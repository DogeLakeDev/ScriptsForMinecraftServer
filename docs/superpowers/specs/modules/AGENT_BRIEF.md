# 开仓智能体共用简报（AGENT_BRIEF）

每个官方模块仓开工时：**只读本文件 + 对应 `*-design.md` + 其 `requires` 指向的上游规格**。设计方案是唯一行为权威；旧 archive 代码禁止逐行移植。

## 1. 脚手架

```bash
npm create @sfmc-bds/module@latest -- --official
# 或: npx @sfmc-bds/create-module@latest --official
```

- install id = 规格中的短名（kebab-case）
- npm：`@sfmc-bds/module-<id>`
- **manifest.id / DESCRIPTOR.id = 同一短名**（例如 `economy`，**不要**写成 `feature-economy` / `core-gui`）
- configKey：短名 `-` → `_`
- 脚手架若写出不一致的 id，立刻改齐再写业务

## 2. 依赖与 import 白名单

**允许：**

- `@sfmc-bds/sdk/module-loader`
- `@sfmc-bds/sdk/sapi/runtime`（`Msg` / `Command` / `Permission` / `MenuNavigator` / `Money` / `debug`）
- `@sfmc-bds/sdk/sapi/db` · `sapi/config` · `sapi/service`
- `@minecraft/*`
- manifest `$schema` 指向 SDK schemas

**禁止：**

- 裸 `@sfmc-bds/sdk`、SDK 私有路径、`@sfmc/sdk`
- `db-server` / `cli` / `bds-tools` / `module-loader/install` / `sapi/host` / `node/*`（业务 SAPI 模块）
- **任何** `@sfmc-bds/module-*` / 其它模块 `sapi/src` 的 npm 或相对路径依赖
- 直接 `player.sendMessage`（必须用 `Msg.*`）
- 字符串拼接 SQL（必须用 `sql` 模板标签）
- 跨模块读写他模块表

跨模块协作：必须在 manifest 中显式声明 `requires` 与 `services.requires`，运行时统一通过 `service.call`（及文档约定的提供方注册）进行松耦合调用。

**平台前置（开仓闸门）：** Wave C/D 中凡 `provides` 含 **SAPI 进程内能力**（打开表单、改计分板、订阅世界事件结果等）的模块，依赖 SDK 已提供：

- `service.provide(name, handler)`（SAPI 进程内注册）
- `service.get` / `service.call`：**优先本地总线**，未命中再 HTTP fallback 到 db-server

在上述能力合并进 `@sfmc-bds/sdk` 并发布前，**不得**开始依赖 `chat.open*` / `land.openMainMenu` / `area.setCreativeChain*` / 模块侧 `economy.account.*`（计分板实现）的并行实现验收。Wave A 中纯文档可先写；economy 计分板实现亦依赖 SAPI 总线若 account 服务注册在模块进程内。

弱依赖：`gui` 作为纯粹的交互导航容器（`manifest.requires: []`），业务模块通过 `gui.registerMenuItem` 声明式挂载菜单项，见 [gui-design.md](./gui-design.md)。

## 3. Manifest v2 规范

必填字段：`schemaVersion: 2`、`id`、`name`、`configKey`、`requires`、`permissions`、`services.provides`、`services.requires`。

禁止使用 v1 遗留字段：`routes` / `tables` / `migrations` / `seeds` / `handlers` / `events`。  
数据库表必须在 `lifecycle.init` 阶段调用 `db.defineTable` 创建，模块私有表统一采用 `sfmc_<id>_<entity>` 命名空间。

`requires` 数组填写**短名**（与被依赖模块的 `manifest.id` 一致），例如 `["economy"]`。

## 4. 生命周期契约（Lifecycle）

```text
registerPermissions → registerCommands → registerEvents → init
shutdown → cleanup
```

- 事件订阅一律置于 `registerEvents` 阶段，严禁写入 `init`；
- 需等待世界实装的逻辑显式声明：`afterWorldLoad: true`；
- 平台采用**确定性冷启动机制**：模块启停状态变更仅在下次启动 BDS 时完整生效，禁止假定运行期热插拔。

## 5. 交互与权限规范

- 命令前缀：统一支持英文半角 `!` 与中文全角 `！`；
- 权限阶梯：严格遵循 `Any(0)` / `Member(1)` / `Admin(2)` / `OP(3)` 标准层级登记；
- 界面规范：表单正文排版使用 `ListFormInfo`；按钮除「返回/关闭」类语义外保持纯文本，不滥用颜色格式代码。

权威文档（主仓）：

- `docs/zh/dev/module-author.mdx`
- `docs/zh/dev/manifest.md`
- `docs/zh/dev/conventions.md`
- `AGENTS.md`

## 6. 门禁与发布

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm test
pnpm publish --access public
```

然后向 [Tanya7z/sfmc-modules](https://github.com/Tanya7z/sfmc-modules) 的 `index.json` 开 PR，条目形状：

```json
"<id>": {
  "npm": "@sfmc-bds/module-<id>",
  "version": "<semver>",
  "sdk": ">=0.2.0"
}
```

## 7. 并行波次建议

1. Providers（Wave A）：`economy` `monitor` `area` `online-time` `activity-log`（基础数据、时序监控与核心中枢插槽）
2. Services & Leaves（Wave B）：`gui`（平台交互导航插槽 Provider，零依赖）、`chat`（平台聊天管道插槽 Provider，依赖 economy）、`inventory-switcher`（背包快照与切换 Provider）、`data-backup`（通用快照与灾备服务 Provider）、`afk` `spawn-protect`
3. Consumers（Wave C）：`chat-sounds`（依赖 chat）、`coop`（依赖 economy + activity-log）、`qa`（依赖 economy + chat）、`land`（依赖 economy + activity-log）、`gamemode-area`（依赖 area + inventory-switcher）、`fly-area`（依赖 area）、`clean`（依赖 area）、`peace-area`（依赖 area）（**不含**已 deferred 的 `daily-task`）
   - 各业务模块在启动阶段自主向 `gui.registerMenuItem` 挂载入口按钮，无需中央硬编码。

## 8. 验收总则

- 行为对齐对应 `*-design.md` 的 Acceptance criteria
- 不出现「移植旧文件 xxx」类提交说明
- GUI / 其它模块不得 `import` 本模块内部类；对外能力一律 `services.provides`
