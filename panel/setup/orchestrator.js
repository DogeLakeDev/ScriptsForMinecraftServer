/**
 * setup/orchestrator.js — 初始化向导的业务逻辑编排
 *
 * - detect()           是否需要展示 setup 窗口
 * - runChecks(payload)  调 db-server /setup/check
 * - submit(payload)     调 db-server /setup/init，写 panel-state 并应用
 * - reset()            回滚到最近一次 init 备份
 * - import(path)       从指定 panel-state.json 快速恢复
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { STATE_PATH, DEFAULT_STATE, loadState, saveState, markInitialized, resetState, backupFile } from './state.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const DB_HOST = '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3001', 10);

function dbRequest(pathName, method = 'GET', payload) {
  return new Promise((resolve, reject) => {
    const data = payload ? JSON.stringify(payload) : '';
    const req = http.request({
      hostname: DB_HOST,
      port: DB_PORT,
      path: pathName,
      method,
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

export async function detect() {
  const local = loadState();
  if (local._initialized) return { needsSetup: false, reason: 'already_initialized' };
  try {
    const r = await dbRequest('/api/sfmc/setup/state');
    if (r.status === 200) {
      return { needsSetup: !r.body.initialized, state: r.body.state };
    }
    return { needsSetup: true, reason: 'db_unreachable' };
  } catch (e) {
    return { needsSetup: true, reason: 'db_offline', error: e.message };
  }
}

export async function runChecks(payload) {
  try {
    const r = await dbRequest('/api/sfmc/setup/check', 'POST', payload);
    if (r.status === 200) return { ok: true, checks: r.body.checks || [] };
    return { ok: false, error: r.body.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function submit(payload) {
  try {
    const r = await dbRequest('/api/sfmc/setup/init', 'POST', payload);
    if (r.status === 200) {
      // 同步本地 panel-state（避免双源）
      const local = markInitialized(r.body.state || DEFAULT_STATE);
      return { ok: true, state: local, written: r.body.written || [] };
    }
    return { ok: false, error: r.body.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function reset() {
  try {
    const r = await dbRequest('/api/sfmc/setup/reset', 'POST', {});
    if (r.status === 200) {
      const local = resetState();
      return { ok: true, state: local, restored: r.body.restored || [] };
    }
    return { ok: false, error: r.body.error || `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function importState(importPath) {
  try {
    const raw = fs.readFileSync(importPath, 'utf-8');
    const data = JSON.parse(raw);
    backupFile(STATE_PATH, 'import-state');
    saveState(data);
    return await submit({ state: data, paths: data.paths, tokens: data.tokens, ui: data.ui, locale: data.locale });
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export const SETUP_VERSION = 1;
export { STATE_PATH };