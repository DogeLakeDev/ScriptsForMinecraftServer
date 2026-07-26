/**
 * 调用 MkDocs（先确保 TypeDoc 已生成）
 * 用法:
 *   node tools/docs-mkdocs.mjs serve
 *   node tools/docs-mkdocs.mjs build
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "serve";

if (!["serve", "build"].includes(mode)) {
  console.error("Usage: node tools/docs-mkdocs.mjs <serve|build>");
  process.exit(1);
}

// 先生成 API 文档
const gen = spawnSync(process.execPath, [path.join(root, "tools", "docs-typedoc.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (gen.status !== 0) process.exit(gen.status ?? 1);

const typedocIndex = path.join(root, "docs", "reference", "sdk", "index.md");
if (!existsSync(typedocIndex)) {
  console.error("[docs-mkdocs] missing typedoc output; run npm run docs:api first");
  process.exit(1);
}

const args = mode === "serve" ? ["serve", "-a", "127.0.0.1:8000"] : ["build"];

function tryMkdocs(cmd, cmdArgs, useShell = false) {
  return spawnSync(cmd, cmdArgs, {
    cwd: root,
    stdio: "inherit",
    shell: useShell,
    env: process.env,
  });
}

// 优先 python -m（跨平台稳定，无需 shell）
let r = tryMkdocs("python", ["-m", "mkdocs", ...args], false);
if (r.error || r.status !== 0) {
  // Windows 上 mkdocs 可能是 .cmd
  const fallback = tryMkdocs("mkdocs", args, process.platform === "win32");
  if (!fallback.error) r = fallback;
}

if (r.status !== 0) {
  console.error(
    [
      "[docs-mkdocs] MkDocs 失败。请先安装 Python 依赖：",
      "  pip install -r docs/requirements.txt",
    ].join("\n")
  );
  process.exit(r.status ?? 1);
}
