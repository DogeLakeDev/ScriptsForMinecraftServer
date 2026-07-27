/**
 * 调用 MkDocs（先确保 TypeDoc 已生成）
 * 用法:
 *   node tools/docs-mkdocs.mjs serve
 *   node tools/docs-mkdocs.mjs build
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] ?? "serve";

if (!["serve", "build"].includes(mode)) {
  console.error("Usage: node tools/docs-mkdocs.mjs <serve|build>");
  process.exit(1);
}

/**
 * MkDocs docs_dir=docs：页面内相对链接不应再带 ./docs/ 前缀。
 * 把 README（仓根路径）原样贴进 docs/*.md 会导致站内导航全断，且默认
 * unrecognized_links=ignore 时 CI 不会拦。在此做契约检查。
 */
function assertNoRepoRootDocsLinks(docsDir) {
  const bad = [];
  const stack = [docsDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        // TypeDoc 输出目录跳过；plan/archive 由 mkdocs exclude
        const rel = path.relative(docsDir, full).replace(/\\/g, "/");
        if (rel === "reference/sdk" || ent.name === "plan" || ent.name === "archive") continue;
        stack.push(full);
        continue;
      }
      if (!ent.name.endsWith(".md")) continue;
      const text = readFileSync(full, "utf8");
      // Markdown 链接目标：](./docs/...) 或 ](docs/...)
      if (/\]\(\.?\/?docs\//.test(text)) {
        bad.push(path.relative(root, full));
      }
    }
  }
  if (bad.length) {
    console.error(
      [
        "[docs-mkdocs] 发现仓根相对路径 docs/…（MkDocs 下应写成 ./guide/、./dev/ 等）：",
        ...bad.map((f) => `  - ${f}`),
      ].join("\n")
    );
    process.exit(1);
  }
}

assertNoRepoRootDocsLinks(path.join(root, "docs"));

// 先生成 API 文档
const gen = spawnSync(process.execPath, [path.join(root, "tools", "docs-typedoc.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (gen.status !== 0) process.exit(gen.status ?? 1);

const typedocIndex = path.join(root, "docs", "reference", "sdk", "index.md");
if (!existsSync(typedocIndex)) {
  console.error("[docs-mkdocs] missing typedoc output; run npm run docs -- api first");
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
