#!/usr/bin/env node

process.env.NODE_ENV = 'production';

const { spawn, execSync } = await import('node:child_process');
const fs = await import('node:fs');
const path = await import('node:path');
const http = await import('node:http');
const { fileURLToPath } = await import('node:url');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  console.log(`BDS Panel — 管理面板

用法:
  node panel/index.js                  默认 TUI 模式
  node panel/index.js --cli            CLI 模式: 打印当前模块/服务状态并退出
  node panel/index.js --no-tui         启动服务不进入 TUI
  node panel/index.js --help           显示本帮助

环境变量:
  PANEL_CLI=1        等价于 --cli
  PANEL_NO_TUI=1     等价于 --no-tui
`);
  process.exit(0);
}

const CLI_MODE = argv.includes('--cli') || process.env.PANEL_CLI === '1';
const NO_TUI = argv.includes('--no-tui') || process.env.PANEL_NO_TUI === '1';

function hasTTY() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function httpJson(urlPath, method = 'GET', payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : '';
    const port = parseInt(process.env.DB_PORT || '3001', 10);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: urlPath,
      method,
      timeout: 4000,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('timeout')));
    if (data) req.write(data);
    req.end();
  });
}

async function waitForDb(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await httpJson('/api/health');
      if (r.status === 200) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

function killProc(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${child.pid} /T 2>nul`, { stdio: 'ignore' });
    } else {
      try { child.kill('SIGTERM'); } catch {}
    }
  } catch {}
}

const procs = [];
function trackProc(child) { procs.push(child); return child; }

function startProc(name, scriptPath, extraEnv = {}) {
  const child = spawn(process.execPath, [scriptPath], {
    cwd: ROOT_DIR,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write(`[${name}] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[${name}] ${d}`));
  child.on('exit', (code) => console.log(`[${name}] 已退出 code=${code}`));
  return trackProc(child);
}

function shutdownAll() {
  for (const p of procs) killProc(p);
}

process.on('SIGINT', () => { shutdownAll(); process.exit(130); });
process.on('SIGTERM', () => { shutdownAll(); process.exit(143); });

// ============================================================
//  CLI 模式
// ============================================================
async function runCli() {
  console.log('[cli] 启动 db-server / qq-bridge');
  startProc('db', path.join(ROOT_DIR, 'db-server', 'index.js'));
  startProc('qq', path.join(ROOT_DIR, 'qq-bridge', 'index.js'));

  const ok = await waitForDb();
  if (!ok) {
    console.error('[cli] db-server 不可达');
    shutdownAll();
    process.exit(1);
  }

  try {
    const mods = await httpJson('/api/sfmc/modules');
    console.log(`[cli] 模块 (${mods.body.modules.length}):`);
    for (const m of mods.body.modules.slice(0, 30)) {
      const stt = m.enabled ? '启用' : '禁用';
      console.log(`  ${m.id.padEnd(24)} [${m.type}] ${stt}`);
    }
  } catch {}

  shutdownAll();
  process.exit(0);
}

// ============================================================
//  TUI 模式
// ============================================================
async function runTui() {
  if (!hasTTY()) {
    console.error('[panel] 当前环境不是 TTY（例如管道 / IDE / 子进程）');
    console.error('[panel] 解决: 在交互式终端直接运行，或使用 --cli / --no-tui 标志');
    console.error('[panel] 当前 stdin.isTTY=' + Boolean(process.stdin.isTTY) + ', stdout.isTTY=' + Boolean(process.stdout.isTTY));
    process.exit(2);
  }

  console.log('[panel] 载入 TUI 与服务管理器');
  const { pushLog, mount } = await import('./tui-react.js');
  const { services } = await import('./services/manager.js');

  pushLog('Panel 启动完成');
  await mount({
    onReady: async () => {
      await services.db.start();
      await services.qq.start();
      pushLog('初始化状态正常', 'success');
      return { setupRequired: false };
    },
  });
  shutdownAll();
  process.exit(0);
}

// ============================================================
//  no-tui 模式
// ============================================================
async function runNoTui() {
  startProc('db', path.join(ROOT_DIR, 'db-server', 'index.js'));
  startProc('qq', path.join(ROOT_DIR, 'qq-bridge', 'index.js'));
  const ok = await waitForDb();
  if (!ok) {
    console.error('[panel] db-server 启动超时');
    shutdownAll();
    process.exit(1);
  }
  console.log('[panel] 服务已启动，按 Ctrl+C 退出');
  await new Promise(() => {});
}

// ============================================================
//  入口分发
// ============================================================
if (CLI_MODE) await runCli();
else if (NO_TUI) await runNoTui();
else await runTui();
