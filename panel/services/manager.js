/**
 * services/manager.js — 统一进程管理器 (按模块依赖图启停)
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

function loadCfg(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'configs', name), 'utf-8'));
  } catch { return {}; }
}

function loadJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT_DIR, rel), 'utf-8'));
  } catch { return null; }
}

function isModuleEnabled(id) {
  const dbPort = parseInt(process.env.DB_PORT || loadCfg('db_config.json').db_port || '3001', 10);
  // 直接读 db-server 接口（db 未启动时回退 catalog 默认值）
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port: dbPort, path: `/api/sfmc/modules/catalog`, timeout: 600 }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          const m = (j.modules || []).find((x) => x.id === id);
          resolve(m ? m.defaultEnabled !== false : true);
        } catch { resolve(true); }
      });
    });
    req.on('error', () => {
      const cat = loadJson('modules/catalog.json');
      const m = cat?.modules?.find((x) => x.id === id);
      resolve(m ? m.defaultEnabled !== false : true);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.end();
  });
}

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
        if (opts.validate) {
          try {
            const v = opts.validate();
            if (v) { this.log(`启动失败: ${v}`); resolve(); return; }
          } catch (e) {
            this.log(`校验失败: ${e.message}`);
            resolve();
            return;
          }
        }
        this.log(`启动中...`);
        const child = spawn(opts.cmd, opts.args || [], {
          cwd: opts.cwd || ROOT_DIR,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: opts.shell || false,
        });
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
          if (!isManualStop && opts.autoRestart) {
            setTimeout(() => svc.start(), opts.restartDelay || 5000);
          }
          proc = null;
        });
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
    restart() { return this.stop().then(() => this.start()); },
    send(cmd) {
      if (proc && proc.stdin) { proc.stdin.write(cmd + '\n'); return true; }
      return false;
    },
    log(msg) { events.emit('output', `[${this.title}] ${msg}`); },
  };
  return svc;
}

const cfg = loadCfg('bds_updater.json');
const qqCfg = loadCfg('qq_config.json');

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
      if (!fs.existsSync(exe)) return `找不到 bedrock_server.exe (${cwd})，请检查 bds_updater.json 的 bds_path`;
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
    validate: () => null,
  }),
  db: createService('db', {
    title: 'DB Server',
    cmd: 'node',
    args: ['db-server/index.js'],
    cwd: ROOT_DIR,
    autoRestart: true,
    restartDelay: 3000,
    validate: () => null,
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

const START_ORDER = ['db', 'qq', 'llbot', 'bds'];
const STOP_ORDER = [...START_ORDER].reverse();

async function startAll() {
  for (const name of START_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    svc.log('准备启动...');
    try { await svc.start(); } catch (e) { svc.log(`启动异常: ${e.message}`); }
  }
}

async function stopAll() {
  for (const name of STOP_ORDER) {
    const svc = services[name];
    if (!svc) continue;
    if (svc.running) await svc.stop();
  }
}

export { services, startAll, stopAll };