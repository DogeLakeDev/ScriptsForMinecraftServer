# Manifest 契约规范

模块的 `sapi/manifest.json` 文件用于声明模块的基本信息、依赖关系、权限以及对外提供的 RPC 服务。平台 CLI、`db-server` 与开发扩展均基于该清单进行模块校验与加载。

:::tip Schema 绑定与智能提示
在模块的 `sapi/manifest.json` 首行配置 `$schema`，可在编辑器中获取字段补全与校验：
```json
"$schema": "https://raw.githubusercontent.com/DogeLakeDev/ScriptsForMinecraftServer/main/modules/sdk/@sfmc-sdk/schemas/sapi-manifest.v2.schema.json"
```
v3 语义元数据目前没有公开的 JSON Schema，使用 v3 时可不设置 `$schema`。若第三方基岩版开发插件误将其识别为原版行为包 manifest 报错，可将该路径加入忽略列表。
:::

## 1. 核心字段说明（v2 基线）

| 字段名称 | 类型 | 必填 | 说明 |
| :--- | :--- | :---: | :--- |
| `schemaVersion` | `number` | **✓** | 契约版本号。基线模块为 `2`；包含 `semantic` 扩展块时填 `3`。 |
| `id` | `string` | **✓** | 模块唯一标识符（小写 kebab-case，如 `teleport`、`feature-teleport` 均可）。 |
| `name` | `string` | **✓** | 模块显示名称（如 `领地保护`、`通用经济`）。 |
| `configKey` | `string` | **✓** | 模块专属配置键（下划线命名），映射到 `<SFMC_ROOT>/configs/<configKey>.json`。 |
| `requires` | `string[]` | **✓** | 该模块强依赖的前置模块 ID 列表。缺失前置依赖时将阻断加载。 |
| `permissions` | `string[]` | **✓** | 模块申请的资源权限列表（如数据库表读写权限，见下文）。 |
| `services.provides` | `ServiceEntry[]` | **✓** | 模块对外开放调用的 RPC 服务接口列表。 |
| `services.requires` | `string[]` | **✓** | 模块需要调用的外部服务名称集合。 |
| `notes` | `string` | ✕ | 模块备注或说明。 |

:::tip 模块启停策略
模块清单不再支持声明 `canDisable` 与 `enabledByDefault`。新安装的模块默认启用并允许服主禁用，启停由服主通过 `sfmc mod enable` 与 `sfmc mod disable` 控制并记录在 `module-lock.json` 中。
:::

## 2. 权限声明语法（Permissions）

为保证数据安全，模块无法随意读写全部 SQLite 数据。`db-server` 会根据声明的权限生成带受限范围的访问 Token：

| 权限模式 | 示例 | 授权范围说明 |
| :--- | :--- | :--- |
| `db:read:<table>` | `db:read:wallets` | 允许对指定的 SQLite 表执行 `SELECT` 查询。 |
| `db:write:<table>` | `db:write:wallets` | 允许对指定的 SQLite 表执行 `INSERT`、`UPDATE`、`DELETE`。 |
| `db:read:*` / `db:write:*` | `db:write:*` | **通配符全局表权限**。仅限高度特权核心模块申请，常规业务模块禁止滥用。 |
| `config:read:<key>` | `config:read:economy` | 允许通过 SDK 读取该配置。 |
| `config:write:<key>` | `config:write:economy` | 允许通过 SDK 运行时修改并持久化该配置。 |
| `service:<name>` | `service:economy.transfer` | 允许发起跨模块 RPC 调用目标服务。 |

## 3. 跨模块服务声明（Services RPC）

模块之间禁止直接通过相对路径相互导入，需通过 RPC 机制调用：

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

- **服务名称唯一**：所有已启用模块中，`provides` 的服务 `name` 必须全局唯一，出现同名会报错。
- **依赖完整性**：所有声明在 `requires` 中的服务，必须存在已启用的提供方模块，否则启动时报错。

## 4. Manifest v3 语义元数据（可选）

将 `schemaVersion` 设为 `3` 时，可额外配置 `semantic` 对象，为开发扩展、控制面板提供模块行为描述：

```json title="sapi/manifest.json (v3 示例)"
{
  "schemaVersion": 3,
  "id": "feature-economy",
  "name": "经济系统",
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

## 5. 已废弃与停用字段

以下字段已被严格禁用，如果在 `manifest.json` 中声明会导致校验失败并阻断加载：

### 启停控制字段（已停用）
- ❌ `canDisable`
- ❌ `enabledByDefault`

**说明**：模块启停完全由服主通过 CLI 或管理接口控制，写入 `module-lock.json`。模块作者无需也不能在清单中强制指定启停策略。如果清单中包含这两个字段，SDK 校验和 `db-server` 均会报错并拒绝启动，升级或新建模块时请直接删除。

### v1 历史字段（已废弃）
- ❌ `routes`、`tables`、`migrations`、`seeds`、`handlers`、`events`

**说明**：数据表的创建已统一收敛至模块主入口 `lifecycle.init()` 阶段，通过 `db.defineTable` 声明式完成。

## 6. 启动前校验规则

在启动 BDS 之前，平台会自动校验已安装模块的 manifest：
1. **模块 ID 唯一性**：检查是否存在重复的模块 ID。
2. **依赖拓扑检查**：解析模块依赖关系，检查是否存在循环依赖。
3. **服务提供方检查**：检查 `services.requires` 中声明的服务是否有对应的启用模块提供。
4. **权限范围检查**：检查通配符权限是否合规。
