import * as esbuild from "esbuild";
import JSZip from "jszip";
import fs from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

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
  alias: { cheerio: require.resolve("cheerio") },
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

/* ── zip helper (build-time only, JSZip handles CJS→ESM) ─── */
async function buildZip(dir) {
  const zip = new JSZip();
  function walk(rel) {
    const full = path.join(dir, rel);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(full)) walk(rel ? `${rel}/${entry}` : entry);
    } else {
      zip.file(rel, fs.readFileSync(full));
    }
  }
  walk("");
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/* Stage K (SEA slim): business modules (22 modules under modules/packages/)
 * are NOT bundled into the SEA. The dispatcher reads them at runtime from
 * the local `modules/packages/<id>/` directory — a fixed convention. To
 * populate that directory, use `node tools/fetch-module.mjs <source>` (see
 * docs/marketplace.zh.md). Only the skeleton — configs-default,
 * resource_packs, behavior_packs — ships inside the .exe.
 */
const assetDirs = [
  { dir: "configs-default", name: "configs-default.zip" },
  { dir: "scriptsforminecraftserver/resource_packs", name: "resource_packs.zip" },
  { dir: "scriptsforminecraftserver/behavior_packs", name: "behavior_packs.zip" },
];

for (const { dir, name } of assetDirs) {
  const src = path.resolve(dir);
  if (!fs.existsSync(src)) {
    console.warn(`[sea] WARN: ${src} not found, skipping`);
    continue;
  }
  const buf = await buildZip(src);
  const out = path.join("dist/sea", name);
  fs.writeFileSync(out, buf);
  console.log(`[sea] asset ${name} -> ${(buf.length / 1024).toFixed(0)} KB`);
}

console.log("[sea] modules are read at runtime from ./modules/packages/<id>/ (populate via tools/fetch-module.mjs)");

