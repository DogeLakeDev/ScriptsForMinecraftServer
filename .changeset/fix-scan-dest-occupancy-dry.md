---
"@sfmc-bds/bds-tools": patch
---

修复 #80 合入冲突残留：`scanDestOccupancy` 恢复走 `readPackDirOccupancy`（DRY），消除未声明标识符导致的 tsc7 构建失败。
