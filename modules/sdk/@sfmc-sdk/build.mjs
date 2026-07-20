/**
 * @sfmc/sdk 单伞包多产物 esbuild
 *
 * 子路径 → 平台映射:
 *   platform "node"  : 任何 import 了 node:fs/node:path 的子路径
 *     - sapi/host  (config/ 用 fs/path 读 configs/*.json)
 *     - node/sdk   (Node 模块契约,可能在 Node 侧 import)
 *     - node/node  (Node-only 工具)
 *     - module-loader (SAPI 入口,实际由 BP esbuild 重新打包;但 SDK 自己 build 时
 *                      仍需 node 平台才能解析 @minecraft/server 的 type-only imports;
 *                      此处 platform 决策:给 module-loader 一个 node-platform 副本,
 *                      BP 端实际 bundle 时会覆盖 — 见下 external 注释)
 *     - behavior-pack-build (BP 发布工具,Node 进程运行)
 *   platform "neutral" : 纯类型/无外部依赖子路径
 *     - contracts / logs / sapi/sdk / sapi/runtime
 *
 * @minecraft/* 始终 external,留给真正 bundle BP 时由 scriptsforminecraftserver
 * 那一侧 esbuild 解析(在 BP 端它们从 scriptsforminecraftserver/node_modules 解析,
 * 这里 esbuild 只是产生中间 bundle,@minecraft/* 会以 require("..") 形式留下)。
 *
 * 步骤:
 *   1) esbuild 各子路径产 ESM bundle → dist/esm/<subpath>/index.js
 *   2) tsc 发 .d.ts → dist/types/<subpath>/index.d.ts
 */
import { build } from "esbuild";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SUBPATHS = [
  { sub: "contracts", platform: "neutral" },
  { sub: "logs", platform: "node" },
  { sub: "sapi/sdk", platform: "neutral" },
  { sub: "sapi/runtime", platform: "neutral" },
  { sub: "sapi/host", platform: "node" },
  { sub: "node/sdk", platform: "node" },
  { sub: "node/node", platform: "node" },
  { sub: "module-loader", platform: "node" },
  { sub: "behavior-pack-build", platform: "node" },
];

const DIST_ESM = "dist/esm";
const DIST_TYPES = "dist/types";
fs.mkdirSync(DIST_ESM, { recursive: true });
fs.mkdirSync(DIST_TYPES, { recursive: true });

const MINECRAFT_EXTERNALS = [
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/server-net",
  "@minecraft/vanilla-data",
];

// 1) ESM bundle
for (const { sub, platform } of SUBPATHS) {
  const entry = path.posix.join("src", sub, "index.ts");
  const outfile = path.posix.join(DIST_ESM, sub, "index.js");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform,
    target: platform === "node" ? "node18" : "es2022",
    sourcemap: true,
    logLevel: "info",
    external: MINECRAFT_EXTERNALS,
  });
}

// 2) .d.ts — tsc --emitDeclarationOnly 产 dist/types
console.log("[sdk] emitting .d.ts via tsc...");
execSync("npx tsc -p tsconfig.types.json", { stdio: "inherit" });

console.log("@sfmc/sdk build done:", SUBPATHS.length, "subpaths");

