# SFMC

[![version](https://img.shields.io/github/v/tag/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square&label=version)](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tags)
[![license](https://img.shields.io/github/license/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square)](./LICENSE)
[![typescript](https://img.shields.io/badge/TypeScript-6.0.2-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![npm](https://img.shields.io/badge/npm-@sfmc--bds%2Fsfmc-CB3837?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/@sfmc-bds/sfmc)

[模块仓库](https://github.com/Tanya7z/sfmc-modules)  [English Version](./README.en.md)
## Scripts For Minecraft Server

> 一个面向 Minecraft 基岩版服务器的模块化开发框架与管理平台。让开发者可以使用现代化工程流程构建、部署和维护 Minecraft 服务端功能。

SFMC 希望通过模块化架构补充基岩版的原生开发体验。

## 核心特性

- 基于 [Minecraft ScriptAPI](https://learn.microsoft.com/zh-cn/minecraft/creator/scriptapi/?view=minecraft-bedrock-stable) 提供 **原生脚本 SDK**
- 提供可独立拆卸的
  **模块化管理服务**
- 提供面向 BDS 的多功能 CLI 工具，支持：
  - 自动更新
  - 模块管理
  - 资源包管理
  - 服务端工具链管理
- 为模块提供统一的 **SQLite 数据库 SDK** 与路由服务
- 提供完整工作流，降低模块开发与维护成本
- 支持 [LLBOT](https://www.llonebot.com/zh-CN/) / QQ
  开放平台 桥接，实现服务器与线上群组互联

## 快速开始

### 桌面版（Windows x64）

[下载桌面正式版](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases/tag/desktop-v0.3.5) · [使用文档](./docs/zh/guide/desktop.md)

SFMC Desktop 支持本机与 SSH 实例，提供服务启停、日志控制台、模块与资源包、配置编辑、玩家管理、运行指标，以及可离线使用的 UI Studio。下载 `.exe` 安装，或完整解压 `.zip` 后启动；内置 Node.js、pnpm 与平台代码。

添加实例时选择 **SFMC 部署根目录**（例如 `D:\WorkPlace\SFMC`）。保存后直接管理；首次验收使用独立测试目录。发行页公示 SHA256，并提供 GitHub Artifact Attestations 构建证明；客户端通过发行页手动更新。

![SFMC Desktop 概览](./docs/public/desktop/overview.jpg)

*界面截图使用演示实例和演示数据；更多截图与使用步骤见使用文档。*

### 使用 pnpm 安装

```bash
# 检查 Node.js 版本（需要 v22.13+）
node -v

# 安装 SFMC CLI 正式版
pnpm add -g @sfmc-bds/sfmc

# 初始化 SFMC
sfmc
```

开发者可以直接克隆本 monorepo，详细内容请查看
[入门指南](./docs/zh/guide/index.mdx)。

## 文档

- 在线文档 <https://sfmc.dogelake.cn/>

## 许可证

SFMC 整体平台采用 [AGPL-3.0](./LICENSE) 许可证。

各软件包许可证对应关系请参考 [LICENSES.md](./LICENSES.md)。

- **自由使用**：你可以运行、复制、分发和修改程序，同时保留这些自由。
- **Copyleft（AGPL
  部分）**：如果你分发修改后的平台或服务版本，必须以相同许可证提供完整对应源代码。
- **模块仓库**：独立仓库中的业务模块可以自行选择许可证。
