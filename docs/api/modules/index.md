# 模块服务目录

跨模块能力通过 **service 名**（如 `economy.account.debit`）暴露；平台用 `service.get` / `tx.call` 派发。  
有 typed client 的模块应优先走 client，避免手写 service 字符串和直操表。

机制说明：[SDK service](../sdk/service.md) · [HTTP 服务 API](../services.md) · [manifest 契约](../../dev/manifest.md)

## 提供方一览

| 模块（install id） | manifest.id | 文档 |
|--------------------|-------------|------|
| `economy` | `feature-economy` | [economy](./economy.md) |
| `land` | `feature-land` | [land](./land.md) |
| `area` | `feature-area` | [area](./area.md) |
| `coop` | `feature-coop` | [coop](./coop.md) |
| `online-time` | `feature-online-time` | [online-time](./online-time.md) |
| `tps` | `feature-tps` | [tps](./tps.md) |

仅 **消费** 经济等服务、不对外提供的模块：`gui`、`chat`、`daily-task`、`qa`、`monitor` 等——见各包 `sapi/manifest.json` 的 `services.requires`。

## 约定

1. **依赖方向**：业务模块 → 业务模块 OK；平台（db-server）不 npm 依赖业务包。  
2. **声明**：消费方 `manifest.requires` + `services.requires` + `permissions: ["service:…"]` + `package.json` dependencies。  
3. **装机**：`fetch-module` 按 id 安装，**不会**按 npm 依赖自动拉齐；装 `land` 时请同时装 `economy`。  
4. **权威类型**：落在提供方包内（如 `sapi/src/types.ts` / `client.ts`），不要塞回 `@sfmc-bds/sdk/contracts`（contracts 仅保留 catalog/lock）。
5. **npm 作用域**：业务包统一 `@sfmc-bds/module-<install-id>`（与平台同组织；SDK 为 `@sfmc-bds/sdk`）。
