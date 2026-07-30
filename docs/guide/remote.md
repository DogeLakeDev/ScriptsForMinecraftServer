# 远程控制

把本机 SFMC 监督进程注册到外部控制器，由控制器下发任务（启停服务等）。功能仍为 **beta**。

Agent **只出站**连控制器，不在本机开入站管理口。凭证写在 `configs/remote.json`。

## 注册

在控制器拿到 enrollment token 后：

```bash
sfmc remote enroll <controller-url> <enrollment-token> [name]
```

未指定 `name` 时，默认用本机计算机名（或 `sfmc-agent`）。成功后写入 `remote.json`（`enabled`、`controller_url`、`agent_id`、`agent_secret`），外壳进程可保持守护。

## 状态与断开

```bash
sfmc> remote status
sfmc> remote disable
```

| 命令 | 作用 |
| ------ | ------ |
| `remote enroll …` | 向控制器注册并启用 |
| `remote status` | 打印 enabled / 连接状态 / 最近错误等 |
| `remote disable` | 关闭启用标志并断开连接 |

`disable` 不会清掉已保存的 id/secret；再次启用需改配置或重新 enroll。

## 运行时

监督进程启动时若配置齐全，会建立 WebSocket、发送 `hello` 与心跳，并执行控制器下发的 `task`。断线会自动重连。

!!! tip "提示"
    缺字段时日志会提示 `run sfmc remote enroll`。日志可在 `<SFMC_ROOT>/.sfmc/logs/` 查看。
