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
  external: ["readline", "node:readline", "fs", "path"],
  alias: { cheerio: require.resolve("cheerio") },
  conditions: ["import", "require", "node", "default"],
  logLevel: "debug",
  banner: { js: "// SEA dispatcher bundle — generated, do not edit" },
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

const assetDirs = [
  { dir: "configs-default", name: "configs-default.zip" },
  { dir: "modules", name: "modules.zip" },
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

