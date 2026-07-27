---
"@sfmc-bds/cli": minor
---

feat(sfmc-cli): 命令通道分层（external / repl / both）

- 单一权威 `command-surface`：部署类（install/create/debug 等）仅外部；send / logs -f 仅 REPL
- help 按通道过滤；dev 类命令蓝色展示（无独立 devmode 开关）
- 去掉 `devmode` / `runtime.json#developer_mode` 门禁
