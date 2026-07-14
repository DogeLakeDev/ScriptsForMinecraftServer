/**
 * DogeChat 数据库服务 — HTTP REST API
 * SQLite + Node.js http
 */

const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { assertNodeVersion } = require('./lib/runtime');
const { quoteIdentifier } = require('./lib/identifiers');
const { loadModuleLock: readModuleLock, saveModuleLock: writeModuleLock, getModuleState, isInstalled, isEnabled, updateModuleState } = require('./lib/module-state');
if (!assertNodeVersion(22, 5)) process.exit(2);
const { openDatabase, createQuery } = require('./lib/sqlite');
const { readJsonFile, writeJsonFile } = require('./lib/json');
const { createModuleRoutes } = require('./routes/modules');
const { createConfigRoutes } = require('./routes/config');

// 加载外部配置 JSON（覆盖 process.env）
const PROJECT_ROOT = process.env.SFMC_ROOT || path.join(__dirname, '..');
const dbcfgPath = path.join(PROJECT_ROOT, 'configs', 'db_config.json');
const qqcfgPath = path.join(PROJECT_ROOT, 'configs', 'qq_config.json');
let dbconfig = {};
let qqconfig = {};
try {
  dbconfig = JSON.parse(fs.readFileSync(dbcfgPath, 'utf-8'));
  qqconfig = JSON.parse(fs.readFileSync(qqcfgPath, 'utf-8'));
  for (const [k, v] of Object.entries(dbconfig)) {
    const envKey = k.replace(/([A-Z])/g, '_$1').toUpperCase();
    process.env[envKey] = String(v);
    console.info(`[DogeDB] 配置 ${k} -> process.env.${envKey} = ${v}`);
  }
} catch (err) {
  console.error('[DogeDB] 加载配置文件失败:', err.message);
  process.exit(1);
}

const PORT = parseInt(dbconfig.db_port || '3001', 10);
const HOST = '127.0.0.1';
const DB_PATH = path.join(__dirname, dbconfig.dbDir) || path.join(__dirname, './data/sfmc_data.db');
console.log(DB_PATH)
const QQ_BRIDGE_HOST = '127.0.0.1';
const QQ_BRIDGE_PORT = parseInt(qqconfig.qq_http_port || '3003', 10);
const AUTH_TOKEN = dbconfig.http_auth || '';
const MODULES_DIR = path.resolve(__dirname, dbconfig.modulesDir) || path.join(PROJECT_ROOT, 'modules');
const MODULE_CATALOG_PATH = path.join(MODULES_DIR, 'catalog.json');
const MODULE_LOCK_PATH = path.join(MODULES_DIR, 'module-lock.json');

let moduleRoutes;
let configRoutes;

let db;

// 监控面板内存存储（SAPI 上报，Panel 拉取）
let _monitorMetrics = null;
let _monitorPlayers = [];

function normalizeModuleEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw.entry && typeof raw.entry === 'object' ? raw.entry : {};
  const id = String(raw.id || '').trim();
  const configKey = String(raw.configKey || raw.config_key || '').trim();
  const name = String(raw.name || '').trim();
  if (!id || !configKey) return null;
  return {
    id,
    configKey,
    name: name || configKey,
    type: String(raw.type || 'feature'),
    description: String(raw.description || ''),
    defaultEnabled: raw.defaultEnabled !== false,
    defaultInstalled: raw.defaultInstalled !== false,
    canDisable: raw.canDisable !== false,
    canUninstall: raw.canUninstall !== false,
    requires: Array.isArray(raw.requires) ? raw.requires.filter(Boolean).map((s) => String(s)) : [],
    optional: Array.isArray(raw.optional) ? raw.optional.filter(Boolean).map((s) => String(s)) : [],
    commands: Array.isArray(raw.commands) ? raw.commands.filter(Boolean).map((s) => String(s)) : [],
    entry: {
      kind: String(entry.kind || ''),
      path: String(entry.path || ''),
      init: String(entry.init || ''),
    },
  };
}

function loadModuleCatalog() {
  const data = readJsonFile(MODULE_CATALOG_PATH, { version: 1, modules: [] });
  const modules = Array.isArray(data.modules) ? data.modules : [];
  return modules.map(normalizeModuleEntry).filter(Boolean);
}

function loadModuleLock() {
  return readModuleLock(MODULE_LOCK_PATH);
}

function saveModuleLock(lock) {
  writeModuleLock(MODULE_LOCK_PATH, lock);
}

function buildModuleList() {
  const catalog = loadModuleCatalog();
  const lock = loadModuleLock();
  const enabledMap = new Map();
  const seenKeys = new Set();
  const rows = catalog.map((module) => {
    seenKeys.add(module.configKey);
    const state = lock.modules[module.id] || {};
    const moduleFiles = [module.entry?.path, ...(Array.isArray(module.files) ? module.files : [])].filter(Boolean);
    const filesPresent = moduleFiles.length === 0 || moduleFiles.every((file) => fs.existsSync(path.join(PROJECT_ROOT, file)));
    const enabled = isEnabled(lock, module.id, module.defaultEnabled);
    return {
      id: module.id,
      module_id: module.id,
      name: module.configKey,
      config_key: module.configKey,
      display_name: module.name,
      type: module.type,
      description: module.description,
      default_enabled: module.defaultEnabled,
      default_installed: module.defaultInstalled,
      can_disable: module.canDisable,
      can_uninstall: module.canUninstall,
      requires: module.requires,
      optional: module.optional,
      commands: module.commands,
      entry: module.entry,
       installed: state.installed !== undefined ? !!state.installed : false,
       install_source: state.installed !== undefined ? 'module-lock' : 'missing-lock-state',
      files_present: filesPresent,
      installed_at: state.installedAt || null,
      updated_at: state.updatedAt || null,
       enabled: !!enabled,
    };
  });
  return rows;
}

function resolveModuleByKey(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return null;
  const catalog = loadModuleCatalog();
  const found = catalog.find((module) => module.id === normalized || module.configKey === normalized);
  if (found) return found;
  return null;
}

function getModuleInstalled(module) {
  if (!module) return true;
  const lock = loadModuleLock();
  const state = lock.modules[module.id];
  return isInstalled(lock, module.id, false);
}

function getModuleEnabled(module) {
  if (!module) return true;
  return isEnabled(loadModuleLock(), module.id, module.defaultEnabled !== false);
}

function checkEnableDeps(module) {
  const catalog = loadModuleCatalog();
  const depModules = (module.requires || []).map((id) => catalog.find((m) => m.id === id)).filter(Boolean);
  const missing = [];
  for (const dep of depModules) {
    if (!getModuleInstalled(dep)) missing.push({ id: dep.id, reason: 'not_installed' });
    else if (!getModuleEnabled(dep)) missing.push({ id: dep.id, reason: 'disabled' });
  }
  return missing;
}

function checkInstallDeps(module) {
  const catalog = loadModuleCatalog();
  const depModules = (module.requires || []).map((id) => catalog.find((m) => m.id === id)).filter(Boolean);
  const missing = [];
  for (const dep of depModules) {
    if (!getModuleInstalled(dep)) missing.push({ id: dep.id, reason: 'not_installed' });
  }
  return missing;
}

function checkReverseDeps(module) {
  const catalog = loadModuleCatalog();
  const dependents = catalog.filter((m) => (m.requires || []).includes(module.id));
  const installedDependents = [];
  for (const dep of dependents) {
    if (getModuleInstalled(dep)) installedDependents.push(dep.id);
  }
  return installedDependents;
}

// ============================================================
//  初始化向导 — 首次安装配置
// ============================================================

const ROOT_DIR = PROJECT_ROOT;
const STATE_PATH = path.join(PROJECT_ROOT, 'panel-state.json');
const CFG_DIR = path.join(PROJECT_ROOT, 'configs');
const BACKUP_DIR = path.join(CFG_DIR, '.backup');

/**
 *
 *
 * @return {*} 
 */
function loadPanelState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return {
      version: 1,
      _initialized: false,
      ui: { defaultModules: ['money', 'chat', 'afk', 'land', 'tps'], defaultServices: ['db', 'qq'], skipGuidedSetup: false },
      tokens: { dbAuthToken: '', bridgeAuthToken: '' },
      paths: { bdsPath: 'D:\\BEServer', llbotPath: 'D:\\LLBot-CLI-win-x64\\llbot.exe', llbotCwd: 'D:\\LLBot-CLI-win-x64', dbPort: 3001 },
      locale: 'zh-CN',
    };
  }
}

/**
 *
 *
 * @param {*} filePath
 * @param {*} value
 */
function saveJsonAtomic(filePath, value) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  fs.renameSync(tmp, filePath);
}

/**
 *
 *
 * @param {*} filePath
 * @return {*} 
 */
function backupConfigFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(BACKUP_DIR, `init-${stamp}`, path.basename(filePath));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(filePath, dest);
  return dest;
}

function loadJsonConfig(filePath, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')); }
  catch { return fallback; }
}

function runSetupChecks(payload) {
  const checks = [];
  const db = payload.db || {};
  const bds = payload.bds || {};
  const qq = payload.qq || {};

  if (db.port) {
    const port = parseInt(db.port, 10);
    checks.push({ id: 'db.port', ok: port > 0 && port < 65536, label: `DB 端口 ${port} 合法` });
  }
  if (bds.path) {
    const exists = fs.existsSync(path.join(bds.path, 'bedrock_server.exe'));
    checks.push({ id: 'bds.path', ok: exists, label: `BDS 可执行文件 ${exists ? '存在' : '缺失: ' + path.join(bds.path, 'bedrock_server.exe')}` });
  }
  if (qq.llbot_path) {
    const exists = fs.existsSync(qq.llbot_path);
    checks.push({ id: 'qq.llbot_path', ok: exists, label: `LLBot 可执行文件 ${exists ? '存在' : '缺失: ' + qq.llbot_path}` });
  }
  if (qq.llbot_cwd) {
    const exists = fs.existsSync(qq.llbot_cwd);
    checks.push({ id: 'qq.llbot_cwd', ok: exists, label: `LLBot 工作目录 ${exists ? '存在' : '缺失: ' + qq.llbot_cwd}` });
  }
  if (qq.bridge_auth_token) {
    checks.push({ id: 'qq.bridge_auth_token', ok: qq.bridge_auth_token.length >= 8, label: `Bridge Token 长度合法 (${qq.bridge_auth_token.length})` });
  }
  return checks;
}

function applyInitPayload(payload) {
  const written = [];
  const state = loadPanelState();

  // 1. 备份现有 configs
  for (const f of ['db_config.json', 'bds_updater.json', 'qq_config.json']) {
    backupConfigFile(path.join(CFG_DIR, f));
  }

  // 2. 写 panel-state.json
  if (payload.state) {
    Object.assign(state, payload.state);
  }
  if (payload.paths) state.paths = { ...state.paths, ...payload.paths };
  if (payload.tokens) state.tokens = { ...state.tokens, ...payload.tokens };
  if (payload.ui) state.ui = { ...state.ui, ...payload.ui };
  if (payload.locale) state.locale = payload.locale;
  state._initialized = true;
  state._initializedAt = Date.now();
  saveJsonAtomic(STATE_PATH, state);
  written.push('panel-state.json');

  // 3. 写 configs/db_config.json
  if (payload.db) {
    const cfg = loadJsonConfig(path.join(CFG_DIR, 'db_config.json'), {});
    Object.assign(cfg, payload.db);
    saveJsonAtomic(path.join(CFG_DIR, 'db_config.json'), cfg);
    written.push('configs/db_config.json');
  }

  // 4. 写 configs/bds_updater.json
  if (payload.bds) {
    const cfg = loadJsonConfig(path.join(CFG_DIR, 'bds_updater.json'), {});
    if (payload.bds.path) cfg.bds_path = payload.bds.path;
    if (payload.bds.backup_dir) cfg.backup_dir = payload.bds.backup_dir;
    saveJsonAtomic(path.join(CFG_DIR, 'bds_updater.json'), cfg);
    written.push('configs/bds_updater.json');
  }

  // 5. 写 configs/qq_config.json
  if (payload.qq) {
    const cfg = loadJsonConfig(path.join(CFG_DIR, 'qq_config.json'), {});
    Object.assign(cfg, payload.qq);
    saveJsonAtomic(path.join(CFG_DIR, 'qq_config.json'), cfg);
    written.push('configs/qq_config.json');
  }

  // 6. 写 modules/module-lock.json
  {
    const lock = loadModuleLock();
    const now = Date.now();
    const cat = loadModuleCatalog();
    const catByKey = new Map(cat.map((m) => [m.configKey, m]));
    const requested = new Set([
      ...(payload.installedModules || []),
      ...(payload.ui?.defaultModules || []),
      ...(payload.ui?.defaultServices || []),
    ]);
    const enabled = new Set([
      ...(payload.ui?.defaultModules || state.ui?.defaultModules || []),
      ...(payload.ui?.defaultServices || state.ui?.defaultServices || []),
    ]);
    for (const mod of cat) {
      const key = mod.configKey;
      const previous = getModuleState(lock, mod.id);
      updateModuleState(lock, mod.id, {
        installed: requested.has(key) || previous.installed === true,
        enabled: enabled.has(key),
      });
    }
    saveModuleLock(lock);
    written.push('modules/module-lock.json');
  }

  // 8. 触发 reload 信号
  query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?, ?, ?)', ['_reload_signal', String(Date.now()), Date.now()]);

  return { state, written };
}

function applyInitReset(payload) {
  const restored = [];

  const stamps = fs.existsSync(BACKUP_DIR) ? fs.readdirSync(BACKUP_DIR).filter((d) => d.startsWith('init-')).sort().reverse() : [];
  if (stamps.length > 0) {
    const latest = stamps[0];
    const dir = path.join(BACKUP_DIR, latest);
    for (const name of fs.readdirSync(dir)) {
      const target = path.join(CFG_DIR, name);
      if (name.endsWith('.json')) {
        fs.copyFileSync(path.join(dir, name), target);
        restored.push(`configs/${name}`);
      }
    }
  }
  // 重置 panel-state.json
  const state = loadPanelState();
  state._initialized = false;
  state._initializedAt = null;
  saveJsonAtomic(STATE_PATH, state);
  query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?, ?, ?)', ['_reload_signal', String(Date.now()), Date.now()]);
  return { state, restored };
}

function setModuleEnabled(module, enabled) {
  if (enabled && module.requires && module.requires.length > 0) {
    const unmet = checkEnableDeps(module);
    if (unmet.length > 0) {
      const err = new Error('dependency_unmet');
      err.code = 'dependency_unmet';
      err.unmet = unmet;
      throw err;
    }
  }
  const lock = loadModuleLock();
  updateModuleState(lock, module.id, { enabled: !!enabled });
  saveModuleLock(lock);
}

function setModuleInstalled(module, installed) {
  if (installed && module.requires && module.requires.length > 0) {
    const unmet = checkInstallDeps(module);
    if (unmet.length > 0) {
      const err = new Error('dependency_unmet');
      err.code = 'dependency_unmet';
      err.unmet = unmet;
      throw err;
    }
  }
  if (!installed) {
    const dependents = checkReverseDeps(module);
    if (dependents.length > 0) {
      const err = new Error('dependency_required');
      err.code = 'dependency_required';
      err.requiredBy = dependents;
      throw err;
    }
  }
  const lock = loadModuleLock();
  updateModuleState(lock, module.id, { installed: !!installed });
  saveModuleLock(lock);
  if (!installed) {
    setModuleEnabled(module, false);
  }
}

// ---------- 数据库初始化 ----------

async function initDB() {
  db = openDatabase(DB_PATH);
  query = createQuery(db);

  db.exec(`
    -- 世界数据
    CREATE TABLE IF NOT EXISTS sfmc_world (
      allow_cheats INTEGER NOT NULL DEFAULT 0,
      game_rules TEXT NOT NULL DEFAULT '',
      seed TEXT DEFAULT '',
      default_spawn_location TEXT NOT NULL DEFAULT '',
      difficulty TEXT NOT NULL DEFAULT '',
      day INTEGER NOT NULL DEFAULT 0,
      ticking_areas_count INTEGER DEFAULT 0,
      absolute_time INTEGER NOT NULL DEFAULT 0,
      structures_from_addon TEXT DEFAULT '',
      structures_from_world TEXT DEFAULT '',
      dynamic_property_total_byte_count INTEGER DEFAULT 0,
      moon_phase INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT ''
    );

    -- 玩家数据
    CREATE TABLE IF NOT EXISTS sfmc_players (
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        permission INTEGER DEFAULT 0,
        client_system_info_local TEXT DEFAULT '',
        client_system_info_maxRenderDistance INTEGER DEFAULT 0,
        client_system_info_memoryTier_level TEXT DEFAULT '',
        client_system_info_PlatformType TEXT DEFAULT '',
        graphicsMode TEXT DEFAULT '',
        dynamicPropertyTotalByteCount INTEGER DEFAULT 0,
        ping INTEGER DEFAULT 0,
        spawnPoint TEXT DEFAULT '',
        tags TEXT DEFAULT '',
        level INTEGER DEFAULT 0,
        totalXp INTEGER DEFAULT 0,
        afk_step INTEGER DEFAULT 0,
        afk_last_location TEXT DEFAULT '',
        onlinetime_session INTEGER DEFAULT 0,
        onlinetime_today INTEGER DEFAULT 0,
        onlinetime_month INTEGER DEFAULT 0,
        onlinetime_total INTEGER DEFAULT 0,
        onlinetime_last_date INTEGER DEFAULT 0,
        onlinetime_last_month INTEGER DEFAULT 0,
        active_channel TEXT NOT NULL DEFAULT '',
        subscribed_channels TEXT DEFAULT '',
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (id, name)
      );
      CREATE INDEX IF NOT EXISTS idx_players_id ON sfmc_players(id);
      CREATE INDEX IF NOT EXISTS idx_players_name ON sfmc_players(name);

      -- 计分板数据
      CREATE TABLE IF NOT EXISTS sfmc_scoreboards (
        objective_id      TEXT NOT NULL,
        objective_display TEXT NOT NULL DEFAULT '',
        participants  TEXT DEFAULT '',
        updated_at        INTEGER NOT NULL,
        PRIMARY KEY (objective_id)
      );
    `);

    db.exec(`
      -- 行为日志
      CREATE TABLE IF NOT EXISTS sfmc_activities (
        id              TEXT PRIMARY KEY,
        timestamp       INTEGER NOT NULL,
        dimension       TEXT NOT NULL DEFAULT '',
        source_type     TEXT NOT NULL,
        source_id     TEXT DEFAULT '',
        source_name     TEXT NOT NULL DEFAULT '',
        source_x        REAL,
        source_y        REAL,
        source_z        REAL,
        event_type      TEXT NOT NULL,
        target_type     TEXT DEFAULT '',
        target_id     TEXT DEFAULT '',
        target_name     TEXT DEFAULT '',
        target_x        REAL,
        target_y        REAL,
        target_z        REAL,
        detail          TEXT DEFAULT '{}',
        created_at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sfmc_act_source ON sfmc_activities(source_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sfmc_act_event ON sfmc_activities(event_type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_sfmc_act_target ON sfmc_activities(target_id, timestamp);
      `);

    db.exec(`
    -- 聊天频道
    CREATE TABLE IF NOT EXISTS sfmc_chat_channels (
      id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      prefix TEXT NOT NULL,
      owner_id TEXT DEFAULT '',
      created_at INTEGER NOT NULL,
      config_allow_chat INTEGER NOT NULL DEFAULT 1,
      config_slow_mode INTEGER NOT NULL DEFAULT 0,
      config_is_broadcast INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_channels_id ON sfmc_chat_channels(id);
    CREATE INDEX IF NOT EXISTS idx_channels_name ON sfmc_chat_channels(name, created_at ASC);

    -- 聊天信息数据
    CREATE TABLE IF NOT EXISTS sfmc_chat_messages (
      id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      from_id TEXT NOT NULL,
      from_name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'text',
      content TEXT NOT NULL,
      attachment TEXT,
      show_timestamp INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON sfmc_chat_messages(channel_id, created_at ASC);

      -- 聊天红包
      CREATE TABLE IF NOT EXISTS sfmc_chat_redpackets (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        remaining_amount REAL NOT NULL,
        total_count INTEGER NOT NULL,
        remaining_count INTEGER NOT NULL,
        receivers TEXT NOT NULL DEFAULT '[]',
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_redpackets_id ON sfmc_chat_redpackets(id);
      `);

  // 配置表
  db.exec(`
    CREATE TABLE IF NOT EXISTS sfmc_config_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module TEXT NOT NULL,
      name TEXT DEFAULT '',
      dimension TEXT NOT NULL,
      start_x REAL NOT NULL, start_z REAL NOT NULL,
      end_x REAL NOT NULL, end_z REAL NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_peace_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      family TEXT NOT NULL,
      exclude_family TEXT DEFAULT '',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_grids (
      name TEXT PRIMARY KEY,
      start_x INTEGER, start_y INTEGER, start_z INTEGER,
      size_h INTEGER, size_v INTEGER,
      direction INTEGER, face INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_banned_items (
      item_id TEXT PRIMARY KEY,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_clean (
      id INTEGER PRIMARY KEY CHECK(id=1),
      item_max INTEGER NOT NULL DEFAULT 192,
      poll_interval INTEGER NOT NULL DEFAULT 60,
      updated_at INTEGER NOT NULL
    );
  `);
  db.exec("INSERT OR IGNORE INTO sfmc_config_clean(id, item_max, poll_interval, updated_at) VALUES(1, 192, 60, 0)");
  db.exec(`

    CREATE TABLE IF NOT EXISTS sfmc_config_permissions (
      player_name TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_qa_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight INTEGER NOT NULL DEFAULT 1,
      question TEXT NOT NULL,
      answers TEXT NOT NULL,
      msg_right TEXT DEFAULT '',
      msg_wrong TEXT DEFAULT '',
      explanation TEXT DEFAULT '',
      min_rank INTEGER DEFAULT NULL,
      max_rank INTEGER DEFAULT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_qa_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      min_rank INTEGER DEFAULT NULL, max_rank INTEGER DEFAULT NULL,
      type TEXT NOT NULL, amount INTEGER DEFAULT 0,
      item_type TEXT DEFAULT '', item_aux INTEGER DEFAULT 0,
      cmd TEXT DEFAULT '',
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES sfmc_config_qa_questions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_config_qa_punishments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'cmd', cmd TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (question_id) REFERENCES sfmc_config_qa_questions(id) ON DELETE CASCADE
    );
    -- Coop 表
    CREATE TABLE IF NOT EXISTS sfmc_coops (
      cid TEXT PRIMARY KEY,
      name TEXT NOT NULL, owner_player_id TEXT NOT NULL,
      owner_name_snapshot TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active', notice TEXT DEFAULT '',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_members (
      cid TEXT NOT NULL, player_id TEXT NOT NULL,
      player_name_snapshot TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member', joined_at INTEGER NOT NULL,
      expires_at INTEGER, status TEXT NOT NULL DEFAULT 'active',
      version INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (cid, player_id),
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sfmc_one_active_coop_member ON sfmc_coop_members(player_id) WHERE status='active';
    CREATE TABLE IF NOT EXISTS sfmc_coop_invites (
      id TEXT PRIMARY KEY, cid TEXT NOT NULL, inviter_id TEXT NOT NULL,
      invitee_id TEXT NOT NULL, invitee_name_snapshot TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'pending',
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sfmc_coop_invites_target ON sfmc_coop_invites(invitee_id,status,expires_at);
    CREATE TABLE IF NOT EXISTS sfmc_coop_accounts (
      cid TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL DEFAULT 1, updated_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_shop_items (
      id TEXT PRIMARY KEY,
      cid TEXT NOT NULL, name TEXT NOT NULL,
      item_type TEXT NOT NULL, item_aux INTEGER DEFAULT 0,
      item_nbt TEXT DEFAULT '', type INTEGER NOT NULL,
      groups TEXT DEFAULT '[]', des TEXT DEFAULT '',
      num INTEGER DEFAULT 0, sv INTEGER DEFAULT 0,
      money INTEGER DEFAULT 0, is_true INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_bank_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cid TEXT NOT NULL, actor_id TEXT NOT NULL,
      actor_name_snapshot TEXT NOT NULL DEFAULT '', type INTEGER NOT NULL, amount INTEGER NOT NULL,
      note TEXT DEFAULT '', transaction_id TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cid TEXT NOT NULL, actor_id TEXT NOT NULL,
      target_id TEXT NOT NULL DEFAULT '', action TEXT NOT NULL, before_state TEXT NOT NULL DEFAULT '{}',
      after_state TEXT NOT NULL DEFAULT '{}', transaction_id TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL,
      FOREIGN KEY (cid) REFERENCES sfmc_coops(cid) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_coop_shop_groups (
      groupid TEXT PRIMARY KEY,
      displayname TEXT NOT NULL,
      displaydescribe TEXT DEFAULT '',
      icon TEXT DEFAULT '', type_function TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS sfmc_lands (
      id TEXT PRIMARY KEY,
      owner_player_id TEXT NOT NULL,
      owner_name_snapshot TEXT NOT NULL DEFAULT '',
      dimension INTEGER NOT NULL,
      min_x INTEGER NOT NULL, min_y INTEGER NOT NULL, min_z INTEGER NOT NULL,
      max_x INTEGER NOT NULL, max_y INTEGER NOT NULL, max_z INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER,
      protection_profile TEXT NOT NULL DEFAULT '{}', version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sfmc_economy_accounts (
      player_id TEXT PRIMARY KEY,
      player_name_snapshot TEXT NOT NULL DEFAULT '',
      balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
      version INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_economy_transactions (
      id TEXT PRIMARY KEY,
      transaction_type TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      source_player_id TEXT,
      target_player_id TEXT,
      amount INTEGER NOT NULL CHECK(amount > 0),
      balance_before INTEGER,
      balance_after INTEGER,
      reference_type TEXT NOT NULL DEFAULT '',
      reference_id TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sfmc_economy_idempotency (
      actor_id TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      response_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (actor_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS idx_economy_transactions_player ON sfmc_economy_transactions(source_player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_economy_transactions_target ON sfmc_economy_transactions(target_player_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sfmc_lands_owner ON sfmc_lands(owner_player_id, status);
    CREATE INDEX IF NOT EXISTS idx_sfmc_lands_location ON sfmc_lands(dimension, min_x, max_x, min_z, max_z, status);
    CREATE TABLE IF NOT EXISTS sfmc_land_members (
      land_id TEXT NOT NULL, player_id TEXT NOT NULL, player_name_snapshot TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'admin', created_at INTEGER NOT NULL, expires_at INTEGER,
      PRIMARY KEY (land_id, player_id), FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_land_permissions (
      land_id TEXT NOT NULL, permission_key TEXT NOT NULL, subject_type TEXT NOT NULL,
      subject_id TEXT NOT NULL, allowed INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
      PRIMARY KEY (land_id, permission_key, subject_type, subject_id),
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sfmc_land_invites (
      id TEXT PRIMARY KEY, land_id TEXT NOT NULL, inviter_id TEXT NOT NULL, invitee_id TEXT NOT NULL,
      role TEXT NOT NULL, expires_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL,
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sfmc_land_invites_target ON sfmc_land_invites(invitee_id, status, expires_at);
    CREATE TABLE IF NOT EXISTS sfmc_land_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT, land_id TEXT NOT NULL, actor_id TEXT NOT NULL,
      action TEXT NOT NULL, payload TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL,
      FOREIGN KEY (land_id) REFERENCES sfmc_lands(id) ON DELETE CASCADE
    );
  `);
  if (!db.prepare("PRAGMA table_info('sfmc_coops')").all().some((column) => column.name === 'fee_bps')) {
    db.exec("ALTER TABLE sfmc_coops ADD COLUMN fee_bps INTEGER NOT NULL DEFAULT 500");
  }
  const landColumns = db.prepare("PRAGMA table_info('sfmc_lands')").all().map((column) => column.name);
  if (!landColumns.includes('purchase_price')) db.exec("ALTER TABLE sfmc_lands ADD COLUMN purchase_price INTEGER NOT NULL DEFAULT 0");
  if (!landColumns.includes('refund_rate')) db.exec("ALTER TABLE sfmc_lands ADD COLUMN refund_rate REAL NOT NULL DEFAULT 0.7");
  // 从 /configs/ JSON 文件导入初始配置（仅空表时执行）
  {
      const cfgDir = path.join(PROJECT_ROOT, 'configs');
      const now = Date.now();
      const _ = (q, p) => { try { query(q, p); } catch (e) { console.warn('[DogeDB] config:', e.message); } };
      try {
        const s = JSON.parse(fs.readFileSync(path.join(cfgDir, 'settings.json'), 'utf-8'));
        for (const [k, v] of Object.entries(s)) _('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?,?,?)', [k, String(v), now]);
      } catch (e) {}
      try {
        const a = JSON.parse(fs.readFileSync(path.join(cfgDir, 'areas.json'), 'utf-8'));
        for (const r of a) _('INSERT OR REPLACE INTO sfmc_config_areas (module, name, dimension, start_x, start_z, end_x, end_z, updated_at) VALUES (?,?,?,?,?,?,?,?)', [r.module, r.name || '', r.dimension, r.start_x, r.start_z, r.end_x, r.end_z, now]);
      } catch (e) {}
      try {
        const p = JSON.parse(fs.readFileSync(path.join(cfgDir, 'peace_filters.json'), 'utf-8'));
        for (const r of p) _('INSERT OR REPLACE INTO sfmc_config_peace_filters (family, exclude_family, updated_at) VALUES (?,?,?)', [r.family, r.exclude_family || '', now]);
      } catch (e) {}
      try {
        const g = JSON.parse(fs.readFileSync(path.join(cfgDir, 'grids.json'), 'utf-8'));
        for (const r of g) _('INSERT OR REPLACE INTO sfmc_config_grids (name, start_x, start_y, start_z, size_h, size_v, direction, face, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [r.name, r.start_x, r.start_y, r.start_z, r.size_h, r.size_v, r.direction, r.face, now]);
      } catch (e) {}
      try {
        const b = JSON.parse(fs.readFileSync(path.join(cfgDir, 'banned_items.json'), 'utf-8'));
        for (const i of b) _('INSERT OR IGNORE INTO sfmc_config_banned_items (item_id, updated_at) VALUES (?,?)', [i, now]);
      } catch (e) {}
      try {
        const c = JSON.parse(fs.readFileSync(path.join(cfgDir, 'clean.json'), 'utf-8'));
        _('INSERT OR REPLACE INTO sfmc_config_clean (id, item_max, poll_interval, updated_at) VALUES (1,?,?,?)', [c.item_max ?? 192, c.poll_interval ?? 60, now]);
      } catch (e) {}
      try {
        const perm = JSON.parse(fs.readFileSync(path.join(cfgDir, 'permissions.json'), 'utf-8'));
        for (const r of perm) _('INSERT OR REPLACE INTO sfmc_config_permissions (player_name, level, updated_at) VALUES (?,?,?)', [r.player_name, r.level, now]);
      } catch (e) {}
      try {
        const q = JSON.parse(fs.readFileSync(path.join(cfgDir, 'questions.json'), 'utf-8'));
        for (const r of q) {
          const res2 = query('INSERT INTO sfmc_config_qa_questions (weight, question, answers, msg_right, msg_wrong, explanation, min_rank, max_rank, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id', [r.weight ?? 1, r.question, JSON.stringify(r.answers || []), r.msg_right || '', r.msg_wrong || '', r.explanation || '', r.min_rank ?? null, r.max_rank ?? null, now]);
          const qid = res2[0]?.id;
          if (qid && r.rewards) { for (const rw of r.rewards) _('INSERT INTO sfmc_config_qa_rewards (question_id, min_rank, max_rank, type, amount, item_type, item_aux, cmd, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [qid, rw.min_rank ?? null, rw.max_rank ?? null, rw.type, rw.amount ?? 0, rw.item_type || '', rw.item_aux ?? 0, rw.cmd || '', now]); }
          if (qid && r.punishments) { for (const pw of r.punishments) _('INSERT INTO sfmc_config_qa_punishments (question_id, type, cmd, updated_at) VALUES (?,?,?,?)', [qid, pw.type || 'cmd', pw.cmd, now]); }
        }
      } catch (e) {}
      console.log('[DogeDB] 初始配置已从 /configs/ 导入');
  }
  console.log('[DogeDB] 数据库已就绪');
}

/**
 * 从 /configs/ JSON 文件重新导入所有配置到 SQLite（控制台 reload 命令使用）
 * 每次都会重新导入（不检查表是否为空），并更新 updated_at 触发 SAPI 轮询
 */
function reloadConfigsFromJson() {
  const cfgDir = path.join(__dirname, '..', 'configs');
  const now = Date.now();
  const _ = (q, p) => { try { query(q, p); } catch (e) { console.warn('[ConfigReload]', e.message); } };
  const log = (table, count) => console.log(`[ConfigReload] ${table}: ${count}个`);
  try {
    const s = JSON.parse(fs.readFileSync(path.join(cfgDir, 'settings.json'), 'utf-8'));
    let c = 0; for (const [k, v] of Object.entries(s)) { _('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?,?,?)', [k, String(v), now]); c++; } log('settings', c);
  } catch (e) { console.warn('[ConfigReload] settings.json 失败:', e.message); }
  try {
    const a = JSON.parse(fs.readFileSync(path.join(cfgDir, 'areas.json'), 'utf-8'));
    let c = 0; for (const r of a) { _('INSERT OR REPLACE INTO sfmc_config_areas (module, name, dimension, start_x, start_z, end_x, end_z, updated_at) VALUES (?,?,?,?,?,?,?,?)', [r.module, r.name || '', r.dimension, r.start_x, r.start_z, r.end_x, r.end_z, now]); c++; } log('areas', c);
  } catch (e) { console.warn('[ConfigReload] areas.json 失败:', e.message); }
  try {
    const p = JSON.parse(fs.readFileSync(path.join(cfgDir, 'peace_filters.json'), 'utf-8'));
    let c = 0; for (const r of p) { _('INSERT OR REPLACE INTO sfmc_config_peace_filters (family, exclude_family, updated_at) VALUES (?,?,?)', [r.family, r.exclude_family || '', now]); c++; } log('peace_filters', c);
  } catch (e) { console.warn('[ConfigReload] peace_filters.json 失败:', e.message); }
  try {
    const g = JSON.parse(fs.readFileSync(path.join(cfgDir, 'grids.json'), 'utf-8'));
    let c = 0; for (const r of g) { _('INSERT OR REPLACE INTO sfmc_config_grids (name, start_x, start_y, start_z, size_h, size_v, direction, face, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [r.name, r.start_x, r.start_y, r.start_z, r.size_h, r.size_v, r.direction, r.face, now]); c++; } log('grids', c);
  } catch (e) { console.warn('[ConfigReload] grids.json 失败:', e.message); }
  try {
    const b = JSON.parse(fs.readFileSync(path.join(cfgDir, 'banned_items.json'), 'utf-8'));
    let c = 0; for (const i of b) { _('INSERT OR IGNORE INTO sfmc_config_banned_items (item_id, updated_at) VALUES (?,?)', [i, now]); c++; } log('banned_items', c);
  } catch (e) { console.warn('[ConfigReload] banned_items.json 失败:', e.message); }
  try {
    const c = JSON.parse(fs.readFileSync(path.join(cfgDir, 'clean.json'), 'utf-8'));
    _('INSERT OR REPLACE INTO sfmc_config_clean (id, item_max, poll_interval, updated_at) VALUES (1,?,?,?)', [c.item_max ?? 192, c.poll_interval ?? 60, now]);
    log('clean', 1);
  } catch (e) { console.warn('[ConfigReload] clean.json 失败:', e.message); }
  try {
    const perm = JSON.parse(fs.readFileSync(path.join(cfgDir, 'permissions.json'), 'utf-8'));
    let c = 0; for (const r of perm) { _('INSERT OR REPLACE INTO sfmc_config_permissions (player_name, level, updated_at) VALUES (?,?,?)', [r.player_name, r.level, now]); c++; } log('permissions', c);
  } catch (e) { console.warn('[ConfigReload] permissions.json 失败:', e.message); }
  try {
    const q = JSON.parse(fs.readFileSync(path.join(cfgDir, 'questions.json'), 'utf-8'));
    let c = 0; for (const r of q) {
      const res2 = query('INSERT INTO sfmc_config_qa_questions (weight, question, answers, msg_right, msg_wrong, explanation, min_rank, max_rank, updated_at) VALUES (?,?,?,?,?,?,?,?,?) RETURNING id', [r.weight ?? 1, r.question, JSON.stringify(r.answers || []), r.msg_right || '', r.msg_wrong || '', r.explanation || '', r.min_rank ?? null, r.max_rank ?? null, now]);
      const qid = res2[0]?.id;
      if (qid && r.rewards) { for (const rw of r.rewards) _('INSERT INTO sfmc_config_qa_rewards (question_id, min_rank, max_rank, type, amount, item_type, item_aux, cmd, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [qid, rw.min_rank ?? null, rw.max_rank ?? null, rw.type, rw.amount ?? 0, rw.item_type || '', rw.item_aux ?? 0, rw.cmd || '', now]); }
      if (qid && r.punishments) { for (const pw of r.punishments) _('INSERT INTO sfmc_config_qa_punishments (question_id, type, cmd, updated_at) VALUES (?,?,?,?)', [qid, pw.type || 'cmd', pw.cmd, now]); }
      c++;
    }
    log('questions', c);
  } catch (e) { console.warn('[ConfigReload] questions.json 失败:', e.message); }
  // 发送热重载信号，SAPI 端 fastPoll 每 2 秒检查此值
  query('INSERT OR REPLACE INTO sfmc_config_settings (key, value, updated_at) VALUES (?,?,?)', ['_reload_signal', String(now), now]);
  console.log(`[ConfigReload] 已发送热重载信号 (${now})，SAPI 将在 2 秒内生效`);
}
// ---------- 工具 ----------

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function body(req) {
  if (req._bodyPromise) return req._bodyPromise;
  req._bodyPromise = new Promise((resolve) => {
    let b = '';
    req.on('data', (chunk) => { b += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(b || '{}')); }
      catch { resolve({}); }
    });
  });
  return req._bodyPromise;
}

/** 转发消息到 QQ Bridge 独立进程 */
function forwardToQQBridge(channelId, fromName, content, fromId) {
  const payload = JSON.stringify({ channelId, fromName, content, fromId });
  const options = {
    hostname: QQ_BRIDGE_HOST,
    post: QQ_BRIDGE_PORT,
    path: '/forward',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };
  const req = http.request(options, (res) => {
    if (res.statusCode !== 200) {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => console.warn(`[DogeDB] QQ Bridge forward → ${res.statusCode}: ${body.slice(0, 100)}`));
    }
  });
  req.on('error', (err) => console.warn(`[DogeDB] QQ Bridge 不可达: ${err.message}`));
  req.write(payload);
  req.end();
}

let query;

function mapLandRow(row) {
  const members = query('SELECT player_id, player_name_snapshot, role, expires_at FROM sfmc_land_members WHERE land_id=? ORDER BY created_at ASC', [row.id]);
  return {
    id: row.id, ownerplid: row.owner_player_id, ownerName: row.owner_name_snapshot,
    managers: members.filter((m) => m.role === 'admin').map((m) => m.player_id), members,
    dimid: row.dimension,
    posA: { x: row.min_x, y: row.min_y, z: row.min_z }, posB: { x: row.max_x, y: row.max_y, z: row.max_z },
    permissions: { ...defaultLandPermissions(), ...JSON.parse(row.protection_profile || '{}') }, nickname: row.name,
    createdAt: row.created_at, status: row.status, version: row.version,
    purchasePrice: row.purchase_price ?? 0, refundRate: row.refund_rate ?? 0.7,
  };
}

function defaultLandPermissions() {
  return {
    allow_place: false, allow_destroy: false, attack_entity: false, open_container: false,
    use_door: false, use_button: false, use_redstone: false, interact_entity: false, pickup_item: false,
  };
}

function auditLand(landId, actorId, action, payload = {}) {
  query('INSERT INTO sfmc_land_audit_logs (land_id, actor_id, action, payload, created_at) VALUES (?,?,?,?,?)', [landId, actorId, action, JSON.stringify(payload), Date.now()]);
}

function canManageLand(landId, actorId) {
  const land = query("SELECT owner_player_id FROM sfmc_lands WHERE id=? AND status='active'", [landId])[0];
  if (!land || !actorId) return false;
  if (land.owner_player_id === String(actorId)) return true;
  const member = query("SELECT role FROM sfmc_land_members WHERE land_id=? AND player_id=? AND role IN ('owner','admin') AND (expires_at IS NULL OR expires_at>?)", [landId, String(actorId), Date.now()])[0];
  return !!member;
}

function landMemberRole(landId, actorId) {
  const land = query('SELECT owner_player_id FROM sfmc_lands WHERE id=?', [landId])[0];
  if (!land || !actorId) return null;
  if (land.owner_player_id === String(actorId)) return 'owner';
  return query("SELECT role FROM sfmc_land_members WHERE land_id=? AND player_id=? AND expires_at IS NULL", [landId, String(actorId)])[0]?.role || null;
}

function canManageMember(landId, actorId, targetRole = null) {
  const actorRole = landMemberRole(landId, actorId);
  if (actorRole === 'owner') return true;
  return actorRole === 'admin' && targetRole !== 'owner' && targetRole !== 'admin';
}

function ensureEconomyAccount(playerId, playerName = '') {
  const now = Date.now();
  query('INSERT OR IGNORE INTO sfmc_economy_accounts (player_id, player_name_snapshot, created_at, updated_at) VALUES (?,?,?,?)', [String(playerId), String(playerName), now, now]);
  if (playerName) query('UPDATE sfmc_economy_accounts SET player_name_snapshot=?, updated_at=? WHERE player_id=?', [String(playerName), now, String(playerId)]);
  return query('SELECT * FROM sfmc_economy_accounts WHERE player_id=?', [String(playerId)])[0];
}

function economyResult(row) { return { playerId: row.player_id, playerName: row.player_name_snapshot, balance: row.balance, version: row.version }; }

function applyEconomyTransaction(data) {
  const amount = Number(data.amount);
  if (!data.actorId || !Number.isSafeInteger(amount) || amount <= 0) return { ok: false, error: 'invalid_amount', status: 400 };
  const sourceId = data.sourcePlayerId ? String(data.sourcePlayerId) : null;
  const targetId = data.targetPlayerId ? String(data.targetPlayerId) : null;
  const idempotencyKey = data.idempotencyKey ? String(data.idempotencyKey).trim() : '';
  if (idempotencyKey && !/^[A-Za-z0-9_.:-]{1,128}$/.test(idempotencyKey)) return { ok: false, error: 'invalid_idempotency_key', status: 400 };
  if (!sourceId && !targetId) return { ok: false, error: 'missing_account', status: 400 };
  if (sourceId && sourceId !== String(data.actorId)) return { ok: false, error: 'forbidden_source', status: 403 };
  if (sourceId && targetId && sourceId === targetId) return { ok: false, error: 'same_account', status: 400 };
  db.exec('BEGIN IMMEDIATE');
  try {
    if (idempotencyKey) {
      const previous = query('SELECT response_json FROM sfmc_economy_idempotency WHERE actor_id=? AND idempotency_key=?', [String(data.actorId), idempotencyKey])[0];
      if (previous) { const response = { ...JSON.parse(previous.response_json), replayed: true }; db.exec('COMMIT'); return response; }
    }
    const source = sourceId ? ensureEconomyAccount(sourceId, data.sourcePlayerName) : null;
    const target = targetId ? ensureEconomyAccount(targetId, data.targetPlayerName) : null;
    if (source && source.balance < amount) { db.exec('ROLLBACK'); return { ok: false, error: 'insufficient_funds', balance: source.balance, status: 409 }; }
    const now = Date.now();
    if (source) query('UPDATE sfmc_economy_accounts SET balance=balance-?, version=version+1, updated_at=? WHERE player_id=? AND balance>=?', [amount, now, source.player_id, amount]);
    if (target) query('UPDATE sfmc_economy_accounts SET balance=balance+?, version=version+1, updated_at=? WHERE player_id=?', [amount, now, target.player_id]);
    const id = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const response = { ok: true, transactionId: id, source: source ? economyResult(ensureEconomyAccount(source.player_id)) : null, target: target ? economyResult(ensureEconomyAccount(target.player_id)) : null };
    query('INSERT INTO sfmc_economy_transactions (id, transaction_type, actor_id, source_player_id, target_player_id, amount, balance_before, balance_after, reference_type, reference_id, reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [id, String(data.type || 'adjustment'), String(data.actorId), sourceId, targetId, amount, source?.balance ?? null, source ? source.balance - amount : target?.balance + amount, String(data.referenceType || ''), String(data.referenceId || ''), String(data.reason || ''), now]);
    if (idempotencyKey) query('INSERT INTO sfmc_economy_idempotency (actor_id,idempotency_key,transaction_id,response_json,created_at) VALUES (?,?,?,?,?)', [String(data.actorId), idempotencyKey, id, JSON.stringify(response), now]);
    db.exec('COMMIT');
    return response;
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} return { ok: false, error: error.message || 'economy_transaction_failed', status: 500 }; }
}

function normalizeLandInput(data) {
  const a = data.posA || {}, b = data.posB || {};
  const values = [data.dimid, a.x, a.y, a.z, b.x, b.y, b.z];
  if (!values.every((v) => Number.isInteger(Number(v)))) return null;
  return {
    dimid: Number(data.dimid), minX: Math.min(Number(a.x), Number(b.x)), minY: Math.min(Number(a.y), Number(b.y)), minZ: Math.min(Number(a.z), Number(b.z)),
    maxX: Math.max(Number(a.x), Number(b.x)), maxY: Math.max(Number(a.y), Number(b.y)), maxZ: Math.max(Number(a.z), Number(b.z)),
  };
}

function validateLandInput(data) {
  const n = normalizeLandInput(data);
  if (!n || !data.ownerId) return { ok: false, error: 'invalid', status: 400 };
  const width = n.maxX - n.minX + 1, length = n.maxZ - n.minZ + 1, height = n.maxY - n.minY + 1;
  const square = width * length, volume = square * height;
  const settings = query("SELECT value FROM sfmc_config_settings WHERE key='land:config'")[0];
  let cfg = { priceFormula: '{square}*8+{height}*20', maxLandsPerPlayer: 5, minSquare: 4, maxSquare: 50000, discount: 1, refundRate: 0.7 };
  try { if (settings) cfg = { ...cfg, ...JSON.parse(settings.value) }; } catch {}
  if (square < cfg.minSquare || square > cfg.maxSquare) return { ok: false, error: 'area_out_of_range', status: 400 };
  const count = query("SELECT COUNT(*) AS count FROM sfmc_lands WHERE owner_player_id=? AND status='active'", [String(data.ownerId)])[0].count;
  if (count >= cfg.maxLandsPerPlayer) return { ok: false, error: 'land_limit', status: 409 };
  const overlap = query("SELECT id FROM sfmc_lands WHERE dimension=? AND status='active' AND min_x<=? AND max_x>=? AND min_y<=? AND max_y>=? AND min_z<=? AND max_z>=? LIMIT 1", [n.dimid, n.maxX, n.minX, n.maxY, n.minY, n.maxZ, n.minZ]);
  if (overlap.length) return { ok: false, error: 'overlap', status: 409 };
  const basePrice = evaluateLandFormula(String(cfg.priceFormula || '{square}*8+{height}*20'), { square, volume, height, width, length });
  const price = Math.max(0, Math.floor(basePrice * Number(cfg.discount || 1)));
  let refundRate = 0.7;
  try { if (settings) refundRate = Number(JSON.parse(settings.value).refundRate ?? refundRate); } catch {}
  return { ok: true, price, square, volume, refundRate, normalized: n };
}

function evaluateLandFormula(formula, values) {
  const expression = formula.replace(/\{(square|volume|height|width|length)\}/g, (_, key) => String(Number(values[key]) || 0));
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return values.square * 8 + values.height * 20;
  const tokens = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g) || [];
  let index = 0;
  const primary = () => {
    const token = tokens[index++];
    if (token === '(') { const value = additive(); index++; return value; }
    if (token === '-') return -primary();
    return Number(token);
  };
  const multiplicative = () => { let value = primary(); while (tokens[index] === '*' || tokens[index] === '/') { const op = tokens[index++]; const rhs = primary(); value = op === '*' ? value * rhs : value / rhs; } return value; };
  const additive = () => { let value = multiplicative(); while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++]; const rhs = multiplicative(); value = op === '+' ? value + rhs : value - rhs; } return value; };
  try { const result = additive(); return Number.isFinite(result) && result >= 0 ? result : values.square * 8 + values.height * 20; } catch { return values.square * 8 + values.height * 20; }
}

function landPrice(row) {
  const purchasePrice = Number(row.purchase_price || 0);
  if (purchasePrice > 0) return Math.floor(purchasePrice * Math.max(0, Math.min(1, Number(row.refund_rate ?? 0.7))));
  const width = row.max_x - row.min_x + 1, length = row.max_z - row.min_z + 1, height = row.max_y - row.min_y + 1;
  const price = Math.max(0, Math.floor(width * length * 8 + height * 20));
  return Math.floor(price * 0.7);
}

function createLandTransaction(data) {
  const check = validateLandInput(data);
  if (!check.ok) return check;
  const now = Date.now();
  const id = `L${now.toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const n = check.normalized;
  db.exec('BEGIN IMMEDIATE');
  try {
    const locked = validateLandInput(data);
    if (!locked.ok) { db.exec('ROLLBACK'); return locked; }
    const account = ensureEconomyAccount(String(data.ownerId), String(data.ownerName || ''));
    if (account.balance < locked.price) { db.exec('ROLLBACK'); return { ok: false, error: 'insufficient_funds', balance: account.balance, price: locked.price, status: 409 }; }
    query('UPDATE sfmc_economy_accounts SET balance=balance-?, version=version+1, updated_at=? WHERE player_id=? AND balance>=?', [locked.price, now, account.player_id, locked.price]);
    const refundRate = Math.max(0, Math.min(1, Number(check.refundRate ?? 0.7)));
    query('INSERT INTO sfmc_lands (id, owner_player_id, owner_name_snapshot, dimension, min_x, min_y, min_z, max_x, max_y, max_z, created_at, updated_at, purchase_price, refund_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [id, String(data.ownerId), String(data.ownerName || ''), n.dimid, n.minX, n.minY, n.minZ, n.maxX, n.maxY, n.maxZ, now, now, locked.price, refundRate]);
    query('INSERT INTO sfmc_land_members (land_id, player_id, player_name_snapshot, role, created_at) VALUES (?,?,?,?,?)', [id, String(data.ownerId), String(data.ownerName || ''), 'owner', now]);
    query('INSERT INTO sfmc_economy_transactions (id, transaction_type, actor_id, source_player_id, target_player_id, amount, balance_before, balance_after, reference_type, reference_id, reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [`E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`, 'land.purchase', String(data.ownerId), String(data.ownerId), null, locked.price, account.balance, account.balance - locked.price, 'land', id, '购买土地', now]);
    auditLand(id, String(data.ownerId), 'land.create', { price: locked.price });
    const row = query('SELECT * FROM sfmc_lands WHERE id=?', [id])[0];
    db.exec('COMMIT');
    return { ok: true, row, price: locked.price, balance: account.balance - locked.price };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    return { ok: false, error: error.message || 'create_failed', status: 500 };
  }
}

// ---------- 路由（按资源路径分组） ----------

const MAX_BODY_BYTES = parseInt(process.env.DB_MAX_BODY || '1048576', 10); // 默认 1MB

async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method;
  const params = url.searchParams;

  // loopback 绑定（仅允许本机访问）
  const remote = req.socket.remoteAddress || '';
  if (remote && !remote.startsWith('127.') && remote !== '::1' && remote !== '::ffff:127.') {
    json(res, { success: false, error: 'forbidden' }, 403);
    return;
  }

  // token 鉴权（仅写接口 + 模块安装类接口）
  const PUBLIC_GET = path === '/api/health' || (method === 'GET' && (
    path === '/api/sfmc/modules' ||
    path === '/api/sfmc/modules/catalog' ||
    path.startsWith('/api/sfmc/modules/') ||
    path === '/api/sfmc/setup/state'
  ));
  const PUBLIC_POST = path === '/api/sfmc/setup/init' || path === '/api/sfmc/setup/reset';
  const NEEDS_AUTH = !PUBLIC_GET && !PUBLIC_POST && method !== 'GET';
  if (AUTH_TOKEN && NEEDS_AUTH) {
    const auth = req.headers['authorization'] || '';
    const provided = auth.startsWith('Bearer ') ? auth.slice(7) : (req.headers['x-db-token'] || '');
    if (provided !== AUTH_TOKEN) {
      json(res, { success: false, error: 'unauthorized' }, 401);
      return;
    }
  }

  // Start buffering the request body before route dispatch so async handlers cannot miss data.
  let received = 0;
  let bodyTooLarge = false;
  req._bodyPromise = new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES && !bodyTooLarge) {
        bodyTooLarge = true;
        req.destroy();
        try { json(res, { success: false, error: 'payload_too_large' }, 413); } catch {}
        resolve({});
        return;
      }
      if (!bodyTooLarge) raw += chunk;
    });
    req.on('end', () => {
      if (bodyTooLarge) return;
      try { resolve(JSON.parse(raw || '{}')); } catch { resolve({}); }
    });
  });

  try {
    // ────── /api/health ──────
    if (path === '/api/health') {
      if (method === 'GET') { json(res, { status: 'ok', uptime: process.uptime() }); }
      else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/economy/account') {
      if (method === 'GET') {
        const playerId = params.get('playerId');
        if (!playerId) { json(res, { success: false, error: 'missing_player_id' }, 400); return; }
        json(res, { account: economyResult(ensureEconomyAccount(playerId, params.get('playerName') || '')) });
      } else if (method === 'POST') {
        const data = await body(req);
        const result = applyEconomyTransaction(data);
        json(res, result, result.ok ? 200 : (result.status || 400));
      } else json(res, { success: false, error: 'not_found' }, 404);
      return;
    }

    if (path === '/api/sfmc/economy/transfer') {
      if (method !== 'POST') { json(res, { success: false, error: 'not_found' }, 404); return; }
      const data = await body(req);
      const result = applyEconomyTransaction({ ...data, type: 'transfer', sourcePlayerId: data.actorId, targetPlayerId: data.targetPlayerId });
      json(res, result, result.ok ? 200 : (result.status || 400));
      return;
    }

    if (path === '/api/sfmc/economy/transactions') {
      if (method !== 'GET') { json(res, { success: false, error: 'not_found' }, 404); return; }
      const playerId = params.get('playerId');
      if (!playerId) { json(res, { success: false, error: 'missing_player_id' }, 400); return; }
      json(res, { transactions: query('SELECT * FROM sfmc_economy_transactions WHERE source_player_id=? OR target_player_id=? ORDER BY created_at DESC LIMIT 100', [playerId, playerId]) });
      return;
    }

    // ────── /api/sfmc/lands ──────
    if (path === '/api/sfmc/lands') {
      if (method === 'GET') {
        json(res, { lands: query("SELECT * FROM sfmc_lands WHERE status='active' ORDER BY created_at ASC").map(mapLandRow) });
      } else if (method === 'POST') {
        const result = createLandTransaction(await body(req));
        if (!result.ok) { json(res, result, result.status || 400); return; }
        json(res, { success: true, land: mapLandRow(result.row), price: result.price });
      } else json(res, { success: false, error: 'not_found' }, 404);
      return;
    }

    if (path === '/api/sfmc/lands/validate') {
      const data = method === 'GET' ? Object.fromEntries(params.entries()) : await body(req);
      const result = validateLandInput(data);
      json(res, result, result.ok ? 200 : (result.status || 400));
      return;
    }

    if (path.startsWith('/api/sfmc/lands/by-owner/')) {
      const ownerId = decodeURIComponent(path.slice('/api/sfmc/lands/by-owner/'.length));
      json(res, { lands: query("SELECT * FROM sfmc_lands WHERE owner_player_id=? AND status='active' ORDER BY created_at ASC", [ownerId]).map(mapLandRow) });
      return;
    }

    if (path.startsWith('/api/sfmc/lands/invites/')) {
      const invitePath = path.slice('/api/sfmc/lands/invites/'.length).split('/');
      const inviteeId = decodeURIComponent(invitePath[0]);
      if (invitePath[1] === 'decline' && method === 'POST') {
        const data = await body(req);
        const invite = query("SELECT * FROM sfmc_land_invites WHERE id=? AND invitee_id=? AND status='pending'", [data.inviteId, inviteeId])[0];
        if (!invite) { json(res, { success: false, error: 'invite_not_found' }, 404); return; }
        query("UPDATE sfmc_land_invites SET status='declined' WHERE id=?", [invite.id]);
        auditLand(invite.land_id, inviteeId, 'invite.decline', { inviteId: invite.id });
        json(res, { success: true });
        return;
      }
      if (method === 'GET') {
        const now = Date.now();
        query("UPDATE sfmc_land_invites SET status='expired' WHERE invitee_id=? AND status='pending' AND expires_at<=?", [inviteeId, now]);
        const invites = query("SELECT * FROM sfmc_land_invites WHERE invitee_id=? AND status='pending' ORDER BY created_at ASC", [inviteeId]);
        json(res, { invites });
        return;
      }
      if (method === 'POST') {
        const data = await body(req);
        const invite = query("SELECT * FROM sfmc_land_invites WHERE id=? AND invitee_id=? AND status='pending' AND expires_at>?", [data.inviteId, inviteeId, Date.now()])[0];
        if (!invite) { json(res, { success: false, error: 'invite_not_found' }, 404); return; }
        const land = query("SELECT * FROM sfmc_lands WHERE id=? AND status='active'", [invite.land_id])[0];
        if (!land) { json(res, { success: false, error: 'not_found' }, 404); return; }
         query('INSERT INTO sfmc_land_members (land_id, player_id, player_name_snapshot, role, created_at, expires_at) VALUES (?,?,?,?,?,?) ON CONFLICT(land_id, player_id) DO UPDATE SET player_name_snapshot=excluded.player_name_snapshot, role=excluded.role, expires_at=excluded.expires_at', [invite.land_id, inviteeId, String(data.playerName || inviteeId), invite.role, Date.now(), null]);
        query("UPDATE sfmc_land_invites SET status='accepted' WHERE id=?", [invite.id]);
        query('UPDATE sfmc_lands SET updated_at=?, version=version+1 WHERE id=?', [Date.now(), invite.land_id]);
        auditLand(invite.land_id, inviteeId, 'invite.accept', { inviteId: invite.id, role: invite.role });
        json(res, { success: true, land: mapLandRow(query('SELECT * FROM sfmc_lands WHERE id=?', [invite.land_id])[0]) });
        return;
      }
    }

    if (path.startsWith('/api/sfmc/lands/') && path.endsWith('/members')) {
      const id = decodeURIComponent(path.slice('/api/sfmc/lands/'.length, -'/members'.length));
      const data = await body(req);
      const land = query("SELECT * FROM sfmc_lands WHERE id=? AND status='active'", [id])[0];
      if (!land) { json(res, { success: false, error: 'not_found' }, 404); return; }
      if (method === 'POST') {
        if (!data.actorId || !data.playerId || !canManageMember(id, data.actorId, data.role)) { json(res, { success: false, error: 'forbidden' }, 403); return; }
        if (!['builder', 'container', 'visitor', 'redstone', 'entity', 'admin'].includes(String(data.role || 'builder'))) { json(res, { success: false, error: 'invalid_role' }, 400); return; }
        if (String(data.role) === 'admin' && landMemberRole(id, data.actorId) !== 'owner') { json(res, { success: false, error: 'forbidden' }, 403); return; }
        const inviteId = `I${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        const expiresAt = Date.now() + Math.min(Math.max(Number(data.ttlMs) || 86400000, 60000), 604800000);
        query('INSERT INTO sfmc_land_invites (id, land_id, inviter_id, invitee_id, role, expires_at, created_at) VALUES (?,?,?,?,?,?,?)', [inviteId, id, data.actorId, String(data.playerId), String(data.role || 'builder'), expiresAt, Date.now()]);
        auditLand(id, data.actorId, 'member.invite', { inviteId, playerId: String(data.playerId), role: String(data.role || 'builder') });
        json(res, { success: true, inviteId, expiresAt });
        return;
      }
      if (method === 'DELETE') {
        const targetRole = query('SELECT role FROM sfmc_land_members WHERE land_id=? AND player_id=?', [id, String(data.playerId)])[0]?.role;
        if (!data.actorId || !data.playerId || !canManageMember(id, data.actorId, targetRole)) { json(res, { success: false, error: 'forbidden' }, 403); return; }
        query('DELETE FROM sfmc_land_members WHERE land_id=? AND player_id=? AND player_id<>?', [id, String(data.playerId), land.owner_player_id]);
        query('UPDATE sfmc_lands SET updated_at=?, version=version+1 WHERE id=?', [Date.now(), id]);
        auditLand(id, data.actorId, 'member.remove', { playerId: String(data.playerId) });
        json(res, { success: true, land: mapLandRow(query('SELECT * FROM sfmc_lands WHERE id=?', [id])[0]) });
        return;
      }
    }

    if (path.startsWith('/api/sfmc/lands/') && path.includes('/members/')) {
      const tail = path.slice('/api/sfmc/lands/'.length).split('/');
      const id = decodeURIComponent(tail[0]);
      const playerId = decodeURIComponent(tail[2] || '');
      if (tail.length !== 3 || tail[1] !== 'members' || method !== 'PATCH') { json(res, { success: false, error: 'not_found' }, 404); return; }
      const data = await body(req);
      const currentRole = query('SELECT role FROM sfmc_land_members WHERE land_id=? AND player_id=? AND (expires_at IS NULL OR expires_at>?)', [id, playerId, Date.now()])[0]?.role;
      if (!currentRole || !data.actorId || !canManageMember(id, data.actorId, currentRole)) { json(res, { success: false, error: 'forbidden' }, 403); return; }
      const nextRole = String(data.role || '');
      if (!['builder', 'container', 'visitor', 'redstone', 'entity', 'admin'].includes(nextRole)) { json(res, { success: false, error: 'invalid_role' }, 400); return; }
      if (nextRole === 'admin' && landMemberRole(id, data.actorId) !== 'owner') { json(res, { success: false, error: 'forbidden' }, 403); return; }
      query('UPDATE sfmc_land_members SET role=? WHERE land_id=? AND player_id=?', [nextRole, id, playerId]);
      query('UPDATE sfmc_lands SET updated_at=?, version=version+1 WHERE id=?', [Date.now(), id]);
      auditLand(id, data.actorId, 'member.role_change', { playerId, from: currentRole, to: nextRole });
      json(res, { success: true, land: mapLandRow(query('SELECT * FROM sfmc_lands WHERE id=?', [id])[0]) });
      return;
    }

    if (path.startsWith('/api/sfmc/lands/') && path.endsWith('/transfer')) {
      const id = decodeURIComponent(path.slice('/api/sfmc/lands/'.length, -'/transfer'.length));
      const data = await body(req);
      if (method !== 'POST' || !data.actorId || !data.targetId) { json(res, { success: false, error: 'forbidden' }, 403); return; }
      db.exec('BEGIN IMMEDIATE');
      try {
        const land = query("SELECT * FROM sfmc_lands WHERE id=? AND status='active'", [id])[0];
        if (!land) { db.exec('ROLLBACK'); json(res, { success: false, error: 'not_found' }, 404); return; }
        if (String(data.actorId) !== String(land.owner_player_id)) { db.exec('ROLLBACK'); json(res, { success: false, error: 'forbidden' }, 403); return; }
        query('UPDATE sfmc_lands SET owner_player_id=?, owner_name_snapshot=?, updated_at=?, version=version+1 WHERE id=? AND status=\'active\' AND owner_player_id=?', [String(data.targetId), String(data.targetName || ''), Date.now(), id, String(data.actorId)]);
        query('UPDATE sfmc_land_members SET role=\'admin\' WHERE land_id=? AND role=\'owner\'', [id]);
        query('INSERT INTO sfmc_land_members (land_id, player_id, player_name_snapshot, role, created_at) VALUES (?,?,?,?,?) ON CONFLICT(land_id, player_id) DO UPDATE SET player_name_snapshot=excluded.player_name_snapshot, role=excluded.role, expires_at=NULL', [id, String(data.targetId), String(data.targetName || ''), 'owner', Date.now()]);
        auditLand(id, data.actorId, 'land.transfer', { targetId: String(data.targetId) });
        db.exec('COMMIT');
        json(res, { success: true, land: mapLandRow(query('SELECT * FROM sfmc_lands WHERE id=?', [id])[0]) });
      } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { success: false, error: error.message || 'transfer_failed' }, 500); }
      return;
    }

    if (path.startsWith('/api/sfmc/lands/') && path.includes('/invites/')) {
      const tail = path.slice('/api/sfmc/lands/'.length).split('/');
      const id = decodeURIComponent(tail[0]);
      const inviteId = decodeURIComponent(tail[2] || '');
      if (tail.length !== 3 || tail[1] !== 'invites' || method !== 'DELETE') { json(res, { success: false, error: 'not_found' }, 404); return; }
      const data = await body(req);
      const invite = query("SELECT * FROM sfmc_land_invites WHERE id=? AND land_id=? AND status='pending'", [inviteId, id])[0];
      if (!invite || !canManageLand(id, data.actorId)) { json(res, { success: false, error: 'forbidden' }, 403); return; }
      query("UPDATE sfmc_land_invites SET status='revoked' WHERE id=?", [inviteId]);
      auditLand(id, data.actorId, 'invite.revoke', { inviteId });
      json(res, { success: true });
      return;
    }

    if (path.startsWith('/api/sfmc/lands/') && path.endsWith('/audit')) {
      const id = decodeURIComponent(path.slice('/api/sfmc/lands/'.length, -'/audit'.length));
      if (method !== 'GET') { json(res, { success: false, error: 'not_found' }, 404); return; }
      json(res, { logs: query('SELECT * FROM sfmc_land_audit_logs WHERE land_id=? ORDER BY created_at DESC LIMIT 100', [id]) });
      return;
    }

    if (path.startsWith('/api/sfmc/lands/at/')) {
      const parts = path.slice('/api/sfmc/lands/at/'.length).split('/');
      if (parts.length !== 4) { json(res, { success: false, error: 'invalid' }, 400); return; }
      const [dimension, x, y, z] = parts.map(Number);
      const rows = query("SELECT * FROM sfmc_lands WHERE dimension=? AND status='active' AND min_x<=? AND max_x>=? AND min_y<=? AND max_y>=? AND min_z<=? AND max_z>=? LIMIT 1", [dimension, x, x, y, y, z, z]);
      if (!rows.length) { json(res, { success: false, error: 'not_found' }, 404); return; }
      json(res, { land: mapLandRow(rows[0]) });
      return;
    }

    if (path === '/api/sfmc/lands/at-batch') {
      if (method !== 'POST') { json(res, { success: false, error: 'not_found' }, 404); return; }
      const data = await body(req);
      if (!Array.isArray(data.points) || data.points.length > 200) { json(res, { success: false, error: 'invalid_points' }, 400); return; }
      const results = data.points.map((point) => {
        const dimension = Number(point.dimid), x = Number(point.x), y = Number(point.y), z = Number(point.z);
        if (![dimension, x, y, z].every(Number.isFinite)) return null;
        const rows = query("SELECT * FROM sfmc_lands WHERE dimension=? AND status='active' AND min_x<=? AND max_x>=? AND min_y<=? AND max_y>=? AND min_z<=? AND max_z>=? LIMIT 1", [dimension, x, x, y, y, z, z]);
        return rows[0] ? mapLandRow(rows[0]) : null;
      });
      json(res, { lands: results });
      return;
    }

    if (path.startsWith('/api/sfmc/lands/')) {
      const id = decodeURIComponent(path.slice('/api/sfmc/lands/'.length));
      const rows = query('SELECT * FROM sfmc_lands WHERE id=?', [id]);
      if (!rows.length) { json(res, { success: false, error: 'not_found' }, 404); return; }
      if (method === 'GET') { json(res, { land: mapLandRow(rows[0]) }); return; }
      if (method === 'PATCH' || method === 'PUT') {
        const data = await body(req);
        if (!canManageLand(id, data.actorId)) { json(res, { success: false, error: 'forbidden' }, 403); return; }
        const sets = ['updated_at=?', 'version=version+1'], values = [Date.now()];
        if (data.nickname !== undefined) { sets.push('name=?'); values.push(String(data.nickname)); }
        if (data.permissions !== undefined) { sets.push('protection_profile=?'); values.push(JSON.stringify(data.permissions || {})); }
        values.push(id); query(`UPDATE sfmc_lands SET ${sets.join(', ')} WHERE id=? AND status='active'`, values);
        auditLand(id, String(data.actorId), 'land.update', { fields: Object.keys(data) });
        json(res, { success: true, land: mapLandRow(query('SELECT * FROM sfmc_lands WHERE id=?', [id])[0]) });
        return;
      }
      if (method === 'DELETE') {
        const data = await body(req);
        if (!data.actorId) { json(res, { success: false, error: 'forbidden' }, 403); return; }
        db.exec('BEGIN IMMEDIATE');
        try {
        const land = query("SELECT * FROM sfmc_lands WHERE id=? AND status='active'", [id])[0];
        if (!land || String(data.actorId) !== String(land.owner_player_id)) { db.exec('ROLLBACK'); json(res, { success: false, error: 'forbidden' }, 403); return; }
        const refund = landPrice(land);
        const account = ensureEconomyAccount(land.owner_player_id, land.owner_name_snapshot);
        const deleted = query("UPDATE sfmc_lands SET status='deleted', updated_at=?, version=version+1 WHERE id=? AND status='active' AND owner_player_id=?", [Date.now(), id, String(data.actorId)]);
        if (!deleted.changes) { db.exec('ROLLBACK'); json(res, { success: false, error: 'already_deleted' }, 409); return; }
        if (refund > 0) {
          query('UPDATE sfmc_economy_accounts SET balance=balance+?, version=version+1, updated_at=? WHERE player_id=?', [refund, Date.now(), land.owner_player_id]);
          query('INSERT INTO sfmc_economy_transactions (id, transaction_type, actor_id, source_player_id, target_player_id, amount, balance_before, balance_after, reference_type, reference_id, reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [`E${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, 'land.refund', data.actorId, null, land.owner_player_id, refund, account.balance, account.balance + refund, 'land', id, '删除土地退款', Date.now()]);
        }
        const balance = ensureEconomyAccount(land.owner_player_id).balance;
        auditLand(id, data.actorId, 'land.delete', { refund });
        db.exec('COMMIT');
        json(res, { success: true, refund, balance });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { success: false, error: error.message || 'delete_failed' }, 500); }
        return;
      }
      json(res, { success: false, error: 'not_found' }, 404);
      return;
    }

    // ────── /api/sfmc/world ──────
    if (path === '/api/sfmc/world') {
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_world');
        json(res, { world: rows.length > 0 ? rows[0] : null });
      } else if (method === 'POST') {
        const data = (await body(req)).data;
        if (!data) { json(res, { success: false, error: 'invalid' }, 400); return; }
        const world = {
          allowCheats: !!data.allowCheats,
          gameRules: typeof data.gameRules === 'string' ? data.gameRules : JSON.stringify(data.gameRules || {}),
          seed: String(data.seed ?? ''),
          defaultSpawnLocation: data.defaultSpawnLocation ?? null,
          difficulty: String(data.difficulty ?? ''),
          day: Number.isFinite(Number(data.day)) ? Number(data.day) : 0,
          tickingAreasCount: Number.isFinite(Number(data.tickingAreasCount)) ? Number(data.tickingAreasCount) : 0,
          absoluteTime: Number.isFinite(Number(data.absoluteTime)) ? Number(data.absoluteTime) : 0,
          structuresFromAddon: String(data.structuresFromAddon ?? ''),
          structuresFromWorld: String(data.structuresFromWorld ?? ''),
          dynamicPropertyTotalByteCount: Number.isFinite(Number(data.dynamicPropertyTotalByteCount)) ? Number(data.dynamicPropertyTotalByteCount) : 0,
          moonPhase: Number.isFinite(Number(data.moonPhase)) ? Number(data.moonPhase) : 0,
          updatedAt: String(data.updatedAt ?? Date.now()),
        };
        query(`INSERT OR REPLACE INTO sfmc_world (
            allow_cheats, game_rules, seed, default_spawn_location, difficulty,
            day, ticking_areas_count, absolute_time, structures_from_addon,
            structures_from_world, dynamic_property_total_byte_count, moon_phase, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          world.allowCheats ? 1 : 0, world.gameRules, world.seed,
          JSON.stringify(world.defaultSpawnLocation), world.difficulty, world.day,
          world.tickingAreasCount, world.absoluteTime,
          world.structuresFromAddon, world.structuresFromWorld,
          world.dynamicPropertyTotalByteCount, world.moonPhase, world.updatedAt
        ]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/channels ──────
    if (path === '/api/sfmc/channels') {
      if (method === 'GET') {
        let sql = 'SELECT * FROM sfmc_chat_channels WHERE 1=1';
        const values = [];
        const filterMap = [
          { key: 'search', sql: ' AND (name LIKE ? OR id LIKE ?)', transform: v => `%${v}%`, repeat: 2 },
          { key: 'type', sql: ' AND type = ?', transform: v => v, repeat: 1 },
          { key: 'ownerId', sql: ' AND owner_id = ?', transform: v => v, repeat: 1 },
          { key: 'minCreatedAt', sql: ' AND created_at >= ?', transform: v => Number(v), repeat: 1 },
          { key: 'maxCreatedAt', sql: ' AND created_at <= ?', transform: v => Number(v), repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== '') {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += ' ORDER BY created_at ASC';
        json(res, { channels: query(sql, values) });
      } else if (method === 'POST') {
        const { channels } = await body(req);
        if (!Array.isArray(channels) || channels.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (channels.length > 90) { json(res, { success: false, error: 'too many requests' }, 413); return; }
        query(
          `INSERT OR REPLACE INTO sfmc_chat_channels (
            id, name, type, prefix, owner_id, created_at,
            config_allow_chat, config_slow_mode, config_is_broadcast, updated_at
          ) VALUES ${channels.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          channels.flatMap(ch => [
            String(ch.id ?? ''),
            String(ch.name ?? ''),
            String(ch.type ?? ''),
            String(ch.prefix ?? ''),
            String(ch.ownerId || ch.ownerid || ''),
            Number(ch.createdAt) || Date.now(),
            Number(ch.configAllowChat ?? (ch.config?.allowChat ? 1 : 0)) || 0,
            Number(ch.configSlowMode ?? (ch.config?.slowMode || 0)) || 0,
            Number(ch.configIsBroadcast ?? (ch.config?.isBroadcast ? 1 : 0)) || 0,
            Date.now()
          ]));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/channels/')) {
      const id = path.slice('/api/sfmc/channels/'.length);
      if (!id) { json(res, { success: false, error: 'missing_id' }, 400); return; }
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_chat_channels WHERE id = ?', [id]);
        if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
        json(res, { channel: rows[0] });
      } else if (method === 'PATCH' || method === 'PUT') {
        const raw = await body(req);
        const data = raw.channel || raw;
        if (!data || typeof data !== 'object') { json(res, { success: false, error: 'invalid' }, 400); return; }
        const sets = ['updated_at=?'];
        const vals = [Date.now()];
        const colMap = {
          name: 'name', prefix: 'prefix', ownerId: 'owner_id', ownerid: 'owner_id',
          createdAt: 'created_at',
          configAllowChat: 'config_allow_chat', configSlowMode: 'config_slow_mode', configIsBroadcast: 'config_is_broadcast',
        };
        for (const [jsField, dbCol] of Object.entries(colMap)) {
          if (data[jsField] !== undefined) { sets.push(`${dbCol}=?`); vals.push(data[jsField]); }
        }
        if (data.config?.allowChat !== undefined) { sets.push('config_allow_chat=?'); vals.push(data.config.allowChat ? 1 : 0); }
        if (data.config?.slowMode !== undefined) { sets.push('config_slow_mode=?'); vals.push(data.config.slowMode); }
        if (data.config?.isBroadcast !== undefined) { sets.push('config_is_broadcast=?'); vals.push(data.config.isBroadcast ? 1 : 0); }
        if (sets.length > 1) { vals.push(id); query(`UPDATE sfmc_chat_channels SET ${sets.join(', ')} WHERE id=?`, vals); }
        json(res, { success: true });
      } else if (method === 'DELETE') {
        query('DELETE FROM sfmc_chat_channels WHERE id = ?', [id]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/messages ──────
    if (path === '/api/sfmc/messages') {
      if (method === 'GET') {
        let sql = 'SELECT * FROM sfmc_chat_messages WHERE 1=1';
        const values = [];
        const filterMap = [
          { key: 'search', sql: ' AND (content LIKE ?)', transform: v => `%${v}%`, repeat: 1 },
          { key: 'type', sql: ' AND type = ?', transform: v => v, repeat: 1 },
          { key: 'channelId', sql: ' AND channel_id = ?', transform: v => v, repeat: 1 },
          { key: 'from', sql: ' AND from_id = ?', transform: v => v, repeat: 1 },
          { key: 'minCreatedAt', sql: ' AND created_at >= ?', transform: v => Number(v), repeat: 1 },
          { key: 'minSentAt', sql: ' AND created_at >= ?', transform: v => Number(v), repeat: 1 },
          { key: 'maxCreatedAt', sql: ' AND created_at <= ?', transform: v => Number(v), repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== '') {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += ' ORDER BY created_at ASC';
        json(res, { messages: query(sql, values) });
      } else if (method === 'POST') {
        const { messages } = await body(req);
        if (!Array.isArray(messages) || messages.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (messages.length > 100) { json(res, { success: false, error: 'too many requests' }, 413); return; }
        query(
          `INSERT OR REPLACE INTO sfmc_chat_messages (
            id, channel_id, from_id, from_name, type, content, attachment, show_timestamp, created_at
          ) VALUES ${messages.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          messages.flatMap(m => [
            m.id, m.channelId, m.fromid, m.fromName,
            m.type || 'text', m.content, m.attachment || null,
            m.showTimestamp ? 1 : 0, m.timestamp
          ]));
        // Forward to QQ bridge if enabled
        for (const m of messages) {
          forwardToQQBridge(m.channelId, m.fromName, m.content, m.fromid);
        }
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/redpacket ──────
      if (path === '/api/sfmc/redpacket') {
      if (method === 'GET') {
        json(res, { redpackets: query('SELECT * FROM sfmc_chat_redpackets') });
      } else if (method === 'POST') {
        const requestData = await body(req), rp = requestData.redpacket;
        if (!rp?.id) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (!rp.senderid || String(rp.senderid) !== String(requestData.actorId || rp.senderid) || !Number.isSafeInteger(Number(rp.totalAmount)) || Number(rp.totalAmount) <= 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        db.exec('BEGIN IMMEDIATE');
        try {
          const account = ensureEconomyAccount(rp.senderid, rp.senderName);
          if (account.balance < Number(rp.totalAmount)) { db.exec('ROLLBACK'); json(res, { success: false, error: 'insufficient_funds' }, 409); return; }
          const now = Date.now();
          query('UPDATE sfmc_economy_accounts SET balance=balance-?,version=version+1,updated_at=? WHERE player_id=? AND balance>=?', [Number(rp.totalAmount), now, rp.senderid, Number(rp.totalAmount)]);
          query(
            `INSERT INTO sfmc_chat_redpackets (
            id, sender_id, sender_name, total_amount, remaining_amount,
            total_count, remaining_count, receivers, target_type, target_id, created_at, expires_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
          rp.id, rp.senderid, rp.senderName, rp.totalAmount, rp.remainingAmount,
          rp.totalCount, rp.remainingCount, JSON.stringify(rp.receivers),
          rp.targetType, rp.targetId, rp.createdAt, rp.expiresAt
          ]);
          const tx = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          query('INSERT INTO sfmc_economy_transactions (id,transaction_type,actor_id,source_player_id,target_player_id,amount,balance_before,balance_after,reference_type,reference_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [tx, 'redpacket.create', rp.senderid, rp.senderid, null, Number(rp.totalAmount), account.balance, account.balance - Number(rp.totalAmount), 'redpacket', rp.id, '发送红包', now]);
          db.exec('COMMIT');
          json(res, { success: true, transactionId: tx, account: economyResult(ensureEconomyAccount(rp.senderid)) });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { success: false, error: error.message || 'redpacket_create_failed' }, 500); }
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/redpacket/')) {
      const id = path.slice('/api/sfmc/redpacket/'.length);
      if (!id) { json(res, { success: false, error: 'missing_id' }, 400); return; }
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_chat_redpackets WHERE id = ?', [id]);
        if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
        json(res, { redpacket: rows[0] });
      } else if (method === 'POST' && path.endsWith('/claim')) {
        const data = await body(req), actorId = String(data.actorId || '');
        db.exec('BEGIN IMMEDIATE');
        try {
          const packet = query('SELECT * FROM sfmc_chat_redpackets WHERE id=?', [id.slice(0, -6)])[0];
          if (!packet || packet.remaining_count <= 0 || Date.now() > packet.expires_at) { db.exec('ROLLBACK'); json(res, { success: false, error: 'unavailable' }, 409); return; }
          const receivers = JSON.parse(packet.receivers || '[]');
          if (receivers.includes(actorId)) { db.exec('ROLLBACK'); json(res, { success: false, error: 'already_claimed' }, 409); return; }
          const amount = packet.remaining_count === 1 ? packet.remaining_amount : Math.max(1, Math.min(packet.remaining_amount - (packet.remaining_count - 1), Math.floor(Math.random() * (Math.floor((packet.remaining_amount / packet.remaining_count) * 2) + 1))));
          const now = Date.now(), account = ensureEconomyAccount(actorId, String(data.actorName || ''));
          query('UPDATE sfmc_chat_redpackets SET remaining_amount=?,remaining_count=?,receivers=? WHERE id=? AND remaining_count=?', [packet.remaining_amount - amount, packet.remaining_count - 1, JSON.stringify([...receivers, actorId]), id.slice(0, -6), packet.remaining_count]);
          query('UPDATE sfmc_economy_accounts SET balance=balance+?,version=version+1,updated_at=? WHERE player_id=?', [amount, now, actorId]);
          const tx = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          query('INSERT INTO sfmc_economy_transactions (id,transaction_type,actor_id,source_player_id,target_player_id,amount,balance_before,balance_after,reference_type,reference_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [tx, 'redpacket.claim', actorId, null, actorId, amount, account.balance, account.balance + amount, 'redpacket', id.slice(0, -6), '领取红包', now]);
          db.exec('COMMIT'); json(res, { success: true, amount, transactionId: tx, account: economyResult(ensureEconomyAccount(actorId)) });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { success: false, error: error.message || 'redpacket_claim_failed' }, 500); }
      } else if (method === 'PATCH' || method === 'PUT') {
        json(res, { success: false, error: 'legacy_route_disabled' }, 410);
      } else if (method === 'DELETE') {
        query('DELETE FROM sfmc_chat_redpackets WHERE id = ?', [id]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/players ──────
    if (path === '/api/sfmc/players/saveField') {
      if (method === 'POST') {
        const { playerId, field, value } = await body(req);
        if (!playerId || !field) { json(res, { success: false, error: 'invalid' }, 400); return; }
        const bind = typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
        query(`UPDATE sfmc_players SET ${field.replace(/:/g, '_')}=?, updated_at=? WHERE id=?`, [bind, Date.now(), playerId]);
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/players/saveAll') {
      if (method === 'POST') {
        const { players } = await body(req);
        if (!Array.isArray(players)) { json(res, { success: false, error: 'invalid' }, 400); return; }
        const now = Date.now();
        for (const p of players) {
          query(
            `INSERT OR REPLACE INTO sfmc_players (id, name, active_channel, updated_at) VALUES (?, ?, ?, ?)`,
            [p.id || p.playerId, p.name || '', p.activeChannel || '', now]
          );
        }
        json(res, { success: true, count: players.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/players') {
      if (method === 'GET') {
        let sql = 'SELECT * FROM sfmc_players WHERE 1=1';
        const values = [];
        const filterMap = [
          { key: 'search', sql: ' AND (name LIKE ? OR id LIKE ?)', transform: v => `%${v}%`, repeat: 2 },
          { key: 'name', sql: ' AND name LIKE ?', transform: v => `%${v}%`, repeat: 1 },
          { key: 'id', sql: ' AND id = ?', transform: v => v, repeat: 1 },
          { key: 'active_channel', sql: ' AND active_channel = ?', transform: v => v, repeat: 1 },
        ];
        for (const rule of filterMap) {
          const val = params.get(rule.key);
          if (val && val.trim() !== '') {
            sql += rule.sql;
            const t = rule.transform(val.trim());
            for (let i = 0; i < rule.repeat; i++) values.push(t);
          }
        }
        sql += ' ORDER BY updated_at ASC';
        json(res, { players: query(sql, values) });
      } else if (method === 'POST') {
        const { players } = await body(req);
        if (!Array.isArray(players) || players.length === 0) { json(res, { success: false, error: 'invalid' }, 400); return; }
        if (players.length > 110) { json(res, { success: false, error: 'too many requests' }, 413); return; }
        const normalizedPlayers = players.map((p) => ({
          ...p,
          id: p.id || p.playerId || '',
          name: p.name || '',
          permission: p.permission ?? 0,
        }));
        if (normalizedPlayers.some((p) => !p.id)) { json(res, { success: false, error: 'player_id_required' }, 400); return; }
        query(`INSERT OR REPLACE INTO sfmc_players (
          id, name, permission,
          client_system_info_local, client_system_info_maxRenderDistance,
          client_system_info_memoryTier_level, client_system_info_PlatformType,
          graphicsMode, dynamicPropertyTotalByteCount, ping,
          spawnPoint, tags, level, totalXp,
          afk_step, afk_last_location,
          onlinetime_session, onlinetime_today, onlinetime_month, onlinetime_total,
          onlinetime_last_date, onlinetime_last_month, active_channel, subscribed_channels, updated_at
        ) VALUES ${normalizedPlayers.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          normalizedPlayers.flatMap(p => [
            p.id, p.name, p.permission,
            p.clientSystemInfoLocal || '', p.clientSystemInfoMaxRenderDistance || 0,
            p.clientSystemInfoMemoryTier_level || 0, p.clientSystemInfo_PlatformType || '',
            p.graphicsMode || '', p.dynamicPropertyTotalByteCount || 0, p.ping || 0,
            p.spawnPoint || '', p.tags || '', p.level || 0, p.totalXp || 0,
            p.afkStep || 0, p.afkLastLocation || '',
            p.onlinetimeSession || 0, p.onlinetimeToday || 0, p.onlinetimeMonth || 0, p.onlinetimeTotal || 0,
            p.onlinetimeLastDate || '', p.onlinetimeLastMonth || '', p.activeChannel || '',
            p.subscribedChannels || '', Date.now()
          ]));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/players/')) {
      const id = path.slice('/api/sfmc/players/'.length);
      if (!id) { json(res, { success: false, error: 'invalid' }, 400); return; }
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_players WHERE id = ?', [id]);
        if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
        json(res, { player: rows[0] });
      } else if (method === 'PATCH' || method === 'PUT') {
        const { player } = await body(req);
        if (!player || typeof player !== 'object') { json(res, { success: false, error: 'invalid' }, 400); return; }
        const FIELD_MAP = {
          permission: 'permission',
          clientSystemInfoLocal: 'client_system_info_local',
          clientSystemInfoMaxRenderDistance: 'client_system_info_max_render_distance',
          clientSystemInfoMemoryTier_level: 'client_system_info_memory_tier_level',
          clientSystemInfoPlatformType: 'client_system_info_platform_type',
          graphicsMode: 'graphics_mode',
          dynamicPropertyTotalByteCount: 'dynamic_property_total_byte_count',
          ping: 'ping', spawnPoint: 'spawn_point', tags: 'tags',
          level: 'level', totalXp: 'total_xp',
          afkStep: 'afk_step', afkLastLocation: 'afk_last_location',
          onlinetimeSession: 'onlinetime_session', onlinetimeToday: 'onlinetime_today',
          onlinetimeMonth: 'onlinetime_month', onlinetimeTotal: 'onlinetime_total',
          onlinetimeLastDate: 'onlinetime_last_date', onlinetimeLastMonth: 'onlinetime_last_month',
          activeChannel: 'active_channel',
          subscribedChannels: 'subscribed_channels',
        };
        const sets = ['updated_at=?'];
        const vals = [Date.now()];
        for (const [jsField, dbCol] of Object.entries(FIELD_MAP)) {
          if (player[jsField] !== undefined) { sets.push(`${dbCol}=?`); vals.push(player[jsField]); }
        }
        if (sets.length > 1) { vals.push(id); query(`UPDATE sfmc_players SET ${sets.join(', ')} WHERE id=?`, vals); }
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/scoreboards ──────
    if (path === '/api/sfmc/scoreboards') {
      if (method === 'GET') {
        json(res, { entries: query('SELECT * FROM sfmc_scoreboards') });
      } else if (method === 'POST') {
        const { entries } = await body(req);
        if (!entries || !Array.isArray(entries)) { json(res, { success: false, error: 'entries array required' }, 400); return; }
        const now = Date.now();
        for (const e of entries) {
          query(
            'INSERT OR REPLACE INTO sfmc_scoreboards (objective_id, objective_display, participants, updated_at) VALUES (?, ?, ?, ?)',
            [e.objectiveId || e.id, e.objectiveDisplay || e.displayName || '', JSON.stringify(e.participantIds || e.participants || []), now]
          );
        }
        json(res, { success: true, count: entries.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/activities ──────
    if (path === '/api/sfmc/activities/batch') {
      if (method === 'POST') {
        const { entries } = await body(req);
        if (!entries || !Array.isArray(entries) || entries.length === 0) { json(res, { success: false, error: 'entries array required' }, 400); return; }
        const now = Date.now();
        const insert = `INSERT OR IGNORE INTO sfmc_activities (
          id, timestamp, dimension, source_type, source_id, source_name,
          source_x, source_y, source_z, event_type,
          target_type, target_id, target_name, target_x, target_y, target_z, detail, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        for (const e of entries) {
          query(insert, [
            e.id || `${now}_${Math.random().toString(36).slice(2, 8)}`, e.timestamp || now,
            e.dimension || '', e.sourceType || 'unknown', e.sourceid || '', e.sourceName || '',
            e.sourceX ?? null, e.sourceY ?? null, e.sourceZ ?? null,
            e.eventType || 'unknown', e.targetType || '', e.targetid || '', e.targetName || '',
            e.targetX ?? null, e.targetY ?? null, e.targetZ ?? null,
            typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail || {}), now
          ]);
        }
        json(res, { success: true, count: entries.length });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/activities/cleanup') {
      if (method === 'POST') {
        const { keepDays = 30, keepAdmin = true } = await body(req);
        const cutoff = Date.now() - keepDays * 86400000;
        if (keepAdmin) {
          const r = query('DELETE FROM sfmc_activities WHERE timestamp < ? AND event_type NOT LIKE ?', [cutoff, 'admin.%']);
          json(res, { success: true, deleted: r.changes || 0 });
        } else {
          const r = query('DELETE FROM sfmc_activities WHERE timestamp < ?', [cutoff]);
          json(res, { success: true, deleted: r.changes || 0 });
        }
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/activities/stats') {
      if (method === 'GET') {
        const id = params.get('id') || '';
        const from = params.get('from') || '';
        const to = params.get('to') || '';
        let cond = 'WHERE 1=1';
        const vals = [];
        if (id) { cond += ' AND source_id = ?'; vals.push(id); }
        if (from) { cond += ' AND timestamp >= ?'; vals.push(parseInt(from)); }
        if (to) { cond += ' AND timestamp <= ?'; vals.push(parseInt(to)); }
        const totalRow = query(`SELECT COUNT(*) as total FROM sfmc_activities ${cond}`, vals);
        const byEvent = query(`SELECT event_type, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY event_type ORDER BY count DESC`, vals);
        const byDate = query(`SELECT strftime('%Y-%m-%d', timestamp / 1000, 'unixepoch') as date, COUNT(*) as count FROM sfmc_activities ${cond} GROUP BY date ORDER BY date DESC LIMIT 30`, vals);
        json(res, { total: totalRow[0]?.total || 0, byEvent, byDate });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path === '/api/sfmc/activities') {
      if (method === 'GET') {
        const id = params.get('id') || '';
        const event = params.get('event') || '';
        const from = params.get('from') || '';
        const to = params.get('to') || '';
        const sourceName = params.get('name') || '';
        const limit = Math.min(parseInt(params.get('limit') || '200', 10), 1000);
        const offset = parseInt(params.get('offset') || '0', 10);
        let sql = 'SELECT * FROM sfmc_activities WHERE 1=1';
        const vals = [];
        if (id) { sql += ' AND source_id = ?'; vals.push(id); }
        if (event) { sql += ' AND event_type = ?'; vals.push(event); }
        if (from) { sql += ' AND timestamp >= ?'; vals.push(parseInt(from)); }
        if (to) { sql += ' AND timestamp <= ?'; vals.push(parseInt(to)); }
        if (sourceName) { sql += ' AND source_name = ?'; vals.push(sourceName); }
        sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        vals.push(limit, offset);
        const rows = query(sql, vals);
        json(res, { entries: rows, count: rows.length, limit, offset });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (await configRoutes({ path, method, req, res })) {
      return;
    }

    if (await moduleRoutes({ path, method, req, res })) {
      return;
    }

    // ────── /api/sfmc/areas ──────
    if (path === '/api/sfmc/areas') {
      if (method === 'GET') {
        const module = params.get('module') || '';
        let sql = 'SELECT * FROM sfmc_config_areas WHERE 1=1';
        const vals = [];
        if (module) { sql += ' AND module = ?'; vals.push(module); }
        json(res, { areas: query(sql, vals) });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/coops (authoritative organization API) ──────
    if (path === '/api/sfmc/coops/create' && method === 'POST') {
      const data = await body(req);
      const cid = String(data.cid || '').trim(), name = String(data.name || '').trim(), actorId = String(data.actorId || '');
      if (!actorId || !/^[A-Za-z0-9_-]{3,32}$/.test(cid) || !name || name.length > 64) { json(res, { ok: false, error: 'invalid_input', details: { cid, name, actorId } }, 400); return; }
      db.exec('BEGIN IMMEDIATE');
      try {
        if (query('SELECT 1 FROM sfmc_coops WHERE cid=?', [cid]).length) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'coop_id_exists' }, 409); return; }
        if (query("SELECT 1 FROM sfmc_coop_members WHERE player_id=? AND status='active'", [actorId]).length) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'already_member' }, 409); return; }
        const account = ensureEconomyAccount(actorId, String(data.actorName || ''));
        if (account.balance < 1000) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'insufficient_funds', balance: account.balance }, 409); return; }
        const now = Date.now();
        query('UPDATE sfmc_economy_accounts SET balance=balance-1000, version=version+1, updated_at=? WHERE player_id=? AND balance>=1000', [now, actorId]);
        query('INSERT INTO sfmc_coops (cid,name,owner_player_id,owner_name_snapshot,notice,created_at,updated_at) VALUES (?,?,?,?,?,?,?)', [cid, name, actorId, String(data.actorName || ''), '社长很懒，没有写公告～', now, now]);
        query('INSERT INTO sfmc_coop_members (cid,player_id,player_name_snapshot,role,joined_at) VALUES (?,?,?,?,?)', [cid, actorId, String(data.actorName || ''), 'owner', now]);
        query('INSERT INTO sfmc_coop_accounts (cid,updated_at) VALUES (?,?)', [cid, now]);
        const tx = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        query('INSERT INTO sfmc_economy_transactions (id,transaction_type,actor_id,source_player_id,target_player_id,amount,balance_before,balance_after,reference_type,reference_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [tx, 'coop.create', actorId, actorId, null, 1000, account.balance, account.balance - 1000, 'coop', cid, '创建合作社', now]);
        query('INSERT INTO sfmc_coop_audit_logs (cid,actor_id,action,after_state,transaction_id,created_at) VALUES (?,?,?,?,?,?)', [cid, actorId, 'coop.create', JSON.stringify({ name }), tx, now]);
        const coop = query('SELECT * FROM sfmc_coops WHERE cid=?', [cid])[0];
        db.exec('COMMIT');
        json(res, { ok: true, coop, transactionId: tx, balance: account.balance - 1000 });
      } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { ok: false, error: error.message || 'create_failed' }, 500); }
      return;
    }

    if (path.startsWith('/api/sfmc/coops/by-player/') && method === 'GET') {
      const playerId = decodeURIComponent(path.slice('/api/sfmc/coops/by-player/'.length));
      const row = query("SELECT c.* FROM sfmc_coops c JOIN sfmc_coop_members m ON m.cid=c.cid WHERE m.player_id=? AND m.status='active' AND c.status='active'", [playerId])[0];
      json(res, { coop: row || null }); return;
    }

    if (path.startsWith('/api/sfmc/coops/') && !path.includes('/shop_items') && !path.includes('/shop_groups')) {
      const parts = path.slice('/api/sfmc/coops/'.length).split('/');
      const cid = decodeURIComponent(parts[0]), sub = parts[1], playerId = parts[2];
      const coop = query("SELECT * FROM sfmc_coops WHERE cid=?", [cid])[0];
      if (!coop) { json(res, { ok: false, error: 'not_found' }, 404); return; }
      const roleOf = (id) => query("SELECT role FROM sfmc_coop_members WHERE cid=? AND player_id=? AND status='active' AND (expires_at IS NULL OR expires_at>?)", [cid, id, Date.now()])[0]?.role || null;
      const can = (id, capability) => { const role = roleOf(id); return role === 'owner' || (role === 'admin' && ['manage_notice','manage_members','manage_shop','audit'].includes(capability)) || (role === 'member' && ['view','deposit','withdraw'].includes(capability)); };
      const snapshot = () => ({ ...query("SELECT * FROM sfmc_coops WHERE cid=?", [cid])[0], account: query('SELECT * FROM sfmc_coop_accounts WHERE cid=?', [cid])[0], members: query('SELECT * FROM sfmc_coop_members WHERE cid=?', [cid]) });
      if (!sub && method === 'GET') { json(res, { ok: true, coop: snapshot() }); return; }
      if (sub === 'settings' && method === 'PATCH') {
        const data = await body(req), actorId = String(data.actorId || ''), feeBps = Number(data.feeBps);
        if (roleOf(actorId) !== 'owner') { json(res, { ok: false, error: 'forbidden' }, 403); return; }
        if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 3000) { json(res, { ok: false, error: 'invalid_fee' }, 400); return; }
        const now = Date.now(), before = query('SELECT fee_bps FROM sfmc_coops WHERE cid=?', [cid])[0];
        db.exec('BEGIN IMMEDIATE');
        try {
          query('UPDATE sfmc_coops SET fee_bps=?,version=version+1,updated_at=? WHERE cid=? AND status=\'active\'', [feeBps, now, cid]);
          const tx = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
          query('INSERT INTO sfmc_coop_audit_logs (cid,actor_id,action,before_state,after_state,transaction_id,created_at) VALUES (?,?,?,?,?,?,?)', [cid, actorId, 'coop.fee_change', JSON.stringify(before), JSON.stringify({ fee_bps: feeBps }), tx, now]);
          db.exec('COMMIT'); json(res, { ok: true, feeBps, transactionId: tx, coop: snapshot() });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { ok: false, error: error.message || 'settings_failed' }, 500); }
        return;
      }
      if (sub === 'members' && method === 'GET') { json(res, { ok: true, members: query('SELECT * FROM sfmc_coop_members WHERE cid=?', [cid]) }); return; }
      if (sub === 'invites' && method === 'GET') {
        const inviteeId = String(params.get('playerId') || '');
        json(res, { ok: true, invites: query("SELECT * FROM sfmc_coop_invites WHERE cid=? AND invitee_id=? AND status='pending' AND expires_at>? ORDER BY created_at DESC", [cid, inviteeId, Date.now()]) }); return;
      }
      if (sub === 'invites' && !parts[2] && method === 'POST') {
        const data = await body(req), actorId = String(data.actorId || ''), inviteeId = String(data.playerId || ''), role = String(data.role || 'member');
        if (!can(actorId, 'manage_members') || !inviteeId || !['admin', 'member'].includes(role)) { json(res, { ok: false, error: 'forbidden' }, 403); return; }
        if (query("SELECT 1 FROM sfmc_coop_members WHERE player_id=? AND status='active'", [inviteeId]).length) { json(res, { ok: false, error: 'already_member' }, 409); return; }
        const now = Date.now(), id = `I${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
        query("UPDATE sfmc_coop_invites SET status='revoked' WHERE cid=? AND invitee_id=? AND status='pending'", [cid, inviteeId]);
        query('INSERT INTO sfmc_coop_invites (id,cid,inviter_id,invitee_id,invitee_name_snapshot,role,status,expires_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)', [id, cid, actorId, inviteeId, String(data.playerName || ''), role, 'pending', now + 7 * 86400000, now]);
        json(res, { ok: true, invite: query('SELECT * FROM sfmc_coop_invites WHERE id=?', [id])[0] }); return;
      }
      if (sub === 'invites' && parts[2] === 'accept' && method === 'POST') {
        const data = await body(req), actorId = String(data.actorId || ''), inviteId = String(data.inviteId || '');
        db.exec('BEGIN IMMEDIATE');
        try {
          const invite = query("SELECT * FROM sfmc_coop_invites WHERE id=? AND cid=? AND invitee_id=? AND status='pending' AND expires_at>?", [inviteId, cid, actorId, Date.now()])[0];
          if (!invite) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'invite_not_found' }, 404); return; }
          if (query("SELECT 1 FROM sfmc_coop_members WHERE player_id=? AND status='active'", [actorId]).length) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'already_member' }, 409); return; }
          query('INSERT INTO sfmc_coop_members (cid,player_id,player_name_snapshot,role,joined_at) VALUES (?,?,?,?,?)', [cid, actorId, String(data.playerName || invite.invitee_name_snapshot), invite.role, Date.now()]);
          query("UPDATE sfmc_coop_invites SET status='accepted' WHERE id=?", [inviteId]); db.exec('COMMIT'); json(res, { ok: true, coop: snapshot() });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { ok: false, error: error.message || 'invite_accept_failed' }, 500); }
        return;
      }
      if (sub === 'audit' && method === 'GET') {
        const auditActorId = String(params.get('actorId') || '');
        if (auditActorId !== String(coop.owner_player_id) && !can(auditActorId, 'audit')) { json(res, { ok: false, error: 'forbidden' }, 403); return; }
        json(res, { ok: true, logs: query('SELECT * FROM sfmc_coop_audit_logs WHERE cid=? ORDER BY created_at DESC LIMIT 200', [cid]) }); return;
      }
      if (sub === 'members' && parts[2] === 'join' && method === 'POST') {
        const data = await body(req), actorId = String(data.actorId || '');
        if (!actorId || actorId !== String(data.playerId || '') || query("SELECT 1 FROM sfmc_coop_members WHERE player_id=? AND status='active'", [actorId]).length) { json(res, { ok: false, error: 'already_member' }, 409); return; }
        query('INSERT INTO sfmc_coop_members (cid,player_id,player_name_snapshot,role,joined_at) VALUES (?,?,?,?,?)', [cid, actorId, String(data.playerName || ''), 'member', Date.now()]);
        json(res, { ok: true, coop: snapshot() }); return;
      }
      if (sub === 'members' && parts[2] === 'leave' && method === 'POST') {
        const data = await body(req), actorId = String(data.actorId || ''), role = roleOf(actorId);
        if (!role || role === 'owner') { json(res, { ok: false, error: role === 'owner' ? 'owner_cannot_leave' : 'not_member' }, 409); return; }
        query("UPDATE sfmc_coop_members SET status='removed',version=version+1 WHERE cid=? AND player_id=?", [cid, actorId]);
        json(res, { ok: true }); return;
      }
      if (sub === 'members' && method === 'POST') {
        const data = await body(req); const actorId = String(data.actorId || ''), targetId = String(data.playerId || '');
        if (!can(actorId, 'manage_members')) { json(res, { ok: false, error: 'forbidden' }, 403); return; }
        if (!targetId || query("SELECT 1 FROM sfmc_coop_members WHERE player_id=? AND status='active'", [targetId]).length) { json(res, { ok: false, error: 'already_member' }, 409); return; }
        query('INSERT INTO sfmc_coop_members (cid,player_id,player_name_snapshot,role,joined_at) VALUES (?,?,?,?,?)', [cid, targetId, String(data.playerName || ''), 'member', Date.now()]);
        json(res, { ok: true, coop: snapshot() }); return;
      }
      if (sub === 'members' && method === 'PATCH' && playerId) {
        const data = await body(req); if (!can(String(data.actorId || ''), 'manage_members') || !['admin','member'].includes(String(data.role))) { json(res, { ok: false, error: 'forbidden' }, 403); return; }
        query('UPDATE sfmc_coop_members SET role=?,version=version+1 WHERE cid=? AND player_id=? AND role<>\'owner\'', [String(data.role), cid, decodeURIComponent(playerId)]);
        json(res, { ok: true, coop: snapshot() }); return;
      }
      if (sub === 'treasury' && (parts[2] === 'deposit' || parts[2] === 'withdraw') && method === 'POST') {
        const data = await body(req), actorId = String(data.actorId || ''), amount = Number(data.amount), mode = parts[2];
        if (!can(actorId, mode) || !Number.isSafeInteger(amount) || amount <= 0) { json(res, { ok: false, error: 'invalid_transaction' }, 400); return; }
        db.exec('BEGIN IMMEDIATE');
        try {
          const coopAccount = query('SELECT * FROM sfmc_coop_accounts WHERE cid=?', [cid])[0], player = ensureEconomyAccount(actorId, String(data.actorName || ''));
          if (mode === 'deposit' && player.balance < amount) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'insufficient_funds' }, 409); return; }
          if (mode === 'withdraw' && coopAccount.balance < amount) { db.exec('ROLLBACK'); json(res, { ok: false, error: 'insufficient_coop_funds' }, 409); return; }
          const now = Date.now(), tx = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`, delta = mode === 'deposit' ? amount : -amount;
          query('UPDATE sfmc_economy_accounts SET balance=balance-?,version=version+1,updated_at=? WHERE player_id=?', [delta, now, actorId]);
          query('UPDATE sfmc_coop_accounts SET balance=balance+?,version=version+1,updated_at=? WHERE cid=?', [delta, now, cid]);
          query('INSERT INTO sfmc_economy_transactions (id,transaction_type,actor_id,source_player_id,target_player_id,amount,balance_before,balance_after,reference_type,reference_id,reason,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', [tx, `coop.${mode}`, actorId, mode === 'deposit' ? actorId : null, mode === 'deposit' ? null : actorId, amount, player.balance, player.balance - delta, 'coop', cid, `合作社${mode === 'deposit' ? '存款' : '取款'}`, now]);
          query('INSERT INTO sfmc_coop_bank_log (cid,actor_id,actor_name_snapshot,type,amount,note,transaction_id,created_at) VALUES (?,?,?,?,?,?,?,?)', [cid, actorId, String(data.actorName || ''), mode === 'deposit' ? 1 : 2, amount, String(data.note || ''), tx, now]);
          db.exec('COMMIT');
          json(res, { ok: true, transactionId: tx, playerBalance: player.balance - delta, coopBalance: coopAccount.balance + delta });
        } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { ok: false, error: error.message || 'treasury_failed' }, 500); }
        return;
      }
      if (!sub && (method === 'PATCH' || method === 'PUT')) {
        const data = await body(req); if (!can(String(data.actorId || ''), 'manage_notice')) { json(res, { ok: false, error: 'forbidden' }, 403); return; }
        const sets = ['updated_at=?','version=version+1'], values = [Date.now()]; if (data.name !== undefined) { sets.push('name=?'); values.push(String(data.name)); } if (data.notice !== undefined) { sets.push('notice=?'); values.push(String(data.notice)); } values.push(cid); query(`UPDATE sfmc_coops SET ${sets.join(',')} WHERE cid=? AND status='active'`, values); json(res, { ok: true, coop: snapshot() }); return;
      }
      if (!sub && method === 'DELETE') {
         const data = await body(req); if (roleOf(String(data.actorId || '')) !== 'owner') { json(res, { ok: false, error: 'forbidden' }, 403); return; }
         const account = query('SELECT balance FROM sfmc_coop_accounts WHERE cid=?', [cid])[0]; const stock = query('SELECT SUM(num) AS total FROM sfmc_coop_shop_items WHERE cid=? AND type=1', [cid])[0]?.total || 0;
         if ((account?.balance || 0) !== 0 || stock !== 0) { json(res, { ok: false, error: 'assets_not_empty' }, 409); return; }
         const before = { coop, account, stock };
         const now = Date.now(), tx = `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
         db.exec('BEGIN IMMEDIATE');
         try {
           query("UPDATE sfmc_coops SET status='dissolved',updated_at=?,version=version+1 WHERE cid=? AND status='active'", [now, cid]);
           query("UPDATE sfmc_coop_members SET status='removed',version=version+1 WHERE cid=? AND status='active'", [cid]);
           query('INSERT INTO sfmc_coop_audit_logs (cid,actor_id,action,before_state,after_state,transaction_id,created_at) VALUES (?,?,?,?,?,?,?)', [cid, String(data.actorId), 'coop.dissolve', JSON.stringify(before), JSON.stringify({ status: 'dissolved' }), tx, now]);
           db.exec('COMMIT');
           json(res, { ok: true, transactionId: tx });
         } catch (error) { try { db.exec('ROLLBACK'); } catch {} json(res, { ok: false, error: error.message || 'dissolve_failed' }, 500); }
         return;
      }
    }

    // Legacy organization writes are disabled; authoritative state uses the routes above.
    if (path === '/api/sfmc/coops') {
      if (method === 'GET') {
        const all = query('SELECT * FROM sfmc_coops ORDER BY updated_at DESC');
        json(res, { coops: all });
      } else if (method === 'POST') {
        json(res, { ok: false, error: 'legacy_route_disabled' }, 410);
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    if (path.startsWith('/api/sfmc/coops/')) {
      const rest = path.slice('/api/sfmc/coops/'.length);
      const parts = rest.split('/');
      const cid = parts[0];
      const sub = parts[1]; // 'members', 'shop_items', 'bank_log' etc
      const subId = parts[2];
      if (!cid) { json(res, { success: false, error: 'invalid' }, 400); return; }

      // GET/PATCH/DELETE /api/sfmc/coops/:cid
      if (!sub) {
        if (method === 'GET') {
          const rows = query('SELECT * FROM sfmc_coops WHERE cid = ?', [cid]);
          if (rows.length === 0) { json(res, { success: false, error: 'not_found' }, 404); return; }
          const coop = rows[0];
          coop.members = query('SELECT * FROM sfmc_coop_members WHERE cid = ?', [cid]);
          coop.shop_items = query('SELECT * FROM sfmc_coop_shop_items WHERE cid = ?', [cid]);
          json(res, { coop });
        } else if (method === 'PATCH' || method === 'PUT') {
          json(res, { ok: false, error: 'legacy_route_disabled' }, 410);
        } else if (method === 'DELETE') {
          json(res, { ok: false, error: 'legacy_route_disabled' }, 410);
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      // /api/sfmc/coops/:cid/members
      if (sub === 'members') {
        if (method === 'GET') {
          json(res, { members: query('SELECT * FROM sfmc_coop_members WHERE cid = ?', [cid]) });
        } else if (method === 'POST') {
          const { player_name, is_op } = await body(req);
          if (!player_name) { json(res, { success: false, error: 'player_name required' }, 400); return; }
          query('INSERT OR REPLACE INTO sfmc_coop_members (cid, player_name, is_op, joined_at) VALUES (?, ?, ?, ?)', [cid, player_name, is_op ? 1 : 0, Date.now()]);
          json(res, { success: true });
        } else if (method === 'DELETE' && subId) {
          query('DELETE FROM sfmc_coop_members WHERE cid=? AND player_name=?', [cid, decodeURIComponent(subId)]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      // /api/sfmc/coops/:cid/shop_items
      if (sub === 'shop_items') {
        if (method === 'GET') {
          const type = params.get('type') || '';
          let sql = 'SELECT * FROM sfmc_coop_shop_items WHERE cid=?';
          const vals = [cid];
          if (type) { sql += ' AND type=?'; vals.push(parseInt(type)); }
          json(res, { items: query(sql, vals) });
        } else if (method === 'POST') {
          const item = await body(req);
          if (!item.id) { json(res, { success: false, error: 'id required' }, 400); return; }
          query('INSERT OR REPLACE INTO sfmc_coop_shop_items (id, cid, name, item_type, item_aux, item_nbt, type, groups, des, num, sv, money, is_true, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [item.id, cid, item.name, item.item_type, item.item_aux ?? 0, item.item_nbt || '', item.type, item.groups || '[]', item.des || '', item.num ?? 0, item.sv ?? 0, item.money ?? 0, item.is_true ?? 1, item.created_at || Date.now(), Date.now()]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      // /api/sfmc/coops/:cid/bank_log
      if (sub === 'bank_log') {
        if (method === 'GET') {
          json(res, { log: query('SELECT * FROM sfmc_coop_bank_log WHERE cid=? ORDER BY created_at DESC LIMIT 100', [cid]) });
        } else if (method === 'POST') {
          const { player_name, type, amount, note } = await body(req);
          if (!player_name || !amount) { json(res, { success: false, error: 'invalid' }, 400); return; }
          query('INSERT INTO sfmc_coop_bank_log (cid, player_name, type, amount, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [cid, player_name, type, amount, note || '', Date.now()]);
          json(res, { success: true });
        } else { json(res, { success: false, error: 'not_found' }, 404); }
        return;
      }

      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/coop_shop_groups ──────
    if (path === '/api/sfmc/coop_shop_groups') {
      if (method === 'GET') { json(res, { groups: query('SELECT * FROM sfmc_coop_shop_groups') }); return; }
      if (method === 'POST') {
        const { group } = await body(req);
        if (!group?.groupid) { json(res, { success: false, error: 'groupid required' }, 400); return; }
        query('INSERT OR REPLACE INTO sfmc_coop_shop_groups (groupid, displayname, displaydescribe, icon, type_function) VALUES (?, ?, ?, ?, ?)',
          [group.groupid, group.displayname, group.displaydescribe || '', group.icon || '', group.type_function || '']);
        json(res, { success: true }); return;
      }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/areas (GET with module filter) ──────
    // ────── /api/sfmc/permissions ──────
    if (path === '/api/sfmc/permissions') {
      if (method === 'GET') { json(res, { permissions: query('SELECT * FROM sfmc_config_permissions') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/qa ──────
    if (path === '/api/sfmc/qa') {
      if (method === 'GET') {
        const questions = query(`SELECT q.*, 
          (SELECT json_group_array(json_object('id', r.id, 'type', r.type, 'amount', r.amount, 'item_type', r.item_type, 'item_aux', r.item_aux, 'cmd', r.cmd, 'min_rank', r.min_rank, 'max_rank', r.max_rank)) FROM sfmc_config_qa_rewards r WHERE r.question_id = q.id) as rewards,
          (SELECT json_group_array(json_object('id', p.id, 'type', p.type, 'cmd', p.cmd)) FROM sfmc_config_qa_punishments p WHERE p.question_id = q.id) as punishments
          FROM sfmc_config_qa_questions q ORDER BY q.id`);
        json(res, { questions });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/clean ──────
    if (path === '/api/sfmc/clean') {
      if (method === 'GET') {
        const rows = query('SELECT * FROM sfmc_config_clean WHERE id=1');
        json(res, { clean: rows.length > 0 ? rows[0] : null });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/banned_items ──────
    if (path === '/api/sfmc/banned_items') {
      if (method === 'GET') { json(res, { items: query('SELECT item_id FROM sfmc_config_banned_items') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/grids ──────
    if (path === '/api/sfmc/grids') {
      if (method === 'GET') { json(res, { grids: query('SELECT * FROM sfmc_config_grids') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/peace_filters ──────
    if (path === '/api/sfmc/peace_filters') {
      if (method === 'GET') { json(res, { filters: query('SELECT * FROM sfmc_config_peace_filters') }); return; }
      json(res, { success: false, error: 'not_found' }, 404); return;
    }

    // ────── /api/sfmc/monitor/* ──────
    // 内存存储，SAPI 按 30 秒间隔上报，Panel 按 3 秒拉取
    if (path === '/api/sfmc/monitor/metrics') {
      if (method === 'POST') {
        const data = await body(req);
        _monitorMetrics = { tps: data.tps || 0, entities: data.entities || {}, timestamp: Date.now() };
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }
    if (path === '/api/sfmc/monitor/player-chunks') {
      if (method === 'POST') {
        const data = await body(req);
        _monitorPlayers = (data.players || []).map(p => ({ ...p, timestamp: Date.now() }));
        json(res, { success: true });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }
    if (path === '/api/sfmc/monitor/summary') {
      if (method === 'GET') {
        const now = Date.now();
        const stale = now - 60000; // 60 秒过期
        const metrics = _monitorMetrics && _monitorMetrics.timestamp > stale ? _monitorMetrics : null;
        const players = _monitorPlayers ? _monitorPlayers.filter(p => p.timestamp > stale) : [];
        const totalChunks = players.reduce((s, p) => s + (p.chunkEstimate || 0), 0);
        json(res, {
          tps: metrics ? metrics.tps : 0,
          entities: metrics ? metrics.entities : {},
          players,
          totalChunks,
          updatedAt: now,
        });
      } else { json(res, { success: false, error: 'not_found' }, 404); }
      return;
    }

    // ────── /api/sfmc/db/* — DB 浏览（Panel 数据查看）──────
    if (path === '/api/sfmc/db/tables') {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
      const result = tables.map(t => {
         const count = db.prepare(`SELECT COUNT(*) AS cnt FROM ${quoteIdentifier(t.name, 'table')}`).get();
        return { name: t.name, rows: count.cnt };
      });
      json(res, { tables: result });
      return;
    }
    if (path.startsWith('/api/sfmc/db/table/')) {
      const tname = path.slice('/api/sfmc/db/table/'.length);
      if (!tname || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tname)) {
        json(res, { success: false, error: 'invalid table name' }, 400); return;
      }
      try {
         const safeTable = quoteIdentifier(tname, 'table');
         const columns = db.prepare(`PRAGMA table_info(${safeTable})`).all();
         const rows = db.prepare(`SELECT * FROM ${safeTable} LIMIT 20`).all();
        json(res, { columns, rows });
      } catch (e) { json(res, { success: false, error: e.message }, 500); }
      return;
    }

    // 未匹配 → 404
    json(res, { success: false, error: 'not_found' }, 404);
  } catch (err) {
    console.error('[DogeDB] 错误:', err);
    json(res, { success: false, error: err.message }, 500);
  }
}

// ---------- 启动 ----------

function checkPortConflict(port) {
  return new Promise((resolve) => {
    const net = require('net');
    const tester = net.createServer()
      .once('error', (err) => resolve({ ok: false, port, error: err.code }))
      .once('listening', () => tester.once('close', () => resolve({ ok: true, port })).close())
      .listen(port, '127.0.0.1');
  });
}

async function start() {
  const portCheck = await checkPortConflict(PORT);
  if (!portCheck.ok) {
    console.error(`[DogeDB] 端口 ${PORT} 被占用 (${portCheck.error}). `);
    process.exit(2);
  }

  // 配置文件缺失字段警告
  try {
    const dbCfgPath = path.join(PROJECT_ROOT, 'configs', 'db_config.json');
    const dbCfg = JSON.parse(fs.readFileSync(dbCfgPath, 'utf-8'));
    if (dbCfg.db_port === undefined) console.warn('[DogeDB] 警告: configs/db_config.json 缺少 db_port，使用默认 3001');
  } catch {}

  await initDB();


  moduleRoutes = createModuleRoutes({
    loadModuleCatalog,
    buildModuleList,
    resolveModuleByKey,
    setModuleEnabled,
    setModuleInstalled,
    body,
    json,
  });
  configRoutes = createConfigRoutes({
    query,
    quoteIdentifier,
    body,
    json,
    path,
    loadPanelState,
    applyInitPayload,
    applyInitReset,
    runSetupChecks,
    projectRoot: PROJECT_ROOT,
    fs,
    loadModuleCatalog,
    loadModuleLock,
    saveModuleLock,
    updateModuleState,
  });

  const server = http.createServer((req, res) => {
    const startedAt = Date.now();
    res.once('finish', () => {
      console.log(`[HTTP] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - startedAt}ms`);
    });
    return handle(req, res);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[DogeDB] HTTP 服务已启动，端口 ${PORT} (loopback only)`);
    console.log(`[DogeDB] API 健康检查: http://${HOST}:${PORT}/api/health`);
    console.log(`[DogeDB] 鉴权: ${AUTH_TOKEN ? '已启用 token' : '未启用'}`);
    console.log(`[DogeDB] 控制台输入 reload 重新导入 /configs/ JSON 配置`);
  });

  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === 'help') {
      console.log('DB Server 可用命令:');
      console.log('  help    — 显示本帮助');
      console.log('  status  — 显示服务状态');
      console.log('  reload  — 重新导入配置文件');
      console.log('  stop    — 停止服务');
    } else if (cmd === 'status') {
      const info = db ? db.prepare("PRAGMA database_list").all() : [];
      console.log(`[DogeDB] 状态: 运行中`);
      console.log(`  HTTP 端口: ${PORT}`);
      console.log(`  数据库: ${DB_PATH}`);
      if (_monitorMetrics) {
        console.log(`  TPS: ${_monitorMetrics.tps ?? '-'}`);
        console.log(`  实体数: ${_monitorMetrics.entityCount ?? '-'}`);
        console.log(`  在线玩家: ${_monitorPlayers?.length ?? '-'}`);
      }
    } else if (cmd === 'reload') {
      reloadConfigsFromJson();
    } else if (cmd === 'stop') {
      console.log('[DogeDB] 正在停止服务...');
      rl.close();
      server.close();
      if (db) db.close();
      process.exit(0);
    } else {
      console.log(`[DogeDB] 未知命令: ${cmd}，输入 help 查看帮助`);
    }
  });
  rl.on('SIGINT', () => process.exit());

  process.on('exit', () => {
    if (db) db.close();
  });
}

start().catch(err => {
  console.error('[DogeDB] 启动失败:', err);
  process.exit(1);
});
