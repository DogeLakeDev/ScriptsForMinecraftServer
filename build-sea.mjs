import * as esbuild from "esbuild";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

await rm("dist/sea", { recursive: true, force: true });
await mkdir("dist/sea", { recursive: true });

await esbuild.build({
  entryPoints: ["sfmc/src/dispatcher.ts"],
  bundle: true,
  platform: "node",
  target: "node26",
  format: "cjs",
  outfile: "dist/sea/dispatcher.mjs",
  external: [],
  alias: { cheerio: require.resolve("cheerio") },
  conditions: ["require", "node", "default"],
  logLevel: "info",
  banner: { js: "// SEA dispatcher bundle — generated, do not edit" },
});

console.log("SEA dispatcher bundle -> dist/sea/dispatcher.mjs");

