/**
 * panel-state.js — 项目级首次安装状态
 *
 * 文件: panel-state.json (项目根)
 *
 * 字段:
 *  - version: 1
 *  - _initialized: 是否已经完成初始化向导
 *  - _initializedAt: 完成时间戳
 *  - owner: 管理员标识 (自由文本)
 *  - ui: { defaultModules, defaultServices, skipGuidedSetup }
 *  - tokens: { dbAuthToken, bridgeAuthToken } (敏感，写盘时仅保留指针)
 *  - paths: { bdsPath, llbotPath, llbotCwd, dbPort }
 *  - locale: 'zh-CN' | 'en'
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..', '..');
export const STATE_PATH = path.join(ROOT_DIR, 'panel-state.json');
export const BACKUP_DIR = path.join(ROOT_DIR, 'configs', '.backup');

export const DEFAULT_STATE = {
  version: 1,
  _initialized: false,
  _initializedAt: null,
  owner: '',
  ui: {
    defaultModules: ['money', 'chat', 'afk', 'shop', 'land', 'tps'],
    defaultServices: ['db', 'qq'],
    skipGuidedSetup: false,
  },
  tokens: {
    dbAuthToken: '',
    bridgeAuthToken: '',
  },
  paths: {
    bdsPath: 'D:\\Minecraft\\BEServer',
    llbotPath: 'D:\\LLBot-CLI-win-x64\\llbot.exe',
    llbotCwd: 'D:\\LLBot-CLI-win-x64',
    dbPort: 3001,
  },
  locale: 'zh-CN',
};

export function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return mergeState(DEFAULT_STATE, data);
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state, opts = {}) {
  const dir = path.dirname(STATE_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const next = JSON.stringify(state, null, 2) + '\n';
  if (opts.backup && fs.existsSync(STATE_PATH)) {
    backupFile(STATE_PATH, 'panel-state');
  }
  fs.writeFileSync(STATE_PATH + '.tmp', next);
  fs.renameSync(STATE_PATH + '.tmp', STATE_PATH);
}

export function isInitialized(state = loadState()) {
  return !!state._initialized;
}

export function markInitialized(state) {
  const next = { ...state, _initialized: true, _initializedAt: Date.now() };
  saveState(next, { backup: true });
  return next;
}

export function resetState() {
  saveState({ ...DEFAULT_STATE }, { backup: true });
  return loadState();
}

export function backupFile(filePath, tag = 'pre-init') {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `${tag}-${stamp}`);
  fs.mkdirSync(dest, { recursive: true });
  const target = path.join(dest, path.basename(filePath));
  fs.copyFileSync(filePath, target);
  return target;
}

function mergeState(base, override) {
  const out = { ...base };
  for (const k of Object.keys(override || {})) {
    if (override[k] && typeof override[k] === 'object' && !Array.isArray(override[k]) && base[k] && typeof base[k] === 'object') {
      out[k] = mergeState(base[k], override[k]);
    } else {
      out[k] = override[k];
    }
  }
  return out;
}