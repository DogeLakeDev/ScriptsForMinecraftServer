#!/usr/bin/env node
/**
 * tools/docs.mjs — 文档统一入口
 *
 *   node tools/docs.mjs api     # TypeDoc → docs/reference/sdk
 *   node tools/docs.mjs build   # MkDocs build（会先跑 typedoc）
 *   node tools/docs.mjs serve   # MkDocs serve
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cmd = process.argv[2];

if (!cmd || !["api", "build", "serve"].includes(cmd)) {
  console.error("用法: node tools/docs.mjs <api|build|serve>");
  process.exit(2);
}

/** @param {string} rel @param {string[]} [args] */
function run(rel, args = []) {
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", rel), ...args], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (r.error) throw r.error;
  process.exit(r.status ?? 1);
}

if (cmd === "api") {
  run("docs-typedoc.mjs");
} else {
  run("docs-mkdocs.mjs", [cmd]);
}
