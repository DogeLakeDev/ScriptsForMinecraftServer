# feature-land 服务

安装 id：`land` · npm：`@sfmc-bds/module-land`  
（原 `land-gui` 已并入本模块，GUI 在 `sapi/src/land-gui.ts`。）

依赖：`feature-economy`（购地/退款走 `@sfmc-bds/module-economy/client`）。

## Service 名

| 名称 | 主要输入 | 输出 |
|------|----------|------|
| `land.byOwner` | `ownerId` | 领地数组 |
| `land.byId` | `landId` | 领地对象 / null |
| `land.byPos` | `dimension,x,y,z` | 领地对象 / null |
| `land.listByOwner` | `ownerId` | 数组 |
| `land.listMembers` | `landId` | 成员数组 |
| `land.listInvites` | `playerId` | 邀请数组 |
| `land.getPlaza` | — | 广场领地 |
| `land.plazaSettings` | — | 广场设置 |
| `land.getPlayerRole` | `landId,playerId` | 角色字符串 |
| `land.validateBox` | `dimension,minX…maxZ` | 校验结果（含价格等） |
| `land.taxDue` | `landId` | 税务信息 |
| `land.auditLog` | `landId` | 审计日志数组 |

## 调用示例

```ts
import { service } from "@sfmc-bds/sdk/sapi/service";

const land = await service.get("land.byId", { landId });
const at = await service.get("land.byPos", { dimension: 0, x, y, z });
```

事务内购地扣款：

```ts
import { economy } from "@sfmc-bds/module-economy/client";

await db.tx(async (tx) => {
  await economy.account.inTx(tx).debit({ playerId, amount: price, reason: "land_buy" });
  // … 写入 lands 表 …
});
```

## 类型

权威类型：`@sfmc-bds/module-land` 导出（`sapi/src/types.ts`）。  
`gui` 等消费者可 `import type` 或继续用本地视图类型，但**不要**再维护独立的 `land-gui` 包。

## 配置

`configKey: land` → `configs/land.json`（及模块 `configs-default/land.json`）。
