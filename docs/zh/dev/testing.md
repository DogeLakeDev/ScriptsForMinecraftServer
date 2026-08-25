# 测试

SFMC 把「测什么、在哪测」分成两条轨：**模块作者**以 Watch / 真机联调为主；**平台包**用 `node:test` 覆盖复杂逻辑。历史上的 Node 假引擎沙箱（`@sfmc-bds/sdk/testing`、`createSandbox`、`minecraft-loader`）已废弃，代码归档在 `_sandbox_archive/`，SDK 不再导出 `./testing`。

## 模块作者：Watch / 真机联调

日常验证模块行为，**不依赖** `pnpm test` 或假引擎。

| 手段 | 何时用 |
| ------ | ------ |
| `pnpm run typecheck` / `npm run typecheck` | 改 `sapi/src` 后快速类型检查 |
| `pnpm run lint` / `npm run lint` | ESLint / Prettier |
| 扩展 **SFMC: Start Watch** | 源码变更 → devkit 重建部署 |
| 扩展 **SFMC: Reload to BDS** / `sfmc mod reload` | 手动重载已装模块 |
| BDS 日志 | 命令、事件、UI、世界交互、版本 quirk |

工作流见 [模块开发](./module-author.mdx)。设置 `sfmc.root` 为含 `configs/`、`modules/` 的运行时根（不必是源码仓）。

`sfmc mod test` / `mod watch` 已移除；建仓用 `npm create @sfmc-bds/module`，联调用扩展 Watch。

### 本地 vs 真机

| 优先在本地 | 优先在 BDS |
| ------ | ------ |
| 类型、lint、manifest / DESCRIPTOR 静态一致性 | lifecycle、聊天命令、`Msg`、权限 |
| 纯逻辑（不碰 `@minecraft/*` 运行时） | 方块 / 实体 / 维度 / 客户端 UI |
| — | 与 pin 版 `@minecraft/*` 行为对齐 |

## 平台包：`node:test`

主仓内复杂逻辑用 Node 单测；**与模块作者日常无关**，此处仅作索引。

| 包 | 测试位置 | 运行 |
| ------ | ------ | ------ |
| `@sfmc-bds/db-server` | `src/**/*.test.ts` → `dist/` | `pnpm -F @sfmc-bds/db-server test` |
| `@sfmc-bds/qq-bridge` | `src/**/*.test.ts` → `dist/` | `pnpm -F @sfmc-bds/qq-bridge test` |
| `@sfmc-bds/bds-tools` | `src/**/*.test.ts` → `dist/` | `pnpm -F @sfmc-bds/bds-tools test` |
| `@sfmc-bds/cli` | `src/**/*.test.ts`、`scripts/module-install/test/` | `pnpm -F @sfmc-bds/cli test` |
| `@sfmc-bds/sdk` | `test/**/*.test.ts`（如 manifest-schema、qq-official） | `pnpm -F @sfmc-bds/sdk test` |
| `@sfmc-bds/tools` | `test/**/*.test.ts` | `cd packages/tools && pnpm test` |
| `@sfmc-bds/create-module` | `src/**/*.test.ts` → `dist/` | `pnpm -F @sfmc-bds/create-module test` |

约定：

- 源码旁或包内 `test/` / `src/` 下 `*.test.ts`；平台包多数先 `build` 再测 `dist/**/*.test.js`。
- SDK / tools 可直接 `tsx` 跑 TypeScript 测试。
- CI：`ootb.yml` 在 build 后跑单测与 `verify`（无真实 BDS）。

## Cursor / VS Code（模块仓）

1. 推荐扩展：ESLint、`SFMC Module`（见模板 `.vscode/extensions.json`）。
2. 命令面板：`SFMC: Start Watch` / `Reload to BDS` / `Link to SFMC Root`。
3. `sfmc.root` 指向 SFMC 工作目录。

模块仓模板默认 **无** 假引擎单测；`nodejs-testing` 与 `minecraft-loader` 配置已移除。

## 相关

| 章节 | 内容 |
| ------ | ------ |
| [模块开发](./module-author.mdx) | 作者闭环与扩展 |
| [工具脚本](./tools.md) | 平台 `verify`、发版脚本 |
| [SDK 类型参考](../reference/index.md) | TypeDoc |
