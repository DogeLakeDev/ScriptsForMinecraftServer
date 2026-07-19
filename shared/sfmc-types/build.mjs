import { build } from "esbuild";
import fs from "node:fs";

await Promise.all([
  build({ entryPoints: ["src/index.ts"], bundle: true, format: "esm", outfile: "dist/esm/index.js", platform: "node", target: "node18", sourcemap: true }),
  build({ entryPoints: ["src/index.ts"], bundle: true, format: "cjs", outfile: "dist/cjs/index.js", platform: "node", target: "node18", sourcemap: true }),
]);

fs.writeFileSync("dist/cjs/package.json", JSON.stringify({ type: "commonjs" }) + "\n");
fs.writeFileSync("dist/esm/package.json", JSON.stringify({ type: "module" }) + "\n");
