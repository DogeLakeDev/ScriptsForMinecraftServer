# remote-controller

[English](./README-EN.md)

面向 `sfmc` 管理进程的**仅出站**远程管理工具。控制器是一个轻量级 HTTP + WebSocket 服务器；每个 `sfmc` 进程注册一次，并将其 `start / stop / restart / status / send` 操作暴露到网络中。所有流量均为**客户端发起**——管理进程从不打开入站端口。

## 适用场景

- 从统一位置集中管理多个 SFMC 部署实例。
- 从 CI、管理后台或聊天机器人触发远程 `bds` 的 `status` / `restart` 操作。
- 读取近期任务以进行审计追踪。

## 快速开始

```bash
# 1. 控制器侧 —— 生成两个令牌并启动
ENROLL=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
ADMIN=$(node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))")
REMOTE_ENROLL_TOKEN="$ENROLL" REMOTE_ADMIN_TOKEN="$ADMIN" \
  node remote-controller/dist/index.js
# → 监听地址 http://127.0.0.1:3100

# 2. 在每个受管主机上注册一次（写入 configs/remote.json）
node sfmc/dist/sfmc.js remote enroll http://controller.local:3100 "$ENROLL" host-a
# 输出 "Enrolled remote agent: <uuid>" 并保持运行；按 Ctrl-C 可正常退出。

# 3. 使用管理员令牌从任意位置下发任务
curl -sS -X POST \
  -H "Authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' \
  -d '{"action":"status"}' \
  http://controller.local:3100/v1/agents/<uuid>/tasks
# → 202 { id, status: "queued" | "running", ... }
```

在 SFMC REPL 中：

```
sfmc> remote status        # 显示注册信息 + 实时连接状态
sfmc> remote disable       # 关闭连接，保留配置文件
```

## 环境变量

| 变量 | 默认值 | 是否必须 | 说明 |
|---|---|---|---|
| `REMOTE_PORT` | `3100` | 否 | TCP 监听端口 |
| `REMOTE_HOST` | `127.0.0.1` | 否 | 绑定的地址。设为 `0.0.0.0` 可暴露到网络中（建议使用反向代理提供 TLS） |
| `REMOTE_ENROLL_TOKEN` | — | **是** | 用于 `POST /v1/enroll` 的 Bearer 令牌。视为一次性机密，通过更改环境变量并重新部署控制器来轮换 |
| `REMOTE_ADMIN_TOKEN` | — | **是** | 所有管理端点的 Bearer 令牌，可独立轮换 |
| `REMOTE_STATE_FILE` | `data/remote-controller.json` | 否 | 持久化的代理注册表 + 任务日志 |
| `REMOTE_HEARTBEAT_MS` | `25000` | 否 | WebSocket 心跳间隔；客户端每 20 秒 ping 一次 |

两个令牌均为必须项——如果启动时缺少任一变量，进程将非零退出。

## HTTP API

所有管理路由均需要 `Authorization: Bearer <REMOTE_ADMIN_TOKEN>`。

| 方法 | 路径 | 认证 | 说明 |
|---|---|---|---|
| `GET` | `/v1/health` | — | 返回 `{ ok, agents, connected }`。公开，无需令牌 |
| `POST` | `/v1/enroll` | 注册令牌 | 请求体 `{ name?: string }`。返回 `{ agentId, agentSecret }`，需写入主机的 `configs/remote.json` |
| `GET` | `/v1/agents` | 管理员令牌 | 列出所有代理及其 `connected` 状态 |
| `GET` | `/v1/agents/{id}` | 管理员令牌 | 单个代理详情（含 `lastSeenAt`） |
| `DELETE` | `/v1/agents/{id}` | 管理员令牌 | 移除代理并关闭其 WebSocket 连接。进行中的任务将被标记为 `failed`，原因为 `agent_deleted` |
| `POST` | `/v1/agents/{id}/tasks` | 管理员令牌 | 下发任务（见下文） |
| `GET` | `/v1/agents/{id}/tasks` | 管理员令牌 | 列出代理的任务。可选参数 `?status=complete\|failed\|running\|queued`，`?limit=50`（最大 200） |
| `GET` | `/v1/tasks/{id}` | 管理员令牌 | 查看单个任务详情 |
| `WS` | `/v1/agent?id={agentId}` | 每个代理的 secret（在 hello 帧中） | 长连接，供 `sfmc` 使用 |

### 任务

```jsonc
// POST /v1/agents/{id}/tasks
{ "action": "status" }                                      // 列出服务状态
{ "action": "start",  "service": "bds" }                    // 需要 service 字段
{ "action": "stop",   "service": "db" }
{ "action": "restart","service": "qq" }
{ "action": "send",   "service": "bds", "message": "stop" }  // 写入 stdin
```

`service` 必须是 `bds`、`db`、`qq`、`llbot` 之一。`send` 操作额外需要非空的 `message`。

生命周期：`queued → running → complete | failed`。服务器立即返回任务并附带 HTTP 202。可通过轮询 `GET /v1/tasks/{id}`（或 `GET /v1/agents/{id}/tasks?status=...`）获取结果。

## 代理配置

注册成功后，管理进程会写入 `<root>/configs/remote.json`：

```jsonc
{
  "enabled": true,
  "controller_url": "http://controller.local:3100",
  "agent_id": "9e5c...",
  "agent_secret": "fJQK..."
}
```

如需禁用但不删除，可将 `enabled` 改为 `false`，或运行 `sfmc remote disable`（同时清空内存状态）。删除该文件可移除所有痕迹。

## 运维注意事项

- 控制器每次变更都会同步重写 `state` 文件。请勿在多个控制器实例间共享该文件——写入竞争会导致文件损坏。若需高可用，请在负载均衡器后方运行单个控制器，并转发 WebSocket 升级请求。
- 代理会以指数退避（1s → 30s）自动重连，并在每次断开后重置延迟。客户端心跳 20 秒，服务端心跳 25 秒。
- `agent_secret` 是代理保留的唯一凭证。请将该文件视为敏感信息（POSIX 上可 `chmod 600`）。
- 如需暴露到互联网：在反向代理（Caddy、nginx、Cloudflare Tunnel）处终止 TLS，并绑定 `REMOTE_HOST=127.0.0.1`。此服务器未实现限流、IP 白名单或 Origin 检查。

## 开发

```bash
# 构建
npx tsc -p tsconfig.json

# 从源码直接运行（不构建）
REMOTE_ENROLL_TOKEN=t1 REMOTE_ADMIN_TOKEN=t2 npx tsx src/index.ts

# 冒烟测试（注册 + 下发任务 + 删除，无需 sfmc）
node tools/smoke-remote-controller.js
```

## 故障排查

| 现象 | 可能原因 |
|---|---|
| 进程退出并提示 “missing required env vars” | 未同时设置 `REMOTE_ENROLL_TOKEN` 和 `REMOTE_ADMIN_TOKEN` |
| `/v1/enroll` 返回 `401 unauthorized` | 注册令牌错误，或令牌包含尾部空白字符 |
| 代理始终无法连接 | 检查 `configs/remote.json` 是否包含全部四个字段；控制器地址是否可从代理主机访问；WebSocket 升级是否被代理拦截 |
| 任务卡在 `queued` | 代理未连接；检查 `GET /v1/agents/{id}` → `connected: false` |
| `invalid_service` | 服务名必须小写：`bds`、`db`、`qq`、`llbot` |
