# SFMC 审查原则（展开）

Skill `sfmc-code-review` 的补充说明。日常审查以 SKILL.md 速记表为准；此处供需要举例时阅读。

## DRY — Don't Repeat Yourself

同一知识/规则只应有一处权威来源。

**常见债：**

- db-server 多条路由各自解析 Bearer + `moduleId`，而非共享中间件/工厂
- catalog / module-lock 读写逻辑在 CLI、db-server、tools 各写一份且语义漂移
- 默认配置对象在多服务复制，而不是 `@sfmc-bds/sdk/node/config`（或现行权威模块）

**修法：** 抽共享函数/中间件；以一处为 source of truth，其余调用。

## OCP — Open-Closed Principle

对扩展开放，对修改关闭。

**常见债：**

- 在 CLI 巨型 `switch (command)` 上继续加 case，而不是 command surface / 注册表
- 新 HTTP 能力复制整段路由文件，而不是 `createXxxRouter` / 策略表
- 为特例在核心装载路径打 `if (id === "…")`

**修法：** 注册、插件、路由工厂、配置驱动分支。

## DIP — Dependency Inversion Principle

高层依赖抽象，不依赖实现细节。

**常见债：**

- 模块或脚本硬编码 `configs/` 相对布局、拼 db-server URL 细节，绕过 SDK 客户端
- `packages/db-server` / `qq-bridge` 等 **import CLI**（禁止）
- 测试绑死具体文件路径而非注入接口

**修法：** 经 `@sfmc-bds/sdk` 公开面；能力下沉到可独立调用的包；CLI 只编排。

## LSP — Liskov Substitution Principle

可互换实现遵守同一契约。

**常见债：**

- `POST /api/sfmc/db/...` 单操作与 `/db/tx` 对鉴权、`moduleId`、错误信封不一致
- HTTP `service.get` 与 `tx.call` 权限门不一致
- 「假引擎」测试助手与生产 `ModuleRegistry` 生命周期语义分叉且未文档化

**修法：** 共享校验与信封构造；补对齐测试。

## Law of Demeter — 最少知识

只与直接协作者说话。

**常见债：**

- 模块 A 读模块 B 的 SQLite 私有表或私有 configKey
- 路由使用 `req` 上中间件挂的未文档化私有字段（如缓存句柄）当作 API
- 跨包深入对方 `src/` 内部文件（应用包的公开 export）

**修法：** 经 manifest 声明的 service / 公开 SDK API；私有实现不外泄。

## 与「能合并」的关系

- 原则违规不一定是运行时 bug；标 MAJOR 的债仍应在审查里写清。
- BLOCKER 优先于文风：安全、鉴权旁路、数据串模块、发布契约破坏。
- 修复时保持既有正确行为（用户规则：不无故改已正确功能）。
