import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@rspress/core";
import { pluginClientRedirects } from "@rspress/plugin-client-redirects";
import { pluginModuleCatalog } from "./plugins/module-catalog";
import { pluginSfmcMermaid } from "./plugins/mermaid";
import { pluginServeMd } from "./plugins/serve-md";
import { pluginSyncTypedocEn } from "./plugins/sync-typedoc-en";
// TypeDoc 在仓根 packages/tools/docs-typedoc.mjs 预生成（避免镜像构建缺依赖）

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SFMC_DOCS_ROOT || path.join(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const BASE = "/ScriptsForMinecraftServer/";
const OUT_DIR = path.join(ROOT, "doc_build");
const serveMdOpts = { docsRoot: DOCS, outDir: OUT_DIR, base: BASE };

export default defineConfig({
  root: DOCS,
  base: BASE,
  title: "ScriptsForMinecraftServer",
  description: "SFMC 使用 · 开发 · 接口文档",
  lang: "zh",
  logoText: "SFMC",
  outDir: OUT_DIR,
  globalStyles: path.join(__dirname, "styles/index.css"),
  markdown: {
    link: {
      checkDeadLinks: false,
    },
    globalComponents: [
      path.join(__dirname, "components/ModuleCatalog.tsx"),
      path.join(__dirname, "components/TroubleshootWizardZh.tsx"),
      path.join(__dirname, "components/TroubleshootWizardEn.tsx"),
    ],
  },
  route: {
    exclude: [
      "**/superpowers/**",
      "**/archive/**",
      "**/plan/**",
      "**/reviews/**",
      "**/includes/**",
      "**/requirements.txt",
      "**/style-sample.mdx",
    ],
  },
  llms: true,
  locales: [
    {
      lang: "zh",
      label: "简体中文",
      title: "ScriptsForMinecraftServer",
      description: "SFMC 使用 · 开发 · 接口文档",
    },
    {
      lang: "en",
      label: "English",
      title: "ScriptsForMinecraftServer",
      description: "SFMC user, developer, and API docs",
    },
  ],
  themeConfig: {
    llmsUI: true,
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/DogeLakeDev/ScriptsForMinecraftServer",
      },
    ],
    editLink: {
      docRepoBaseUrl:
        "https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/docs",
      text: "Edit this page",
    },
    lastUpdated: true,
  },
  builderConfig: {
    resolve: {
      alias: {
        "@site": path.join(ROOT, "website"),
      },
    },
    server: {
      // TypeDoc 生成物体积大；避免误触碰时拖垮 HMR
      watch: {
        ignored: [
          "**/docs/**/reference/sdk/**",
          "**/website/generated/**",
          "**/doc_build/**",
        ],
      },
    },
  },
  plugins: [
    pluginSfmcMermaid(),
    pluginServeMd(serveMdOpts),
    // 缩写：remark 注入 html/raw 会与 MDX 冲突，暂用页面内术语表；后续可改成组件
    pluginModuleCatalog({
      localIndexCandidates: [
        path.join(ROOT, "..", "sfmc-modules", "index.json"),
        path.join(ROOT, "website", "generated", "module-registry.fallback.json"),
      ],
      remoteUrl:
        "https://raw.githubusercontent.com/Tanya7z/sfmc-modules/main/index.json",
      outFile: path.join(ROOT, "website", "generated", "module-registry.json"),
      fallbackFile: path.join(
        ROOT,
        "website",
        "generated",
        "module-registry.fallback.json"
      ),
    }),
    pluginSyncTypedocEn({
      zhDir: path.join(DOCS, "zh", "reference", "sdk"),
      enDir: path.join(DOCS, "en", "reference", "sdk"),
    }),
    pluginClientRedirects({
      redirects: [
        { from: "/guide/install", to: "/guide/" },
        { from: "/guide/first-run", to: "/guide/" },
        { from: "/guide/behavior-pack", to: "/guide/modules" },
        { from: "/guide/world-packs", to: "/guide/addons" },
        { from: "/guide/pack-update", to: "/dev/pack-update" },
        { from: "/dev/npm-publish", to: "/dev/publish" },
        { from: "/api/modules", to: "/api/module-control" },
      ],
    }),
  ],
});
