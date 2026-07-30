# 消息

表 `sfmc_chat_messages`，用于游戏内频道与 QQ 桥。运维见 [使用指南 · QQ](../guide/qq-bridge.md)。

## GET /api/sfmc/messages

Query（均可选）：

| 参数 | 说明 |
| ------ | ------ |
| `search` | 内容模糊匹配 |
| `type` | 消息类型 |
| `channelId` | 频道 id |
| `from` | 发送者 id |
| `minCreatedAt` / `maxCreatedAt` | 时间范围（毫秒） |
| `minSentAt` | 同 created 过滤 |

响应：`{ messages: [...] }`。

## POST /api/sfmc/messages

批量写入，最多 **100** 条。

```json
{
  "messages": [
    {
      "id": "uuid",
      "channelId": "bridge",
      "fromid": "player-uuid",
      "fromName": "Steve",
      "type": "text",
      "content": "hello",
      "attachment": null,
      "showTimestamp": true,
      "timestamp": 1721548800000
    }
  ]
}
```

成功：`{ success: true }`。写入后可能触发 MC→QQ（由 db-server 直连 LLBot）。

## 与 qq-bridge

| 方向 | 路径 |
| ------ | ------ |
| QQ → MC | LLBot → qq-bridge → POST 本接口 |
| MC → QQ | db-server → LLBot HTTP |
