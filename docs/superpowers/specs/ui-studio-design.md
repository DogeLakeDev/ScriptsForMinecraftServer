# SFMC UI Studio 与声明式 UI 设计方案

> 状态：基础契约已落地，Studio 与 Runtime 尚未实现
>
> 文档格式：`formatVersion: 1`
>
> 目标读者：模块开发者、UI Studio 开发者、GUI Runtime 维护者

## 1. 结论

SFMC GUI 采用“可视化编辑器生成声明式 JSON，运行时解释执行”的路线。

模块作者不需要学习 TypeScript UI API，也不需要手写 JSON。日常入口是本地网页应用 **SFMC UI Studio**；JSON 是可版本控制、可校验、可迁移的中间产物。需要业务逻辑时，页面只能调用模块 manifest 已声明的 service，不能嵌入或执行任意脚本。

第一阶段不替换现有 GUI 模块。现有模块继续承担菜单入口、页面栈、错误恢复和 Minecraft 原生表单适配；新建一个声明式 Runtime 适配层，待页面能力覆盖后再逐模块迁移。

## 2. 设计目标

- 非程序员可以通过拖放、表单配置和数据选择器完成页面。
- 编辑器、CLI、Runtime 使用同一份 TypeScript 契约和语义校验器。
- 页面文件适合 Git：稳定排序、稳定节点 id、小范围差异、无二进制工程文件。
- UI 只能组合已授权能力；权限校验最终仍由业务 service 负责。
- 文档可以演进：带格式版本、提供迁移链、保存时保留当前编辑器不认识的字段。
- 浏览器预览快速可用，同时明确它不是 Minecraft 客户端的像素级模拟器。

## 3. 非目标

- v1 不提供自由 CSS、任意 HTML 或脚本插件。
- v1 不追求像素级布局；Minecraft 表单能力由 Runtime 决定。
- v1 不允许页面直接访问数据库、配置文件或网络。
- v1 不在浏览器预览中调用生产 BDS service。
- v1 不一次性迁移所有现有 GUI 页面。

## 4. 系统边界

```text
模块作者
   │ 浏览器操作
   ▼
SFMC UI Studio ──读写──> feature.ui.json + screens/*.ui.json
   │                          │
   │ 同一契约/校验器           │ Git 审查与版本控制
   ▼                          ▼
网页语义预览              CLI 校验/打包
                              │
                              ▼
                        声明式 UI Runtime
                              │
                    调用 manifest 已声明 service
                              │
                              ▼
                         现有 GUI Host
```

职责划分：

| 组件 | 负责 | 不负责 |
| --- | --- | --- |
| UI Studio | 页面树编辑、属性面板、绑定选择、语义预览、撤销重做、原子保存 | 执行业务代码 |
| 共享契约 | 文档类型、JSON Schema、结构与跨文件诊断 | Minecraft 呈现 |
| CLI | 项目发现、校验、迁移、打包、启动 Studio | 页面交互 |
| 声明式 Runtime | 加载、绑定求值、service 调用、效果执行、渲染适配 | 绕过 service 权限 |
| 业务模块 | 提供有权限校验的 service 和业务数据 | 控制编辑器内部实现 |
| 现有 GUI Host | 菜单、页面栈、错误恢复、原生表单显示 | 理解业务数据结构 |

## 5. 工程文件

建议每个带 UI 的模块使用以下布局：

```text
ui/
├─ feature.ui.json
├─ screens/
│  ├─ home.ui.json
│  └─ detail.ui.json
└─ .ui-studio/
   └─ preview.fixture.json
```

- `feature.ui.json`：模块入口、玩家/管理界面分组和页面文件清单。
- `screens/*.ui.json`：独立页面；页面移动或拆分不会改写整个工程。
- `.ui-studio/preview.fixture.json`：仅供本地预览的假数据，不进入 Runtime 包。
- `$schema`：允许 VS Code 等普通编辑器提供补全，但 UI Studio 才是主要编辑方式。
- 文件使用标准 JSON，不使用 JSONC。注释需求由 `name`、`notes` 和编辑器说明字段承担。

Studio 保存时采用固定字段顺序和两个空格缩进。数组顺序代表页面显示顺序；对象键按用户编辑顺序保持稳定，不做无意义的全文件排序。

## 6. 文档模型

### 6.1 Feature

Feature 定义“页面属于哪个模块、从哪里进入、有哪些页面文件”。入口包含：

- `surface`：`player` 或 `admin`；
- `group`：菜单分组；
- `title`、`description`、`icon`、`order`：入口展示信息；
- `permission`：入口可见性提示，不代替 service 的权限检查；
- `target`：目标页面 id。

页面引用同时保存 `id` 与 `file`。编译时两者必须与页面文件内部 id 一致，以便稳定重命名和精确诊断。

### 6.2 Screen

页面由以下部分组成：

| 字段 | 用途 |
| --- | --- |
| `presentation` | `auto`、`menu`、`form` 或 `reactive` 呈现建议 |
| `params` | 从页面跳转传入的只读路由参数 |
| `state` | 当前玩家、当前打开会话的输入状态 |
| `load` | 打开或刷新页面时调用的只读数据源 |
| `derived` | 由数据、参数和状态计算出的安全表达式 |
| `body` | 按顺序排列的组件树 |
| `actions` | 用户触发的命名 service 调用及完成效果 |

所有组件必须带稳定 `id`。Studio 创建组件时生成可读 id，并在复制时生成新 id；拖动排序只改变数组位置。id 用于选择状态、撤销重做、诊断定位和 Git 差异，不是显示文本。

### 6.3 数据作用域

模板字符串使用 `{{root.path}}`：

| 根 | 来源 | 示例 |
| --- | --- | --- |
| `player` | 当前玩家只读摘要 | `{{player.name}}` |
| `params` | 页面路由参数 | `{{params.landId}}` |
| `data` | `load` 的结果 | `{{data.land.name}}` |
| `state` | 表单输入状态 | `{{state.renewYears}}` |
| `derived` | 安全表达式结果 | `{{derived.renewCost}}` |
| `result` | 当前 action 的返回值 | `{{result.message}}` |
| 列表别名 | `each.as` 声明的局部变量 | `{{land.name}}` |

模板仅做值绑定，不解释 JavaScript。结构判断和计算使用对象形式的表达式 AST，例如：

当一个 JSON 字符串完全由单个绑定组成（如 `"{{state.renewYears}}"`）时，Runtime 保留原值类型，因此可以向 service 传递数字或布尔值；绑定与其他文字混合时，结果统一转换为展示字符串。

```json
{
  "op": "greaterThanOrEqual",
  "args": [
    { "ref": "data.account.balance" },
    { "ref": "derived.renewCost" }
  ]
}
```

Runtime 只实现白名单操作符，不使用 `eval`、`Function` 或动态模块加载。

### 6.4 组件集合

v1 组件刻意保持小而完整：

| 类别 | 组件 | Minecraft 映射 |
| --- | --- | --- |
| 展示 | `header`、`text`、`info`、`image`、`divider`、`spacer` | 标题、正文、body、图标或降级文本 |
| 操作 | `button` | ActionForm 按钮或 DDUI 按钮 |
| 输入 | `textField`、`toggle`、`dropdown`、`slider` | ModalForm 对应控件 |
| 结构 | `when`、`each` | 求值后生成组件序列 |

`presentation: auto` 由编译器依据组件推导；混合复杂页面优先使用 `reactive`。某个宿主不支持的展示能力必须有明确降级规则，而不是静默丢失。

### 6.5 动作与效果

按钮只有一个判别明确的 `trigger`，避免同一组件同时声明跳转和回调导致优先级不清：

- `action`：执行页面 `actions` 中的命名动作，可通过 `input` 携带当前列表项等局部数据；
- `navigate` / `replace`：页面栈跳转；
- `back` / `refresh` / `close`：标准导航行为。

Action 只能调用一个已声明 service，可选择确认步骤，然后执行标准效果：消息、跳转、替换、返回、刷新、关闭或更新 state。业务返回值通过 `result` 作用域读取。

重要规则：入口 `permission` 只影响可见性。业务 service 必须根据调用玩家再次鉴权，不能信任页面传入的玩家 id、价格或权限标记。

## 7. UI Studio 交互设计

Studio 使用三栏加底部诊断区：

```text
┌──────────────┬─────────────────────────────┬──────────────────┐
│ 工程/页面树   │ 语义预览画布                 │ 属性与数据绑定     │
│              │                             │                  │
│ Feature      │ [标题] 我的领地              │ 组件：按钮         │
│ ├ home       │ ┌─────────────────────────┐ │ 文本：...         │
│ └ detail     │ │ 主城领地                │ │ 动作：打开 detail │
│              │ └─────────────────────────┘ │ 参数：landId      │
│ 组件库        │                             │                  │
├──────────────┴─────────────────────────────┴──────────────────┤
│ 问题：2  /body/3/trigger/to 未声明页面 ...                    │
└───────────────────────────────────────────────────────────────┘
```

关键工作流：

1. `sfmc ui studio <模块目录>` 启动本地服务并打开浏览器。
2. 用户从组件库拖入组件，画布显示近似 Minecraft 的语义预览。
3. 属性面板根据 JSON Schema 生成基础字段，根据共享契约提供专用编辑器。
4. 数据绑定不要求输入路径：用户从 `玩家 / 参数 / 数据源 / 状态 / 计算值` 树中选择。
5. 配置 service 时仅列出 manifest 已声明能力；输入字段由后续 service schema 提供。
6. 任何操作进入撤销栈；保存前显示文件级差异与诊断。
7. 保存采用临时文件 + 原子替换；首次改写旧版本前创建可恢复备份。

属性面板不直接展示全部 JSON。高级用户可以打开“源码”视图，但源码与可视化编辑共享同一文档模型和撤销历史。

## 8. 预览策略

网页预览的目标是验证信息结构、顺序、条件和数据绑定，不承诺字体、间距与 Minecraft 完全一致。

- 默认使用 `.ui-studio/preview.fixture.json` 假数据。
- 数据源可在“成功 / 空数据 / 失败 / 延迟”场景间切换。
- Action 默认只展示将要调用的 service、input 与效果，不实际发出调用。
- 后续可提供显式的“连接测试服”模式；必须由用户主动开启并显示醒目标识。
- 最终视觉与交互验收仍在测试 BDS 和 Minecraft 客户端完成。

## 9. 校验与诊断

校验分三层，但对用户只显示一个问题列表：

1. JSON 解析：文件是否为合法 JSON；
2. Schema：必填字段、字段类型、枚举和组件结构；
3. 语义编译：重复 id、页面引用、动作引用、数据作用域、路径安全和 service 清单。

每条问题包含稳定错误码、JSON Pointer 路径和中文消息。Studio 点击问题可定位文件与组件；CLI 使用相同消息输出。发布和部署前必须执行语义编译，Runtime 对漏网错误采用失败关闭，不猜测用户意图。

## 10. 保存、兼容与恢复

- Studio 在内存中保留原始 JSON 对象，修改已知字段时不删除未知字段。
- Schema 对当前版本保持严格；打开未来版本时进入只读模式，不能用旧 Studio 覆盖。
- 每次格式变更递增 `formatVersion`，并提供 `vN -> vN+1` 纯数据迁移函数。
- 自动迁移先备份，再生成可审查差异；不自动删除旧文件。
- 文件监听发现外部修改时暂停自动保存，让用户选择重新载入或比较合并。
- 写入限定在启动时指定的模块 `ui/` 根目录，拒绝绝对路径与 `..` 越界。

## 11. 本地服务安全

- 默认仅监听 `127.0.0.1`，不暴露到局域网。
- 启动时生成短期会话令牌，浏览器写操作必须携带令牌并通过 Origin 检查。
- API 使用解析后的真实路径验证所有读写目标仍在工程根内。
- 不把文件内容、service 数据、凭据或遥测上传到外部服务。
- 预览 fixture 禁止自动复制真实玩家数据；检测常见密钥字段时给出提交警告。

## 12. 版本控制中的唯一可信源

当前基础文件位于 SDK：

- `src/contracts/ui-document.ts`：平台无关 TypeScript 契约；
- `src/validation/ui-document.ts`：结构与跨文件语义校验/编译；
- `schemas/ui-feature.v1.schema.json`：Feature JSON Schema；
- `schemas/ui-screen.v1.schema.json`：页面 JSON Schema；
- `schemas/examples/`：可导入的完整工程与预览数据。

Studio、CLI 和 Runtime 不得复制一份自己的字段定义。若专用属性面板需要展示元数据，应从 Schema 扩展关键字或共享组件注册表派生。

## 13. 实施顺序

### 阶段 0：基础准备（本次范围）

- [x] UI v1 平台无关类型；
- [x] Feature 与 Screen JSON Schema；
- [x] 结构校验、引用校验和工程编译入口；
- [x] 覆盖列表、详情、输入与 action 的领地示例；
- [x] Studio 产品、文件、安全与迁移设计；
- [x] 最小高信号契约测试。

### 阶段 1：Runtime 垂直切片

- 实现模板与表达式求值器；
- 实现 `menu`、`form`、标准效果和 service 适配；
- 用一个只读列表页和一个可提交表单页贯通 BDS；
- 将运行时接入现有 GUI Host，但保留旧 API。

### 阶段 2：Studio MVP

- 增加 `sfmc ui studio` 本地命令和受限文件 API；
- 实现工程树、组件树、画布、属性面板和诊断区；
- 实现拖放、复制、撤销重做、数据绑定选择器和原子保存；
- 实现 fixture 场景预览与源码差异视图。

### 阶段 3：迁移与增强

- 选择低风险模块试迁移，保留可回退旧页面；
- 为 service 增加 input/output schema，提升绑定自动补全；
- 增加格式迁移器、页面模板和可复用片段；
- 评估连接测试服与真机预览，不作为 Studio MVP 前置条件。

## 14. 建议优先确认的产品选择

以下选择不阻塞基础实现，但建议在 Studio MVP 开始前确认：

1. **入口命令**：建议统一为 `sfmc ui studio`，不要另建独立全局 CLI。
2. **主要画布**：建议做 Minecraft 风格的语义预览，不做自由布局画布。
3. **文件粒度**：建议一页一文件；大型工程的 Git 冲突和加载体验更可控。
4. **高级模式**：建议保留 JSON 源码视图，但默认隐藏，且不能绕过校验保存。
5. **首个试点**：建议选“领地详情/续期”这种同时包含列表、输入、确认和 service 的页面，能尽早暴露契约缺口。

## 15. Runtime 开发前仍需补齐的契约

目前 `service` 只有名称，Studio 无法自动知道 input/output 字段。进入阶段 1 前，建议为 manifest service 增加可选的输入输出 JSON Schema 或引用；这是高质量数据绑定面板的关键。未提供 schema 的旧 service 可以继续通过手动键值表接入，但 Studio 应提示“弱类型绑定”。

本方案暂不增加 SDK 版本变更记录。等 Runtime 或 Studio 首次真正消费这些公共导出、准备发布 SDK 时，再一起确定 API 命名并添加 changeset，避免为仍可能调整的预备契约产生无意义版本。
