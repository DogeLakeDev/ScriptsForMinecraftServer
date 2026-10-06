import { build as esbuild } from "esbuild";
import path from "node:path";
import { build as vite } from "vite";
import { buildUiStudio, studioPublicDir } from "./ui-studio.mjs";
const base = process.cwd();
await buildUiStudio();
await esbuild({
  entryPoints: ["src/main/main.ts", "src/main/preload.ts"],
  outdir: "dist",
  outbase: "src/main",
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  sourcemap: true,
  outExtension: { ".js": ".cjs" },
  external: ["electron", "ssh2", "electron-updater"],
});
await vite({
  root: base,
  base: "./",
  publicDir: studioPublicDir,
  build: { outDir: path.join(base, "dist/renderer"), emptyOutDir: true, chunkSizeWarningLimit: 2500 },
  server: { host: "127.0.0.1" },
});
