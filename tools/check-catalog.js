#!/usr/bin/env node
/**
 * check-catalog.js — 构建期模块目录自检
 *
 * 用法: node tools/check-catalog.js
 *
 * 规则:
 *  - modules/catalog.json 允许为空（业务模块外置到 Tanya7z/sfmc-modules）
 *  - services/catalog.json 必须存在且非空（平台服务仍是本仓真相源）
 *  - 模块 id / configKey 必须唯一
 *  - requires / optional 引用必须存在
 *  - modules/catalog 的 entry.path 路径必须存在（asset/node/sapi 类型）
 *  - entry.init 仅在 sapi 类型可选
 *  - 不允许循环依赖（拓扑排序检测）
 */
// 仓库根 package.json 未声明 "type": "module"，本文件按 CommonJS 解析；
// 与其余 tools/*.js 保持一致改用 require()，避免在未开启 ESM 探测的 Node
// 版本（例如 CI 固定的 node-version）上直接抛出 "Cannot use import
// statement outside a module" 而崩溃。
const { accessSync, constants, readFileSync } = require("node:fs");
const { resolve, join } = require("node:path");

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

/**
 * 校验一份 catalog 模块列表（modules/catalog 或 services/catalog）。
 * 空列表合法：业务模块已外置到 Tanya7z/sfmc-modules，本地 mirror 可为 [].
 */
function validateModuleList(modules, { label, requireEntryOnDisk }) {
  if (!Array.isArray(modules)) fail(`${label}: modules 必须是数组`);

  const byId = new Map();
  const byKey = new Map();
  for (const m of modules) {
    if (!m.id || !m.configKey) fail(`${label}: 缺少 id 或 configKey: ${JSON.stringify(m)}`);
    if (byId.has(m.id)) fail(`${label}: 重复模块 id: ${m.id}`);
    if (byKey.has(m.configKey)) fail(`${label}: 重复 configKey: ${m.configKey}`);
    byId.set(m.id, m);
    byKey.set(m.configKey, m);
  }

  for (const m of modules) {
    for (const dep of [...(m.requires || []), ...(m.optional || [])]) {
      if (!byId.has(dep)) fail(`${label}: ${m.id} 引用了未知模块 ${dep}`);
    }
    if (!m.entry || !m.entry.path) fail(`${label}: ${m.id} 缺少 entry.path`);
    if (requireEntryOnDisk && (m.entry.kind === "sapi" || m.entry.kind === "node" || m.entry.kind === "asset")) {
      const entryPath = join(ROOT, m.entry.path);
      if (!exists(entryPath)) fail(`${label}: ${m.id} 入口路径不存在: ${m.entry.path}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function dfs(id, chain) {
    if (visited.has(id)) return;
    if (visiting.has(id)) fail(`${label}: 检测到循环依赖: ${[...chain, id].join(" -> ")}`);
    visiting.add(id);
    const m = byId.get(id);
    for (const dep of m.requires || []) dfs(dep, [...chain, id]);
    visiting.delete(id);
    visited.add(id);
  }
  for (const m of modules) dfs(m.id, []);

  return modules.length;
}

function main() {
  if (!exists(CATALOG)) fail(`找不到 ${CATALOG}`);
  const raw = JSON.parse(readFileSync(CATALOG, "utf-8"));
  if (raw.version !== 1) fail(`catalog 版本不支持: ${raw.version}`);
  const modules = Array.isArray(raw.modules) ? raw.modules : [];
  // 业务包外置后 modules/catalog.json 允许为空；仍校验其 schema 与依赖闭包。
  const featureCount = validateModuleList(modules, {
    label: "modules/catalog.json",
    requireEntryOnDisk: true,
  });

  // 平台服务 catalog 仍是本仓库内置真相源，必须存在且非空。
  if (!exists(SERVICES_CATALOG)) fail(`找不到 ${SERVICES_CATALOG}`);
  const svc = JSON.parse(readFileSync(SERVICES_CATALOG, "utf-8"));
  if (svc.version !== 1) fail(`services/catalog.json 版本不支持: ${svc.version}`);
  const serviceCount = validateModuleList(svc.modules || [], {
    label: "services/catalog.json",
    // dist 入口在 CI build 后才存在；此处只校验 schema/依赖，不强制 dist 落盘。
    requireEntryOnDisk: false,
  });
  if (serviceCount === 0) fail("services/catalog.json 为空");

  console.log(`[check-catalog] OK (${featureCount} feature modules, ${serviceCount} services)`);
}

main();
