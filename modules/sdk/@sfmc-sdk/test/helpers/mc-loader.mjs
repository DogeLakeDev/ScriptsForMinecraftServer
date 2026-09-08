/**
 * 最小 ESM loader：把 @minecraft/server|server-net 指到测试 stub。
 * 用法：node --import ./test/helpers/mc-loader.mjs --import tsx/esm --test …
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

register(import.meta.url);

const here = path.dirname(fileURLToPath(import.meta.url));

const BRIDGES = {
  "@minecraft/server": "mc-stub-server.mjs",
  "@minecraft/server-net": "mc-stub-net.mjs",
};

export async function resolve(specifier, context, nextResolve) {
  const file = BRIDGES[specifier];
  if (file) {
    return {
      url: pathToFileURL(path.join(here, file)).href,
      shortCircuit: true,
    };
  }
  if (specifier.startsWith("@minecraft/")) {
    return {
      url: "data:text/javascript,export default {};export const sentry = {};export const SentryEventLevel = {};export const secrets = {};export const variables = {};",
      shortCircuit: true,
    };
  }
  return nextResolve(specifier, context);
}
