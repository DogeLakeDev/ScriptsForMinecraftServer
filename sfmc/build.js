import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  target: "node22",
  outfile: "dist/sfmc.js",
  banner: { js: "#!/usr/bin/env node" },
  format: "esm",
  external: ["chalk", "@clack/prompts", "cli-progress"],
});

