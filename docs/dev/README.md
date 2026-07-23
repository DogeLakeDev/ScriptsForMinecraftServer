# 开发指南

面向两类读者：**写业务模块** 和 **改 SFMC 平台本身**。

## 阅读顺序

| 章节 | 适合谁 |
|------|--------|
| [架构](./architecture.md) | 所有人 |
| [模块开发](./module-author.md) | 写 sfmc-modules（脚手架、link、`sfmc reload`） |
| [manifest 契约](./manifest.md) | 权限、services、依赖 |
| [模块服务目录](../api/modules/README.md) | economy / land 等对外 API |
| [构建管线](./build-pipeline.md) | BP 怎么打出来 |
| [工具脚本](./tools.md) | `tools/*.mjs` 与 CI |
| [平台开发](./platform.md) | 改 db-server / sfmc / 工具链 |
| [npm 发布](./npm-publish.md) | `@sfmc-bds/*` 包发布 |
| [代码约定](./conventions.md) | 消息、权限、审查原则 |

## 仓库分工

- **本仓**：`@sfmc-bds/sdk`、db-server、qq-bridge、sfmc、bds-tools  
- **sfmc-modules**：业务模块源码与注册表  

模块只通过 SDK / 对方 **client** 跟平台或其它模块说话：不要直连 db-server 端口，不要 import 别的模块源码，不要直读写对方私有表。

## 本地最小流程（模块作者）

```bash
# 主仓 + 同级 sfmc-modules 已 npm install
sfmc module create          # 或 sfmc module link / module dev
# … 改 sapi 源码 …
sfmc reload                 # build + deploy + 向 BDS 发 reload
```

运维装机见 [使用指南 · 模块](../guide/modules.md)。接口细节见 [接口指南](../api/README.md)。
