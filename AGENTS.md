# ScriptsForMinecraftServer 项目约定

## 基本要求

- 沟通、文档和代码注释使用简体中文；代码标识符沿用项目现有风格。
- 先查看相关源码、测试和 `package.json`，不要把本文或旧文档当作高于源码的事实。
- 只修改用户要求范围内的文件，保留工作区中已有的无关改动。
- 不读取、输出或提交 `configs/`、`data/`、密钥、Token 等运行时敏感内容。

## 架构边界

- 本仓库是平台 monorepo；运行时工作目录 `SFMC_ROOT` 与单模块作者仓是不同目录。
- 核心能力位于 `packages/*` 与 `modules/sdk/*`；CLI 负责调用和编排，避免复制底层实现。
- 业务模块只依赖 `@sfmc-bds/sdk` 与 `@minecraft/*`；跨模块协作通过 manifest 与 service/tx。
- 玩家消息使用 `Msg.*`；动态 SQL 使用项目提供的安全构造器，禁止拼接不可信输入。
- 修改公共 API、发布包行为或版本契约时，检查是否需要 changeset。

## 工作方式

- 修复问题前先追踪真实调用链、注册时机、权限与生命周期，确认根因后再改代码。
- 优先复用现有实现和测试模式；不要为了“更完整”扩大重构范围。
- 格式遵循仓库 Prettier/ESLint 配置，不在规则文件中重复维护格式参数。

## 验证

- 运行与改动范围相称的最小检查；优先使用目标包的 `test`、`typecheck` 或 `build`。
- 跨包或架构变更再运行根目录 `pnpm run typecheck`、`pnpm run lint`、`pnpm run verify` 或 `pnpm run build` 中相关项。
- 未运行或未通过的检查必须明确说明，不得声称修复完成。

## 按需资料

- 架构与约定：`docs/zh/dev/architecture.md`、`docs/zh/dev/conventions.md`
- 模块开发：`docs/zh/dev/module-author.mdx`
- 测试：`docs/zh/dev/testing.md`
- 文档站任务：`website/AGENTS.md`
- 场景化流程：`.cursor/skills/`
