# SFMC 文档站约定

- 本目录规则继承仓库根 `AGENTS.md`。
- 中文内容放在 `docs/zh/**`；仅在任务明确要求时同步 `docs/en/**`。
- 站点配置位于 `website/rspress.config.ts`，组件和插件分别位于 `website/components/`、`website/plugins/`。
- 不手工编辑 TypeDoc 生成内容；使用根目录 `pnpm run docs -- api` 重新生成。
- 文档或站点变更优先运行 `pnpm run docs -- build`；局部开发可运行 `pnpm run docs -- serve`。
- `doc_build/` 是生成目录，不提交构建产物。
- 路由排除项以 `website/rspress.config.ts` 当前配置为准，不在本文件重复维护。
