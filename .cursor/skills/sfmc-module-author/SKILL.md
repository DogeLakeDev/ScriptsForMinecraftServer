---
name: sfmc-module-author
description: >-
  Current SFMC module authoring path: npm create @sfmc-bds/module, createSandbox
  tests, link into SFMC_ROOT, extension Watch via @sfmc-bds/devkit, npm publish
  plus sfmc-modules index. Use when creating or linking modules, authoring
  SAPI packages, or choosing author vs ops tooling.
---

# SFMC Module Author

一模块一仓。人类权威文档：`docs/zh/dev/module-author.mdx`（与源码冲突时以文档 + 源码为准）。

## 两面分工

| 动作 | 作者面 | 运维面（SFMC_ROOT） |
|------|--------|---------------------|
| 建仓 | `npm create @sfmc-bds/module@latest` 或 `SFMC: New Module` | — |
| 单测 | `npm test` / `SFMC: Run Tests` | — |
| 挂到工作目录 | 扩展 Link，或 `mod install --link` | 同左 |
| 源码部署 | 扩展 Watch（`@sfmc-bds/devkit`） | `sfmc mod build` / `reload` |
| 启停 | — | `sfmc mod enable` / `disable` |
| 发布 / 安装发布物 | 扩展 Publish 或 `npm publish` + index PR | `sfmc mod install <id>` |

建仓引擎：`@sfmc-bds/create-module`（CLI 与扩展共用 `createModule()`）。

## 闭环

```text
1. npm create @sfmc-bds/module@latest
2. npm install && npm test
3. Link 到 SFMC_ROOT → enable
4. Watch 或 mod reload → 进服终检
5. npm publish → sfmc-modules index.json PR
```

### Link（在 SFMC_ROOT）

```bash
sfmc mod install <id> --from "dir:<作者仓绝对路径>" --link
sfmc mod enable <id>
```

扩展：`sfmc.root` = SFMC_ROOT，再执行 Link。路径含 `#` 或空格时整段加引号。

### 部署边界

| 改动 | 生效 |
|------|------|
| `sapi/src` | Watch / `mod reload` |
| `manifest`、平台 `configs` | 重启 BDS |

## 命名

| 层 | 规则 | 例 |
|----|------|-----|
| install id / 文件夹 | kebab | `my-feature` |
| npm 社区 | `@<user>/sfmc-module-<id>` | `@alice/sfmc-module-my-feature` |
| npm 官方 | `@sfmc-bds/module-<id>` | `@sfmc-bds/module-economy` |
| `manifest.id` | `feature-<id>` 或 `core-<id>` | `feature-my-feature` |
| `configKey` | `-` → `_` | `my_feature` |

## 仓结构

```text
my-feature/
├── package.json
├── eslint.config.js
├── .vscode/
├── sapi/
│   ├── manifest.json
│   ├── tsconfig.json
│   └── src/index.ts    # ModuleRegistry.register + DESCRIPTOR
└── test/
```

`bootModule` 顺序：`registerPermissions` → `registerCommands` → `registerEvents` → `init`。

## 模块依赖面

| 路径 | 用途 |
|------|------|
| `@sfmc-bds/sdk/sapi/runtime` | Msg、命令、权限、菜单 |
| `@sfmc-bds/sdk/sapi/db` | 表 / CRUD / 事务 |
| `@sfmc-bds/sdk/sapi/config` | 模块私有配置 |
| `@sfmc-bds/sdk/sapi/service` | 跨模块服务 |
| `@sfmc-bds/sdk/testing` | `createSandbox` |
| `@minecraft/*` | SAPI |

跨模块：manifest 声明 + `service` / `tx`。消息用 `Msg.*`。

## 测试与发布

- 门禁：`npm test`（`createSandbox`；未实现的 `@minecraft/*` API 会硬失败）
- 进服：Watch / 日志终检
- 发布：`npm publish --access public` → `sfmc-modules` 的 `index.json` PR
- 社区包用 `@<user>/sfmc-module-*`；官方包用 `@sfmc-bds/module-*`

## 相关

- 三根路径 → `sfmc-onboarding`
- `docs/zh/dev/conventions.md` · `testing.md` · `publish.md`
