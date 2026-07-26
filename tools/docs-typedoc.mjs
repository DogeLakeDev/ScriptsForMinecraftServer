/**
 * 生成 @sfmc-bds/sdk 的 TypeDoc Markdown，写入 docs/reference/sdk/
 * 用法: node tools/docs-typedoc.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "docs", "reference", "sdk");

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    // Windows 上 npm/npx 是 .cmd，需要 shell；参数已固定无用户输入
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

console.log("[docs-typedoc] generating @sfmc-bds/sdk → docs/reference/sdk/");
// 直接跑本地 typedoc，避免 npx shell 拼接警告
const typedocBin = path.join(
  root,
  "node_modules",
  "typedoc",
  "bin",
  "typedoc"
);
run(process.execPath, [typedocBin, "--options", "typedoc.json"]);

// TypeDoc 会清空 out 目录，补回 awesome-pages 导航
mkdirSync(outDir, { recursive: true });
const pagesPath = path.join(outDir, ".pages");
writeFileSync(
  pagesPath,
  ["title: SDK 类型参考", "nav:", "  - index.md", "  - ...", ""].join("\n"),
  "utf8"
);

if (!existsSync(path.join(outDir, "index.md"))) {
  console.error("[docs-typedoc] ERROR: index.md was not generated");
  process.exit(1);
}

console.log("[docs-typedoc] done");
