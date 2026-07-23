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
];
```

更严：用 `sfmc.configs.all`（`no-player-send-message` 升为 error）。

## 规则

| Rule | recommended | 说明 |
|------|-------------|------|
| `@sfmc-bds/no-player-send-message` | warn | 禁止 `*.sendMessage()`，改用 `Msg.*` |
| `@sfmc-bds/no-sfmc-sdk-alias` | error | 禁止 `@sfmc/sdk`，改用 `@sfmc-bds/sdk` |
| `@sfmc-bds/no-sdk-deep-import` | error | 禁止相对路径深挖 SDK 源码 |
| `@sfmc-bds/require-module-registry` | warn | `sapi/src/index.ts` 须 `ModuleRegistry.register` |

SDK 自身 `sapi/runtime` 实现 `Msg` 时可对 `no-player-send-message` 设 `off`。

## 开发

```bash
npm run build -w @sfmc-bds/eslint-plugin
npm run test -w @sfmc-bds/eslint-plugin
```
