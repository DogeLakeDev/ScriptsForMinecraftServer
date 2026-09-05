# qa — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 定时向全服播发知识问答题目，挂接至 `chat` 模块的前置拦截器插槽捕获玩家快捷作答（`!答案`）；支持加权题库抽选、答案正则/字面量判定，以及涵盖节操货币、游戏道具与指令执行的多样化奖惩分发。

**Non-goals:**
- 首版不提供图形化题库管理与在线编辑 GUI（题库完全由服务端 JSON 配置文件驱动）
- 不设计跨服务器的分布式竞答同步
- **禁止私自裸监听原生 `world.beforeEvents.chatSend`**，出站题目广播统一调用 `chat.broadcast`，作答判定经由 `chat.registerInterceptor` 拦截插槽完成

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `qa` |
| npm | `@sfmc-bds/module-qa` |
| manifest.id | `qa` |
| configKey | `qa` |
| enabledByDefault | true |
| canDisable | true |
| manifest.requires | `["economy", "chat"]` |

## 3. Player surface

纯聊天管道交互，无独立注册命令。挂接至 `chat` 模块的前置拦截插槽，玩家输入前缀 `!` 或 `！` 后跟答案文本进行竞答；若当前轮次存在活跃题目，系统拦截该消息（返回消费标记）阻止进入常规公屏聊天，并在内部判定作答对错。

## 4. Data

纯内存轮次状态机，无数据库持久化表。

## 5. Config

`configs/qa.json` 必须采用对象结构（杜绝旧版顶层裸数组的非标格式）：

```json
{
  "questions": [
    {
      "weight": 1,
      "question": "Minecraft 的主世界共有几个主要生物群系？",
      "answers": ["60", "六十"],
      "msg_right": "恭喜回答正确！",
      "msg_wrong": "回答错误，再接再厉！",
      "explanation": "截至当前版本主世界拥有超过 60 种生物群系。",
      "rewards": [{ "type": "money", "amount": 10 }],
      "punishments": []
    }
  ],
  "qa_interval_min": 600,
  "qa_interval_max": 720,
  "qa_timeout": 60
}
```

- `Bonus.type` 支持：`money`（节操货币）、`item`（物品给予）、`cmd`（控制台指令）；
- 安全边界：若题库 `questions` 为空或解析失败，模块在 `init` 阶段输出警告并不启动竞答计时器，安全空转。

## 6. Services

### provides

无。

### requires

| name | 来自 | 用途 |
|------|------|------|
| `economy.account.credit` | [economy-design.md](./economy-design.md) | 回答正确发放节操奖励 |
| `economy.account.debit` | 同上 | 回答错误执行节操扣款惩罚（扣至 0 为止，不产生负数） |
| `chat.broadcast` | [chat-design.md](./chat-design.md) | 全服广播竞答题目、获胜喜报与超时答案解析 |
| `chat.registerInterceptor` | 同上 | **进程内插槽接入**：注册作答前置拦截器，捕获并消费玩家竞答消息 |

跨模块调用遵循两阶段幂等原则，传入由轮次与玩家 ID 构成的业务唯一 `idempotencyKey`。

## 7. Lifecycle notes

- `afterWorldLoad`: **false**
- `registerEvents`：调用 `chat.registerInterceptor` 注册作答前置拦截插槽，严禁裸听原生聊天事件
- 题库调度与防重：基于加权随机算法抽题，并维护容量为 5 的最近题目前置队列，避免连续抽到相同题目；出题时调用 `chat.broadcast`；
- 轮次生命周期：每轮题目广播后启动倒计时；每个玩家每轮仅限提交一次答案；有人答对即发放奖励并结束本轮；超时未答出时系统经由 `chat.broadcast` 播发答案与解析并平稳结束。

## 8. Acceptance criteria

- [ ] 严格校验配置文件形状；空题库与坏配置安全降级
- [ ] 接入 `chat` 拦截插槽与广播服务，答案判定、超时公布与奖惩结算全流程闭环
- [ ] 节操奖惩正确调用 `economy.account.*` 跨模块服务并传递幂等键
- [ ] typecheck / lint / test 通过

## 9. Deferred

- 多语言题库、连胜加成

## 10. Legacy reference（仅参考）

- `packages/qa/`
