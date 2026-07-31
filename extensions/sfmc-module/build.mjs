import { build } from "esbuild";
import fs from "node:fs";

fs.rmSync("dist", { recursive: true, force: true });
await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "dist/extension.js",
  external: ["vscode", "@sfmc-bds/devkit"],
  sourcemap: true,
});
console.log("sfmc-module extension built");
