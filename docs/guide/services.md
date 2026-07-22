# 服务管理

推荐启动顺序：**db-server → qq-bridge（可选）→ BDS**。

## sfmc 常用命令

```bash
node sfmc/dist/main.js          # 进 REPL
node sfmc/dist/main.js status   # 只看状态
```

| 命令 | 说明 |
|------|------|
| `start db\|qq\|llbot\|bds\|-all` | 启动 |
| `stop …` / `restart …` | 停 / 重启 |
| `logs <svc> [-n N] [-f]` | 看日志 |
| `init` | 重跑向导 |
| `update [--check-only]` | 检查或安装 BDS 更新 |
| `module list\|install\|…` | 模块（见 [模块](./modules.md)） |
| `remote enroll\|status\|disable` | 远程 agent |

REPL 里输入 `help` 看完整列表。`Ctrl+C` 退出 REPL，子进程可继续跑。

## CLI 与 REPL 的差异

这些命令**只在 CLI** 里（单独开终端执行）：

```bash
node sfmc/dist/main.js behavior-pack build
node sfmc/dist/main.js behavior-pack deploy
node sfmc/dist/main.js module enable feature-afk
node sfmc/dist/main.js module disable feature-afk
```

## 单独起 db-server

```bash
cd db-server && npm run build && npm start
curl http://127.0.0.1:3001/api/health
```

## 一键启动

```text
sfmc> start -all
```

会按依赖拉起 db、qq、llbot、bds（具体取决于你的配置）。

下一章：[模块](./modules.md)
