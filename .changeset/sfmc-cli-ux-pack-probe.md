---
"@sfmc-bds/cli": minor
"@sfmc-bds/bds-tools": minor
---

feat(sfmc/bds-tools): CLI UX 分层、pack-update 迁出、OS 进程探活

- REPL：`/` + Ctrl+P 命令面板、左右光标、quit 干净退出
- argv：`sfmc i|install`、`sfmc -p …`；help 按通道标准化
- pack-update 迁入 `@sfmc-bds/bds-tools/pack-update`（CLI 薄封装）
- process-probe：外部 BDS 可识别；status 区分 managed/external
