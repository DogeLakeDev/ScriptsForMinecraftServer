# `@sfmc-bds/eslint-plugin`

SFMC 模块 / SDK 约定的 ESLint 插件，形态对齐 [`eslint-plugin-minecraft-linting`](https://www.npmjs.com/package/eslint-plugin-minecraft-linting)：独立包 + `configs.recommended`。

## 安装

主仓 workspace 已包含；sfmc-modules 通过 `file:` 依赖主仓路径。

```bash
npm install -D @sfmc-bds/eslint-plugin
```

## Flat config

```js
import sfmc from "@sfmc-bds/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["packages/*/sapi/src/**/*.ts"],
    languageOptions: { parser: tsParser },
    ...sfmc.configs.recommended,
  },
  // SDK 实现 Msg / HttpDB 处可关闭部分规则
  {
    files: ["**/sapi/runtime/msg.ts", "**/sapi/runtime/httpdb.ts"],
    rules: {
      "@sfmc-bds/no-player-send-message": "off",
      "@sfmc-bds/no-httpdb-legacy": "off",
    },
  },
  // economy 模块自身可读写私有表
  {
    files: ["**/packages/economy/**", "**/module-economy/**"],
    rules: { "@sfmc-bds/no-economy-private-tables": "off" },
  },
];
```

更严：用 `sfmc.configs.all`（若干 warn 升为 error）。

## 规则

| Rule | recommended | 说明 |
|------|-------------|------|
| `@sfmc-bds/no-player-send-message` | warn | 禁止 `*.sendMessage()`，改用 `Msg.*` |
| `@sfmc-bds/no-sfmc-sdk-alias` | error | 禁止 `@sfmc/sdk`，改用 `@sfmc-bds/sdk` |
| `@sfmc-bds/no-sdk-deep-import` | error | 禁止相对路径深挖 SDK 源码 |
| `@sfmc-bds/no-sdk-private-export` | error | 仅允许 `@sfmc-bds/sdk` 公开 `exports` 子路径 |
| `@sfmc-bds/require-module-registry` | warn | `sapi/src/index.ts` 须 `ModuleRegistry.register` |
| `@sfmc-bds/no-db-toplevel-in-tx` | error | `db.tx` 内禁顶层 `db.*` / `service.get`；用 `tx.*` / `tx.call` / `inTx` |
| `@sfmc-bds/require-command-permission` | warn | `Command.register` 字符串权限须同包 `Permission.register` |
| `@sfmc-bds/no-httpdb-legacy` | warn | `HttpDB` 为 legacy；用 `db` / `service` / `config` |
| `@sfmc-bds/require-service-requires` | warn | `service.get` / `tx.call` 须在本包 `services.requires` 声明 |
| `@sfmc-bds/valid-config-key` | warn | `config.get/set` 字段对照默认配置；`onChange` 校验 arity |
| `@sfmc-bds/require-await-sdk-promise` | warn | 常见 SDK Promise API 须 `await` / `return` / `void` |
| `@sfmc-bds/no-economy-private-tables` | error | 禁止读写 `sfmc_economy_*`；用 economy client / service |
| `@sfmc-bds/no-platform-internal-import` | error | 禁止 import `db-server` / `sfmc` / `bds-tools` 等平台内部 |
| `@sfmc-bds/no-cross-module-source-import` | error | 禁止深挖其它模块 `sapi/src`；允许 `@sfmc-bds/module-*/client` |

## 开发

```bash
npm run build -w @sfmc-bds/eslint-plugin
# 发布 build 不含 *.test.ts / rule-tester；测试走独立 tsconfig
npm run test -w @sfmc-bds/eslint-plugin
```
