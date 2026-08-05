# ESLint 约定

用 [`@sfmc-bds/eslint-plugin`](https://www.npmjs.com/package/@sfmc-bds/eslint-plugin) 卡住模块与 SDK 约定（Msg、导入路径、跨模块边界等）。形态对齐 `eslint-plugin-minecraft-linting`：独立包 + flat `configs.recommended`。

## 安装

主仓 workspace 已包含。作者仓：

```bash
npm i -D @sfmc-bds/eslint-plugin eslint @typescript-eslint/parser
```

## Flat config

```js
import sfmc from "@sfmc-bds/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["sapi/src/**/*.ts"],
    languageOptions: { parser: tsParser },
    ...sfmc.configs.recommended,
  },
];
```

更严：改用 `sfmc.configs.all`（部分 warn 升为 error）。

主仓根 `eslint.config.js` 已接入；`npm run lint` 会先 build 插件再跑。

## 规则（recommended）

| 规则 | 级别 | 说明 |
| ------ | ------ | ------ |
| `no-player-send-message` | warn | 禁止 `*.sendMessage()`，用 `Msg.*` |
| `no-sfmc-sdk-alias` | error | 禁止 `@sfmc/sdk`，用 `@sfmc-bds/sdk` |
| `no-sdk-deep-import` | error | 禁止相对路径深挖 SDK 源码 |
| `no-sdk-private-export` | error | 仅允许公开 `exports` 子路径 |
| `require-module-registry` | warn | `sapi/src/index.ts` 须 `ModuleRegistry.register` |
| `no-db-toplevel-in-tx` | error | `db.tx` 内禁顶层 `db.*`；用 `tx.*` |
| `require-command-permission` | warn | `Command.register` 权限须同包 `Permission.register` |
| `no-httpdb-legacy` | warn | 勿用 legacy `HttpDB` |
| `require-service-requires` | warn | `service.get` / `tx.call` 须在 manifest `services.requires` |
| `valid-config-key` | warn | `config.get/set` 对照默认配置 |
| `require-await-sdk-promise` | warn | 常见 SDK Promise 须 await / return / void |
| `no-economy-private-tables` | error | 禁止直读写 `sfmc_economy_*` |
| `no-platform-internal-import` | error | 禁止 import db-server / sfmc / bds-tools 等 |
| `no-cross-module-source-import` | error | 禁止深挖其它模块 `sapi/src` |

规则名前缀均为 `@sfmc-bds/`。完整说明见插件 [README](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/modules/sdk/@sfmc-eslint-plugin/README.md)。

## 编辑器

模板 `.vscode/extensions.json` 已推荐 **ESLint**（`dbaeumer.vscode-eslint`）与 **SFMC Module**。安装后打开 `sapi/src` 即可在 Problems 看到规则诊断；勿把 eslint-plugin 再打包成独立 VS Code 扩展。

SFMC Module 扩展在 `package.json` 中通过 `extensionRecommendations` 推荐 ESLint 扩展（**非强制依赖**，缺少时 SFMC Module 仍能激活，但 rules 诊断不可用）。

与 [代码约定](./conventions.md) 互补：lint 管强制项，约定管文风与流程。

## 插件开发（主仓）

```bash
npm run build -w @sfmc-bds/eslint-plugin
npm run test -w @sfmc-bds/eslint-plugin
```
