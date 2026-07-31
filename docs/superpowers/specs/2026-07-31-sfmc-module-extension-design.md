# SFMC Module 扩展重写设计

**日期：** 2026-07-31  
**状态：** 待审  
**范围：** `extensions/sfmc-module` 推倒重写；Playground 宿主；与 `@sfmc-bds/devkit` / `@sfmc-bds/sdk/testing` 的边界  
**非目标：** Marketplace 上架流程、Enable/Disable、扫主仓 `modules/packages`、BDS 内断点、完整假 BDS

---

## 1. 问题与成功标准

现有扩展由不熟悉项目模型的实现堆出，典型缺陷：Watch 盯错模块、`sfmc.root` 静默回退到工作区、启停半成品、与 CLI/`devkit` 漂移。

成功标准：

> 作者单独打开模块仓，用侧栏 Playground（可调试）验证模块行为，用 Watch/Reload 联调真机；路径解析与重建逻辑与 `devkit` 同源，不再猜主仓。

作者默认**不必**手写 `node:test`；手写测试为可选增强。

---

## 2. 约束与决策摘要

| 决策 | 选择 |
|------|------|
| 实现路线 | 薄扩展 + 厚 `devkit` / SDK testing |
| 主工作区 | 单独打开模块仓；`sfmc.root` 指向 SFMC 主仓根 |
| `sfmc.root` 缺失 | Watch/Reload 时立刻选目录，写入 **Workspace** 设置后继续；选了就信，不做 `modules/` 形态检查 |
| 模块根缺失 | 提示 + **打开模块根目录**（`openFolder`） |
| 测试主路径 | IDE Playground + 一键冒烟；非强制 `npm test` |
| 断点 | Playground「启动并调试」（Node + source map）；目标主要是模块 `sapi/src` |
| 启停 | 第一版不做 |

保留对外 command id / 显示名（文档已引用）：`sfmcModule.newModule`、`runTests`、`startWatch`、`stopWatch`、`reload`、`refreshTree` 等。删除半成品 Enable/Disable 贡献项。内部不再用 `watchStarted` 伪命令绕树刷新。

---

## 3. 架构

```text
┌─ VS Code / Cursor (extensions/sfmc-module) ───────────────┐
│  路径解析 │ Tree │ Webview Playground │ 命令 │ 状态栏     │
│  spawn npm test? 否（冒烟走宿主）                         │
│  debug.startDebugging → playground-host                   │
└─────────────┬───────────────────────────┬─────────────────┘
              │                           │
              ▼                           ▼
┌─ playground-host ─────────┐  ┌─ @sfmc-bds/devkit ─────────┐
│  createSandbox            │  │  scaffoldModule            │
│  会话 / chatSend / emit   │  │  startModuleWatch          │
│  UI queueResponse / 冒烟  │  │  rebuildAndDeploy          │
│  JSON-RPC ↔ Webview       │  │  resolveModuleRoot（权威） │
└───────────────────────────┘  └────────────────────────────┘
              │
              ▼
     @sfmc-bds/sdk/testing（假引擎，不在扩展内再实现）
```

**DIP：** 模块根判定、SFMC 根读写约定、重建部署只在 `devkit`（或 SDK）一处权威；扩展只做 VS Code UI 与进程生命周期。

---

## 4. 路径解析

### 4.1 有效模块根

目录 `D` 同时满足：

1. 存在 `D/package.json`
2. 存在可解析的 `D/sapi/manifest.json`
3. `schemaVersion === 2` 且 `id` 为非空字符串

第一版不要求 `package.json` 依赖里必须出现 `@sfmc-bds/sdk`（可作为后续加强）。

### 4.2 发现顺序

1. 活动编辑器：自文件路径向上找最近有效模块根  
2. 各 `workspaceFolder`：若自身是有效模块根则收录  
3. **不**递归扫子目录；**不**扫描 `sfmc.root/modules/packages/*`  
4. 多个 → Tree 全列；需单一目标的命令 → QuickPick（标签用 `manifest.id` / `name`）  
5. 零个 → Tree 提示「未检测到 SFMC 模块」+ 打开模块根目录

### 4.3 `sfmc.root`

- 唯一配置键：`sfmc.root`  
- 仅 Watch / Reload 需要  
- 已设且路径存在 → 使用  
- 否则 → `showOpenDialog` 选文件夹 → 写入 Workspace `sfmc.root` → 继续当前命令  
- 用户取消选择 → 中止，不堆错误  
- Playground / New Module / 仅模块本地操作：**不依赖** `sfmc.root`

---

### 5.0 模拟边界（SAPI 1:1，无最小集）

**权威：** [script-api-native-map.md](../notes/script-api-native-map.md)。

第一轮三块完整映射 pin 版 `@minecraft/server` 表面，不裁最小集：

| 块 | 行为 |
|----|------|
| **构造对象** | 属性袋 = d.ts 可写字段；入口对齐 SAPI |
| **操作对象** | 全部 method 可调；L2 有语义 / 否则 L0 硬失败 |
| **事件触发** | 全部 hub 信号可 emit |

元数据从 `.d.ts` 生成；快捷糖次轮。计划见 [../plans/2026-07-31-sapi-playground-1to1.md](../plans/2026-07-31-sapi-playground-1to1.md)。

---

## 5. 世界模拟维度（沙箱 + Playground 共用）

「全表面 ≠ 假 BDS」。维度用于约定保真与面板范围。

| ID | 维度 | 含义 | 沙箱 | Playground v1 |
|----|------|------|------|----------------|
| H | 宿主分相 | ConfigManager → boot → worldLoad → afterWorldLoad；dispose | 有 | 启动 / 重启 / 销毁；启动并调试 |
| S | System 时间 | run / timeout / interval；tick / flush | 有 | 推进 N tick |
| W | World 壳 | 假 world、维度入口 | 薄 | 只读（已 load 等） |
| D | Dimension / 方块 | getBlock 默认空气；set permutation；无物理/区块卸载 | 部分 L2 | 面板后补 |
| P | 玩家 | 名、OP、位置、权限、Msg、inventory 挂接 | 有 | 添加 / 选中 |
| E | 实体 | spawn / query / remove / kill / teleport / tags | 部分 L2 | 面板后补 |
| I | 物品栏 | ItemStack / Container / 36 格 | 有 | 面板后补 |
| C | 聊天 → 命令 | 每玩家聊天框 → `chatSend` → `!` 拦截 | emit 有 | **每玩家聊天框** + 插入 `!` |
| V | 事件对象 | 创建=按属性构造；操作=调方法+事件 | 有 | 创建 / 操作 两区 |
| U | UI | 表单 + queueResponse | 有 | 待应答点选 / 填写 |
| B | 记分板 | objective / score | 有 | 面板后补 |
| M | 模块宿主 | Registry / Permission / Msg / 内存配置 | 有 | boot 结果；一键冒烟 |
| N | DB | 内存假 DB | 有 | 默认假 DB |

**永不模拟：** 完整物理、红石、流体、AI、区块生成语义、客户端渲染、BDS 原生断点。

事件面按模块常用批次加深；未实现 API 保持 L0 硬失败。对照线索见 [script-api-native-map.md](../notes/script-api-native-map.md)（Levi `mc/scripting` 只读、不入库）。

### 5.1 文档落点（实现时必须写入）

世界模拟维度表（上表）与「永不模拟」边界，实现阶段同步进作者可见文档，避免只留在 superpowers 规格里：

| 文档 | 写入内容 |
|------|----------|
| `docs/dev/testing.md` | 完整维度表 + 与 L0–L3 / Playground 面板对应关系 |
| `docs/dev/module-author.md` | 短表或链接：日常用哪些维度、其余靠 Watch |
| 扩展内 Playground 帮助/空态文案 | 一句话指向 testing.md，避免两套口径 |

---

## 6. Playground

### 6.1 定位

- 作者主验证面：点着用沙箱，不强制写测试样板  
- 对照业界：类似 Roblox Playtest + 命令刺激，而非官方 Bedrock Debugger（真机链）；与 Watch 互补  

### 6.2 会话

- 加载当前 `moduleRoot` 的模块描述符，`createSandbox({ module })`  
- 同时仅一个会话；换模块或重启先 `dispose`  
- 不依赖 `sfmc.root`  
- 与扩展：stdio 或等价通道上的 JSON-RPC（实现计划锁定消息表）

### 6.2.1 启动分相可视化（对齐 BDS / SFMC 表面）

启动（含「启动并调试」）时，Playground **必须逐步展示**正在模拟的流程，而不是只显示最终「boot 成功」。步骤顺序对齐真机与映射笔记，尽量覆盖 Script 能观察到的表面（非完整引擎）：

对照权威：

- 主仓启动链：[architecture.md](../../dev/architecture.md)（`startup` → `worldLoad` → `shutdown`）  
- 原生线索：[script-api-native-map.md](../notes/script-api-native-map.md)（`ScriptModuleStartupBeforeEvent` → `system.beforeEvents.startup`；Level init → `world.afterEvents.worldLoad`）  
- Levi `mc/scripting`：只读补充事件/分相命名，**不**把头文件或反编译代码带进扩展  

**建议进度步骤（宿主按序 emit，UI 逐步勾选/高亮；失败停在该步并展示错误）：**

分两层标注，避免把 SFMC 宿主误当成 Mojang API：

- **原生（BDS / Script）**：名用真实 `@minecraft/server` 事件或对象；对照 Learn + [script-api-native-map.md](../notes/script-api-native-map.md)  
- **SFMC 宿主**：名用 `ConfigManager` / `ModuleRegistry` 等；UI 前缀或徽章标 **SFMC**（或缩进挂在上一条原生事件下）

| 序 | 层 | 展示文案（示例） | 沙箱实际动作 | 维度 |
|----|----|------------------|--------------|------|
| 0 | 原生* | 装载脚本入口（early） | 解析并加载模块入口（≈ 真机执行 BP `main.js`；*非*磁盘拷贝） | H |
| 1 | 原生 | 加载 System | 复位/初始化 FakeSystem | S |
| 2 | 原生 | 加载 World 壳 | 初始化 FakeWorld、维度入口、scoreboard 挂接 | W / B |
| 3 | 原生 | 绑定 @minecraft 表面 | minecraft-loader → 假 server / server-ui | — |
| 4 | 原生 | `system.beforeEvents.startup` | 触发假 startup（Script 表面） | H |
| 5 | **SFMC** | └ ConfigManager.init | 内存 DataAdapter / configs（**非**原生 API） | M / N |
| 6 | **SFMC** | └ ModuleRegistry.bootAll | register* + 非延迟 init | M |
| 7 | **SFMC** | └ snapshotEnabled | 快照启用集 | M |
| 8 | 原生 | （等待世界就绪） | 可折叠为一步；对应官方 “Wait for world…” | H |
| 9 | 原生 | Dimension 默认可查询 | overworld 等 `getBlock`（worldLoad 后语义） | D |
| 10 | 原生 | `world.afterEvents.worldLoad` | 触发假 worldLoad | H / V |
| 11 | **SFMC** | └ bootAfterWorldLoad | `afterWorldLoad: true` 的 init | M |
| 12 | — | 就绪 | 可交互 | P / C / … |

细节与事件流程图见 [script-api-native-map.md](../notes/script-api-native-map.md)。

销毁会话：

| 序 | 层 | 展示 | 动作 |
|----|----|------|------|
| 1 | 原生 | `system.beforeEvents.shutdown` | 假 shutdown |
| 2 | **SFMC** | └ ModuleRegistry.teardown / dispose | 清理 Registry、ConfigManager 测试复位 |

原则：

1. **表面优先**：原生行对应 Script 能订阅/拿到的对象；不假装地形/物理。  
2. **宿主诚实**：ConfigManager 等必须标成 SFMC，文案或 tooltip 写清「SFMC 在 startup 回调里执行，不是 BDS 内置步骤」。  
3. **结构对齐真机 BP**：真实打包入口也是「先收到原生 startup，再跑 ConfigManager → bootAll」；进度树用缩进表达从属，而不是把 ConfigManager 写成与 `startup` 平级的「第 N 个 BDS 阶段」。  
4. **硬失败诚实**：原生 L0 未实现 vs SFMC 配置/模块加载失败，错误归类到对应层。  
5. 映射笔记增补分相时，进度表与 `testing.md` 一并更新。

### 6.3 面板能力（v1）

| 区 | 行为 |
|----|------|
| 会话 | 启动 / 重启 / 销毁；**启动并调试**；**分相进度**（§6.2.1）；显示模块 id、boot 成败 |
| 玩家 | 添加假玩家（名、是否 OP）；选中当前玩家 |
| 聊天（每玩家） | 独立输入框；旁侧「插入 `!`」（已有则不重复）；发送 → `emit.chatSend(该玩家, text)`；见 §6.3.1 日志频道 |
| 事件对象 | **创建**（按属性构造）/ **操作**（调方法 + 触发事件） |
| 时间 | `tick(n)` |
| UI | 待应答表单列出；Action/Message 点选或 Modal/Custom 填写后 `queueResponse` |
| 冒烟 | 假 OP 玩家对已注册命令逐条发 `!{name}`（同一 `chatSend` 路径）；汇总通过/抛错 |

**禁止**扩展直接 `triggerCommand` 作为手点主路径；冒烟与手点必须同走聊天（LSP）。

### 6.3.1 日志频道（多路，非单一 Output）

Playground 日志按来源分频道，对齐真机心智：

| 频道 | 对齐真机 | 内容 | UI |
|------|----------|------|-----|
| **系统（System）** | BDS 控制台 / 脚本 `console` 与宿主启动日志 | 分相进度、boot 错误、L0 硬失败、Registry/Config 日志、未绑定到具体玩家的 `Msg`/系统通道、冒烟汇总 | 独立「系统」面板或标签页 |
| **玩家（每玩家一路）** | 该玩家客户端聊天 / 收到的 `sendMessage`·`Msg.*` | 该玩家发出的聊天原文、模块对该玩家的回显与提示音文案等价物 | **挂在该玩家聊天框旁**（同一玩家卡片内：上为历史，下为输入） |

规则：

1. **不混流**：系统频道不默认塞进某个玩家框；玩家回显不进系统频道（除非消息本身是广播/系统频道且规格标明——广播可同时写入「系统」+ 各在线玩家，或单独「广播」标签；第一版：**广播进系统 + 每个在线玩家各一份**，避免丢信息）。  
2. **路由权威**：`player.sendMessage` / `Msg.*(player, …)` → 该玩家频道；无 player 或明确系统通道 → 系统频道；宿主/分相/未捕获异常 → 系统频道。  
3. **扩展 OutputChannel `SFMC Module`**：可镜像系统频道（便于无 Webview 时排查）；不以它替代每玩家聊天 UI。  
4. 销毁会话时清空各频道；重启分相日志重新写入系统频道。

### 6.4 调试

- 「启动并调试」：`vscode.debug.startDebugging`，`program` 为 playground-host，带 inspect / source map  
- 断点主要落在模块 `sapi/src`  
- 日常「启动」不挂调试器  

### 6.5 模块入口约定

宿主须能从模块根解析可 boot 的描述符（与模板一致：如导出 `DESCRIPTOR` / `ModuleRegistry.register` 入口）。解析规则放在 `devkit` 或共享 loader，一处权威；失败时 Playground 明确报错（缺导出 / 加载失败）。

### 6.6 `SFMC: Run Module Tests`

语义改为：**对当前模块跑一键冒烟**（同 §6.3），结果进 OutputChannel / Playground 日志。  
手写 `npm test` 仍可由作者终端或 `nodejs-testing` 扩展运行，SFMC Module **不**再以 spawn `npm test` 为主路径。

---

## 7. 其它命令与 Tree

| 命令 | 行为 |
|------|------|
| New Module | InputBox id/name → 选父目录 → `devkit.scaffoldModule`；询问是否打开新目录 |
| Start Watch | 解析 moduleRoot + 确保 sfmc.root → `startModuleWatch`；`onRebuild` → `rebuildAndDeploy`；同时仅一个 Watch |
| Stop Watch | 停 watcher，刷 Tree / 状态栏 |
| Reload to BDS | 确保 sfmc.root → `rebuildAndDeploy` |
| Refresh | 重扫模块根 |

**Tree：** 每模块子节点含 Run Tests（冒烟）、Start/Stop Watch、Reload、Module Info、打开 Playground（若独立命令）。Watch 中模块可标记 `watching`。另一模块点 Start → 先 Stop 再 Start。

**生命周期：** 单一 OutputChannel `SFMC Module`；`deactivate` 停 Watch 与 Playground 宿主；TreeProvider 正确 dispose。

---

## 8. 构建与验收

- `extensions/sfmc-module`：`npm run build` → `dist/`；可 `vsce package`  
- 本地：F5 Extension Development Host 或装 `.vsix`  

**验收：**

1. 单独开模块仓能识别有效根；无效可打开目录  
2. Playground：会话分相进度可见；系统频道 ≈ BDS 控制台；每玩家聊天框含输入+该玩家 Msg；插 `!`、事件、tick、UI  
3. 启动并调试：模块源码断点，发 `!` 聊天可停住  
4. 一键冒烟经 `!name` + chatSend 汇总  
5. Watch/Reload：缺根则选目录写入设置；Watch 盯选定模块  
6. New Module 可用  
7. `docs/dev/testing.md`（及 module-author 链接）含世界模拟维度表，与规格一致  
8. 无：猜主仓、Watch 死盯列表第一项、启停半成品入口  

---

## 9. 与既有规格关系

- 沙箱保真层级、L0 硬失败、宿主分相：见 [2026-07-30-sapi-testing-sandbox-design.md](./2026-07-30-sapi-testing-sandbox-design.md)  
- 本规格增加：**消费面**（扩展 Playground / 维度表 / 每玩家聊天 / 调试启动），不取代沙箱引擎规格  
- 引擎缺口（某事件未 L2）在 Playground 表现为硬失败或明确「未实现」，不静默 noop  

---

## 10. 范围拆分说明

本规格可用**一份**实现计划覆盖，但实现上建议分批：

1. 路径 + Tree + Watch/Reload/New Module（修正确性）  
2. playground-host + Webview 核心（会话 / 玩家 / 每玩家聊天 / tick / 事件）  
3. UI 应答 + 冒烟 + 启动并调试  

批次属于计划层，不拆成多个产品规格。
