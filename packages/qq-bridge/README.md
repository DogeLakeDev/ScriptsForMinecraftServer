# @sfmc-bds/qq-bridge

SFMC QQ ↔ MC 桥接，支持双后端：

- **official**（默认）：QQ 开放平台 Gateway，转发群内 @机器人消息
- **llbot**：LLBot OneBot 11 reverse-WS（端口 3002）

消息统一 POST 到 db-server `/api/sfmc/messages`。MC→QQ 出站由 db-server 按同一 `qq_backend` 处理。

QQ 侧指令（`菜单` / `ping` / `whoami`）在桥内拦截，不依赖 MC；official 用 Markdown+键盘，llbot 用编号菜单。

配置见 `configs/qq_config.json` 与文档 [QQ 互通](../../docs/zh/guide/qq-bridge.md)。

## 安装

```bash
npm install @sfmc-bds/qq-bridge
node node_modules/@sfmc-bds/qq-bridge/dist/index.js
```

通常由 `@sfmc-bds/sfmc` / `@sfmc-bds/cli` 统一拉起。

## 依赖

- `@sfmc-bds/sdk`
- `ws`
- Node.js >= 22.13

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/packages/qq-bridge>

