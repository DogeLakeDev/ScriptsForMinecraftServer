#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = 3191;
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'sfmc-db-api-'));
const dbPath = path.join(workspace, 'sfmc_data.db');

function copy(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function request(method, pathname, payload) {
  return new Promise((resolve, reject) => {
    const data = payload === undefined ? null : JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        let body = {};
        try { body = JSON.parse(text); } catch {}
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const result = await request('GET', '/api/health');
      if (result.status === 200) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('db-server 启动超时');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`[db-api] PASS: ${message}`);
}

async function main() {
  copy(path.join(ROOT, 'modules', 'catalog.json'), path.join(workspace, 'modules', 'catalog.json'));
  copy(path.join(ROOT, 'modules', 'module-lock.json'), path.join(workspace, 'modules', 'module-lock.json'));
  fs.mkdirSync(path.join(workspace, 'configs'), { recursive: true });
  fs.writeFileSync(path.join(workspace, 'configs', 'db_config.json'), JSON.stringify({ db_port: PORT }) + '\n');

  const child = spawn(process.execPath, [path.join(ROOT, 'db-server', 'index.js')], {
    cwd: ROOT,
    env: { ...process.env, SFMC_ROOT: workspace, SFMC_DB_PATH: dbPath, SFMC_MODULES_DIR: path.join(workspace, 'modules'), DB_PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await waitForServer();
    const health = await request('GET', '/api/health');
    assert(health.body.status === 'ok', 'health 路由返回 ok');

    const catalog = await request('GET', '/api/sfmc/modules/catalog');
    assert(catalog.status === 200 && catalog.body.modules.length === 29, '模块 catalog 路由返回 29 个模块');
    const modules = await request('GET', '/api/sfmc/modules');
    assert(modules.status === 200 && modules.body.modules.length === catalog.body.modules.length, '模块列表与 catalog 数量一致');

    const state = await request('GET', '/api/sfmc/setup/state');
    assert(state.status === 200 && typeof state.body.initialized === 'boolean', 'setup state 路由返回 initialized');
    const checks = await request('POST', '/api/sfmc/setup/check', { db: { port: PORT } });
    assert(checks.status === 200 && Array.isArray(checks.body.checks), 'setup check 路由返回 checks');

    const setting = await request('PUT', '/api/sfmc/settings/integration_test', { value: 'ok' });
    assert(setting.status === 200 && setting.body.success === true, 'settings PUT 路由成功');
    const settingRead = await request('GET', '/api/sfmc/settings/integration_test');
    assert(settingRead.status === 200 && settingRead.body.value === 'ok', 'settings GET 路由返回写入值');
    const updated = await request('GET', '/api/sfmc/configs/updated-since/0');
    assert(updated.status === 200 && updated.body.updated.settings, 'configs updated-since 路由返回 settings');

    const invalidImport = await request('POST', '/api/sfmc/configs/import', { table: 'unknown', rows: [{ value: 1 }] });
    assert(invalidImport.status === 400 && invalidImport.body.error === 'unknown_table', 'configs import 拒绝未知表');
    const missing = await request('GET', '/api/does-not-exist');
    assert(missing.status === 404 && missing.body.error === 'not_found', '未知路由返回 404');

    const land = { ownerId: 'player-1', ownerName: 'PlayerOne', dimid: 0, posA: { x: 0, y: 60, z: 0 }, posB: { x: 4, y: 70, z: 4 } };
    const created = await request('POST', '/api/sfmc/lands', land);
    assert(created.status === 200 && created.body.land?.ownerplid === 'player-1', '土地创建并持久化');
    const overlap = await request('POST', '/api/sfmc/lands', { ...land, ownerId: 'player-2', ownerName: 'PlayerTwo' });
    assert(overlap.status === 409 && overlap.body.error === 'overlap', '土地重叠检查拒绝冲突范围');
    const at = await request('GET', '/api/sfmc/lands/at/0/2/65/2');
    assert(at.status === 200 && at.body.land.id === created.body.land.id, '按坐标查询土地');
    const changed = await request('PATCH', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { nickname: 'Home' });
    assert(changed.status === 200 && changed.body.land.nickname === 'Home' && changed.body.land.version > 1, '土地更新递增版本');
    const deleted = await request('DELETE', `/api/sfmc/lands/${encodeURIComponent(created.body.land.id)}`, { actorId: 'player-1' });
    assert(deleted.status === 200 && deleted.body.refund > 0, '土地软删除并返回退款');
    console.log('[db-api] 全部通过');
  } finally {
    child.kill();
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch {}
    if (stderr && /启动失败/.test(stderr)) process.stderr.write(stderr);
  }
}

main().catch((error) => {
  console.error(`[db-api] ERROR: ${error.message}`);
  process.exitCode = 1;
});
