# SDK 导读

包名 `@sfmc-bds/sdk`。本文是**用法导读**；完整签名见 [SDK 类型参考](../reference/index.md)（`npm run docs -- api`）。

## 四抽屉

| 抽屉 | 导入 | 导读 |
| ------ | ------ | ------ |
| runtime | `@sfmc-bds/sdk/sapi/runtime` | [runtime](./runtime.md) |
| db | `@sfmc-bds/sdk/sapi/db` | [db](./db.md) |
| config | `@sfmc-bds/sdk/sapi/config` | [config](./config.md) |
| service | `@sfmc-bds/sdk/sapi/service` | [service](./service.md) |

## 入口注册

```ts
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
```

## 测试沙箱

```ts
import { createSandbox, assertMsg } from "@sfmc-bds/sdk/testing";
```

须配合 `--import @sfmc-bds/sdk/testing/minecraft-loader`。宿主分相、L0–L2 与示例见 [开发指南 · 测试沙箱](../dev/testing.md)。

## 平台 / 构建用

模块业务一般不直接 import：

| 路径 | 用途 |
| ------ | ------ |
| `@sfmc-bds/sdk/module-loader` | ModuleRegistry、ConfigManager |
| `@sfmc-bds/sdk/module-loader/install` | `installHostBootstrap`（仅 BP 启动） |
| `@sfmc-bds/sdk/sapi/host` | 平台 host 适配 |
| `@sfmc-bds/sdk/contracts` | catalog / lock 类型 |
| `@sfmc-bds/sdk/node/config` | Node 侧读 configs |
| `@sfmc-bds/sdk/node/sdk` | Node 服务能力 |
| `@sfmc-bds/sdk/logs` | 日志 |
| `@sfmc-bds/sdk/behavior-pack-build` | BP 构建（平台内部） |

## 原则

- 只走 SDK / 对方 typed client，不直连 db-server
- 不手写 SQL；用 `WhereExpr`
- 不 import 其它模块源码；跨模块用 service / client
- 业务类型放在模块包内；`contracts` 仅平台 catalog/lock

对外服务：[模块服务目录](../modules/index.md)。HTTP 对照：[接口入门](../index.md)。
