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
 * MkDocs docs_dir=docs：手写页相对链接解析后必须落在 docs/ 内。
 * 同时拦住两类误用（单一权威规则，避免再为每种前缀打洞）：
 * 1) README 仓根路径误贴：](./docs/guide/…) → 站内变成双重 docs/
 * 2) 指向仓内其它目录：](../../sfmc/…) → Pages 上 404；应改 GitHub 绝对 URL
 * TypeDoc 生成目录跳过；mkdocs exclude（plan/archive/reviews）仍检查，防草稿误贴。
 */
function assertDocsRelativeLinksStayInDocs(docsDir) {
  const bad = [];
  const linkRe = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const stack = [docsDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const rel = path.relative(docsDir, full).replace(/\\/g, "/");
        // 仅跳过 TypeDoc 输出（生成物，非手写契约）
        if (rel === "reference/sdk") continue;
        stack.push(full);
        continue;
      }
      if (!ent.name.endsWith(".md")) continue;
      const text = readFileSync(full, "utf8");
      const fileRel = path.relative(root, full).replace(/\\/g, "/");
      let m;
      linkRe.lastIndex = 0;
      while ((m = linkRe.exec(text))) {
        const raw = m[1].replace(/^<|>$/g, "");
        // 锚点 / 协议链接 / 协议相对 URL 不参与 docs_dir 解析
        if (!raw || raw.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith("//")) {
          continue;
        }
        const targetPath = raw.split("#")[0].split("?")[0];
        if (!targetPath) continue;
        const resolved = path.resolve(path.dirname(full), targetPath);
        const relToDocs = path.relative(docsDir, resolved);
        if (relToDocs.startsWith("..") || path.isAbsolute(relToDocs)) {
          bad.push(`${fileRel}: ](${raw})`);
        }
      }
    }
  }
  if (bad.length) {
    console.error(
      [
        "[docs-mkdocs] 相对链接逃出 docs/（站内应写 ./guide/ 等；仓外目标用 GitHub 绝对 URL）：",
        ...bad.map((line) => `  - ${line}`),
      ].join("\n")
    );
    process.exit(1);
  }
}

assertDocsRelativeLinksStayInDocs(path.join(root, "docs"));

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
