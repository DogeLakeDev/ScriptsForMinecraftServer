---
"@sfmc-bds/cli": minor
"@sfmc-bds/bds-tools": minor
---

chore: 删除已无仓内调用的公开兼容导出

破坏性（外部若仍 import 需改用替代）：

- `@sfmc-bds/cli`：移除 `serviceStatus`（用 `queryServicesRuntime`）、`HELP`（用 `getHelp`）、
  `resolveDefaultsDir` / `seedMissingConfigsFromDefaults`、`CommandChannel: "external"` /
  `PaletteEntry` / `listPaletteEntries` 等遗留表面。
- `@sfmc-bds/bds-tools`：移除已不抛出的 `Utf8BomError` 类及 re-export（读 JSON 仍自动剥 BOM）。
