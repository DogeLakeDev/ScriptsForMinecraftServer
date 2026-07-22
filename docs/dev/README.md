# 开发指南

面向两类读者：**写业务模块** 和 **改 SFMC 平台本身**。

## 阅读顺序

| 章节 | 适合谁 |
|------|--------|
| [架构](./architecture.md) | 所有人 |
| [平台开发](./platform.md) | 改 db-server / sfmc / 工具链 |
| [模块开发](./module-author.md) | 写 sfmc-modules 里的包 |
| [manifest 契约](./manifest.md) | 声明权限、services、依赖 |
| [构建管线](./build-pipeline.md) | BP 怎么打出来 |
| [工具脚本](./tools.md) | `tools/*.mjs` 与 CI |
| [npm 发布](./npm-publish.md) | `@sfmc-bds/*` 包发布与 org 配置 |
| [代码约定](./conventions.md) | 消息、权限、审查原则 |

## 仓库分工

- **本仓**：`@sfmc-bds/sdk`、db-server、qq-bridge、sfmc、bds-tools
- **sfmc-modules**：业务模块源码与注册表

模块只通过 SDK 跟平台说话，不要直连 db-server 端口、不要 import 别的模块源码。

## 本地最小流程

```bash
npm install && npm run build --workspaces --if-present
node tools/fetch-module.mjs install afk
npm run catalog-sync
node sfmc/dist/main.js behavior-pack build
node sfmc/dist/main.js behavior-pack deploy
```

接口细节见 [接口指南](../api/README.md)。
