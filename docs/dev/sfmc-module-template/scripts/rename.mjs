#!/usr/bin/env node
/**
 * scripts/rename.mjs — 把模板里 `example` 占位符替换为你的模块 id。
 *
 * 用法：
 *   node scripts/rename.mjs <kebab-id> [--name <显示名>]
 *
 * 改的文件：
 *   - package.json#name
 *   - sapi/manifest.json (id / name / configKey / permissions)
 *   - sapi/src/index.ts  (MODULE_ID / PERM / 命令字符串)
 *   - test/example.test.ts (import 路径 + 描述)
 *   - README.md (替换 example 为新 id)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const PLACEHOLDER_ID = "example";
const PLACEHOLDER_PERM = "example.use";
const PLACEHOLDER_LOGICAL = "feature-example";
const PLACEHOLDER_CONFIG = "example";
const PLACEHOLDER_DISPLAY = "示例模块";

function die(msg, code = 1) {
  console.error(`[rename] ${msg}`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = { name: null };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--name") flags.name = argv[++i] ?? null;
    else if (a.startsWith("--name=")) flags.name = a.slice("--name=".length);
    else if (a.startsWith("--")) die(`未知参数: ${a}`);
    else positional.push(a);
  }
  return { flags, positional };
}

const KEBAB_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function main() {
  const ROOT = process.cwd();
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const folderId = positional[0];
  if (!folderId) die("用法: node scripts/rename.mjs <kebab-id> [--name 显示名]");
  if (!KEBAB_RE.test(folderId)) die(`id 须为小写 kebab-case（例: my-feature），收到: ${folderId}`);
  if (folderId === PLACEHOLDER_ID) die("id 不能仍为 example；请换一个。");

  const logicalId = `feature-${folderId}`;
  const configKey = folderId.replace(/-/g, "_");
  const perm = folderId.replace(/-/g, "_");
  const displayName = (flags.name ?? folderId).trim();

  const replace = (file, replacer) => {
    const abs = path.join(ROOT, file);
    if (!fs.existsSync(abs)) {
      console.warn(`[rename] 跳过（不存在）: ${file}`);
      return;
    }
    const before = fs.readFileSync(abs, "utf8");
    const after = replacer(before);
    if (after === before) {
      console.log(`[rename] 无变更: ${file}`);
      return;
    }
    fs.writeFileSync(abs, after, "utf8");
    console.log(`[rename] 已写入: ${file}`);
  };

  replace("package.json", (s) =>
    s.replaceAll(`@sfmc-bds/module-${PLACEHOLDER_ID}`, `@sfmc-bds/module-${folderId}`)
  );

  replace("sapi/manifest.json", (s) => {
    let r = s;
    r = r.replaceAll(`"${PLACEHOLDER_LOGICAL}"`, `"${logicalId}"`);
    r = r.replaceAll(`"${PLACEHOLDER_DISPLAY}"`, `"${displayName}"`);
    r = r.replaceAll(`"${PLACEHOLDER_CONFIG}"`, `"${configKey}"`);
    r = r.replaceAll(`config:read:${PLACEHOLDER_CONFIG}`, `config:read:${configKey}`);
    return r;
  });

  replace("sapi/src/index.ts", (s) => {
    let r = s;
    r = r.replaceAll(`"${PLACEHOLDER_LOGICAL}"`, `"${logicalId}"`);
    r = r.replaceAll(`"${PLACEHOLDER_PERM}"`, `"${perm}.use"`);
    r = r.replaceAll(`"${PLACEHOLDER_ID}"`, `"${folderId}"`);
    r = r.replaceAll(`"${PLACEHOLDER_DISPLAY}"`, `"${displayName}"`);
    return r;
  });

  replace("README.md", (s) => s.replaceAll(PLACEHOLDER_ID, folderId));

  console.log(`\n[rename] 完成。新 id: ${folderId}（manifest id: ${logicalId}）`);
  console.log("[rename] 接下来:");
  console.log("          npm install");
  console.log("          npm run typecheck");
  console.log("          （在主仓）sfmc mod install --from local --link");
}

main();
