/**
 * ui-studio-web/vite.config.ts — UI Studio 浏览器端构建配置。
 *
 * 产物输出到 ../dist/ui-studio-web，由 SDK 的 ui-studio 本地服务托管；
 * base 使用相对路径，服务可挂载在任意端口/路径下。
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: "./",
  plugins: [react()],
  build: {
    outDir: path.resolve(here, "..", "dist", "ui-studio-web"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
