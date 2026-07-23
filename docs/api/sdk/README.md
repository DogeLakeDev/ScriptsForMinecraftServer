# SDK 接口

包名 `@sfmc-bds/sdk`，模块作者日常用四个抽屉：

| 抽屉 | 导入路径 | 文档 |
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
| `@sfmc-bds/sdk/contracts` | 平台级共享类型（catalog / lock） |
| `@sfmc-bds/sdk/node/config` | Node 侧读 configs |
| `@sfmc-bds/sdk/node/sdk` | Node 服务统一能力 |
| `@sfmc-bds/sdk/logs` | 日志 |
| `@sfmc-bds/sdk/behavior-pack-build` | BP 构建 |

## 原则

- 模块只走 SDK，不直连 `127.0.0.1:3001`
- 不手写 SQL；用 `WhereExpr`
- 不 import 其它模块源码

对应 HTTP 见 [接口指南](../README.md)。
