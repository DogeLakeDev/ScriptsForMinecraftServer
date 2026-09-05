# chat-sounds — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 挂接至 `chat` 模块的消息管道观察者插槽（Observer Slot），实时匹配聊天文本中的预设关键字，向全服广播对应的 Minecraft 原声音效；内置玩家维度的冷却防刷机制，增强聊天趣味性与互动感。

**Non-goals:**
- 首版不构建动态热词后台管理界面或复杂词典系统
- **禁止私自裸监听原生 `world.beforeEvents.chatSend`**，全服聊天事件统一由 `chat` 模块独占并转化为标准消息管道

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `chat-sounds` |
| npm | `@sfmc-bds/module-chat-sounds` |
| manifest.id | `chat-sounds` |
| configKey | `chat_sounds` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["chat"]` |

## 3. Player surface

纯插槽响应，无独立执行指令。接入 `chat.onMessage` 消息管道观察者插槽进行文本子串模式匹配。

## 4. Data

纯内存维护冷却时间戳，无数据库表。

## 5. Config

`configs/chat_sounds.json`：

```json
{
  "cooldown_ticks": 200,
  "rules": [
    { "keyword": "ciallo", "sound": "random.levelup", "volume": 1.0, "pitch": 1.0 },
    { "keyword": "baka", "sound": "mob.villager.no", "volume": 1.0, "pitch": 1.2 }
  ]
}
```

未配置时自动回退采用内置预设词表与音效映射，默认冷却为 200 ticks（约 10 秒）。

## 6. Services

### provides

无。

### requires

| name | 来自 | 用途 |
|------|------|------|
| `chat.onMessage` | [chat-design.md](./chat-design.md) | 订阅聊天管道中合法投递的消息文本与玩家上下文 |

## 7. Lifecycle notes

- `afterWorldLoad`: **false**
- `registerEvents`：调用 `chat.onMessage` 注册关键词匹配观察者；严禁直接订阅原生 `chatSend`
- 冷却防刷控制：对命中关键词的生存模式玩家记录冷却到期刻数；冷却期间仅发送聊天文本，不触发全服音效；创造模式玩家可豁免冷却直接触发。

## 8. Acceptance criteria

- [ ] 正确挂接 `chat.onMessage` 管道插槽，不抢占原生聊天事件
- [ ] 命中预设关键字即时向全服玩家播发目标音效
- [ ] 玩家个人冷却机制严格生效，无刷屏音效污染
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 动态热词在线增删 GUI

## 10. Legacy reference（仅参考）

- `packages/chat-sounds/`

