---
name: sfmc-module-author
description: >-
  SFMC module authoring workflow: create with npm create @sfmc-bds/module,
  test via createSandbox, link into SFMC_ROOT, watch/reload with the SFMC
  Module extension and @sfmc-bds/devkit, then publish to npm + index.
  Use when creating modules, scaffolding, mod install --link, watch, publish,
  author vs operator surface, or when someone mentions sfmc mod test/watch/publish
  (removed).
---

# SFMC Module Author

一模块一仓。主仓 `modules/packages/` 只是 **SFMC_ROOT 上的安装目标**，不是作者工作区。

权威人类文档：`docs/zh/dev/module-author.mdx`（细节冲突时以文档 + 源码为准）。

## 作者面 vs 运维面

| 动作 | 作者面 | 运维面 |
|------|--------|--------|
| 建仓 | `npm create @sfmc-bds/module@latest` 或扩展 `SFMC: New Module` | — |
| 单测 | `npm test` / `SFMC: Run Tests` | — |
| 挂到工作目录 | 扩展 Link，或下方 `mod install --link` | 同左（在 SFMC_ROOT 执行） |
| 改代码热部署 | 扩展 Watch（`@sfmc-bds/devkit`） | `sfmc mod build` / `reload` |
| 启停 | — | `sfmc mod enable` / `disable` |
| 发布 | 扩展 Publish 或 `npm publish` + index PR | `sfmc mod install <id>`（装已发布包） |

**已移除（勿再教）：** `sfmc mod test` / `mod watch` / `mod publish`；GitHub Template / `sfmc-new-module` / `rename.mjs`。

建仓唯一引擎：`@sfmc-bds/create-module`（CLI 与扩展同一 `createModule()`）。

## 闭环清单

```text
Author loop:
- [ ] Create：npm create @sfmc-bds/module@latest
- [ ] npm install && npm test（假引擎，不依赖 sfmc.root / BDS）
- [ ] Link 到 SFMC_ROOT
- [ ] enable（若 lock 未开）
- [ ] Watch 或 mod reload；进服终检
- [ ] Publish → sfmc-modules index.json PR
```

### Link（在 SFMC_ROOT 执行）

路径含空格或 `#` 时整段加引号；推荐正斜杠：

```bash
sfmc mod install <id> --from "dir:<作者仓绝对路径>" --link
sfmc mod enable <id>
```

扩展：先设 `sfmc.root` = SFMC_ROOT，再 `SFMC: Link to SFMC Root`。

### 热更边界

- 只改 `sapi/src` → Watch / `mod reload` 通常够用。
- 改 `manifest` / 平台 `configs` → **重启 BDS**。

## 命名

| 层 | 规则 | 例 |
|----|------|-----|
| install id / 文件夹 | kebab | `my-feature` |
| npm 社区 | `@<user>/sfmc-module-<id>` | `@alice/sfmc-module-my-feature` |
| npm 官方 | `@sfmc-bds/module-<id>` | `@sfmc-bds/module-economy` |
| `manifest.id` | `feature-<id>` 或 `core-<id>` | `feature-my-feature` |
| `configKey` | `-` → `_` | `my_feature` |

## 作者仓最小结构

```text
my-feature/
├── package.json
├── eslint.config.js
├── .vscode/
├── sapi/
│   ├── manifest.json
│   ├── tsconfig.json
│   └── src/index.ts      # ModuleRegistry.register + DESCRIPTOR
└── test/
```

入口须 `ModuleRegistry.register({ id, lifecycle })`。生命周期顺序：`registerPermissions` → `registerCommands` → `registerEvents` → `init`。

## SDK 导入（模块只依赖这些）

| 路径 | 用途 |
|------|------|
| `@sfmc-bds/sdk/sapi/runtime` | Msg、命令、权限、菜单 |
| `@sfmc-bds/sdk/sapi/db` | 表 / CRUD / 事务 |
| `@sfmc-bds/sdk/sapi/config` | 模块私有配置 |
| `@sfmc-bds/sdk/sapi/service` | 跨模块服务 |
| `@sfmc-bds/sdk/testing` | `createSandbox` |
| `@minecraft/*` | SAPI |

禁止：legacy `HttpDB`；`player.sendMessage()`；import 他模块源码；读他模块私有表。

## 测试要点

- 默认门禁：`npm test`（`createSandbox`，对齐宿主分相；沙箱内含 chat → `Command.trigger`）。
- 未实现的 `@minecraft/*` API 会 **硬失败**（非静默 noop）→ 进服仍是终检。
- 改 SDK mc-fake 生成物后：在 SDK 包执行 `npm run gen:mc-fake` 并提交 `testing/engine/generated/`。

## 发布

1. `npm publish --access public`（或扩展 Publish）
2. 向 `sfmc-modules` 仓库 `index.json` 开 PR
3. 服主：`sfmc mod install <id>`（默认走 npm）

官方 scope `@sfmc-bds/*` 不对外部作者开放社区包命名空间。

## 相关

- 平台进仓 / 三根路径 → `sfmc-onboarding`
- 约定全文 → `docs/zh/dev/conventions.md`
- 测试 → `docs/zh/dev/testing.md`
- 发布 → `docs/zh/dev/publish.md`
