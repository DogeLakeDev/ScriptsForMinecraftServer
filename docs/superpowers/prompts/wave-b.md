# Wave B：交互中枢、通用服务与自治叶子模块（6 个）

开仓前确认 Wave A 中本模块 `requires` 的上游已具备可用契约（或按 AGENT_BRIEF 开仓闸门等待 SDK）。  
套用 skill `sfmc-module-kickoff` + 对应 `*-design.md`。

---

## 6. `gui`（数据驱动 UI 引擎与单页路由中枢）

```markdown
请实现 official module: `gui`。
权威规范：docs/superpowers/specs/modules/gui-design.md
【关键要求】：
1. 平台交互中枢：`manifest.requires: []`，纯粹作为微内核表单导航容器；
2. MenuNavigator SPA 单页路由：基于 Observable 状态实现 0ms 零黑屏动态刷新，支持多级面包屑与返回历史；
3. 扩展能力：封装原生 `ActionFormData` / `ModalFormData`，支持 `image`、`spacer`、`divider` 及按钮 `disabled` 状态；
4. 防吞保护：封装 `gui.showForm` 提供 8 秒安全重试管道；
5. 服务暴露：提供 `gui.registerMenuItem`、`gui.registerAdminItem` 与 `gui.openMainMenu`。
```

---

## 7. `chat`（聊天管道与消息分流中枢）

```markdown
请实现 official module: `chat`。
权威规范：docs/superpowers/specs/modules/chat-design.md
【关键要求】：
1. 独占聊天流：平台唯一独占监听 `world.beforeEvents.chatSend` 的模块，彻底杜绝多模块裸监听冲突；
2. 管道解耦插槽：
   - 提供 `chat.registerInterceptor`（前置拦截器插槽，供 qa 等捕获作答）；
   - 提供 `chat.onMessage`（观察者插槽，供 chat-sounds 等实时监听文本）；
3. 发送服务：提供 `chat.broadcast`（全服广播）与 `chat.send`（定向私聊）；
4. 命令与样式：支持 `!chat` / `!tell`，自定义称号前缀与彩色格式化。
```

---

## 8. `inventory-switcher`（玩家背包多槽位快照与置换服务）

```markdown
请实现 official module: `inventory-switcher`。
权威规范：docs/superpowers/specs/modules/inventory-switcher-design.md
【关键要求】：
1. 纯受控服务：零模式监听、零物理双箱或告示牌，纯内存与数据库（`sfmc_inventories`）结构化持久化；
2. 完整栏位覆盖：36格背包、4格装备栏、副手槽位，精确序列化附魔、耐久、lore 与名称；
3. 原子还原：先清空槽位再填充，杜绝复制漏洞；
4. 服务暴露：提供 `inventory.save`、`inventory.restore`、`inventory.switch`、`inventory.clear` 与 `inventory.has`。
```

---

## 9. `data-backup`（世界环境与计分板灾备中枢）

```markdown
请实现 official module: `data-backup`。
权威规范：docs/superpowers/specs/modules/data-backup-design.md
【关键要求】：
1. 平台基础设施：`canDisable: false`；
2. 引导与灾备快照：定期保存世界种子/游戏规则（`sfmc_world`）、玩家元数据（`sfmc_players`）及全服计分板快照（`sfmc_scoreboards`）；
3. 严格排除业务计分板：快照与恢复时**绝对排除 `sfmc_money`**（由 economy 专属权威托管）；
4. 提供 OP 管理指令：`scoreboard restore`（灾难恢复）。
```

---

## 10. `afk`（位移检测与挂机标记）

```markdown
请实现 official module: `afk`。
权威规范：docs/superpowers/specs/modules/afk-design.md
【关键要求】：
1. 极简自治叶子：纯内存位移检测，零数据库表；
2. 原生 Tag 标记：通过原生玩家 Tag `AFK`（挂机中）和 `NOAFK`（豁免自动检测）运作；
3. 指令支持：`!afk`（主动切换）与 `!noafk <player>`（管理员豁免）；
4. 玩家产生 ≥ 1.0 格位移时自动解除挂机并广播。
```

---

## 11. `spawn-protect`（出生与复活保护）

```markdown
请实现 official module: `spawn-protect`。
权威规范：docs/superpowers/specs/modules/spawn-protect-design.md
【关键要求】：
1. 极简自治叶子：`manifest.requires: []`，零数据库表；
2. 精确刻度保护：监听 `world.afterEvents.playerSpawn`（进服与复活），施加 60 ticks（约 3 秒）最高阶伤害抗性（`minecraft:resistance`, amplifier: 5）；
3. 防覆盖：玩家若已有同等或更高抗性效果时不逆向缩减。
```
