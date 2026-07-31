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
  external: ["vscode", "@sfmc-bds/devkit", "@sfmc-bds/sdk", "@sfmc-bds/sdk/logs"],
  sourcemap: true,
});

const webviewOut = path.join("dist", "webview");
fs.mkdirSync(webviewOut, { recursive: true });

await build({
  entryPoints: ["src/playground/graph-ui/main.tsx"],
  bundle: true,
  format: "esm",
  platform: "browser",
  outfile: path.join(webviewOut, "graph.js"),
  sourcemap: true,
  jsx: "automatic",
  loader: { ".css": "empty" },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});

const cssOut = path.join(webviewOut, "graph.css");
fs.copyFileSync(path.join("src", "playground", "graph-ui", "styles.css"), cssOut);

const xyCandidates = [
  path.resolve("node_modules/@xyflow/react/dist/style.css"),
  path.resolve("../../node_modules/@xyflow/react/dist/style.css"),
];
for (const p of xyCandidates) {
  if (fs.existsSync(p)) {
    fs.appendFileSync(cssOut, "\n" + fs.readFileSync(p, "utf8"));
    break;
  }
}

/** 拷贝 Codicon 字体与样式到 webview 产物（与 graph.css 同目录，相对 url 可用） */
const codiconDirs = [
  path.resolve("node_modules/@vscode/codicons/dist"),
  path.resolve("../../node_modules/@vscode/codicons/dist"),
];
for (const dir of codiconDirs) {
  const css = path.join(dir, "codicon.css");
  const ttf = path.join(dir, "codicon.ttf");
  if (fs.existsSync(css) && fs.existsSync(ttf)) {
    fs.copyFileSync(css, path.join(webviewOut, "codicon.css"));
    fs.copyFileSync(ttf, path.join(webviewOut, "codicon.ttf"));
    break;
  }
}

if (fs.existsSync("media")) {
  fs.cpSync("media", path.join("dist", "media"), { recursive: true });
}

console.log("sfmc-module extension built (graph webview, no Elements)");
