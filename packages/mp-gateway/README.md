# @sfmc-bds/mp-gateway

SFMC 微信小程序管理网关。微信小程序没法直接启动本机进程，这个网关负责把经过鉴权的 WebSocket 连接逐条桥接到 `sfmc manage --stdio`，管理协议与桌面端完全相同。

- 每条连接对应一个 CLI 管理子进程；连接断开只结束管理通道，不会停止守护进程或服务器。
- 只放行小程序用到的管理方法（见 `src/methods.ts`）。初始化部署、接入升级等需要本机交互的流程仍交给桌面端。
- 握手的实例目录一律改写为网关启动时的 `--root`，客户端无法指定服务器上的其他目录。

## 启动

```bash
pnpm --filter @sfmc-bds/mp-gateway build
node packages/mp-gateway/dist/main.js --root /srv/sfmc
```

首次启动会生成访问令牌，写入 `<root>/.sfmc/mp-gateway.json`（权限 0600），并在终端打印一次；之后启动只提示文件位置。也可以通过 `--token` 或环境变量 `SFMC_MP_GATEWAY_TOKEN` 指定（至少 24 个字符）。其他选项见 `--help`。

默认只监听 `127.0.0.1:3910`。小程序正式版只允许访问 https / wss，请在前面配置 TLS 反向代理。

## 接口

| 路径 | 说明 |
| --- | --- |
| `GET …/health` | 存活检查，无需鉴权 |
| `GET …/manage` | WebSocket，请求头 `Authorization: Bearer <凭证>`（凭证见下文“管理鉴权”） |
| `PUT …/packs/inbox?name=<文件名>` | 上传世界包原始字节到实例收件箱，返回 `{ filename, size }`（管理鉴权） |
| `POST …/auth/wx-login` | `{ code }`：用 `wx.login` 的 code 换玩家会话 `{ token, expiresAt }` |
| `GET …/player/me` | 玩家会话：绑定的游戏账号、SFMC 等级、是否管理员、账号资料 |
| `POST …/player/bind/request` | 玩家会话：申请 6 位绑定码，玩家在游戏内输入 `/c:bind` 后发送该码 |
| `POST …/player/unbind` | 玩家会话：解除微信绑定 |
| `GET …/player/activity` | 玩家会话：本人的行为日志记录（`limit` / `offset` / `eventType` / `eventTypePrefix` / `from` / `to` / `keyword` 等筛选），只返回微信绑定账号的记录；未绑定时 `bound` 为 false |
| `POST …/auth/device/start` / `poll` | 桌面端“用小程序登录”：发起并轮询（公开，限流） |
| `POST …/auth/device/describe` / `approve` / `deny` | 管理员在小程序扫码或输入短码后查看、批准、拒绝 |
| `GET …/auth/devices`、`POST …/auth/devices/revoke` | 管理员查看与撤销已授权的桌面设备 |

路由按路径结尾匹配，反向代理去不去掉前缀都可以。WebSocket 关闭码：`4401` 凭证无效，`4403` 没有管理权限，`4429` 鉴权失败过多（暂时封禁），`4503` 会话数已满（`--max-sessions`，默认 4），`1013` 鉴权依赖的 db-server 暂不可用。

## 微信登录与管理鉴权

设置环境变量 `SFMC_MP_WX_APPID`（或 `--wx-appid`）与 `SFMC_MP_WX_SECRET` 后启用微信登录。AppSecret 只从环境变量读取。网关经本机 db-server（默认读取 `configs/db_config.json` 的 `db_port`，可用 `--db-url` 指定）读写微信绑定与玩家等级。

管理通道接受三种凭证，权限完全相同：

1. 静态访问令牌（原有方式）。
2. 小程序玩家会话：绑定的游戏账号 SFMC 等级为 3 时放行，每次连接都现查等级。
3. 桌面设备凭证：管理员在小程序批准后签发，有效期 30 天；每次连接都现查授权人是否仍为等级 3。授权记录保存在 `<root>/.sfmc/mp-gateway-devices.json`（只存摘要）。

会话签名密钥首次启动时生成，保存在 `<root>/.sfmc/mp-gateway.json` 的 `sessionSecret` 字段；删除该字段会使所有玩家会话与设备凭证失效。

## Nginx 示例

```nginx
location /sfmc/ {
    proxy_pass http://127.0.0.1:3910;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 1h;
    client_max_body_size 256m;
}
```

使用 `X-Forwarded-For` 时请给网关加上 `--trust-proxy`，否则鉴权限流会把所有请求都算在代理地址上。`client_max_body_size` 应不小于 `--max-upload-mb`。

此时小程序里填写的网关地址为 `https://example.com/sfmc`。在微信公众平台「开发管理 → 服务器域名」中添加：

- socket 合法域名：`wss://example.com`
- request 合法域名：`https://example.com`（世界包上传、微信登录与玩家接口）
