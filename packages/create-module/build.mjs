import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(root, "src");
fs.rmSync(path.join(root, "dist"), { recursive: true, force: true });

const entries = fs
  .readdirSync(srcDir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => path.join(srcDir, f));

await build({
  entryPoints: entries,
  bundle: false,
  format: "esm",
  outdir: "dist",
  platform: "node",
  target: "node22",
  sourcemap: true,
  banner: {
    js: "",
  },
});

/* CLI 需要 shebang */
const cliPath = path.join(root, "dist", "cli.js");
if (fs.existsSync(cliPath)) {
  const body = fs.readFileSync(cliPath, "utf8");
  if (!body.startsWith("#!")) {
    fs.writeFileSync(cliPath, `#!/usr/bin/env node\n${body}`, "utf8");
  }
}

let tsc7;
try {
  tsc7 = require.resolve("@sfmc-bds/tools/tsc7");
} catch {
  console.warn("[create-module] skip d.ts (tsc7 not found)");
  process.exit(0);
}
const r = spawnSync(process.execPath, [tsc7, "-p", "tsconfig.json"], { stdio: "inherit" });
process.exit(r.status === null ? 1 : r.status);
