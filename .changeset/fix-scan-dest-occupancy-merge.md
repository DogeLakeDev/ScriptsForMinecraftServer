---
"@sfmc-bds/bds-tools": patch
---

修复 #80/#81 合并后 `scanDestOccupancy` 未赋值 `facts`、引用未声明标识符导致 tsc 构建失败；恢复经 `readPackDirOccupancy` 的 DRY 占用扫描。
