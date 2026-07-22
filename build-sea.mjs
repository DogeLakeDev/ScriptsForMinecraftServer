import * as esbuild from "esbuild";
import fs from "node:fs";
import { mkdir, rm } from "node:fs/promises";

await rm("dist/sea", { recursive: true, force: true });
await mkdir("dist/sea", { recursive: true });

const result = await esbuild.build({
  entryPoints: ["sfmc/src/dispatcher.ts"],
  metafile: true,
  bundle: true,
  platform: "node",
  target: "node26",
  format: "esm",
  outfile: "dist/sea/dispatcher.mjs",
  external: ["node:readline", "node:fs", "node:path"],
  conditions: ["import", "require", "node", "default"],
  logLevel: "info",
  minify: true,
  banner: {
    js: [
      `import { createRequire as __sea_require } from "node:module";`,
      `globalThis.require = __sea_require(import.meta.url);`,
      `// SEA dispatcher bundle — generated, do not edit`,
    ].join("\n"),
  },
});
fs.writeFileSync("meta.json", JSON.stringify(result.metafile, null, 2));
console.log("SEA dispatcher bundle -> dist/sea/dispatcher.mjs");
