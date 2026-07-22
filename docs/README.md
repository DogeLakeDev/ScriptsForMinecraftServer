# SFMC 文档

> ScriptsForMinecraftServer 官方文档。按角色选入口即可。

## 我该看哪份？

| 你是谁 | 从这里开始 |
|--------|------------|
| 服主 / 运维 | [使用指南](./guide/README.md) |
| 写业务模块 | [开发指南 → 模块开发](./dev/module-author.md) |
| 改平台 / 服务 | [开发指南 → 平台开发](./dev/platform.md) |
| 查 HTTP / SDK 接口 | [接口指南](./api/README.md) |

## 目录

### [使用指南](./guide/README.md)

日常部署与运维：安装、配置、启停、模块、行为包、QQ 桥、备份排障。

### [开发指南](./dev/README.md)

架构、平台贡献、模块作者、manifest、构建管线、工具链、代码约定。

### [接口指南](./api/README.md)

db-server REST API 与 `@sfmc-bds/sdk` 各抽屉用法。

## 命名速记

装模块用短 id（`afk`、`land`）；启停和契约里用逻辑 id（`feature-afk`）。详见 [模块管理](./guide/modules.md)。

## 其它

- 仓库根 [README](../README.md) — 项目概览与快速开始
- `docs/plan/`、`docs/archive/` — 历史规划，以本目录为准
