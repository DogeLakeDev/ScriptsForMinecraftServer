# manifest v2 契约

> v2 是当前协议版本,替代旧的 `routes / migrations / handlers` 路线。模块 = 不可信第三方包,通过 `manifest.json` 向平台声明**它需要的能力 + 它暴露的能力 + 它对数据库/配置的权限**。平台**不执行模块代码**,只读 manifest 决定启停;模块用 `@sfmc/sdk/sapi/db|config|service` 与平台对话。

## 1. 文件位置

**单源真理**:模块仓 `Tanya7z/sfmc-modules` 里 `packages/<id>/sapi/manifest.json`。bp 构建时,fetch-module 已经把它拉到主仓 `modules/packages/<id>/sapi/manifest.json`,db-server + SAPI 直接读它。

```jsonc
{
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "领地",
  "type": "feature",
  "configKey": "land",
  "requires": ["feature-economy"],
  "permissions": [...],
  "services": {
    "provides": [...],
    "requires": [...]
  },
  "notes": "自由文本(可选)"
}
```

## 2. 字段速查

| 字段 | 类型 | 必填 | 含义 |
|------|------|------|------|
| `schemaVersion` | `2` | ✓ | v1 已弃用,启动期 throw;其他值 throw |
| `id` | string | ✓ | 全局唯一,`feature-*` / `core-*` 前缀推荐 |
| `name` | string | ✓ | 显示名 |
| `type` | `"core"` \| `"feature"` | ✓ | `core` 不能 disable,`feature` 可 enable/disable |
| `configKey` | string | ✓ | 对应 `configs/<key>.json`,SDK 用 `config.get("land.x")` 读 |
| `requires` | `string[]` | ✓ | 依赖模块 id 列表,启动期拓扑校验 |
| `permissions` | `string[]` | ✓ | 平台权限声明,见 §4 |
| `services.provides` | `ServiceEntry[]` | ✓ | 本模块对外暴露的服务 |
| `services.requires` | `ServiceEntry[]` | ✓ | 本模块需要消费的服务 |
| `notes` | string | – | 自由描述 |

**禁用字段**(v1 残留,出现则启动 throw):`routes` / `tables` / `migrations` / `seeds` / `handlers` / `events`。

## 3. ServiceEntry

```jsonc
{
  "name": "land.byId",                      // 全局唯一,通常是 <moduleId>.<动词/名词>
  "input":  { "type": "object", "properties": { "landId": { "type": "string" } }, "required": ["landId"] },
  "output": { "type": "object" }
}
```

- `name` 全局唯一,启动期 db-server 跨模块去重;重复 throw
- `requires` 中的 name 必须在某 enabled 模块的 `provides` 里有同名,否则启动 throw
- `input/output` 只做登记 + 文档,平台不在协议层严格校验 schema(JSON Schema 风格以便将来生成 SDK 类型)

## 4. permissions

权限字符串统一前缀表:

| 模式 | 含义 |
|------|------|
| `db:read:<table>` | 读模块声明的 table |
| `db:write:<table>` | 写模块声明的 table |
| `db:read:*` / `db:write:*` | 通配(慎用,启动期白名单) |
| `config:read:<config_key>` | 读 `configs/<config_key>.json` 下条目 |
| `config:write:<config_key>` | 写 `configs/<config_key>.json` 下条目 |
| `service:<service_name>` | 调用此 service(可选但推荐,启动期校验) |

**校验时机**:启动期(db-server 已加载所有 enabled 模块时)集中校验:
- 表名是否在本模块的 `db.defineTable(...)` 中声明过(否则 db:write:* 但没声明表 → 启动 warn)
- `db:write:*` / `db:read:*` 是否在 `configs/db_config.json` 的 `modulePermissionPolicy.allowWildcard` 白名单里
- `service:*` 是否在 `services.requires` 里也有对应条目

**运行时校验**:`db.query("lands", ...)` 时 db-server 验证调用方模块的 permissions 含 `db:read:lands`,否则 403。

## 5. 启动期校验全景

```
db-server 启动:
  1. SQLite 打开
  2. 扫 modules/packages/*/sapi/manifest.json
     · schemaVersion != 2 → warn-skip(v1 不再加载)
     · 重复 id → throw
  3. 拓扑排序 requires;有环 → throw
  4. 所有 enabled 模块:
     · permissions-vs-services.requires 交叉 → 漏报 throw
     · services.requires.name 必须命中某 provides.name → 找不到 throw
     · 同一 services.provides.name 被两个模块声明 → throw
  5. 注册 service handlers(模块 SAPI init 阶段调 service.provide 注册)
  6. 启动 HTTP,监听 127.0.0.1:3001
  7. SAPI init 阶段:模块调 db.defineTable() → schema-registry 收集 → 统一 CREATE TABLE
```

## 6. 端到端示例

`packages/feature-land/sapi/manifest.json`:

```jsonc
{
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "领地",
  "type": "feature",
  "configKey": "land",
  "requires": ["feature-economy"],
  "permissions": [
    "db:read:lands",
    "db:write:lands",
    "db:read:land_members",
    "db:write:land_members",
    "db:write:land_audit_logs",
    "db:read:land_audit_logs",
    "config:read:land",
    "config:write:land",
    "service:economy.account",
    "service:economy.debit",
    "service:economy.credit"
  ],
  "services": {
    "provides": [
      { "name": "land.byId",        "input": {...}, "output": {...} },
      { "name": "land.byOwner",     "input": {...}, "output": {...} },
      { "name": "land.transfer",    "input": {...}, "output": {...} },
      { "name": "land.listMembers", "input": {...}, "output": {...} },
      { "name": "land.auditLog",    "input": {...}, "output": {...} }
    ],
    "requires": [
      { "name": "economy.debit" },
      { "name": "economy.credit" }
    ]
  },
  "notes": "领地系统,需要 feature-economy 服务"
}
```

## 7. 校验工具

模块仓自带 `tools/check-modules.js`:

```bash
cd sfmc-modules
node tools/check-modules.js
# 检查所有 packages/*/sapi/manifest.json:
#   - schemaVersion = 2
#   - 无禁用字段 (routes/tables/migrations/seeds/handlers/events)
#   - id 全局唯一
#   - permissions 中每个 db:read:*/db:write:* 都有对应 defineTable
#   - permissions 中每个 service:* 都在 services.requires 里
```

CI 在每次 push 时跑一次,失败时拒绝 merge。

---

下一步:看 [模块作者指南](./module-author.zh.md) 写新模块,或 [SDK API 索引](./sdk-reference.zh.md) 查 db / config / service 抽屉。