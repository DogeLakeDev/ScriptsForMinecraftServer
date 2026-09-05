# chat — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 构建多频道聊天路由中心与**全平台唯一的聊天消息管道与插槽提供者（Chat Pipeline & Slot Provider）**。独占接管并取消原生的 `world.beforeEvents.chatSend`，向平台提供出站消息分发（`chat.send` / `chat.broadcast`）、前置消息拦截器插槽（`chat.registerInterceptor`，供 `qa` 等拦截作答或敏感词过滤）以及投递观察者插槽（`chat.onMessage`，供 `chat-sounds` 等匹配音效或留档）；同时支持公共频道隔离分流、点对点私聊、空间坐标一键分享、玩家传送请求与节操红包分发，并通过标准化 service 对外暴露面板唤起能力供 `gui` 聚合调度。

**Non-goals:**
- 禁止下游模块私自裸监听原生 `world.beforeEvents.chatSend` 竞争拦截，全服聊天数据流统一经由本模块管道插槽派发
- 严禁向外部导出内部 `MenuNavigator` 或 GUI 实现类，跨模块界面唤起统一经由 RPC service 服务完成
- 杜绝移植旧版碎片化的界面文件树，全面基于现行 SDK UI 规范重构
- 离线玩家皮肤像素烘焙（Skin Bake）与自定义字体 Glyph 生成属于独立工具链，不作为本模块运行时目标

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `chat` |
| npm | `@sfmc-bds/module-chat` |
| manifest.id | `chat` |
| configKey | `chat` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["economy"]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `channel` / `ch` | `chat.use` | Member | 打开频道面板 / 切换 |
| `msg` | `chat.use` | Member | 私聊 |
| `lo` | `chat.use` | Member | 分享坐标 |
| `tp` | `chat.use` | Member | 传送邀请相关 |
| `hongbao` / `hb` | `chat.use` | Member | 红包 |

另登记 `chat.admin` 为 Admin（等级 2），用于管理频道（创建/解散、禁言、设置慢速等）。

以 `!`/`！` 开头的消息留给其它系统（命令或前置拦截器），或经由拦截器插槽消费后不进入公屏频道。

### GUI（本模块内 MenuNavigator）

频道面板、管理、设置、私聊、红包、创建/重命名、选人、发送/领取、邀请等；**通过 service 打开**（见 §6），不 `export class` 给 gui。

## 4. Data

| 表名 | 归属 | 关键列 |
|------|------|--------|
| `sfmc_chat_channels` | 平台/本模块 | id, name, type, prefix, owner_id, allow_chat, slow_mode, is_broadcast |
| `sfmc_chat_messages` | 同上 | from_*, channel_id, type, content, attachment, created_at |
| `sfmc_chat_redpackets` | 同上 | 金额/份数/领取者 JSON、过期 |
| `sfmc_players` | 偏好字段 | active_channel, subscribed_channels |
| `sfmc_chat_avatars` | 本模块 defineTable | player_id, slot 0–255, skin_hash, dirty |

## 5. Config

`configKey: chat`；频道慢速/广播等可存表内。可选读取桥接设置（如 QQ channel id）若平台提供。

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `chat.openChannelPanel` | `{ playerId }` | `{ ok }` | 打开主频道 GUI |
| `chat.openRedPacketPanel` | `{ playerId }` | `{ ok }` | 红包 GUI |
| `chat.openPrivatePanel` | `{ playerId, targetId? }` | `{ ok }` | 私聊 GUI |
| `chat.send` | `{ channelId?, targetPlayerId?, senderId?, senderName?, content, type? }` | `{ ok, messageId? }` | 向指定频道或私聊目标发送结构化消息 |
| `chat.broadcast` | `{ content, prefix?, channelId? }` | `{ ok }` | 全服或指定频道系统级广播（供 qa、公告等调用） |
| `chat.registerInterceptor` | `{ id, priority?, handler }` | `{ ok }` | **进程内拦截插槽**：注册前置消息拦截器，若 handler 消费（返回 true）则阻断进入常规频道（供 qa 作答等） |
| `chat.onMessage` | `{ id, handler }` | `{ ok }` | **进程内观察插槽**：注册消息送达观察者，在合法消息分发至公屏时触发（供 chat-sounds 等音效/审计匹配） |

（实现可增补只读查询服务；至少保证 gui 与下游插槽模块不依赖内部实现类。）

### requires

| name | 来自 | 用途 |
|------|------|------|
| `economy.account.credit` | [economy-design.md](./economy-design.md) | 红包领取入账 |
| `economy.account.debit` | 同上 | 发红包扣款 |

发红包与抢红包遵循**两阶段幂等补偿机制**：
1. 生成全局业务幂等键（如 `hb_send_<redpacket_id>`、`hb_claim_<redpacket_id>_<player_id>`）；
2. 先通过 `economy.account.debit` / `credit` 完成玩家计分板资金划转；
3. 划转成功后再提交本地 `sfmc_chat_redpackets` 记录变更。若本地更新失败，触发逆向补偿（原路退款 credit）或记录异常流水。**不依赖且不存在 `inTx` 经济服务**。

## 7. Lifecycle notes

- `afterWorldLoad`: **false**
- `registerEvents`：**独占接管原生事件**。订阅 `world.beforeEvents.chatSend` 并统一设置 `event.cancel = true`，杜绝原生未受控广播。
- **消息插槽管道（Chat Pipeline）处理序列**：
  1. **命令前缀排查**：以半角 `!` 或全角 `！` 开头的内容，若属于已注册命令则放行由命令引擎处理；
  2. **前置拦截插槽（Interceptors）**：执行按优先级排序的拦截器链（如 `qa` 竞答作答）。若拦截器判定命中并消费该消息，则中止后续常规频道路由；
  3. **频道与权限校验**：解析发信玩家当前活跃频道，校验禁言、冷却慢速与发送权限；
  4. **持久化**：消息存入 `sfmc_chat_messages` 留档；
  5. **投递观察者插槽（Observers）**：触发 `chat.onMessage` 观察者钩子（如 `chat-sounds` 关键字扫描、跨服转发）；
  6. **客户端渲染播发**：构造富文本并通过 `Msg.raw` 分发至对应频道订阅者。

## 8. Acceptance criteria

- [ ] 独占接管原生聊天并提供标准拦截器与观察者管道插槽
- [ ] 频道路由、慢速、红包原子扣/入账、私聊/坐标/传送邀请可用
- [ ] provides 面板服务与广播服务；**无** `@sfmc-bds/module-*` 依赖
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 皮肤图集 bake 流水线、glyph 资源包自动化

## 10. Legacy reference（仅参考）

- `packages/chat/`（含旧 chat-gui 合并）
