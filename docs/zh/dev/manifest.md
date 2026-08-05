# manifest 契约

每个模块根目录：`sapi/manifest.json`，**schemaVersion 必须为 2**。

IDE：文件内 `$schema` 指向 `@sfmc-bds/sdk/schemas/sapi-manifest.v2.schema.json`；主仓 [`.vscode/settings.json`](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/blob/main/.vscode/settings.json) 亦按路径绑定。若 Bedrock 扩展误报 BP/RP manifest，可忽略或对该路径关闭其诊断——以本 schema 为准。

## 字段

| 字段 | 必填 | 说明 |
| ------ | ------ | ------ |
| `schemaVersion` | ✓ | 固定 `2` |
| `id` | ✓ | 全局唯一，如 `feature-land` |
| `name` | ✓ | 显示名 |
| `type` | ✓ | `core`（不可禁）或 `feature` |
| `configKey` | ✓ | 对应 `configs/<key>.json` |
| `requires` | ✓ | 依赖的模块 id 列表 |
| `permissions` | ✓ | 见下表 |
| `services.provides` | ✓ | 对外暴露的服务 |
| `services.requires` | ✓ | 依赖的其它模块服务 |
| `notes` |  | 备注 |

## 禁止的 v1 字段

`routes`、`tables`、`migrations`、`seeds`、`handlers`、`events` — 出现会报错或跳过。

## permissions

| 模式 | 含义 |
| ------ | ------ |
| `db:read:<table>` / `db:write:<table>` | 读写表 |
| `db:read:*` / `db:write:*` | 通配（慎用） |
| `config:read:<key>` / `config:write:<key>` | 配置 |
| `service:<name>` | 调用某 service |

## ServiceEntry

```json
{
  "name": "land.byId",
  "input": {
    "type": "object",
    "properties": { "landId": { "type": "string" } },
    "required": ["landId"]
  },
  "output": { "type": "object" }
}
```

`provides` 的 `name` 全仓唯一。`requires` 必须能在某个模块的 `provides` 中解析；启动时校验。

## 示例

```json
{
  "$schema": "https://cdn.jsdelivr.net/gh/DogeLakeDev/ScriptsForMinecraftServer@%40sfmc-bds/sdk@0.2.0-beta.6/modules/sdk/%40sfmc-sdk/schemas/sapi-manifest.v2.schema.json",
  "schemaVersion": 2,
  "id": "feature-land",
  "name": "领地",
  "type": "feature",
  "configKey": "land",
  "requires": [],
  "permissions": [
    "db:read:lands",
    "db:write:lands",
    "config:read:land",
    "config:write:land"
  ],
  "services": {
    "provides": [{ "name": "land.byId", "input": {}, "output": {} }],
    "requires": []
  }
}
```

## 启动校验

db-server 扫描已装包 manifest：重复 id、循环依赖、service 引用、权限声明。失败会在日志标出模块 id。

HTTP 侧见 [接口指南 · 模块控制](../api/module-control.md)。
