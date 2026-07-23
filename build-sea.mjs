import * as esbuild from "esbuild";
import fs from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

await rm("dist/sea", { recursive: true, force: true });
await mkdir("dist/sea", { recursive: true });

/* SEA Node 目标唯一来源：仓库根 .node-version-sea（与 release.yml 共用，DRY） */
const root = path.dirname(fileURLToPath(import.meta.url));
const seaNodeMajor = fs.readFileSync(path.join(root, ".node-version-sea"), "utf8").trim();
if (!/^\d+$/.test(seaNodeMajor)) {
  throw new Error(`.node-version-sea 应为纯主版本号，当前: ${JSON.stringify(seaNodeMajor)}`);
}
const seaTarget = `node${seaNodeMajor}`;

const result = await esbuild.build({
  entryPoints: ["sfmc/src/dispatcher.ts"],
  metafile: true,
  bundle: true,
  platform: "node",
  target: seaTarget,
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
console.log(`SEA dispatcher bundle -> dist/sea/dispatcher.mjs (target ${seaTarget})`);
