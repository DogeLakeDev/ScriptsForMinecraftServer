# SDK 接口导读

包名 `@sfmc-bds/sdk`。本文是**用法导读**；完整类型签名见 TypeDoc 生成的 [SDK 类型参考](../../reference/index.md)（`npm run docs -- api`）。

模块作者日常用四个抽屉：

| 抽屉 | 导入路径 | 导读 |
|------|----------|------|
| runtime | `@sfmc-bds/sdk/sapi/runtime` | [runtime.md](./runtime.md) |
| db | `@sfmc-bds/sdk/sapi/db` | [db.md](./db.md) |
| config | `@sfmc-bds/sdk/sapi/config` | [config.md](./config.md) |
| service | `@sfmc-bds/sdk/sapi/service` | [service.md](./service.md) |

## 入口注册

```ts
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
```

## 平台 / 构建用（模块业务一般不直接 import）

| 路径 | 用途 |
|------|------|
| `@sfmc-bds/sdk/module-loader` | ModuleRegistry、ConfigManager、installHostBootstrap |
| `@sfmc-bds/sdk/sapi/host` | 平台 host 适配 |
| `@sfmc-bds/sdk/contracts` | 平台级类型（module catalog / lock）；业务类型在各模块包内 |
| `@sfmc-bds/sdk/node/config` | Node 侧读 configs |
| `@sfmc-bds/sdk/node/sdk` | Node 服务统一能力 |
| `@sfmc-bds/sdk/logs` | 日志 |
| `@sfmc-bds/sdk/behavior-pack-build` | BP 构建 |

## 原则

- 模块只走 SDK / 对方 typed client，不直连 `127.0.0.1:3001`
- 不手写 SQL；用 `WhereExpr`
- 不 import 其它模块源码；跨模块用 service / client
- 业务类型在模块包内维护；`@sfmc-bds/sdk/contracts` 仅 catalog/lock

各模块对外服务：[模块服务目录](../modules/index.md)。

对应 HTTP 见 [接口指南](../index.md)。
