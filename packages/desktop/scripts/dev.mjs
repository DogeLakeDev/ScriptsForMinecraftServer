import electron from "electron";
import { build } from "esbuild";
import { spawn } from "node:child_process";
import { createServer } from "vite";
import { buildUiStudio, studioPublicDir } from "./ui-studio.mjs";
await buildUiStudio();
await build({
  entryPoints: ["src/main/main.ts", "src/main/preload.ts"],
  outdir: "dist",
  outbase: "src/main",
  bundle: true,
  platform: "node",
  format: "cjs",
  outExtension: { ".js": ".cjs" },
  external: ["electron", "ssh2", "electron-updater"],
});
const server = await createServer({
  publicDir: studioPublicDir,
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
});
await server.listen();
const debugPort = process.env.SFMC_DESKTOP_REMOTE_DEBUGGING_PORT;
const electronArgs = debugPort && /^\d+$/.test(debugPort) ? [".", `--remote-debugging-port=${debugPort}`] : ["."];
const child = spawn(electron, electronArgs, {
  env: { ...process.env, SFMC_DESKTOP_DEV_URL: "http://127.0.0.1:5173", SFMC_DESKTOP_DEV_NODE: process.execPath },
  stdio: "inherit",
  windowsHide: true,
});
child.on("exit", async (code) => {
  await server.close();
  process.exitCode = code ?? 0;
});
