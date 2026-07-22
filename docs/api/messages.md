# 消息 API

表 `sfmc_chat_messages`，用于游戏内频道与 QQ 桥。

## GET /api/sfmc/messages

Query 参数（均可选）：

| 参数 | 说明 |
|------|------|
| `search` | 内容模糊匹配 |
| `type` | 消息类型 |
| `channelId` | 频道 id |
| `from` | 发送者 id |
| `minCreatedAt` / `maxCreatedAt` | 时间范围（毫秒时间戳） |
| `minSentAt` | 同 created 过滤 |

响应：`{ messages: [...] }`

## POST /api/sfmc/messages

批量写入，最多 **100** 条。Body：

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

成功：`{ success: true }`。POST 后会尝试转发到 QQ（MC→QQ 仍主要由 db-server 直连 LLBot）。

## 与 qq-bridge 的关系

QQ→MC：LLBot → qq-bridge → POST 本接口  
MC→QQ：db-server 根据配置调 LLBot HTTP

运维见 [使用指南 → QQ](../guide/qq-bridge.md)。
