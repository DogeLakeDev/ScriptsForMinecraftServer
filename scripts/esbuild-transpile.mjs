/**
 * scripts/esbuild-transpile.mjs
 *
 * 逐文件 TS → ESM 转译（不 bundle），作为 tsc emit JS 的替代。
 * 可选再跑 tsc --emitDeclarationOnly 产出 .d.ts（仅带 types 导出的包使用）。
 *
 * 用法（在包根目录执行）:
 *   node ../scripts/esbuild-transpile.mjs
 *   node ../scripts/esbuild-transpile.mjs --dts
 */

import { build } from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const emitDts = process.argv.includes("--dts");
const srcDir = path.resolve("src");
const outDir = path.resolve("dist");

if (!fs.existsSync(srcDir)) {
  console.error(`[esbuild-transpile] 找不到 src/: ${srcDir}`);
  process.exit(1);
}

/** 递归收集 src 下 .ts（排除 .d.ts） */
function collectTsFiles(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...collectTsFiles(p));
    } else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".d.ts")) {
      out.push(p);
    }
  }
  return out;
}

const entryPoints = collectTsFiles(srcDir);
if (entryPoints.length === 0) {
  console.error("[esbuild-transpile] src/ 下没有 .ts 文件");
  process.exit(1);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

await build({
  entryPoints,
  outdir: outDir,
  outbase: srcDir,
  format: "esm",
  platform: "node",
  target: "node22",
  sourcemap: true,
  logLevel: "info",
});

console.log(`[esbuild-transpile] emitted ${entryPoints.length} files → dist/`);

if (emitDts) {
  console.log("[esbuild-transpile] emitting .d.ts via tsc --emitDeclarationOnly...");
  execSync("npx tsc -p tsconfig.json --emitDeclarationOnly --declaration --declarationMap", {
    stdio: "inherit",
  });
}
