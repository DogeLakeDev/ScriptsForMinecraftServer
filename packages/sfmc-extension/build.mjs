import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

fs.rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "dist/extension.js",
  external: ["vscode", "@sfmc-bds/devkit", "@sfmc-bds/create-module", "@sfmc-bds/sdk", "@sfmc-bds/sdk/logs"],
  sourcemap: true,
});

if (fs.existsSync("media")) {
  fs.cpSync("media", path.join("dist", "media"), { recursive: true });
}

console.log("sfmc-extension built");
