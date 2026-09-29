---
"@sfmc-bds/cli": minor
---

新增业务模块自动更新。`mod update` 在开服前按官方索引升级已安装模块，保留启停状态；失败时从回收站还原，不挡住开服。社区包和本地链接默认不自动升级，可用 `mod pin` 单独打开。`stop` / `restart` 改为经 `Service.stop` 清理外部 BDS、db、qq 实例。
