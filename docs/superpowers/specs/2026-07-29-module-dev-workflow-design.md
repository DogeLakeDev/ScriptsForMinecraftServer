# 模块生态：纯 index + 一模块一仓 — 设计规格

> 日期：2026-07-29  
> 状态：实现中  
> 范围：主仓 CLI/工具、`sfmc-module-template`、`sfmc-modules`（仅索引）

## 问题摘要

产品叙事已切到「独立 npm 插件模型」，但脚手架 / `--link` 守卫 / 薄 index / 文档仍停在 monorepo + GitHub zip 时代。`sfmc-modules` 不应再兼任源码工作区。

## 目标

1. **唯一开发路径**：template → rename →（主仓）`--from dir:… --link` → `mod reload`/`watch` → `mod publish` → 薄 index PR。  
2. **`sfmc-modules` = 纯 index**：仅 `index.json` + 登记说明；无 `packages/` 开发面。  
3. **单一契约**：install 源、index schema、包命名在文档与代码一致。  
4. **兼容过渡**：遗留 `{repo,tag}` 仍可解析为 `github:`（deprecated）；新登记只加 `npm`。

## 非目标

- 本轮不要求 17 个官方模块全部拆仓并发到 npm（分批即可）。  
- 不改 SAPI / ModuleRegistry 生命周期。  
- 不实现 SDK 批量 bump 机器人 / org reusable workflow（预留钩子即可）。

## 角色硬边界

| 角色 | 职责 | 禁止 |
|------|------|------|
| 作者独立仓（template 派生） | **唯一**模块开发面（官方与社区同源，仅 scope 不同） | 把业务源码写进主仓 `modules/packages/` |
| `sfmc-modules` | **仅** `index.json` 发现层 + 登记 README | `packages/`、typecheck 工作区、`--link` 旁路 |
| 主仓 `modules/packages/<id>/` | `mod install` 落点（含 `--link`） | 当作 git 写码工作区 |
| npm | 制品分发 | zip 仅离线兼容，不是主路径 |

## 包命名

| 身份 | npm name | 说明 |
|------|----------|------|
| 官方 | `@sfmc-bds/module-<id>` | 仅官方 CI / `SFMC_OFFICIAL_PUBLISH=1` |
| 社区 | `@<user>/sfmc-module-<id>` | template / `mod publish` 默认 |

`manifest.id`：`feature-<id>` / `core-<id>`；folder / install id：短 kebab。

## index.json v2（map）

```json
{
  "version": 2,
  "modules": {
    "economy": {
      "npm": "@sfmc-bds/module-economy",
      "version": "1.2.3",
      "sdk": ">=0.2.0"
    },
    "legacy-mod": {
      "repo": "Tanya7z/sfmc-modules",
      "tag": "modules-v0.4.0"
    }
  }
}
```

规则：

- 条目至少具备 **`npm`** 或 **`repo`+`tag`** 之一。  
- `defaultSourceFor(id)`：**优先 `npm:`**，否则 deprecated `github:repo@tag`，再否则猜 `@sfmc-bds/module-<id>`。  
- `mod publish` / CI 写 **map upsert**，禁止 `modules: []` 数组。

## CLI

### `--link` + `local:`

- 允许：`--from local` / `--from local:<dir>` + `--link`（目录源 → 规范为 `dir:<abs>`）。  
- tgz/zip + `--link` → 明确报错。  
- **删除**：无 `--from` 时自动探测 `../sfmc-modules`。

### 缺 id

- `mod install --from local|dir:…`（无 id）：从目标目录 `package.json#name` / `sapi/manifest.json` 推导 folder id。

### `module create`

- 仅脚手架到**当前目录或用户指定空目录**（单包根，同 template）。  
- **删除**写入旁路 `sfmc-modules/packages` 的路径。

### `mod publish` 预检

- `private: true` → error。  
- `@sfmc-bds/*` 且无 `SFMC_OFFICIAL_PUBLISH=1` → error。

## 模板

- 去掉 `private: true`。  
- `rename --scope <user>`；`--official` → `@sfmc-bds/module-<id>`。  
- release.yml 写 map v2。  
- 独立仓可在 **devDependencies** 钉 `@minecraft/*`。

## 文档

| 文档 | 定位 |
|------|------|
| 主仓 `docs/dev/module-author.md` | 唯一作者权威路径 |
| 主仓 `docs/guide/modules.md` | 服主装模块；作者链到 module-author |
| `sfmc-modules` README | 登记规则 + schema；明示非开发仓 |
| template README | 与 CLI 命令一字不差 |

## 成功标准

1. 按 template README 可 `--link` 联调与 `publish --dry-run`（无 monorepo）。  
2. CLI/文档无「在 sfmc-modules/packages 开发」。  
3. `sfmc-modules` main 无业务 `packages/`（源码在归档）。  
4. `parseRegistryIndex` / `patchIndexFile` 共用 map v2。  
5. 遗留 `repo`+`tag` 仍可装；新登记只加 `npm`。
