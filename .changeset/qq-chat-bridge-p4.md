---
"@sfmc-bds/db-server": patch
"@sfmc-bds/qq-bridge": patch
"@sfmc-bds/cli": patch
"@sfmc-bds/bds-tools": patch
---

游戏聊天互通：MC→QQ 仅转发 `bridge_channel_id` 匹配且非 `qq_` 回环的 messages；QQ 指令「频道」只读提示；扫描 `modules/packages` 时跟随 symlink（修复 `--link` 在 Linux 下被当成非目录）
