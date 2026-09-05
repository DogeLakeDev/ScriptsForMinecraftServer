# AGENTS.md — SFMC 官方文档站维护手册（Rspress）

面向 Agent 的文档站点维护与构建速查。官方文档站发布地址：<https://dogelakedev.github.io/ScriptsForMinecraftServer/>。

## 常用命令

在 monorepo 根目录下执行以下命令管理文档站点：

```bash
pnpm install                   # 安装依赖
pnpm run docs -- serve         # 启动本地开发预览服务器
pnpm run docs -- build         # 执行文档站全量生产构建
pnpm run docs -- api           # 仅单独重新生成 TypeDoc SDK API 文档
```

> **执行入口**：根目录 `pnpm run docs`（或 `npm run docs`）底层统一调度 `packages/tools/docs.mjs` 编排脚本。

## 文档站目录结构

| 目录与文件                  | 职责与承载内容                                             |
| --------------------------- | ---------------------------------------------------------- |
| `docs/zh/**`                | 默认语言（简体中文）正文文档                               |
| `docs/en/**`                | 英文版文档正文（部分同步页面）                             |
| `website/rspress.config.ts` | Rspress 全局构建与插件配置                                 |
| `website/i18n.json`         | 站点多语言国际化文案映射                                   |
| `website/components/`       | 自定义 React 组件（如 ModuleCatalog 模块目录、排障向导等） |
| `website/plugins/`          | Rspress 定制构建与增强插件                                 |
| `doc_build/`                | 生产环境静态打包输出目录（已纳入 gitignore）               |

API 文档预生成：在站点构建前，由 `packages/tools/docs-typedoc.mjs` 自动将 SDK API 解析并输出至 `docs/zh/reference/sdk/`。

## 路由排除规则

以下路径模式统一排除在公开生成路由之外（配置于 `rspress.config.ts` 中的 `route.exclude`）：

- `**/archive/**`
- `**/plan/**`
- `**/reviews/**`
- `**/includes/**`
- `**/superpowers/**`（历史规格留存路径，保留排除项确保安全）
- `**/style-sample.mdx`

> **规范归档要求**：正式的技术方案、设计规范请统一归档至 `docs/zh/dev/` 或通过 GitHub Issue 记录，避免依赖已排除的内部路由。

## 构建注意事项

- **特殊字符路径兼容**：当 monorepo 本地路径包含 `#` 等特殊字符时，`docs.mjs` 会自动镜像至 `%TEMP%/sfmc-rspress-build` 临时目录后再调用 Rspack 构建。
- **模块目录动态数据**：模块目录组件默认从 `sfmc-modules` 仓库的 `index.json` 动态获取元数据（优先读取本地同级目录，回退至 GitHub Raw 资源）。
- **LLM 语义索引**：站点配置已开启 `llms: true`，自动生成符合 LLM 抓取规范的索引文件（参考 <https://rspress.rs/llms.txt>）。

## 持续集成与部署（CI）

- **工作流定义**：`.github/workflows/docs.yml`。
- **触发机制**：向 `main` 分支推送且变更涉及文档或站点配置时，自动化执行构建并部署至 GitHub Pages。

## 与主仓核心知识库的关系

- **平台核心架构**：底层服务架构、db-server 通信机制、模块系统与生命周期等事实，以根目录 `AGENTS.md` 为权威源。
- **文档贡献规范**：文档撰写规范与贡献流程参见 `docs/zh/CONTRIBUTING-DOCS.mdx` 与 `docs/zh/dev/contributing.md`。
