# SFMC - **S**cripts**F**or**M**ine**c**raftServer

> 一套 Minecraft Bedrock Script API (SAPI) 行为包 + Node.js 仓顶服务的 monorepo。
>
> 在**原生BDS**即可获得类似插件服的**高效、安全、扩展丰富**的体验

- 提供基于[Minecraft Script API](https://learn.microsoft.com/zh-cn/minecraft/creator/scriptapi/?view=minecraft-bedrock-stable)的**原生脚本SDK**
- 外置可拆卸的**模块化管理**服务，拥有类似插件服的舒适体验；目前已开发[22+实用模块](https://github.com/Tanya7z/sfmc-modules)
- 为BDS服务器提供的多功能、易用的cli工具，涵盖**自动更新**，**模块管理**，**资源包管理**等功能
- 为模块提供**Sqlite数据库管理SDK**及其路由服务
- 自建工作流，使模组/模块开发更轻松
- 依赖于[LLBOT](https://www.llonebot.com/zh-CN/)的QQ桥接服务，轻松实现群服互通

[模块仓库 →](https://github.com/Tanya7z/sfmc-modules)  
[English version →](./README.en.md)

[![version](https://img.shields.io/github/v/tag/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square&label=version)](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tags)
[![license](https://img.shields.io/github/license/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-22.13%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/TypeScript-6.0.2-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![npm](https://img.shields.io/badge/npm-@sfmc--bds%2Fsfmc-CB3837?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@sfmc-bds/sfmc)
[![modules](https://img.shields.io/badge/modules-25-7B68EE?style=flat-square&logo=cube&logoColor=white)](./modules/catalog.json)
[![bd](https://img.shields.io/badge/BDS-1.26.x-00BC8C?style=flat-square&logo=minecraft)](https://www.minecraft.net/en-us/download/server/bedrock)

---

## 快速开始

### npm

```bash
> node -v   # 需要 v22.13+
> npm install -g @sfmc-bds/sfmc # 或 beta 版：npm install -g @sfmc-bds/sfmc@beta
> mkdir my-server && cd my-server
> sfmc
```

> 当前阶段仅发 **beta**；请带 `@beta` 安装。

开发者也可克隆本仓 monorepo，见 [入门](./docs/zh/guide/index.mdx)。

## 快速入门

| 分类         | 入口                                                                                |
| ------------ | ----------------------------------------------------------------------------------- |
| 在线文档站   | <https://dogelakedev.github.io/ScriptsForMinecraftServer/>                          |
| 使用指南     | [docs/zh/guide/](./docs/zh/guide/index.mdx)                                         |
| 开发指南     | [docs/zh/dev/](./docs/zh/dev/index.mdx) · [贡献指南](./docs/zh/dev/contributing.md) |
| 接口指南     | [docs/zh/api/](./docs/zh/api/index.mdx)                                             |
| SDK 类型参考 | [docs/zh/reference/](./docs/zh/reference/index.md)（构建时 TypeDoc）                |
| 本地预览     | `cd website && npm i` → 仓根 `npm run docs -- serve`                                |

## 许可证

整体平台遵循 [AGPL-3.0](./LICENSE)（见 [LICENSES.md](./LICENSES.md) 各包对照表）。

| 类型       | 许可证            | 包示例                                                         |
| ---------- | ----------------- | -------------------------------------------------------------- |
| 作者向库   | **ISC**           | `@sfmc-bds/sdk`、`@sfmc-bds/eslint-plugin`                     |
| 平台与服务 | **AGPL-3.0-only** | `cli`、`db-server`、`qq-bridge`、`bds-tools`、`@sfmc-bds/sfmc` |

- **自由**：您可以运行、复制、分发、修改程序，但必须保持这些自由。
- **Copyleft（AGPL 部分）**：若您分发修改后的**平台/服务**版本，必须以相同许可证提供完整对应源代码。
- **模块仓**：业务模块在独立仓库发布时，许可证由该仓库自行声明；通过 ISC 的 SDK 开发不自动将模块变为 AGPL。

---

[English version →](./README.en.md)
