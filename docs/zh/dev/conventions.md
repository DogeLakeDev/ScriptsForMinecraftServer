# 代码与工程约定

本文汇总 SFMC 平台包与业务模块的代码规范与工程约定。

## 1. 交互与消息规范

### 统一使用 `Msg` 助手

- **业务模块中避免直接调用 `player.sendMessage()`**（对应 ESLint 规则：`@sfmc-bds/no-player-send-message`）。
- 统一通过 `@sfmc-bds/sdk/sapi/runtime` 中的 `Msg` 助手向玩家发送提示，保持前缀格式与色彩一致：
  - `Msg.info(msg, player)`：常规提示（前缀 `§f[*]`）
  - `Msg.success(msg, player)`：操作成功（前缀 `§a[√]`）
  - `Msg.warning(msg, player)`：告警与提示（前缀 `§e[!]`）
  - `Msg.error(msg, player)`：错误提示（前缀 `§c[x]`）
  - `Msg.tips(msg, player)`：玩法帮助与小贴士（前缀 `§7[!]`）
- 若需向全服广播消息，使用 `@minecraft/server` 的 `world.sendMessage()`。

### 表单 UI 排版规范（`ListFormInfo`）

使用 `ActionFormData` 或 `ModalFormData` 展示多行详情时，推荐使用 `ListFormInfo(string[])` 助手格式化正文行：

- 首行使用 `[*]` 标头引出主题。
- 列表项保持统一缩进，避免多余空行。
- 功能按钮文本建议简洁明了，仅返回/取消类按钮可使用颜色前缀（如 `§c返回`）。

## 2. 命令与权限设计

### 玩家命令规范

- 所有玩家命令统一使用 `/c:<命令>` 形式注册，命令名称建议保持简短易记（如 `/c:pay`、`/c:afk`）。
- 同一功能模块的子操作优先使用原生枚举子命令（如 `/c:afk exempt`），避免占用过多顶层命令。
- 所有业务命令应在模块顶层通过 `Command.register` 注册，以便在启动期完成原生命令挂载。
- 平台会自动为命令附加 `moduleGuard` 保护：当模块在 `module-lock.json` 中被禁用时，其关联命令会自动拦截并提示玩家，无需在模块内手动编写启停判断。

### 权限等级定义

权限节点在 `ModuleRegistry.register` 的 `registerPermissions()` 阶段集中声明，遵循 4 级权限分级：

| 权限等级 | 级别名称 | 典型场景 |
| :---: | :--- | :--- |
| **`0`** | **Any**（所有人） | 基础查询与通用交互命令（如 `/c:ping`、`/c:help`、`/c:menu`）。 |
| **`1`** | **Member**（玩家） | 普通玩家日常功能（如 `/c:home`、`/c:afk`、`/c:pay`）。 |
| **`2`** | **Admin / OP**（管理员） | 管理与巡查命令（如 `/c:admin_kick`、`/c:admin_mute`）。 |
| **`3`** | **Root / SuperAdmin**（控制台/服主） | 底层运维命令（如 `/c:reload`、权限分发）。 |

## 3. 配置管理规范

1. **平台全局配置（`<SFMC_ROOT>/configs/*.json`）**：
   - 包括 `db_config.json`、`qq_config.json`、`bds_updater.json` 等。
   - SAPI 端 `ConfigManager` 在冷启动阶段一次性加载快照，修改后需**重启 BDS** 生效。
2. **模块专属配置（`<SFMC_ROOT>/configs/<configKey>.json`）**：
   - 模块在作者仓 `configs-default/<configKey>.json` 中声明默认配置。安装器首次安装时创建，升级时仅补充缺失字段，不会覆盖服主已有值。
   - 业务模块通过 `@sfmc-bds/sdk/sapi/config` 提供的 `config.get` / `config.set` 进行读写。
   - 不要在启动阶段仅为写入默认值而调用 `config.set`。

## 4. 模块依赖与隔离边界

- **依赖约束**：业务模块仅允许依赖 `@sfmc-bds/sdk` 与官方 `@minecraft/*` 运行时包，避免引入体积过大或带有 Node 原生依赖的第三方 npm 包。
- **跨模块调用规则**：
   - 禁止通过相对路径直接 import 其他模块内部源码（ESLint 规则：`no-cross-module-source-import`）。
   - 禁止直接查询或修改其他模块创建的专属 SQLite 表。
   - 跨模块通信需在 `manifest.json` 中声明 `requires`，通过 `service.call` 或事务内的 `tx.call` 完成。

## 5. 数据库与 SQL 安全规范

- **使用参数化查询**：所有 SQL 查询必须使用 SDK 导出的 `sql` 模板标签（如 `sql`SELECT * FROM users WHERE id = ${userId}``），参数会自动绑定，禁止手动拼接字符串 SQL。
- **动态标识符转义**：若表名或列名由变量决定，需使用 `raw(...)` 包裹，避免外部不可信输入被作为 SQL 语法执行。
- **事务范围最小化**：事务（`db.transaction`）内仅执行必要的数据库原子读写，避免在事务内部包含耗时过长的网络请求或异步等待。

## 6. 代码格式与工程规范

### 统一代码格式（Prettier）

- 双引号（`"`），结尾逗号使用 ES5 规则（`trailingComma: "es5"`）。
- 单行最大字符数：`printWidth: 120`，缩进：`tabWidth: 2`。
- Windows 仓库统一样式：`endOfLine: "crlf"`。

### 依赖一致性（Syncpack）

主仓 Monorepo 根目录下依赖保持统一：

```bash
pnpm run syncpack:fix
pnpm exec syncpack format --check
```

- 本地 `@sfmc-bds/*` 互引使用具体的版本范围（`^<version>`），**禁止使用 `workspace:*`**，以保证单独发布至 npm 后依赖有效。
- 对 `@minecraft/*` 的 Peer 依赖保持宽松兼容范围（`^1.x.x`）。

### 注释规范

- 代码注释统一使用简体中文，注重说明设计原因与边界条件，避免重复描述语法。
