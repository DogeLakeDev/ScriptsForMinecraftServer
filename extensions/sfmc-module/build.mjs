import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

fs.rmSync("dist", { recursive: true, force: true });

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  format: "cjs",
  platform: "node",
  outfile: "dist/extension.js",
  external: ["vscode", "@sfmc-bds/devkit", "@sfmc-bds/sdk", "@vscode-elements/elements"],
  sourcemap: true,
});

const webviewOut = path.join("dist", "webview");
fs.mkdirSync(webviewOut, { recursive: true });
for (const f of ["stimulus.css", "stimulus.js"]) {
  fs.copyFileSync(path.join("src", "playground", "webview", f), path.join(webviewOut, f));
}

const elementsMain = require.resolve("@vscode-elements/elements/dist/main.js");
const vendorDir = path.join(webviewOut, "vendor");
fs.mkdirSync(vendorDir, { recursive: true });
fs.copyFileSync(elementsMain, path.join(vendorDir, "vscode-elements.js"));
// elements 可能还有 chunk；复制整个 dist
const elementsDist = path.dirname(elementsMain);
fs.cpSync(elementsDist, path.join(vendorDir, "elements-dist"), { recursive: true });

if (fs.existsSync("media")) {
  fs.cpSync("media", path.join("dist", "media"), { recursive: true });
}

console.log("sfmc-module extension built");
