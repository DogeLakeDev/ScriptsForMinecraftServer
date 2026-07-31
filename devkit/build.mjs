import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";

const require = createRequire(import.meta.url);
fs.rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  format: "esm",
  outfile: "dist/index.js",
  platform: "node",
  target: "node18",
  sourcemap: true,
  packages: "external",
});

let tsc7;
try {
  tsc7 = require.resolve("@sfmc-bds/tools/tsc7");
} catch {
  console.warn("[devkit] skip d.ts (tsc7 not found)");
  process.exit(0);
}
const r = spawnSync(process.execPath, [tsc7, "-p", "tsconfig.json"], { stdio: "inherit" });
process.exit(r.status === null ? 1 : r.status);
