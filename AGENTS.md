# AGENTS.md — ScriptsForMinecraftServer 核心架构速查

本文件是面向 Agent 的项目全局速查手册与权威事实基准。人类开发者详文参见：`docs/zh/dev/`。沟通、文档与代码注释统一采用 **简体中文**。

技能剧本（场景执行）：`.cursor/skills/sfmc-onboarding` · `sfmc-module-author` · `sfmc-code-review`。  
常驻规则（架构契约）：`.cursor/rules/sfmc-role-and-style.mdc` · `sfmc-source-of-truth.mdc` · `sfmc-standing-contracts.mdc`。

## 三根路径

| 路径标识      | 职责与承载内容                                      | 规范说明                                         |
| ------------- | --------------------------------------------------- | ------------------------------------------------ |
| **monorepo**  | 平台核心源码仓库（本工程仓）                        | 路径包含 `#` 或空格时命令行参数需加双引号包裹    |
| **SFMC_ROOT** | 运行时工作目录：`configs/`、`modules/` 与持久化数据 | 所有文档与文案中规范表述为「SFMC **工作目录**」  |
| **作者仓**    | 单个业务模块的独立代码仓                            | 通过 `mod install --link` 挂载至工作目录协同联调 |

- `packages/*`：平台内置核心能力包。
- `modules/packages/<id>/`：工作目录（SFMC_ROOT）下的模块实际安装与软链接挂载目标。

## 包地图

| 包路径                             | 发布包名 / 职责            | 说明                                                                                |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------------------------------- |
| `modules/sdk/@sfmc-sdk/`           | `@sfmc-bds/sdk`            | 提供 SAPI 运行时与 Node.js 核心接口（Node + SAPI）                                  |
| `modules/sdk/@sfmc-eslint-plugin/` | `@sfmc-bds/eslint-plugin`  | 模块与平台定制 ESLint 规则集                                                        |
| `packages/db-server/`              | `@sfmc-bds/db-server`      | SQLite HTTP 数据服务，默认监听 `:3001`（要求 Node ≥ 22.13）                         |
| `packages/qq-bridge/`              | `@sfmc-bds/qq-bridge`      | 消息网桥服务（支持 official 与 llbot 双协议）                                       |
| `packages/bds-tools/`              | `@sfmc-bds/bds-tools`      | BDS 生命周期与版本管理、更新灾备、行为包动态组装构建与 server.properties 智能本地化 |
| `packages/cli/`                    | `@sfmc-bds/cli`            | 平台运维编排命令行工具与交互式 REPL                                                 |
| `packages/meta/`                   | `@sfmc-bds/sfmc`           | 平台元包聚合分发                                                                    |
| `packages/create-module/`          | `@sfmc-bds/create-module`  | 业务模块脚手架初始化引擎（`npm create @sfmc-bds/module`）                           |
| `packages/devkit/`                 | `@sfmc-bds/devkit`         | 模块开发 Watch 监听与增量重构工具集                                                 |
| `packages/sfmc-extension/`         | `@sfmc-bds/sfmc-extension` | VS Code / Cursor IDE 扩展「SFMC Module」                                            |
| `packages/tools/`                  | `@sfmc-bds/tools`          | 仓内自动化自检、文档生成与版本发布私有工具集（`"private": true`）                   |

核心能力内聚在 `bds-tools` / `db-server` / `qq-bridge` / SDK 中，CLI 仅负责调用编排。

## 模块安装与索引

| 注册数据项       | 存储位置                                   | 用途说明                                 |
| ---------------- | ------------------------------------------ | ---------------------------------------- |
| 已安装元数据镜像 | `modules/catalog.json`                     | 记录已下载或挂载模块的元数据与状态       |
| 模块启停状态清单 | `modules/module-lock.json`                 | 锁定启用的模块列表（enabled / disabled） |
| 模块契约声明文件 | `modules/packages/<id>/sapi/manifest.json` | 声明模块权限、接口暴露与外部依赖契约     |
| 官方中心发现索引 | `sfmc-modules` 仓库的 `index.json`         | 模块发现中心（优先解析 npm 分发）        |

```bash
sfmc mod search
sfmc mod install <id> [--from <source>] [--link]
sfmc mod uninstall <id>
```

- `--from`：缺省默认使用 npm 官方源 `@sfmc-bds/module-<id>`；支持 `github:` / `dir:` / `local:` / `tgz:` / `zip:` 等协议来源。
- `--link`：挂接本地作者仓源码进行联调。
- `mod list` 状态标识：`●` 官方启用 / `○` 官方禁用 / `?` 未知发布源（不在官方 `index.json`） / `○` 契约缺失。若文件夹名与 `manifest.id` 不一致显示为 `folderId(logicalId)`。
- 装载器实现参考：`modules/sdk/@sfmc-sdk/src/module-loader/`。

## 行为包组装机制

行为包在部署时由 CLI 与 `bds-tools` 根据当前启用的模块动态编译组装。

```bash
sfmc mod build      # 编译产物输出至：<SFMC_ROOT>/packs/_build/sfmc-modules/
sfmc mod reload     # 执行 build + 部署至 BDS + 请求 BDS 重载脚本
```

- 启动桩注入：`installHostBootstrap()`；模块注册入口：`ModuleRegistry.register`。
- 构建流程：遍历 `module-lock.json` 中已启用且 `catalog.json` 存在的 `sapi/src/index.ts`，打包转译为 `scripts/main.js`。
- 目标路径：`<BDS>/worlds/<level>/behavior_packs/sfmc-modules/`（资源包对应：`sfmc-modules-rp`）。

| 变更类型                                           | 生效时机与要求                                        |
| -------------------------------------------------- | ----------------------------------------------------- |
| 模块业务代码（`sapi/src`）                         | 执行 `sfmc mod reload` 或借助 IDE 扩展 Watch 自动重载 |
| 平台配置（`configs/*.json`）与模块 `manifest.json` | 需重启 BDS 进程加载                                   |

## 宿主生命周期

装载器核心实现参见：`module-loader/install.ts`。

1. `startup` 启动阶段：`ConfigManager.init()` → `bootAll()` → `announceLoaded()`
2. `worldLoad` 世界加载：`bootAfterWorldLoad()`（执行标记为 `afterWorldLoad: true` 模块的 `init`）
3. `shutdown` 停机阶段：`teardown()` 统一清理资源

模块初始化执行序列（`bootModule`）：
模块顶层 `Command.register` 声明命令；启动阶段依次执行 `registerPermissions` → `registerEvents` → `init`。

- `ConfigManager.init()`：向服务端发起一次 `GET /api/sfmc/configs/all`，初始化并缓存 `modules` / `settings` / `permissions` 及各模块对应的鉴权 Token。模块私有配置通过 `@sfmc-bds/sdk/sapi/config` 读写。
- 模块启停状态变更（通过 db-server、AdminGUI 或 CLI 写入 `module-lock.json` 与 `catalog.json`）在下次启动 BDS 或触发行为包重载闸门时完整生效；当前运行中的 BDS 进程内已激活模块不会在运行期直接注销，保证运行期状态稳定。

```ts
ModuleRegistry.register({
  id: "feature-afk",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {},
    registerEvents() {},
    async init() {},
    cleanup() {},
  },
});
```

## 配置模型与 HTTP 通信

- **平台全局配置**：`configs/*.json`（纳入 gitignore；服务首次启动时自动写入默认值与 `$schema` 校验结构）。
- **运行时锁文件**：`modules/module-lock.json` 仅管理模块启停状态（enable/disable）。
- **模块私有配置**：运行期支持调用 `config.set` 动态持久化；全局与行为包层面的配置按上述生命周期边界生效。
- **数据服务通信**：`db-server` 监听本地回环（Loopback），SAPI 客户端通信目标为 `127.0.0.1:3001`。
- **标准化客户端**：业务模块统一经由 `@sfmc-bds/sdk/sapi/db|service|config` 访问底层服务。
- **鉴权管理**：平台管控 Token 定义在 `configs/db_config.json` 的 `http_auth` 字段或通过环境变量 `HTTP_AUTH` 注入。

| 路由端点                                 | 功能说明                                                 |
| ---------------------------------------- | -------------------------------------------------------- |
| `GET /api/sfmc/configs/all`              | SAPI 启动初始化快照（免除单模块鉴权）                    |
| `GET /api/sfmc/settings/{key}`           | 获取平台特定系统设置                                     |
| `GET /api/sfmc/{areas,permissions,…}`    | 读取平台全局 JSON 配置                                   |
| `GET/POST /api/sfmc/db/*`                | 数据库操作（需携带 Bearer module_token 与 `?moduleId=`） |
| `GET/POST /api/sfmc/services*`           | 跨模块服务 RPC 调用（需携带 Token 与 `?moduleId=`）      |
| `GET/POST /api/sfmc/configs/<configKey>` | 模块私有持久化配置命名空间                               |

## 平台代码规范

| 规范主题           | 现行落地约定                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **玩家消息通知**   | 统一采用 `Msg.*`（来自 `@sfmc-bds/sdk/sapi/runtime`）                                                                          |
| **表单说明排版**   | `ListFormInfo(string[])`：首行以 `[*]` 开头，正文使用朴素缩进                                                                  |
| **按钮与标题样式** | 保持纯文本无额外颜色格式代码（「返回」类操作按钮除外）                                                                         |
| **经济货币单位**   | 基于计分板系统，符号引用 `Money.UNIT`（默认为 `节操`）                                                                         |
| **游戏命令注册**   | 使用原生自定义命令；平台为 `/sfmc:<命令>`，模块为 `/sfmc:<模块名>_<命令>`；权限层级：`Permission.register`（Any=0 至 Admin=3） |
| **模块依赖边界**   | 仅依赖 `@sfmc-bds/sdk` 与 `@minecraft/*`；跨模块协作经由 `manifest.json` + `service` / `tx`                                    |
| **安全 SQL 查询**  | 动态 SQL 必须使用受信任标识：`sql()` / `.append(raw(...))`                                                                     |

## QQ 消息网桥（QQ Bridge）

配置文件：`configs/qq_config.json`。标准服务启动次序：`db-server` → `qq-bridge` → `BDS`。

| 后端驱动（`qq_backend`）   | 数据链路流向                                                        |
| -------------------------- | ------------------------------------------------------------------- |
| `official`（默认官方协议） | Gateway → qq-bridge → 数据库入队；出站调用官方 OpenAPI 发送群聊消息 |
| `llbot`（OneBot 协议）     | LLBot WS:3002 → qq-bridge → 数据库入队；出站调用 LLBot HTTP:3004    |

- 消息链路机制：自动过滤机器人自身发送的消息，采用 message id 进行 5 秒滑动窗口去重。
- 运维支持：配置为 `llbot` 驱动时，CLI 支持自动拉起并守护 LLBot 子进程。

## 命令速查

monorepo 以 **pnpm** 作为首选包管理器（根目录声明 `packageManager`）；下列 **pnpm / npm 等价**：

```powershell
# monorepo 根目录日常研发
pnpm install && pnpm run build
npm install && npm run build --workspaces --if-present

pnpm run lint          # 静态代码规则检查（需先构建 eslint-plugin）
pnpm run typecheck     # 全局类型校验
pnpm run verify        # 自动化自检套件校验
pnpm start             # 启动 sfmc CLI 交互式 REPL

# 工作目录（SFMC_ROOT）运维指令
pnpm start -- status|start|stop|restart|init|update
# 或使用 npm：
npm start -- status|start|stop|restart|init|update

# 业务模块作者指令
npm create @sfmc-bds/module@latest
# 单测验证、Link 挂载、实时 Watch 构建与发布推荐使用 VS Code / Cursor 扩展「SFMC Module」
```

```bash
# 单独子包构建与调试
cd packages/db-server && pnpm run dev|start|test
cd packages/db-server && npm run dev|start|test
cd packages/bds-tools && pnpm run update|start|stop|status
cd packages/bds-tools && npm run update|start|stop|status
```

- 调试开关：`variables.json` 中配置 `"sfmc_debug": true`。
- Sentry 监控：`secrets.json` 中配置 `SENTRY_DSN`。
- CLI 调试命令：`sfmc debug ...`。

## 测试与持续集成（CI）

| 层级                 | 测试策略与执行命令                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `db-server` 服务测试 | 使用原生测试运行器：`node --test`                                                             |
| 业务模块验证         | 使用 Watch 模式进行行为验证；执行 `typecheck` / manifest 静态检查                             |
| SDK 与基础平台包     | 原生测试：`node --test`（涵盖 manifest-schema、qq-official、db-server、qq-bridge 等）         |
| SDK 本地快速测试     | `pnpm --filter @sfmc-bds/sdk test`；假环境模拟：`pnpm --filter @sfmc-bds/sdk run gen:mc-fake` |

| 工作流文件              | 职责与触发条件                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `ootb.yml`              | 运行于 Ubuntu 与 Windows 双平台；覆盖完整构建、单元测试、生成代码一致性与 `verify` 校验 |
| `docs.yml`              | 构建 Rspress 文档站与 TypeDoc SDK API 参考，并发布至 GitHub Pages                       |
| `changeset-release.yml` | 基于 Changesets 自动化处理版本变更（Version Packages）并发布至 npm                      |
| `npm-publish.yml`       | 用于应急场景下的单包独立发布流水线（默认携带 beta 标签）                                |

- Node.js 运行时：严格要求 `engines` ≥ 22.13；CI 流水线环境版本与 `.node-version` 严格锁定一致。
- 发版契约：所有公开发布包若引入 API 或行为变更，必须附带对应 changeset；pre 模式下统一发布 beta tag。

## 工程规范

- **代码格式化（Prettier）**：统一配置双引号、`trailingComma: "es5"`、`tabWidth: 2`、`printWidth: 120`、`endOfLine: "crlf"`。
- **文件忽略机制（gitignore）**：忽略 `configs/`、`data/`、`dist/` 等运行时目录；缺失配置由服务启动时自动补全默认项。
- **环境变量驱动**：统一通过 `SFMC_ROOT` 读取运行时工作目录；`modulesDir` 配置缺省默认为 `"modules"`。
- **Schema 统一**：规范 Schema 统一存放在 `modules/sdk/@sfmc-sdk/schemas/`，并通过 `.vscode/settings.json` 关联编辑器校验。
- **构建管道**：工作区底层转译采用私有工具包 `@sfmc-bds/tools` 提供的 `sfmc-esbuild-transpile` 与 `tsc7`。
- **代码审查标准**：遵循 DRY、OCP、DIP、LSP 与迪米特法则，详见 skill `sfmc-code-review`。

## 云端运行环境（Linux）

```bash
pnpm install && pnpm run build
npm install && npm run build --workspaces --if-present
SFMC_ROOT=$PWD node packages/db-server/dist/index.js
# 健康检查：GET http://127.0.0.1:3001/api/health
```

## 延伸阅读与参考

| 主题类别                     | 文档路径                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| 平台架构、环境设计与核心约定 | `docs/zh/dev/architecture.md` · `platform.md` · `conventions.md`     |
| 构建体系、模块开发与测试规范 | `docs/zh/dev/build-pipeline.md` · `module-author.mdx` · `testing.md` |
| 文档站专有速查               | `website/AGENTS.md`                                                  |
