---
name: sfmc-module-author
description: >-
  SFMC 业务模块开发与发布指南：脚手架创建（npm create @sfmc-bds/module）、类型检查与代码校验、
  工作目录 Link 挂载、实时 Watch 构建、以及 npm 发布与官方索引登记流程。
  适用于创建新模块、开发 SAPI 模块、跨模块协作或区分作者面与运维面操作。
---

# SFMC 业务模块开发指南（Module Authoring）

业务模块遵循“一模块一独立仓”原则。技术详文参考：`docs/zh/dev/module-author.mdx`。

## 两面职责分工

| 研发环节           | 作者面（独立模块代码仓）                                                   | 运维面（SFMC_ROOT 工作目录）                                |
| ------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **项目脚手架**     | 执行 `npm create @sfmc-bds/module@latest` 或扩展命令 `SFMC: New Module`    | —                                                           |
| **静态质量检查**   | 执行 `pnpm run typecheck`、lint；运行 `pnpm test`（manifest 结构静态测试） | —                                                           |
| **工作目录挂载**   | 借助 VS Code / Cursor 扩展「SFMC Module」执行 Link                         | 执行 `sfmc mod install <id> --from "dir:<绝对路径>" --link` |
| **源码编译与装载** | 借助扩展启用实时 Watch（基于 `@sfmc-bds/devkit`）                          | 执行 `sfmc mod build` 或 `sfmc mod reload`                  |
| **模块启停状态**   | —                                                                          | 执行 `sfmc mod enable <id>` / `disable <id>`                |
| **发布与安装**     | 扩展 Publish 或执行 `pnpm publish --access public` + 提交索引 PR           | 执行 `sfmc mod install <id>`（通过包管理器下载分发物）      |

脚手架核心引擎为 `@sfmc-bds/create-module`（CLI 与 IDE 扩展底层共用 `createModule()` 核心方法）。

## 端到端研发工作流

```text
1. 脚手架初始化：npm create @sfmc-bds/module@latest
2. 静态检查验证：pnpm install && pnpm run typecheck（或 npm 对应命令）
3. 挂载至工作目录：执行 Link 到 SFMC_ROOT → 执行 sfmc mod enable <id>
4. 调试与行为验收：开启扩展 Watch 或执行 sfmc mod reload → 进入 BDS 服务器最终验证
5. 打包发布上线：pnpm publish 发布包 → 向 sfmc-modules 仓 index.json 提交索引 PR
```

### 本地挂载联调（Link 机制）

在运行时工作目录（SFMC_ROOT）下执行软链接挂载：

```bash
# 挂载本地模块源码
sfmc mod install <id> --from "dir:<作者仓绝对路径>" --link

# 启用模块
sfmc mod enable <id>
```

> **提示**：若使用 IDE 扩展，先在扩展配置中设定 `sfmc.root` 指向 SFMC_ROOT 绝对路径，再点击 Link。路径包含 `#` 或空格时需使用双引号包裹。

### 变更生效与部署边界

| 变更范围                                           | 生效路径与要求                                              |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `sapi/src/**` 业务逻辑源码                         | 借助扩展 Watch 自动增量热重载，或手动执行 `sfmc mod reload` |
| `sapi/manifest.json` 元数据或平台 `configs/*.json` | 需重启 BDS 进程生效                                         |

## 模块命名体系

权威约定见 `docs/superpowers/specs/modules/AGENT_BRIEF.md`（官方模块）与 `docs/zh/dev/module-author.mdx`。

| 命名维度                             | 命名规范                           | 示例                            |
| ------------------------------------ | ---------------------------------- | ------------------------------- |
| **安装标识（id）/ 仓目录名**         | 小写连字符（kebab-case）           | `economy` / `online-time`       |
| **社区 npm 发布包名**                | `@<user>/sfmc-module-<id>`         | `@alice/sfmc-module-my-feature` |
| **官方 npm 发布包名**                | `@sfmc-bds/module-<id>`            | `@sfmc-bds/module-economy`      |
| **Manifest 注册标识（manifest.id）** | 与 install 短名一致；**不加** `feature-` / `core-` 前缀 | `economy`                       |
| **配置存储键（configKey）**          | 蛇形命名（snake_case，`-` 转 `_`） | `online_time`                   |

官方模块开仓剧本见 skill `sfmc-module-kickoff` 与 `docs/superpowers/prompts/`。

## 模块仓标准目录结构

```text
my-feature/
├── package.json
├── eslint.config.js
├── .vscode/
├── sapi/
│   ├── manifest.json    # 模块元数据、权限需求与服务暴露/引用声明
│   ├── tsconfig.json
│   └── src/index.ts     # 模块入口：ModuleRegistry.register 与 DESCRIPTOR
└── test/                # 单元测试与 manifest 静态校验
```

模块启动生命周期方法调用次序：
`registerPermissions` → `registerCommands` → `registerEvents` → `init`。

## 模块依赖与能力调用面

| SDK 导入路径                 | 承载能力                                                        |
| ---------------------------- | --------------------------------------------------------------- |
| `@sfmc-bds/sdk/sapi/runtime` | 玩家消息通信（`Msg.*`）、自定义命令注册、权限判定、GUI 导航菜单 |
| `@sfmc-bds/sdk/sapi/db`      | 数据表管理、事务控制与 CRUD 操作                                |
| `@sfmc-bds/sdk/sapi/config`  | 模块私有持久化配置读写                                          |
| `@sfmc-bds/sdk/sapi/service` | 跨模块服务发现与 RPC 交互接口                                   |
| `@minecraft/*`               | Minecraft 官方 Script API（SAPI） 原生类型与能力                |

> **跨模块交互规范**：跨模块调用必须在 `manifest.json` 中明确声明 `requires` / `services.requires`，运行时通过 `service.provide` / `service.call` 松耦合调用；终端玩家消息统一使用 `Msg.*`。

## 质量把控与发布流

- **提交门禁**：合并前必须通过 `typecheck` 与 `lint` 检查；运行时交互依托 Watch 模式与 BDS 运行日志进行最终验收。
- **发布通道**：
  - 社区模块包使用 `@<user>/sfmc-module-*` 规范命名；官方核心模块使用 `@sfmc-bds/module-*` 规范。
  - 执行 `pnpm publish --access public`（或 `npm publish --access public`），随后向 `sfmc-modules` 仓库的 `index.json` 提交 PR 完成生态注册。

## 关联指引

- 三根路径概念与基础环境 → `sfmc-onboarding`
- 深入设计与规范文档 → `docs/zh/dev/conventions.md` · `testing.md` · `publish.md`
