# `<install-id>` — Design Spec

> **Status:** draft  
> **Spec authority:** this file. Legacy archive code is reference-only.

## 1. Goal / Non-goals

**Goal:** …

**Non-goals:**

- 不移植旧仓目录结构、文件拆分或历史实现风格
- 不依赖其它业务模块的 npm 源码包（跨模块只走 manifest + `service` / `tx`）

## 2. Identity

| 字段 | 值 |
|------|-----|
| install id / index key | `<id>` |
| npm | `@sfmc-bds/module-<id>` |
| manifest.id / DESCRIPTOR.id | `<id>`（与 install id 相同，**不加** `feature-` / `core-` 前缀） |
| configKey | `<snake_case>` |
| enabledByDefault | true / false |
| canDisable | true / false |
| manifest.requires | `[]` |

## 3. Player surface

### Commands

| 命令 | 权限节点 | 权限等级 | 行为摘要 |
|------|----------|----------|----------|
| … | … | Any / Member / Admin / OP / Root | … |

### GUI

- …

## 4. Data

| 表名 | 归属 | 关键列 / 语义 |
|------|------|----------------|
| `sfmc_<id>_<entity>` | 本模块 `defineTable` / 平台 bootstrap | 关键列定义、主键、索引与软删除语义 |

跨模块严格禁止越权读写他模块私有表。

## 5. Config

`configs/<configKey>.json` 形状与默认值要点：

```json
{}
```

## 6. Services

### provides

| name | input | output | 语义 |
|------|-------|--------|------|
| … | … | … | … |

### requires

| name | 来自规格 | 用途 |
|------|----------|------|
| … | [`…-design.md`](./…-design.md) | … |

## 7. Lifecycle notes

- 冷启动 only（启停写入 lock，下次 BDS 启动生效）
- `afterWorldLoad`: true / false
- 钩子顺序：`registerPermissions` → `registerCommands` → `registerEvents` → `init`；关机 `cleanup`

## 8. Acceptance criteria

- [ ] `schemaVersion: 2` manifest；`id` ≡ install id；无 v1 字段
- [ ] `pnpm run typecheck && pnpm run lint && pnpm test` 通过
- [ ] …（模块特有行为）

## 9. Deferred

- …

## 10. Legacy reference（仅参考）

- 路径 / rev：`sfmc-modules` `archive/monorepo-packages` → `packages/<id>/`（land：`git show c8ec85f:packages/land/...`）
