# Manifest 契约规范

在 SFMC 模块化架构中，位于 `sapi/manifest.json` 的清单文件是模块的**核心契约（Contract）**。它向系统声明了该模块的唯一标识、依赖拓扑、数据库访问权限与跨模块服务（RPC）接口。

无论是平台编排引擎、`db-server` 鉴权中心，还是 VS Code 开发扩展，均严格以该契约作为静态校验与运行时隔离的依据。

:::tip Schema 绑定与智能提示
在模块的 `sapi/manifest.json` 首行配置 `$schema`，可在编辑器中享受实时的语法补全与合法性校验：
```json
"$schema": "https://cdn.jsdelivr.net/gh/DogeLakeDev/ScriptsForMinecraftServer@%40sfmc-bds/sdk@0.2.0-beta.6/modules/sdk/%40sfmc-sdk/schemas/sapi-manifest.v2.schema.json"
```
如使用支持语义元数据的 v3 版本，可切换为对应的 `sapi-manifest.v3.schema.json`。若第三方 Bedrock 插件误报其不是原版 BP 清单，可安全忽略或将该路径加入其诊断忽略列表。
:::

---

## 1. 核心契约字段一览（v2 基线）

| 字段名称 | 类型 | 必填 | 规约与说明 |
| :--- | :--- | :---: | :--- |
| `schemaVersion` | `number` | **✓** | 契约版本号。基线模块为 `2`；包含 `semantic` 语义扩展块时填 `3`。 |
| `id` | `string` | **✓** | 模块全局唯一标识符。前缀必须为 `feature-` 或 `core-`（如 `feature-land`、`core-auth`）。 |
| `name` | `string` | **✓** | 模块的用户可读中文名称（如 `领地保护`、`通用经济`）。 |
| `type` | `string` | **✓** | 模块类型：`"feature"`（常规玩法模块，可自由启停）或 `"core"`（平台关键基石，开服强依赖，禁止随意停用）。 |
| `configKey` | `string` | **✓** | 模块私有配置键（下划线命名），映射到 `<SFMC_ROOT>/configs/<configKey>.json`。 |
| `requires` | `string[]` | **✓** | 该模块强依赖的前置模块 ID 列表（如 `["core-auth", "feature-economy"]`）。缺失前置时将被装载闸门阻断。 |
| `permissions` | `string[]` | **✓** | 模块向平台声明所需申请的底层资源权限节点列表（见下文语法规则）。 |
| `services.provides` | `ServiceEntry[]` | **✓** | 该模块向外部其它模块主动开放调用的 RPC 服务接口清单。 |
| `services.requires` | `string[]` | **✓** | 该模块需要消费调用的外部服务名称集合。 |
| `notes` | `string` | ✕ | 模块备注信息、设计说明或作者备忘。 |

---

## 2. 权限声明语法规约（Permissions）

为了实现微内核级的数据安全与邻居隔离，模块不能任意读写整个 SQLite 数据库。`db-server` 会根据此字段为模块下发带受限权限范围的 Bearer Token：

| 权限语法模式 | 范例 | 权限授予范围说明 |
| :--- | :--- | :--- |
| `db:read:<table>` | `db:read:wallets` | 允许对指定的 SQLite 数据表执行 `SELECT` 读取。 |
| `db:write:<table>` | `db:write:wallets` | 允许对指定的数据表执行 `INSERT`、`UPDATE`、`DELETE` 等变更。 |
| `db:read:*` / `db:write:*` | `db:write:*` | **通配符全局表权限**。仅限高度特权的 `core` 级模块申请，常规业务模块严禁滥用。 |
| `config:read:<key>` | `config:read:economy` | 允许通过 SDK 读取该配置命名空间。 |
| `config:write:<key>` | `config:write:economy` | 允许通过 SDK 运行时修改并持久化该配置。 |
| `service:<name>` | `service:economy.transfer` | 允许发起跨模块 RPC 调用目标服务。 |

---

## 3. 跨模块服务声明（Services RPC）

模块间不得直接通过全局对象或相对路径导入调用，必须通过强契约的 RPC 机制解耦：

```json title="sapi/manifest.json 中的 services 片段"
{
  "services": {
    "provides": [
      {
        "name": "economy.transfer",
        "description": "跨玩家转账接口",
        "input": {
          "type": "object",
          "properties": {
            "fromPlayer": { "type": "string" },
            "toPlayer": { "type": "string" },
            "amount": { "type": "number", "minimum": 1 }
          },
          "required": ["fromPlayer", "toPlayer", "amount"]
        },
        "output": {
          "type": "object",
          "properties": {
            "success": { "type": "boolean" },
            "txId": { "type": "string" }
          }
        }
      }
    ],
    "requires": [
      "auth.getPlayerProfile"
    ]
  }
}
```

- **全局唯一性**：所有已启用模块中，`provides` 的服务 `name` 必须全局唯一，出现同名注册将触发装载异常。
- **依赖自闭合**：所有列在 `requires` 中的服务，必须能够被某个已激活模块的 `provides` 闭环解析；若存在悬空依赖，系统将在开服前报警。

---

## 4. Manifest v3 语义化元数据扩展（可选）

若将 `schemaVersion` 声明为 `3`，可额外提供 `semantic` 对象，为开发者沙箱、UI 控制面板与可视化调试提供更丰富的语义镜像：

```json title="sapi/manifest.json (v3 示例)"
{
  "$schema": "https://cdn.jsdelivr.net/gh/DogeLakeDev/ScriptsForMinecraftServer@%40sfmc-bds/sdk@0.2.0-beta.6/modules/sdk/%40sfmc-sdk/schemas/sapi-manifest.v3.schema.json",
  "schemaVersion": 3,
  "id": "feature-economy",
  "name": "经济系统",
  "type": "feature",
  "configKey": "economy",
  "requires": [],
  "permissions": [
    "db:read:wallets",
    "db:write:wallets",
    "config:read:economy",
    "config:write:economy"
  ],
  "services": {
    "provides": [{ "name": "economy.transfer" }],
    "requires": []
  },
  "semantic": {
    "configKeys": ["economy.*"],
    "dependsOn": [],
    "events": {
      "emits": ["economy:walletChanged"],
      "listens": ["world.afterEvents.playerJoin"]
    },
    "dbTables": [
      { "name": "wallets", "columns": ["playerId", "balance"] }
    ],
    "publicApi": [
      {
        "symbol": "transfer",
        "description": "执行转账",
        "params": [
          { "name": "from", "type": "string", "required": true },
          { "name": "to", "type": "string", "required": true },
          { "name": "amount", "type": "number", "required": true }
        ],
        "returns": { "type": "boolean", "description": "操作结果" }
      }
    ]
  }
}
```

---

## 5. 废弃的 v1 历史字段禁令

在旧版（v1 实验版）中曾出现的以下字段已被新版架构彻底废弃并禁止使用：
- ❌ `routes`、`tables`、`migrations`、`seeds`、`handlers`、`events`

一旦在 manifest 中出现上述遗留字段，`sfmc mod verify` 将抛出合规性错误。数据表的创建请统一收敛至模块主入口的 `lifecycle.init()` 阶段，通过 `db.defineTable` 或 `db.execute` 声明式完成。

---

## 6. 开服前自动化校验逻辑

在拉起 BDS 前，`db-server` 与装载闸门会遍历已安装模块的 manifest 实施严格拓扑校验：
1. **重复 ID 检测**：确保无任何模块标识冲突。
2. **循环依赖拓扑排序（Cycle Detection）**：通过拓扑排序算法检测是否存在循环前置依赖（如 A 依赖 B，B 依赖 A）。
3. **未满足的服务接口（Dangling Services）**：扫描所有声明在 `services.requires` 中的条目，确保其提供方模块已处于启用状态。
4. **越权请求核查**：根据模块类型限制通配符权限，确保各模块在受限沙盒内安全运行。
