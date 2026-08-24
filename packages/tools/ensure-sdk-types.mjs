#!/usr/bin/env node
// @ts-check
/**
 * 确保 workspace 内 @sfmc-bds/sdk 已产出 dist/types（供 --dts / typecheck 解析 exports.types）。
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { runTsc7 } from "./tsc7.mjs";

const require = createRequire(import.meta.url);

/** 与 package.json exports["./logs"].types 对齐的探测文件 */
const TYPES_PROBE = "dist/types/logs/index.d.ts";

/**
 * @param {fs.PathLike} filePath
 */
function tryRealpath(filePath) {
  try {
    return fs.realpathSync.native(filePath);
  } catch {
    return filePath;
  }
}

/**
 * 若已安装 @sfmc-bds/sdk 且 dist/types 缺失，则在该包目录执行 tsc7 -p tsconfig.types.json。
 * @returns {boolean} 是否执行了类型构建
 */
export function ensureSdkTypes() {
  let sdkPkgJson;
  try {
    sdkPkgJson = require.resolve("@sfmc-bds/sdk/package.json");
  } catch {
    return false;
  }

  const sdkRoot = path.dirname(sdkPkgJson);
  const probe = path.join(sdkRoot, TYPES_PROBE);
  if (fs.existsSync(probe)) {
    return false;
  }

  const tsconfig = path.join(sdkRoot, "tsconfig.types.json");
  if (!fs.existsSync(tsconfig)) {
    console.warn("[ensure-sdk-types] 找不到 @sfmc-bds/sdk tsconfig.types.json，跳过");
    return false;
  }

  console.log("[ensure-sdk-types] @sfmc-bds/sdk dist/types 缺失，正在 build:types...");
  const code = runTsc7(["-p", tsconfig]);
  if (code !== 0) {
    throw new Error(`@sfmc-bds/sdk build:types 失败（exit ${code}）`);
  }
  return true;
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  const entryReal = tryRealpath(path.resolve(entry));
  const selfReal = tryRealpath(fileURLToPath(import.meta.url));
  return entryReal === selfReal;
}

if (isMainModule()) {
  try {
    ensureSdkTypes();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[ensure-sdk-types] ${message}`);
    process.exit(1);
  }
}
