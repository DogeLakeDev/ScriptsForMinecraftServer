# 服务管理

推荐启动顺序：**db-server → qq-bridge（可选）→ BDS**。

## sfmc 常用命令

```bash
node sfmc/dist/main.js          # 进 REPL
node sfmc/dist/main.js status   # 只看状态
```

| 命令 | 说明 |
|------|------|
| `start db\|qq\|llbot\|bds\|-all` | 启动（`bds` 启动前会校验并按需重编行为包） |
| `stop …` / `restart …` | 停 / 重启 |
| `logs <svc> [-n N] [-f]` | 看日志 |
| `init` | 重跑向导 |
| `update [--check-only]` | 检查或安装 BDS 更新 |
| `module`/`mod` list\|install\|build\|… | 模块（见 [模块](./modules.md)） |
| `pack` status\|build\|deploy\|list\|… | 行为包/资源包装载（见 [行为包](./behavior-pack.md)） |
| `remote enroll\|status\|disable` | 远程 agent |

REPL 里输入 `help` 看完整列表。`Ctrl+C` 退出 REPL，子进程可继续跑。装载相关日志源为 **`pack`**（Ctrl+L 可过滤）。

## 行为包与 BDS 启动

`start bds` / `restart bds` / `start -all` 在拉起 `bedrock_server` **之前**会：

1. 比对世界 BP 内 `sfmc-deploy-catalog.json` 与本机模块启停/指纹
2. 不一致则整包 `build` + `deploy`（含 `world_*_packs.json` 与 `config/<uuid>/permission.json`）
3. 打印装载摘要；失败则**不**启动 BDS

手动编译可用 `mod build` / `pack build` / `bp build`。

## 单独起 db-server

```bash
cd db-server && npm run build && npm start
curl http://127.0.0.1:3001/api/health
```

## 一键启动

```text
sfmc> start -all
```

会按 **db → qq → llbot → bds** 顺序拉起；bds 步含装载闸门。
