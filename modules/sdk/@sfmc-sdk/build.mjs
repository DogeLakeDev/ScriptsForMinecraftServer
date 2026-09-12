// @ts-check
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * @param {string[]} args
 * @returns {number}
 */
function runTsc7(args) {
  let tsc7Entry;
  try {
    tsc7Entry = require.resolve("@sfmc-bds/tools/tsc7");
  } catch {
    throw new Error("无法 resolve @sfmc-bds/tools/tsc7。请在 monorepo 根目录执行 npm install");
  }
  const result = spawnSync(process.execPath, [tsc7Entry, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  return result.status === null ? 1 : result.status;
}

/**
 * @typedef {object} SubpathBuild
 * @property {string} sub
 * @property {import('esbuild').Platform} platform
 * @property {string} [entry]
 * @property {string[]} [externalExtra]
 */

/** @type {SubpathBuild[]} */
const SUBPATHS = [
  { sub: "contracts", platform: "neutral" },
  { sub: "validation", platform: "neutral" },
  { sub: "logs", platform: "node" },
  { sub: "sapi/sdk", platform: "neutral" },
  { sub: "sapi/runtime", platform: "neutral" },
  { sub: "sapi/ui", platform: "neutral" },
  { sub: "sapi/db", platform: "neutral" },
  { sub: "sapi/config", platform: "neutral" },
  { sub: "sapi/diagnostics", platform: "neutral" },
  { sub: "sapi/service", platform: "neutral" },
  { sub: "sapi/host", platform: "node" },
  { sub: "node/sdk", platform: "node" },
  { sub: "node/node", platform: "node" },
  { sub: "node/config", platform: "node" },
  { sub: "node/qq-official", platform: "node" },
  { sub: "module-loader", platform: "node" },
  { sub: "module-loader/install", platform: "node", entry: "src/module-loader/install.ts" },
  // UI Studio 本地服务（Node 侧）；浏览器端源码在 ui-studio-web/，由 Vite 单独构建。
  { sub: "ui-studio", platform: "node" },
];

const DIST_ESM = "dist/esm";
const DIST_TYPES = "dist/types";
fs.rmSync(DIST_ESM, { recursive: true, force: true });
fs.rmSync(DIST_TYPES, { recursive: true, force: true });
fs.mkdirSync(DIST_ESM, { recursive: true });
fs.mkdirSync(DIST_TYPES, { recursive: true });

const MINECRAFT_EXTERNALS = [
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/server-net",
  "@minecraft/server-admin",
  "@minecraft/diagnostics",
  "@minecraft/vanilla-data",
];

// 1) ESM bundle
for (const item of SUBPATHS) {
  const { sub, platform } = item;
  const entry = item.entry ?? path.posix.join("src", sub, "index.ts");
  // 单文件入口（如 module-loader/install.ts）→ dist/esm/module-loader/install.js
  const outfile = item.entry ? path.posix.join(DIST_ESM, `${sub}.js`) : path.posix.join(DIST_ESM, sub, "index.js");
  await build({
    entryPoints: [entry],
    bundle: true,
    format: "esm",
    outfile,
    platform,
    target: platform === "node" ? "node18" : "es2022",
    sourcemap: true,
    logLevel: "info",
    external: [...MINECRAFT_EXTERNALS, ...(item.externalExtra ?? [])],
  });
}

// 2) .d.ts — 经 tsc7（TS7 native）产 dist/types
console.log("[sdk] emitting .d.ts via tsc7...");
const dtsCode = runTsc7(["-p", "tsconfig.types.json"]);
if (dtsCode !== 0) process.exit(dtsCode);

// 3) UI Studio 浏览器端 — Vite 构建到 dist/ui-studio-web（供 ui-studio 子路径服务）
// 注意：vite 7 的 exports 不暴露 ./bin/vite.js，这里直接用其 JS API。
console.log("[sdk] building ui-studio web via vite...");
let viteBuild;
try {
  ({ build: viteBuild } = await import("vite"));
} catch {
  throw new Error("无法 import vite。请在 monorepo 根目录执行 pnpm install");
}
await viteBuild({ configFile: "ui-studio-web/vite.config.ts" });

console.log("@sfmc-bds/sdk build done:", SUBPATHS.length, "subpaths");
