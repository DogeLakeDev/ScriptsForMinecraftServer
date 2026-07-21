/**
 * check-modules.js — 校验 packages/*/sapi/manifest.json 全部 v2 合规
 *
 * 检查项:
 *   - 必须 schemaVersion=2
 *   - 必须有 id / name / type / configKey
 *   - permissions 数组元素都是 string
 *   - services.provides / services.requires 数组合法(name 非空,无重名)
 *   - 不允许出现 routes/tables/migrations/seeds/handlers/events 字段
 *
 * 用法:node tools/check-modules.js
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const packagesDir = resolve(root, "packages");

const VALID_TYPES = new Set(["core", "feature"]);
const IDENT = /^[A-Za-z0-9_-]+$/;

const errors = [];

function fail(modId, msg) {
  errors.push(`${modId}: ${msg}`);
}

function checkOne(modId, manifestPath) {
  if (!existsSync(manifestPath)) {
    fail(modId, `${manifestPath} 不存在`);
    return;
  }
  let raw;
  try {
    raw = readFileSync(manifestPath, "utf8");
  } catch (e) {
    fail(modId, `读 ${manifestPath} 失败: ${e.message}`);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    fail(modId, `${manifestPath} 非合法 JSON: ${e.message}`);
    return;
  }
  if (typeof parsed.schemaVersion !== "number") {
    fail(modId, "schemaVersion 缺失");
    return;
  }
  if (parsed.schemaVersion !== 2) {
    fail(modId, `schemaVersion=${parsed.schemaVersion} (需要 2)`);
    return;
  }
  if (typeof parsed.id !== "string" || !IDENT.test(parsed.id)) {
    fail(modId, `id 缺失或非法 "${parsed.id}"`);
  }
  if (typeof parsed.name !== "string" || parsed.name.length === 0) {
    fail(modId, "name 缺失");
  }
  if (typeof parsed.type !== "string" || !VALID_TYPES.has(parsed.type)) {
    fail(modId, `type 必须是 core|feature ("${parsed.type}")`);
  }
  if (typeof parsed.configKey !== "string" || parsed.configKey.length === 0) {
    fail(modId, "configKey 缺失");
  }
  if (!Array.isArray(parsed.requires)) fail(modId, "requires 必须是数组");
  if (!Array.isArray(parsed.permissions)) fail(modId, "permissions 必须是数组");
  for (const p of parsed.permissions ?? []) {
    if (typeof p !== "string") fail(modId, `permissions 项非 string: ${JSON.stringify(p)}`);
  }
  for (const forbidden of ["routes", "tables", "migrations", "seeds", "handlers", "events"]) {
    if (Array.isArray(parsed[forbidden])) {
      fail(modId, `不再支持 ${forbidden} 字段,改用 db.defineTable + platform routes`);
    }
  }
  const services = parsed.services ?? { provides: [], requires: [] };
  if (typeof services !== "object" || services === null) {
    fail(modId, "services 必须是对象");
  } else {
    checkServiceList(modId, "provides", services.provides);
    checkServiceList(modId, "requires", services.requires);
  }
}

function checkServiceList(modId, dir, list) {
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    fail(modId, `services.${dir} 必须是数组`);
    return;
  }
  const seen = new Set();
  for (const item of list) {
    if (typeof item !== "object" || item === null) {
      fail(modId, `services.${dir} 项必须是对象`);
      continue;
    }
    if (typeof item.name !== "string" || item.name.length === 0) {
      fail(modId, `services.${dir} 项缺少 name`);
      continue;
    }
    if (seen.has(item.name)) fail(modId, `services.${dir} name 重复 "${item.name}"`);
    seen.add(item.name);
  }
}

const ids = readdirSync(packagesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

for (const id of ids) {
  const manifestPath = resolve(packagesDir, id, "sapi", "manifest.json");
  checkOne(id, manifestPath);
}

if (errors.length > 0) {
  console.error("❌ check-modules 失败:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ check-modules OK: ${ids.length} modules v2-compliant`);