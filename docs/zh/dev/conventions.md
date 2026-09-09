# 代码与工程约定

为了保障 SFMC 生态的稳定性、代码优雅性与长久可维护性，所有平台包与业务模块均需严格遵守以下工程约定。

## 1. 交互与消息规范（Interaction & Messaging）

### 统一使用 `Msg` 助手

- **绝对禁止在业务代码中直接调用 `player.sendMessage()`**（ESLint 规则：`@sfmc-bds/no-player-send-message`）。
- 必须统一通过 `@sfmc-bds/sdk/sapi/runtime` 中的 `Msg` 助手输出提示。
- 遵循色彩与语义对齐：
  - `Msg.info`：常规中立信息（默认浅灰/亮白）
  - `Msg.success`：操作成功、交易达成（绿色系）
  - `Msg.warning`：权限警示、边界告警（黄色系）
  - `Msg.error`：严重故障、参数校验失败（红色系）
  - `Msg.tips`：玩法建议、命令说明（浅青/浅紫系）
  - `Msg.broadcast`：全服广播

### 表单 UI 正文规范（`ListFormInfo`）

使用 `ActionFormData` 或 `ModalFormData` 展示复杂信息时，正文必须通过 `ListFormInfo(string[])` 助手格式化：

- 第一行以 `[*]` 标头引出主体。
- 后续每行进行规范缩进与对齐，杜绝杂乱无章的空行。
- 按钮文字保持干净简洁，**除“§c返回/关闭”外，常规功能按钮禁止包含原版颜色格式码**。

## 2. 命令与权限梯度（Commands & Permissions）

### 原生自定义命令统一接入

- 平台命令统一使用 `/c:<命令>`，模块命令统一使用 `/c:<模块名>_<命令>`，例如 `/c:economy_pay`。
- 所有业务命令通过模块顶层的 `Command.register` 声明，以便宿主在 `system.beforeEvents.startup` 的 early-execution 阶段提交原生注册；不要在生命周期钩子内延迟声明。
- 系统会自动包裹 `moduleGuard` 保护门禁；一旦模块在 `module-lock.json` 中被停用，其关联命令会自动熔断拦截并向玩家返回友好提示，无需模块内部硬编码判断。

### 四级权限阶梯定义

权限节点必须在 `ModuleRegistry.register` 的 `registerPermissions()` 阶段集中声明，并映射至四级标准权限数：

| 权限等级 | 角色代号                      | 典型场景                                                              |
| :------: | :---------------------------- | :-------------------------------------------------------------------- |
| **`0`**  | **Any**（游客）               | 基础交互命令（如 `/c:ping`、`/c:help`、`/c:tps`、`/c:menu`）。        |
| **`1`**  | **Member**（成员）            | 正常玩家功能（如 `/c:home_set`、`/c:afk_toggle`、`/c:economy_pay`）。 |
| **`2`**  | **Admin / OP**（管理员）      | 巡查与日常管理命令（如 `/c:admin_kick`、`/c:admin_mute`）。           |
| **`3`**  | **Root / SuperAdmin**（超管） | 底层运维命令（如 `/c:reload`、权限分配）。                            |

## 3. 配置分层与防腐（Configuration Layers）

1. **平台级配置（`configs/*.json`）**：
   - 包含 `db_config.json`、`qq_config.json`、`bds_updater.json` 等。
   - SAPI 端的 `ConfigManager` 在冷启动阶段一次性缓存 `modules` / `settings` / `permissions`，运行时不进行轮询。
   - 变更平台级配置需**重启 BDS** 才能生效。
2. **模块私有配置（`configs/<configKey>.json`）**：
   - 模块包在 `configs-default/<configKey>.json` 声明全部默认字段；安装器负责创建并在升级时只补缺、不覆盖用户值。
   - 每个模块拥有独立的配置命名空间，通过 `@sfmc-bds/sdk/sapi/config` 提供的 `config.get` / `config.set` 进行透明读写。
   - `config.set` 会即时落盘；模块不得绕过 SDK 直接探测或读写文件系统。
   - 不得仅为播种默认值而申请 `config:write` 权限或在启动时调用 `config.set`。

## 4. 模块边界与架构防腐（Module Boundaries）

- **极简依赖**：业务模块仅允许依赖 `@sfmc-bds/sdk` 与官方 `@minecraft/*` 运行时包，严禁将未打包的外部大体积 Node 模块混入 SAPI 环境。
- **跨模块调用标准**：
  - 严禁通过相对路径直接 `import` 其它模块的内部源文件（ESLint 规则：`no-cross-module-source-import`）。
  - 严禁读取或修改其它模块声明的私有 SQLite 表。
  - 如需调用其它模块能力，必须在 `manifest.json` 中声明 `requires`，并统一走 `service.call` 或分布式事务 `tx.call`。

## 5. 数据库与 SQL 安全规范（Database & SQL）

- **参数化查询防注入**：所有 SQL 查询必须使用 SDK 导出的 `sql` 模板标签（例如 `sql`SELECT * FROM users WHERE id = ${userId}``），底层自动转换为预编译参数绑定，严禁手动通过字符串拼接拼凑 SQL。
- **动态列名转义**：若涉及动态标识符（表名/列名），必须使用 `sql().append(raw(...))` 显式包裹，严禁将外部不可信输入作为裸 SQL 标识符执行。
- **短事务原则**：事务（`db.transaction`）内仅执行必要的数据库读写与原子操作，禁止在事务临界区内发起耗时巨大的外部网络 I/O。

## 6. 代码工程纪律（Code Quality & Formatting）

### 统一格式化标准（Prettier）

- 双引号（`"`）、结尾逗号使用 ES5 规则（`trailingComma: "es5"`）。
- 单行最大字符数：`printWidth: 120`，缩进：`tabWidth: 2`。
- Windows 仓库对齐换行符：`endOfLine: "crlf"`。

### 依赖规范（Syncpack）

在平台 Monorepo 根目录下，依赖必须保持严格一致：

```bash
pnpm run syncpack:fix
pnpm exec syncpack format --check
```

- 本地 `@sfmc-bds/*` 互引必须对齐真实版本号并使用 `^`，**严禁使用 `workspace:*`**，保障发版到 npm 后的独立可用性。
- SDK 中对 `@minecraft/*` 的 Peer 依赖保持宽松兼容范围（`^1.x.x`）。

### 注释与编码

- 代码注释统一采用**简体中文 UTF-8**，言简意赅，阐明核心设计意图而非复述语法。
- 遵循经典架构设计原则：**DRY**（不重复）、**OCP**（开闭原则）、**DIP**（依赖倒置）、**迪米特法则**（最少知识原则）。
