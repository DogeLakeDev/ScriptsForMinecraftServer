# @sfmc-bds/create-module

## 0.1.0-beta.4

### Patch Changes

- 4a9b066: 模块脚手架不再生成常驻测试目录或测试命令，改以类型检查、构建和实际联调验收。
- efa6e73: 将 Minecraft Script API 类型与新模块模板更新到 BDS 1.26.51 使用的 server 2.11.0-beta、server-ui 2.3.0-beta，并同步 vanilla-data 版本。
- 3465c7e: 更新 QQ 账号和服务器信息面板、频道来源控制及模块和世界包查询；移除 QQ 踢人指令，完善 CLI 服务窗口提示与模块配置行为。

## 0.1.0-beta.3

### Patch Changes

- 74a27c7: 将旧版 `!` 聊天前缀命令迁移到 Bedrock 原生自定义命令接口。平台命令统一使用
  `/sfmc:<command>`，模块命令使用 `/sfmc:<moduleId>_<command>`；同时修复内置
  `/sfmc:help` 及其访客权限未注册的问题。

  交互式数据库事务改为互斥排队执行，避免并发 `beginSession` 清理仍在使用的会话。

- d933a02: 安装和更新模块时从 `configs-default` 创建并补全模块配置，且不覆盖用户已有值。

## 0.1.0-beta.2

### Patch Changes

- d9ded8f: fix(sdk): 作用域 db/config/service 客户端，消除多模块身份串桶与全局事务互斥

  - 新增 createDbClient / createConfigClient / createServiceClient：身份与 tx 状态封闭在闭包
  - 单例 db/config/service 改为按 moduleId 登记表转发（兼容旧代码）
  - ModuleRegistry lifecycle 注入 ModuleServices；install 装配配对 inTx 探针
  - create-module 模板引导闭包捕获 services.db

## 0.1.0-beta.1

### Minor Changes

- e5b9142: 模块作者面改用 `npm create @sfmc-bds/module`（`@sfmc-bds/create-module`）为唯一建仓入口；移除 `@sfmc-bds/devkit` 的 `sfmc-new-module` / `scaffoldModule`。扩展补齐 Create→Test→Link→Watch→Publish 全周期。
