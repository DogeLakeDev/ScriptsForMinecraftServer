# ScriptsForMinecraftServer 项目约定

## 基本要求

- 沟通、文档和代码注释使用简体中文；代码标识符沿用项目现有风格。

## 架构边界

- 本仓库是平台 monorepo；运行时工作目录 `SFMC_ROOT` 与单模块作者仓是不同目录。
- 核心能力位于 `packages/*` 与 `modules/sdk/*`；CLI 负责调用和编排，避免复制底层实现。
- 修改公共 API、发布包行为或版本契约时，检查是否需要 changeset。
- 桌面端的小修复保留产品版本，仅递增构建号：源码版本用 `0.3.8+build.1`，界面与发行标题显示 `0.3.8(1)`，后续依次为 `(2)`、`(3)`；不要因这类小更新提升到 `0.3.9`。桌面构建不加入 changeset 的产品版本升级；涉及公开平台包时仍按依赖版本契约发布，以便已有实例能更新后台接口。

## 工作方式

- 默认不新增常驻测试脚本；功能完成后清理临时验证脚本，保留必要的构建、类型检查与运行验收记录。
- 格式遵循仓库 Prettier/ESLint 配置，不在规则文件中重复维护格式参数。

## 按需资料

- 架构与约定：`docs/zh/dev/architecture.md`、`docs/zh/dev/conventions.md`
- 模块开发：`docs/zh/dev/module-author.mdx`
- 验证与联调：`docs/zh/dev/testing.md`
- 文档站任务：`website/AGENTS.md`
