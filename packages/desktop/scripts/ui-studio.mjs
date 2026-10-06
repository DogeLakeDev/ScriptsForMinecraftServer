/** 复用 SDK 的 Vite 配置，生成开发与发行共用的内置编辑器资源。 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const desktop = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const sdk = path.resolve(desktop, "../../modules/sdk/@sfmc-sdk");
const sdkRequire = createRequire(path.join(sdk, "package.json"));
export const studioPublicDir = path.join(desktop, "dist/studio");

export async function buildUiStudio() {
  const { build } = await import(pathToFileURL(sdkRequire.resolve("vite")).href);
  await build({
    configFile: path.join(sdk, "ui-studio-web/vite.config.ts"),
    build: { outDir: path.join(studioPublicDir, "ui-studio"), emptyOutDir: true },
  });
}
