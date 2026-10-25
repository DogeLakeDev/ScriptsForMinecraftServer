---
"@sfmc-bds/db-server": patch
"@sfmc-bds/sdk": patch
---

修复 `/reload` 后模块初始化偶发「事务繁忙」：旧脚本实例刚开启、来不及提交或回滚的交互式事务会话会占住 db-server 全局事务槽直到空闲超时（15 秒），新实例模块 init 的读写因此失败。db-server 新增 `POST /api/sfmc/db/tx/reap`（只中止鉴权身份所属模块的会话，返回 `aborted` 数量）；SDK 宿主在 `ModuleRegistry.bootAll()` 之前对各模块调用一次回收，失败只记日志、不阻断启动（兼容未升级的 db-server）。
