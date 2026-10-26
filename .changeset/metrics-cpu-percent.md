---
"@sfmc-bds/db-server": patch
"@sfmc-bds/management": patch
---

运行指标新增 CPU 占用率：数据服务在资源采集时对累计 CPU 时间求差，以整机全部逻辑核为 100%，通过 `host.cpu.usedPercent` 与 `processes.*.cpuPercent` 返回，并以 `hostCpuPercent`、`bdsCpuPercent`、`dbCpuPercent`、`partsCpuPercent` 写入资源历史供曲线使用。管理协议类型同步新增这些可选字段；旧数据服务不返回时客户端回退显示累计 CPU 秒数。
