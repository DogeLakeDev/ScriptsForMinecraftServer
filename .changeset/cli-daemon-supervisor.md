---
"@sfmc-bds/cli": patch
"@sfmc-bds/sdk": patch
"@sfmc-bds/bds-tools": patch
"@sfmc-bds/sfmc": patch
---

新增 CLI 守护进程监管：退出 CLI 不停服，经命名管道 RPC 连接；移除 bds_updater 崩溃自启配置项，改由 daemon 固定拉起。正式版补丁 0.2.3。
