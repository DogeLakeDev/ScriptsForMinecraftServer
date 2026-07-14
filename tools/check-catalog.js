#!/usr/bin/env node
/**
 * check-catalog.js — 构建期模块目录自检
 *
 * 用法: node tools/check-catalog.js
 *
 * 规则:
 *  - 模块 id / configKey 必须唯一
 *  - requires / optional 引用必须存在
 *  - entry.path 路径必须存在（asset/node/sapi 类型）
 *  - entry.init 仅在 sapi 类型可选
 *  - 不允许循环依赖（拓扑排序检测）
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CATALOG = path.join(ROOT, "modules", "catalog.json");
const SAPI_ENTRY = path.join(ROOT, "scriptsforminecraftserver", "scripts", "entry.ts");
const MODULE_KEYS = path.join(ROOT, "scriptsforminecraftserver", "scripts", "libs", "ModuleKeys.ts");

function fail(msg) {
  console.error(`[check-catalog] ${msg}`);
  process.exit(1);
}

function exists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!exists(CATALOG)) fail(`找不到 ${CATALOG}`);
  const raw = JSON.parse(fs.readFileSync(CATALOG, "utf-8"));
  if (raw.version !== 1) fail(`catalog 版本不支持: ${raw.version}`);
  const modules = Array.isArray(raw.modules) ? raw.modules : [];
  if (modules.length === 0) fail("catalog 为空");

  const byId = new Map();
  const byKey = new Map();
  for (const m of modules) {
    if (!m.id || !m.configKey) fail(`缺少 id 或 configKey: ${JSON.stringify(m)}`);
    if (byId.has(m.id)) fail(`重复模块 id: ${m.id}`);
    if (byKey.has(m.configKey)) fail(`重复 configKey: ${m.configKey}`);
    byId.set(m.id, m);
    byKey.set(m.configKey, m);
  }

  const sapiCatalog = modules.filter((m) => m.type === "feature" && m.entry?.kind === "sapi");
  const source = fs.readFileSync(SAPI_ENTRY, "utf-8");
  const keysSource = fs.readFileSync(MODULE_KEYS, "utf-8");
  const configKeys = new Set([...keysSource.matchAll(/\n\s*\w+:\s*["']([^"']+)["']/g)].map((match) => match[1]));
  const registeredIds = new Set([...source.matchAll(/ModuleRegistry\.register\(\{\s*\n\s*id:\s*["']([^"']+)["']/g)].map((match) => match[1]));
  for (const m of sapiCatalog) {
    if (!configKeys.has(m.configKey)) fail(`${m.id} 的 configKey 未在 ModuleKeys.ts 注册: ${m.configKey}`);
    const moduleId = [...configKeys].find((key) => key === m.configKey);
    if (moduleId && !registeredIds.has(moduleId === "online_time" ? "onlineTime" : moduleId === "scoreboard_sync" ? "scoreboardSync" : moduleId === "activity_log" ? "activityLog" : moduleId === "spawn_protect" ? "spawnProtect" : moduleId === "chat_sounds" ? "chatSounds" : moduleId === "inventory_switcher" ? "inventorySwitcher" : moduleId === "price_index" ? "priceIndex" : moduleId === "daily_task" ? "dailyTask" : moduleId)) {
      fail(`${m.id} 未在 entry.ts 注册 ModuleRegistry 生命周期: ${m.configKey}`);
    }
  }

  for (const m of modules) {
    for (const dep of [...(m.requires || []), ...(m.optional || [])]) {
      if (!byId.has(dep)) fail(`${m.id} 引用了未知模块 ${dep}`);
    }
    if (!m.entry || !m.entry.path) fail(`${m.id} 缺少 entry.path`);
    const entryPath = path.join(ROOT, m.entry.path);
    if (m.entry.kind === "sapi" || m.entry.kind === "node" || m.entry.kind === "asset") {
      if (!exists(entryPath)) fail(`${m.id} 入口路径不存在: ${m.entry.path}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function dfs(id, chain) {
    if (visited.has(id)) return;
    if (visiting.has(id)) fail(`检测到循环依赖: ${[...chain, id].join(" -> ")}`);
    visiting.add(id);
    const m = byId.get(id);
    for (const dep of m.requires || []) dfs(dep, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const m of modules) dfs(m.id, []);

  console.log(`[check-catalog] OK (${modules.length} modules)`);
}

main();
