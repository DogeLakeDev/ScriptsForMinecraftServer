# ScriptsForMinecraftServer 文档

> 中英双语。

## 使用文档(面向用户 / 运维)

| 中文 | English |
|------|---------|
| [ScriptsForMinecraftServer 使用文档](../user-guide.zh.md) | [ScriptsForMinecraftServer User Guide](../user-guide.en.md) |

## 开发文档(面向 SAPI 模块作者)

| 中文 | English |
|------|---------|
| [SAPI 模块作者指南](./module-author.zh.md) | [SAPI Module Author Guide](./module-author.en.md) |
| [SDK 三抽屉 API 索引](./sdk-reference.zh.md) | [SDK Three-Drawer API Reference](./sdk-reference.en.md) |
| [manifest 契约](./manifest-contract.zh.md) | [Manifest Contract](./manifest-contract.en.md) |

## 阅读顺序建议

### 我是用户 / 运维

1. **使用文档** — 完整流程:安装 → 初始化 → 启动 → 日常操作 → 备份升级 → 应急恢复

### 我是模块作者

1. **模块作者指南** — 解释模块放置位置、生命周期、`ModuleRegistry.register(...)` 怎么写、catalog.json 怎么登记、常见错误
2. **SDK 三抽屉 API 索引** — 写代码时查表。`@sfmc/sdk/sapi/runtime` 是 90% 业务代码的 import 来源
3. **manifest 契约** — 当你需要让你的模块调用 db-server 时读这个

## 仓顶相关文档

- `CLAUDE.md` — 给 Claude Code 的项目说明(人类贡献者也值得一读)
- `docs/plan/modules.md` — 旧版模块系统规划(Stage A-G 之前的草案,部分内容已被本目录替代)
- `meta.json` — 行为包 / 资源包的 BDS 元数据