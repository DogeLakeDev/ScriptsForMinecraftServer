# ScriptsForMinecraftServer 开发文档

> 面向 SAPI 模块作者的开发者文档,中英双语。

## 索引

| 中文 | English |
|------|---------|
| [SAPI 模块作者指南](./module-author.zh.md) | [SAPI Module Author Guide](./module-author.en.md) |
| [SDK 三抽屉 API 索引](./sdk-reference.zh.md) | [SDK Three-Drawer API Reference](./sdk-reference.en.md) |
| [manifest 契约](./manifest-contract.zh.md) | [Manifest Contract](./manifest-contract.en.md) |

## 阅读顺序建议

1. **模块作者指南** — 如果你要写/改一个 SAPI 模块,先读这个。它解释了模块放置位置、生命周期、`ModuleRegistry.register(...)` 怎么写、catalog.json 怎么登记、常见错误
2. **SDK 三抽屉 API 索引** — 写代码时查表。`@sfmc/sdk/sapi/runtime` 是 90% 业务代码的 import 来源,这里有每个导出的最小示例
3. **manifest 契约** — 当你需要让你的模块调用 db-server 时读这个。它定义 `manifest.json` 的字段语义、`routes[]` 占位符格式、db-server 启动期的 reconcile 流程

## 仓顶相关文档

- `CLAUDE.md` — 给 Claude Code 的项目说明(人类贡献者也值得一读)
- `docs/plan/modules.md` — 旧版模块系统规划(Stage A-G 之前的草案,部分内容已被本目录替代)
- `meta.json` — 行为包 / 资源包的 BDS 元数据