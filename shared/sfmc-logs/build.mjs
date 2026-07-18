/**
 * build.mjs — 用 esbuild 把 @sfmc/logs bundle 成单文件 ESM + CJS
 *
 * 单文件输出避免多文件 require 在跨模块系统加载时的路径解析问题
 * (项目路径含 # 被 URL 编码成 %23,导致 createRequire 解析失败)。
 *
 * types 单独用 tsc --emitDeclarationOnly 生成 (见 build:types 脚本)。
 */
import { build } from "esbuild";
import fs from "node:fs";

await Promise.all([
  build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "esm",
    outfile: "dist/esm/index.js",
    platform: "node",
    target: "node18",
    sourcemap: true,
  }),
  build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    format: "cjs",
    outfile: "dist/cjs/index.js",
    platform: "node",
    target: "node18",
    sourcemap: true,
  }),
]);

// 标记子目录模块类型,覆盖包根的 type:module
fs.writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
fs.writeFileSync("dist/esm/package.json", JSON.stringify({ type: "module" }) + "\n");

console.log("@sfmc/logs build done (esbuild bundle)");
