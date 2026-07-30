#!/usr/bin/env node
// @ts-check
/**
 * @sfmc-bds/sdk/testing/minecraft-loader
 *
 * Node ESM loader：把 @minecraft/server|server-ui|… 指到 SDK 假引擎桥。
 * vanilla-data 走真实包。用法：
 *   node --test --import @sfmc-bds/sdk/testing/minecraft-loader --import tsx/esm …
 */

import { register } from "node:module";
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

register(import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, string>} */
const BRIDGES = {
  "@minecraft/server": "mc-bridge-server.js",
  "@minecraft/server-ui": "mc-bridge-ui.js",
  "@minecraft/server-net": "mc-bridge-net.js",
  "@minecraft/server-admin": "mc-bridge-admin.js",
  "@minecraft/diagnostics": "mc-bridge-diagnostics.js",
};

/**
 * @param {string} file
 */
function bridgeUrl(file) {
  const candidates = [path.join(here, file), path.join(here, "engine", file)];
  for (const c of candidates) {
    if (fs.existsSync(c)) return pathToFileURL(c).href;
  }
  return pathToFileURL(path.join(here, file)).href;
}

/**
 * @param {string} specifier
 * @param {{ parentURL?: string }} context
 * @param {(s: string, c: object) => Promise<{ url: string; shortCircuit?: boolean }>} nextResolve
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@minecraft/vanilla-data" || specifier.startsWith("@minecraft/vanilla-data/")) {
    return nextResolve(specifier, context);
  }
  if (specifier === "@minecraft/common" || specifier.startsWith("@minecraft/common/")) {
    /* common 仅类型；给空模块避免炸 */
    return { url: "data:text/javascript,export default {};", shortCircuit: true };
  }
  const bridge = BRIDGES[specifier];
  if (bridge) {
    return { url: bridgeUrl(bridge), shortCircuit: true };
  }
  if (specifier.startsWith("@minecraft/")) {
    return {
      url: `data:text/javascript,throw new Error(${JSON.stringify(
        `sfmc-testing: 未支持的包 ${specifier}（仅 server/server-ui/net/admin/diagnostics/vanilla-data）`
      )});`,
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
