# gui — Design Spec

> **Status:** approved  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** 构建**全平台数据驱动交互引擎与无感导航中枢（Data-Driven UI Engine & Navigation Hub）**。
- 深度集成 `@sfmc-bds/sdk/sapi/runtime` 中的 `MenuNavigator` 与 `@minecraft/server-ui` 全新数据驱动 UI（DDUI）特性；
- 为全服提供统一交互主菜单（`!menu`）、管理员控制台（`!admin`）以及右键快捷唤起道具；
- **双模菜单插槽（Dual-Mode Navigation Slots）**：
  - **无感子路由模式（Seamless SPA Section）**：通过 `build(page, nav)` 将业务子页面直接编织进同一个 `CustomForm`，基于 `ObservableBoolean` 实现 0 毫秒零闪烁页面切换、自动面包屑导航（`titleObs`）与受控返回按钮（`backVis`）；
  - **独立动作模式（Standalone Handler）**：通过 `handler(player)` 支持常规独立动作或唤起非 DDUI 模态表单；
- **响应式动态状态栏（Live Reactive Dashboard）**：在主菜单顶部利用 `ObservableString` 动态呈现玩家实时个人资产、在线时长与服务器 TPS，在玩家眼前实时跳动更新，表单无需关开刷新；
- **单页内联状态反馈（Inline FormStatus）**：集成 `FormStatus`（成功/失败/加载中内联提示），彻底消除打断操作的二次弹窗；
- **表单防踩与繁忙安全重试（UserBusy Safe Queue）**：内置智能轮询重试管道，彻底根绝基岩版在玩家走动、跳跃或界面冲突时“吞表单”的顽疾；
- **微模态二次确认标准服务（`gui.confirm`）**：为全平台提供统一、规范的异步二次确认对话框服务。

**Non-goals:**
- **严禁在 `gui` 内部硬编码任何具体业务逻辑**（领地、钱包、聊天、合作社等界面均由对应模块启动时声明式挂载）；
- **严禁强制依赖任何外部业务模块**，`manifest.requires` 严格保持 **`[]`**（实时大盘感知到 `economy` 等服务不存在时优雅降级隱去对应信息）；
- 不做侵入式 HUD 物理覆层，严格立足并最大化发挥 SAPI 数据驱动表单的标准能力。

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id | `gui` |
| npm | `@sfmc-bds/module-gui` |
| manifest.id | `gui` |
| configKey | `gui` |
| enabledByDefault | true |
| canDisable | **false**（全服交互与导航底座，强制保持激活） |
| manifest.requires | `[]` |

## 3. Player surface

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| `menu`（别名 `cd`） | `menu.use` | Any (0) | 打开动态聚合的 SPA 无感主菜单 |
| `admin`（或 `sfmcadmin`） | `gui.admin` | OP (3) | 打开管理员控制台（多模块运维聚合） |

### 物理快捷道具唤起（Right-click Shortcut Item）

- 玩家手持配置的快捷道具（默认 `minecraft:clock`）**右键或长按**时，直接唤起主菜单；
- 具备防丢/防放置阻断保护，移动端与手柄玩家可一键呼出，大幅降低打字门槛。

## 4. Data

纯内存维护动态导航项与管理项注册表（`Map<id, MenuItemDefinition>`）以及活跃玩家的 `MenuNavigator` 实例句柄，无数据库持久化表。

## 5. Config

`configs/gui.json`：

```json
{
  "menu_title": "§l§eSFMC 综合服务中心",
  "admin_title": "§l§cSFMC 管理员控制台",
  "empty_placeholder": "当前暂无可用服务",
  "show_live_dashboard": true,
  "enable_shortcut_item": true,
  "shortcut_item": {
    "type": "minecraft:clock",
    "name": "§e§l快捷导航 §7[右键/长按打开]",
    "lore": ["§7随时呼出服务器综合服务菜单"],
    "give_on_first_join": false,
    "slot": 8
  },
  "busy_retry_ticks": 10,
  "busy_max_retries": 16
}
```

## 6. Services & 契约定义

### 6.1 菜单注册项契约 (MenuItemDefinition)

```ts
import { Player } from "@minecraft/server";
import { Page, MenuNavigator } from "@sfmc-bds/sdk/sapi/runtime";

export interface MenuItemDefinition {
  readonly id: string;
  /** 按钮主标题，支持静态字符串或动态计算函数 */
  readonly title: string | ((player: Player) => string | Promise<string>);
  /** 排序权重（升序） */
  readonly order?: number;
  /** 图标路径（支持资源包相对路径或原生纹理路径） */
  readonly icon?: string;
  /** 功能分类标识，例如 "general" | "economy" | "world" | "admin" */
  readonly category?: string;
  /** 权限节点限制（未授权玩家自动隐藏） */
  readonly permission?: string;
  /** 动态徽章 / 副标题（例如 "[余额: 1,250]" 或 "[2条待办]"） */
  readonly badge?: (player: Player) => string | Promise<string>;
  /** 
   * 模式 A（推荐）：无感子路由页面构建器。
   * 页面直接编织进同一个 CustomForm，利用 ObservableBoolean 0ms 零闪烁切换，
   * 自动获得面包屑导航、统一返回按钮与内联 FormStatus。
   */
  readonly build?: (page: Page, nav: MenuNavigator) => void | Promise<void>;
  /** 
   * 模式 B：独立动作回调。
   * 用于执行独立操作、触发外部命令或唤起非 DDUI 模态表单。
   */
  readonly handler?: (player: Player) => void;
}
```

### 6.2 页面构建器接口规范 (Page)

SDK 运行时的 `Page` 接口已完整对齐 `@minecraft/server-ui` 的最新 DDUI 控件矩阵：

```ts
export interface Page {
  /** 按钮：支持绑定 disabled(ObservableBoolean)、tooltip 与点击回调 */
  button(label: string | ObservableString, onClick: () => void, options?: ButtonOptions): this;
  /** 文本标签：只读展示 */
  label(text: string | ObservableString | UIRawMessage): this;
  /** 标题行：大号加粗章节标题 */
  header(text: string | ObservableString | UIRawMessage): this;
  /** 图像：支持资源包内图片相对路径与宽度控制 */
  image(src: string | ObservableString, pack: string | ObservableString, options?: ImageOptions): this;
  /** 水平分割线：划分卡片逻辑区域 */
  divider(options?: DividerOptions): this;
  /** 垂直留白：制造呼吸感间距 */
  spacer(options?: SpacingOptions): this;
  /** 文本输入框：支持占位符、小字说明与 disabled 响应式受控 */
  textField(label: string | ObservableString, text: ObservableString, options?: TextFieldOptions): this;
  /** 开关切换：支持小字说明与 disabled 受控 */
  toggle(label: string | ObservableString, toggled: ObservableBoolean, options?: ToggleOptions): this;
  /** 下拉选择框：持有选中项索引与选项列表 */
  dropdown(
    label: string | ObservableString,
    value: ObservableNumber,
    items: DropdownItemData[],
    options?: DropdownOptions
  ): this;
  /** 滑块控件：持有连续数值，支持 step 步长与 min/max 范围 */
  slider(
    label: string | ObservableString,
    value: ObservableNumber,
    min: number | ObservableNumber,
    max: number | ObservableNumber,
    options?: SliderOptions
  ): this;
}
```

### 6.3 provides

| name | input | output | 语义 |
|------|-------|--------|------|
| `gui.registerMenuItem` | `MenuItemDefinition` | `{ ok: boolean }` | **主菜单插槽**：注册玩家主菜单入口项（支持 SPA 子页面与独立动作） |
| `gui.unregisterMenuItem` | `{ id: string }` | `{ ok: boolean }` | 注销指定主菜单项 |
| `gui.registerAdminItem` | `MenuItemDefinition` | `{ ok: boolean }` | **管理后台插槽**：向管理员控制台注册运维管理项 |
| `gui.openMainMenu` | `{ playerId: string }` | `{ ok: boolean }` | 为指定玩家构建并打开 SPA 无感主菜单 |
| `gui.openAdminPanel` | `{ playerId: string }` | `{ ok: boolean }` | 为指定管理员打开运维控制台 |
| `gui.confirm` | `{ playerId: string, title: string, body: string, confirmText?: string, cancelText?: string }` | `Promise<boolean>` | **全平台二次确认**：标准异步确认对话框（内置繁忙重试） |
| `gui.showForm` | `{ playerId: string, form: any, maxRetries?: number }` | `Promise<any>` | **防吞表单执行器**：统一代理表单展现并处理 `UserBusy` 繁忙队列 |

### 6.4 requires

无（零外部强依赖。运行时弱协同探测 `economy`、`online-time` 与 `monitor` 服务用于丰富顶部 Live Dashboard，若不存在则自然降级隐藏对应信息段）。

---

## 7. DDUI 数据驱动表单五大高级设计范式 (Design Patterns)

平台各业务模块在构建界面时，应优先采用以下现代 DDUI 设计范式，彻底摒弃旧版基岩版插件的粗糙交互：

### 范式 1：响应式表单实时防呆与按钮置灰 (Validation & Disabled)

通过将按钮的 `options.disabled` 绑定至 `ObservableBoolean`，在输入不合规或玩家余额不足时实时置灰禁用，杜绝非法提交：

```ts
// 玩家在输入框打字或改变开关时，计算属性自动生效
const isValidName = obsBool(false);
const nameInput = obsStr("");

// 当名字合法且金币充足时，提交按钮自动激活变亮
page.textField("转账目标玩家", nameInput, {
  placeholder: "输入玩家完整名称",
  description: "请仔细核对玩家名称，转账不可撤销"
});

page.button("确认转账", handleTransfer, {
  disabled: isInvalidObs, // 响应式布尔值：无效时按钮为灰色不可点击
  tooltip: "输入有效玩家名称与金额后即可点击"
});
```

### 范式 2：多控件联动与实时计价计算器 (Live Dynamic Calculator)

拖动滑块或切换下拉项时，通过 Observable 监听实时重新计算总价与费用标签，打造现代电商 App 般的体验：

```ts
// 领地租赁：面积下拉 + 天数滑块 = 实时总价联动
const daysObs = obsNum(7);
const priceText = obsStr("§e预估费用: §a700 节操");

page.slider("租赁天数", daysObs, 1, 30, {
  step: 1,
  description: "每日基准租金为 100 节操"
});

page.label(priceText); // 拖动滑块时，价格标签数字当场跳动更新！

daysObs.subscribe((days) => {
  const cost = days * 100;
  priceText.setData(`§e预估费用: §a${cost} 节操 §7(${days}天)`);
  canSubmit.setData(myMoney >= cost);
});
```

### 范式 3：视觉呼吸感与品牌排版 (Hero Banner & Aesthetic Spacing)

利用 `image()` 挂载宣传画，配合 `spacer()` 和 `divider()` 消除界面逼仄感，构建清晰视觉层级：

```ts
// 1. 顶部品牌海报
page.image("textures/ui/sfmc_hero.png", "sfmc-modules-rp", { width: 320 });
page.spacer(); // 垂直呼吸感留白

// 2. 章节大标题
page.header("§6我的领地资产");
page.divider(); // 分割线

// 3. 业务操作区
page.button("📍 创建新领地", () => nav.go("land_create"));
page.button("📜 领地成员与授权", () => nav.go("land_members"));
page.spacer();
```

### 范式 4：单页内联状态流与微模态确认 (Inline Status & Micro-Confirm)

彻底消灭弹窗中断，通过 `FormStatus` 原位展现操作结果，危险操作直接在表单内微模态滑入：

```ts
const status = new FormStatus(page); // 绑定原位状态行

page.button("购买飞行权限", async () => {
  await nav.runTask(status, async () => {
    // 异步执行扣费与权限授予
    await service.call("fly.purchase", { playerId: player.id });
    status.ok("飞行权限激活成功！有效期 2 小时。");
  }, "购买失败，请检查节操余额。");
});

// 危险操作：表单内原地滑入确认页
page.button("§c放弃领地", () => {
  nav.confirm(
    "§c⚠ 放弃领地确认",
    "放弃后领地保护立即失效，所有方块将对全服开放。确定继续吗？",
    async () => {
      await service.call("land.abandon", { landId });
      nav.replace("land_list"); // 替换为列表页
    }
  );
});
```

### 范式 5：原生物品多语言与计分板投影 (Native I18n & RawText Projection)

利用原版 `rawtext` 实现客户端语言自适应与计分板免轮询投射：

```ts
page.label({
  rawtext: [
    { text: "§7主手手持道具: §e" },
    { translate: "item.diamond_sword.name" }, // 客户端自动依据系统语言翻译
    { text: "\n§7当前赛季排行: §6第 " },
    { score: { name: "*", objective: "sfmc_rank" } }, // 原生计分板直投
    { text: " 名" }
  ]
});
```

---

## 8. Lifecycle notes & 核心运行时机制

- `afterWorldLoad`: **true**（需在世界就绪后挂载 `itemUse` 快捷道具右键监听）；
- **SPA 单页装配与零闪烁路由机制（MenuNavigator Assembly）**：
  1. 玩家唤起主菜单时，`gui` 为其创建 `MenuNavigator(player)` 实例；
  2. 根页面 `root` 头部挂载 `ObservableString` 驱动的 **Live Dashboard**：
     - 查询玩家货币（`economy.account.balance`）$\to$ 绑定响应式变量；
     - 查询在线时长（`onlinetime.byPlayer`）$\to$ 绑定响应式变量；
     - 查询刻速状态（`tps.status`）$\to$ 绑定响应式变量；
  3. 遍历所有注册项，进行权限过滤与动态副标题（`badge`）解析；
  4. 对于声明了 `build(page, nav)` 的项：
     - 在同一 `CustomForm` 内部通过 `nav.section(id, title, build)` 注册子页面；
     - 根页面放置对应按钮，点击后直接调用 `nav.go(id)`；
  5. 对于仅声明 `handler(player)` 的项：
     - 点击后调用 `nav.leave(() => handler(player))`；
  6. 页面切换仅触发 `ObservableBoolean` 变更，整个浏览流程**无黑屏、无加载延迟、面包屑与返回键全自动托管**。
- **防吞表单安全重试管道（UserBusy Handling）**：
  - 所有表单展现统一经过繁忙重试循环：若捕获 `DataDrivenScreenClosedReason.UserBusy`，每 `busy_retry_ticks` 重新探测唤起，最多重试 `busy_max_retries` 次（约 8 秒），并发送温馨提示，彻底解决基岩版被怪打退或跳跃时弹不出表单的问题。

## 9. Acceptance criteria

- [ ] 核心零业务硬编码，双模插槽（`build` SPA 子页面与 `handler` 独立动作）运转正常
- [ ] 顶部 Live Dashboard 响应式绑定实时数据，外部服务未启用时优雅降级
- [ ] 页面层级跳转零闪烁，顶部面包屑与返回按钮随历史栈自适应显隐
- [ ] 内联 `FormStatus` 状态提示与 `nav.confirm` 微模态确认生效
- [ ] `Page` 完整暴露 `image`、`spacer`、`divider`、`button` (含 `disabled`/`tooltip`) 等 DDUI 全套控件
- [ ] `gui.confirm` 与 `gui.showForm` 具备可靠的 `UserBusy` 繁忙重试机制，杜绝吞表单
- [ ] 手持快捷时钟道具右键/长按成功唤起主菜单
- [ ] `manifest.requires` 严格为 `[]`
- [ ] typecheck / lint / test 通过

## 10. Deferred

- 自定义资源包 GUI 纹理主题与调色板动态换肤
- 玩家自定义个人高频快捷入口收藏夹

## 11. Legacy reference（仅参考）

- `packages/gui/`（全面重构为微内核数据驱动交互引擎）
