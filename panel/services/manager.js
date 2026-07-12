/**
 * 统一进程管理器 — BDS / QQ Bridge / DB Server
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function loadCfg(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'configs', name), 'utf-8'));
  } catch { return {}; }
}

// ── 服务工厂 ──

function createService(name, opts) {
  let proc = null;
  let isManualStop = false;
  const events = new EventEmitter();
  events.setMaxListeners(100);

  const svc = {
    name,
    title: opts.title || name,
    pid: 0,
    running: false,
    events,

    start() {
      return new Promise((resolve) => {
        if (proc) { resolve(); return; }

        // D2: 启动前校验
        if (opts.validate) {
          const v = opts.validate();
          if (v) { this.log(`启动失败: ${v}`); resolve(); return; }
        }

        this.log(`启动中...`);

        const child = spawn(opts.cmd, opts.args || [], {
          cwd: opts.cwd || ROOT_DIR,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: opts.shell || false,
        });

        // spawn 后立即检查 — spawn 在 ENOENT 时不会 throw, 会发 'error' 事件
        child.once('error', (e) => {
          this.log(`启动失败: ${e.message}`);
          if (proc === child) { proc = null; this.pid = 0; this.running = false; }
          resolve();
        });

        proc = child;
        this.pid = child.pid || 0;
        this.running = true;
        isManualStop = false;

        child.stdout.on('data', (d) => events.emit('output', d.toString(), 'info'));
        child.stderr.on('data', (d) => events.emit('output', d.toString(), 'error'));

        child.on('exit', (code) => {
          this.running = false;
          this.pid = 0;
          this.log(`已退出 (code: ${code})`);
          this._proc = null;
          if (!isManualStop && opts.autoRestart !== false && child._allowRestart) {
            setTimeout(() => svc.start(), opts.restartDelay || 5000);
          }
          proc = null;
        });

        // 等待进程就绪
        setTimeout(() => resolve(), 500);
      });
    },

    stop() {
      return new Promise((resolve) => {
        if (!proc) { resolve(); return; }
        isManualStop = true;
        this.log('正在停止...');

        if (name === 'bds') {
          proc.stdin.write('stop\n');
        } else {
          proc.kill('SIGTERM');
        }

        const timeout = setTimeout(() => {
          if (proc) {
            this.log('超时，强制终止');
            try { proc.kill('SIGKILL'); } catch {}
          }
        }, opts.stopTimeout || 10000);

        proc.on('exit', () => {
          clearTimeout(timeout);
          proc = null;
          this.running = false;
          this.pid = 0;
          resolve();
        });
      });
    },

    restart() {
      return this.stop().then(() => this.start());
    },

    send(cmd) {
      if (proc && proc.stdin) {
        proc.stdin.write(cmd + '\n');
        return true;
      }
      return false;
    },

    log(msg) {
      events.emit('output', `[${this.title}] ${msg}`);
    },

    _proc: null,
  };

  return svc;
}

// ── 服务初始化 ──

const cfg = loadCfg('bds_updater.json');
const qqCfg = loadCfg('qq_config.json');

function isModuleEnabled(name) {
  try {
    const raw = fs.readFileSync(path.join(ROOT_DIR, 'configs', 'modules.json'), 'utf-8');
    const d = JSON.parse(raw);
    return d.modules?.[name] !== false;
  } catch { return true; }
}

const services = {
  bds: createService('bds', {
    title: 'BDS',
    cmd: 'bedrock_server.exe',
    cwd: path.resolve(cfg.bds_path || path.join(ROOT_DIR, '..')),
    stopTimeout: 30000,
    autoRestart: cfg.crash_restart !== false,
    restartDelay: (cfg.crash_restart_delay || 5) * 1000,
    validate: () => {
      const cwd = path.resolve(cfg.bds_path || path.join(ROOT_DIR, '..'));
      const exe = path.join(cwd, 'bedrock_server.exe');
      if (!fs.existsSync(exe)) {
        return `找不到 bedrock_server.exe (${cwd})，请检查 bds_updater.json 的 bds_path`;
      }
      return null;
    },
  }),

  qq: createService('qq', {
    title: 'QQ Bridge',
    cmd: 'node',
    args: ['qq-bridge/index.js'],
    cwd: ROOT_DIR,
    autoRestart: true,
    restartDelay: 3000,
    validate: () => {
      if (!isModuleEnabled('qq_bridge')) return 'QQ Bridge 模块已禁用 (qq_bridge=false)';
      return null;
    },
  }),

  db: createService('db', {
    title: 'DB Server',
    cmd: 'node',
    args: ['db-server/index.js'],
    cwd: ROOT_DIR,
    autoRestart: true,
    restartDelay: 3000,
  }),

  llbot: createService('llbot', {
    title: 'LLBot',
    cmd: qqCfg.llbot_path || 'D:\\LLBot-CLI-win-x64\\llbot.exe',
    args: [],
    cwd: qqCfg.llbot_cwd || 'D:\\LLBot-CLI-win-x64',
    autoRestart: true,
    restartDelay: 5000,
    validate: () => {
      const exe = qqCfg.llbot_path || 'D:\\LLBot-CLI-win-x64\\llbot.exe';
      if (!qqCfg.llbot_enabled) return 'LLBot 管理已禁用 (llbot_enabled=false)';
      if (!fs.existsSync(exe)) return `找不到 ${exe}`;
      return null;
    },
  }),
};

// ── 工具 ──

function healthCheck(serviceName) {
  const svc = services[serviceName];
  return svc.running;
}

async function startAll() {
  for (const [name, svc] of Object.entries(services)) {
    svc.log('准备启动...');
  }
  await Promise.all([
    services.db.start(),
    services.qq.start(),
  ]);
}

async function stopAll() {
  for (const svc of Object.values(services)) {
    if (svc.running) await svc.stop();
  }
}

export { services, startAll, stopAll, healthCheck };
