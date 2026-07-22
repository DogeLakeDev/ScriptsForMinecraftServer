# SFMC - ScriptsForMinecraftServer

> 一套 Minecraft Bedrock Script API (SAPI) 行为包 + Node.js 仓顶服务的 monorepo。
>
> 🎉 在原版BDS即可获得类似插件服的高效、安全、扩展丰富的体验

* 提供基于[Minecraft Script API](https://learn.microsoft.com/zh-cn/minecraft/creator/scriptapi/?view=minecraft-bedrock-stable)的**原生脚本SDK**
* 外置可拆卸的**模块化管理**，拥有类似插件服的舒适体验；目前已开发[22+实用模块](https://github.com/Tanya7z/sfmc-modules)
* 为BDS服务器提供的多功能、易用的cli工具，涵盖**自动更新**，**模块管理**，**资源包管理**，**远程控制**等功能
* 为模块提供**Sqlite数据库管理SDK**及其路由服务
* 自建工作流，使模组/模块开发更轻松
* 依赖于[LLBOT](https://www.llonebot.com/zh-CN/)的QQ桥接服务，轻松实现群服互通

[English version →](./README.en.md)

[![version](https://img.shields.io/github/v/tag/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square&label=version)](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tags)
[![license](https://img.shields.io/github/license/DogeLakeDev/ScriptsForMinecraftServer?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-22.13%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/TypeScript-6.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![sea](https://img.shields.io/badge/SEA-single--executable-FF6B6B?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/api/single-executable-applications.html)
[![modules](https://img.shields.io/badge/modules-25-7B68EE?style=flat-square&logo=cube&logoColor=white)](./modules/catalog.json)
[![bd](https://img.shields.io/badge/BDS-1.26.x-00BC8C?style=flat-square&logo=minecraft)](https://www.minecraft.net/en-us/download/server/bedrock)

---

## 架构图

```mermaid
flowchart LR
  REG["sfmc-modules"] -->|fetch| PKG["packages/"]
  PKG -->|build · deploy| BDS["BDS / SAPI"]
  BDS <-->|HTTP :3001| DB["db-server"]
  LLBot <-->|WS · HTTP| QQ["qq-bridge"] --> DB
  SFMC["sfmc CLI"] -. 管理 .-> BDS & DB & QQ
```

**数据流摘要**

* **模块**：注册表 → `modules/packages/` → esbuild 装配 → 写入 BDS 行为包  
* **游戏内**：SAPI 经 HTTP 访问 db-server（配置 / 数据 / 模块启停）  
* **QQ**：群消息 LLBot → qq-bridge → db-server；MC→QQ 由 db-server 直连 LLBot

> **为什么选择数据库？**
>
> 本项目的一大特色便是预制了为模块提供的数据库服务，相当于**将sapi当做前端**.当sapi侧发送请求（如经济操作、新建领地）时，所有数据处理都在**外置node环境中运行**而非游戏内。因此特性，我们编写的经济模块便可在后端使用原子性经济事务，幂等键等处理方式，既避免了游戏内处理数据的不稳定性，更利于服务器长期运维。

详细说明见 [文档中心](./docs/README.md)。

## 快速开始

### ⚡ SFMC - SEA(.exe)

[Releases](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases)

### ⚙️ npm monorepo(开发者)

```bash
# 1.
git clone https://github.com/DogeLakeDev/ScriptsForMinecraftServer
cd ScriptsForMinecraftServer
npm install

# 2. 自检 
node tools/check-ootb.mjs
node sfmc/dist/main.js 

# 3. 安装模块
node tools/fetch-module.mjs search                  # 看可用模块
node tools/fetch-module.mjs install afk
node tools/fetch-module.mjs install land economy
# install 会同步 modules/catalog.json + module-lock.json

# 4. 编译、打包模块
npm run build --workspaces   # 重 build 全部 SDK + 装配工具
sfmc> behavior-pack build && behavior-pack deploy

# 5. 启动
sfmc> start -all
```

## 目录速览

```txt
ScriptsForMinecraftServer/
├── bds-tools/             BDS 自动更新工具/进程管理
├── db-server/             SQLite HTTP REST API
├── qq-bridge/             QQ 桥(LLBot OneBot 11)
├── sfmc/                  REPL 管理 CLI (走 SEA)
├── remote-controller/     远程控制服务
├── modules/
│   ├── catalog.json       模块清单
│   ├── module-lock.json   模块锁 控制模块状态
│   ├── sdk/@sfmc-sdk/     SDK工具伞包
│   └── packages/          模块安装处
├── tools/                 自检/构建/拉取工具
└── build-sea.mjs          SEA 构建入口
```

## 文档

完整文档在 [docs/](./docs/README.md)：

| 分类 | 入口 |
|------|------|
| 使用指南 | [docs/guide/](./docs/guide/README.md) |
| 开发指南 | [docs/dev/](./docs/dev/README.md) |
| 接口指南 | [docs/api/](./docs/api/README.md) |

## 端口速查

| 端口 | 用途 |
|------|------|
| `3001` | db-server REST API |
| `3002` | qq-bridge 接入 LLBot OneBot 11 的反向 WebSocket |
| `3004` | db-server → LLBot |

## 路线图

* ✅ **Stage I**:per-module manifest + emit-manifest + db-server reader
* ✅ **Stage J**:`shared/*` 迁入 `@sfmc-bds/sdk`,22 模块迁出
* ✅ **Stage K**:SEA slim —— 模块从 SEA 剥离,populate 由 `tools/fetch-module.mjs` 完成
* 🚧 **Stage L**:模块 zip 自动解压、`sfmc module install --enable-and-deploy` 一条龙
* 🚧 **Stage M**:模块签名 / 公钥验证(取代纯 SHA-256 指纹)
* 🚧 **Stage N+**:服务网格(多 BDS 实例 / 跨节点)

## 许可证

[AGPL-3.0](./LICENSE)

---

(1) 使用本软件及其相关服务前，您必须同意来自Mojang的[EULA协议](https://www.minecraft.net/en-us/eula)。

[English version →](./README.en.md)
