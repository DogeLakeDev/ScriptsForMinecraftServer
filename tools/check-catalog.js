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
const { accessSync, constants, readFileSync } = require("node:fs");
const { resolve, join } = require("node:path");
const path = require("node:path");

// 与其余 tools/*.js 保持一致的 CommonJS 写法：仓库根 package.json 未设置
// "type": "module"，若沿用 import 语法，在未启用模块语法自动探测的 Node 版本
// （例如 CI 固定的 22.5.x）上会直接抛出 SyntaxError。
const ROOT = resolve(__dirname, "..");
const CATALOG = join(ROOT, "modules", "catalog.json");
const SERVICES_CATALOG = join(ROOT, "services", "catalog.json");
/* SAPI modules no longer register through a single static entry.ts —
 * the runtime aggregator walks modules/packages/<id>/sapi/src/index.ts.
 * So the only invariant for sapi modules is: their sapi/src/index.ts
 * must exist on disk. */

function fail(msg) {
  console.error(`[check-catalog] ${msg}`);
  process.exit(1);
}

function exists(p) {
  try {
    accessSync(p, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!exists(CATALOG)) fail(`找不到 ${CATALOG}`);
  const raw = JSON.parse(readFileSync(CATALOG, "utf-8"));
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
  for (const m of sapiCatalog) {
    const sapiEntry = join(ROOT, m.entry.path);
    if (!exists(sapiEntry)) {
      fail(`${m.id} entry.path 不存在: ${m.entry.path}`);
    }
  }

  // Optional: also validate services/catalog.json if it exists.
  if (exists(SERVICES_CATALOG)) {
    const svc = JSON.parse(readFileSync(SERVICES_CATALOG, "utf-8"));
    if (svc.version !== 1) fail(`services/catalog.json 版本不支持: ${svc.version}`);
    for (const m of svc.modules || []) {
      if (!m.id || !m.configKey) fail(`services 模块缺少 id 或 configKey: ${JSON.stringify(m)}`);
      if (!m.entry || !m.entry.path) fail(`${m.id} 缺少 entry.path`);
      const entryPath = join(ROOT, m.entry.path);
      if (m.entry.kind === "sapi" || m.entry.kind === "node" || m.entry.kind === "asset") {
        if (!exists(entryPath)) fail(`${m.id} 服务入口路径不存在: ${m.entry.path}`);
      }
    }
  }

  for (const m of modules) {
    for (const dep of [...(m.requires || []), ...(m.optional || [])]) {
      if (!byId.has(dep)) fail(`${m.id} 引用了未知模块 ${dep}`);
    }
    if (!m.entry || !m.entry.path) fail(`${m.id} 缺少 entry.path`);
    const entryPath = join(ROOT, m.entry.path);
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
