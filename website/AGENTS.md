# AGENTS.md — SFMC 文档站（Rspress）

维护 ScriptsForMinecraftServer 的 Rspress 文档站。站点：<https://dogelakedev.github.io/ScriptsForMinecraftServer/>

## 命令

在 monorepo 根目录执行（勿只在 `website/` 内跑 build）：

```bash
cd website && npm install          # 文档站依赖（根目录 npm ci 不含 website 子包时需单独装）
npm run docs -- serve              # TypeDoc + Rspress 开发
npm run docs -- build              # 构建 → doc_build/
npm run docs -- api                # 仅 TypeDoc → docs/zh/reference/sdk/
```

根目录 `npm run docs` 入口：`packages/tools/docs.mjs`。

## 目录布局

| 路径 | 内容 |
|------|------|
| `docs/zh/**` | 默认语言正文 |
| `docs/en/**` | 英文（部分页面） |
| `website/rspress.config.ts` | Rspress 配置 |
| `website/i18n.json` | 国际化 |
| `website/components/` | 自定义组件（ModuleCatalog、排障向导等） |
| `website/plugins/` | Rspress 插件 |
| `doc_build/` | 构建输出（gitignore） |

TypeDoc 在构建前由 `packages/tools/docs-typedoc.mjs` 预生成 SDK API 到 `docs/zh/reference/sdk/`。

## 路由排除

以下内容 **不参与** 公开路由（`rspress.config.ts` → `route.exclude`）：

- `**/archive/**`
- `**/plan/**`
- `**/reviews/**`
- `**/includes/**`
- `**/superpowers/**`（历史内部 spec 路径；目录可不存在，exclude 保留无害）
- `**/style-sample.mdx`

人类可读 spec / 设计稿请放 `docs/zh/dev/` 或独立 issue，勿依赖 superpowers 路由。

## 构建注意

- monorepo 路径含 `#` 时，`docs.mjs` 会镜像到 `%TEMP%/sfmc-rspress-build` 再跑 Rspack
- 模块目录组件从 `sfmc-modules` 的 `index.json` 拉取（本地 sibling 或 GitHub raw）
- Rspress LLM 索引：配置 `llms: true`；参考 <https://rspress.rs/llms.txt>

## CI

`.github/workflows/docs.yml`：push 到 `main` 且 docs 相关路径变更时，构建并部署 GitHub Pages。

## 与主仓 AGENTS 的关系

- 平台架构、db-server、模块系统 → 根目录 `AGENTS.md`
- 文档贡献流程 → `docs/zh/CONTRIBUTING-DOCS.mdx`、`docs/zh/dev/contributing.md`
