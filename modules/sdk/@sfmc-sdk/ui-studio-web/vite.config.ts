/**
 * ui-studio-web/vite.config.ts — UI Studio 浏览器端构建配置。
 *
 * 产物输出到 ../dist/ui-studio-web，由 SDK 的 ui-studio 本地服务托管；
 * base 使用相对路径，服务可挂载在任意端口/路径下。
 */
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  base: "./",
  plugins: [
    react(),
    {
      name: "sfmc-ui-license",
      generateBundle() {
        // 浏览器应用复用了桌面端的 AGPL 公共 UI；随静态产物保留许可证与源码入口。
        this.emitFile({
          type: "asset",
          fileName: "LICENSE.txt",
          source: fs.readFileSync(path.resolve(here, "../../../../LICENSE"), "utf8"),
        });
        this.emitFile({
          type: "asset",
          fileName: "NOTICE.txt",
          source:
            "SFMC UI Studio 界面应用使用 @sfmc-bds/ui（AGPL-3.0-only）。\n源码：https://github.com/DogeLakeDev/ScriptsForMinecraftServer\nSDK 的模块运行时、契约与校验器沿用 ISC 许可证。\n视觉设计：SnowUI Dashboard UI Kit（ByeWind，CC BY 4.0）。\n",
        });
      },
    },
  ],
  build: {
    outDir: path.resolve(here, "..", "dist", "ui-studio-web"),
    emptyOutDir: true,
    sourcemap: true,
  },
});
