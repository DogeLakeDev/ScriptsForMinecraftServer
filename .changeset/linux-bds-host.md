---
"@sfmc-bds/bds-tools": minor
"@sfmc-bds/cli": patch
"@sfmc-bds/db-server": patch
---

Linux BDS 宿主：按平台解析可执行文件与下载 URL，启动时设置 LD_LIBRARY_PATH；argv start 在 POSIX 上 daemonize；pgrep 用 -x 避免误匹配
