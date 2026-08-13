/**
 * @sfmc-bds/sdk 单伞包多产物 esbuild
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
 *       （contracts 现仅含 module catalog/lock）
 *
 * @minecraft/* 始终 external,留给 BP 构建时由 `sfmc behavior-pack build` 那一侧解析。
 *
 * 步骤:
 *   1) esbuild 各子路径产 ESM bundle → dist/esm/<subpath>/index.js
 *   2) tsc 发 .d.ts → dist/types/<subpath>/index.d.ts
 */
import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * 经 package exports 解析 `@sfmc-bds/tools/tsc7`，避免 `../../../tools/...`。
 * SDK 不能声明依赖 tools（tools → sdk 会成环）；同仓 workspace hoist 仍可 resolve。
 * @param {string[]} args
 * @returns {number}
 */
function runTsc7(args) {
  let tsc7Entry;
  try {
    tsc7Entry = require.resolve("@sfmc-bds/tools/tsc7");
  } catch {
    throw new Error(
      "无法 resolve @sfmc-bds/tools/tsc7。请在 monorepo 根目录执行 npm install（SDK 构建依赖同仓 tools bin）。"
    );
  }
  const result = spawnSync(process.execPath, [tsc7Entry, ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  return result.status === null ? 1 : result.status;
}

const SUBPATHS = [
  { sub: "contracts", platform: "neutral" },
  { sub: "logs", platform: "node" },
  { sub: "sapi/sdk", platform: "neutral" },
  { sub: "sapi/runtime", platform: "neutral" },
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
  // BDS 启动入口：单独子路径，避免污染 module-loader barrel（DIP）
  { sub: "module-loader/install", platform: "node", entry: "src/module-loader/install.ts" },
  { sub: "behavior-pack-build", platform: "node" },
  { sub: "testing", platform: "node", externalExtra: ["@sfmc-bds/sdk/sapi/runtime", "@sfmc-bds/sdk/module-loader"] },
];

const TESTING_BRIDGES = [
  "mc-bridge-server",
  "mc-bridge-ui",
  "mc-bridge-net",
  "mc-bridge-admin",
  "mc-bridge-diagnostics",
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
  const outfile = item.entry
    ? path.posix.join(DIST_ESM, `${sub}.js`)
    : path.posix.join(DIST_ESM, sub, "index.js");
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

// 1b) 测试假引擎桥 + loader（供 --import @sfmc-bds/sdk/testing/minecraft-loader）
const testingOut = path.join(DIST_ESM, "testing");
fs.mkdirSync(testingOut, { recursive: true });
for (const name of TESTING_BRIDGES) {
  await build({
    entryPoints: [path.posix.join("src/testing/engine", `${name}.ts`)],
    bundle: true,
    format: "esm",
    outfile: path.join(testingOut, `${name}.js`),
    platform: "node",
    target: "node18",
    sourcemap: true,
    logLevel: "info",
    external: MINECRAFT_EXTERNALS,
  });
}
fs.copyFileSync(
  path.join("src/testing/minecraft-loader.mjs"),
  path.join(testingOut, "minecraft-loader.mjs")
);

await build({
  entryPoints: ["src/testing/playground-host.ts"],
  bundle: true,
  format: "esm",
  outfile: path.join(testingOut, "playground-host.js"),
  platform: "node",
  target: "node18",
  sourcemap: true,
  logLevel: "info",
  external: [...MINECRAFT_EXTERNALS, "@sfmc-bds/sdk/sapi/runtime", "@sfmc-bds/sdk/module-loader"],
});

// 2) .d.ts — 经 tsc7（TS7 native）产 dist/types
console.log("[sdk] emitting .d.ts via tsc7...");
const dtsCode = runTsc7(["-p", "tsconfig.types.json"]);
if (dtsCode !== 0) process.exit(dtsCode);

console.log("@sfmc-bds/sdk build done:", SUBPATHS.length, "subpaths +", TESTING_BRIDGES.length, "bridges");

