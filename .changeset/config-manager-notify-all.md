---
"@sfmc-bds/sdk": patch
---

fix(sdk/ConfigManager): `refreshModules` 对全部启停键做 diff 广播

原先 `_notifyModuleChanges` 在非 force 路径 `break`，只通知 Map 第一项。
现改为：init 全量通知；refresh 相对 previous 通知变更项（含消失 → false）。
