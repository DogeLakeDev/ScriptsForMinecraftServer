# 模块开发（对标 npm 插件模型）

## 三层模型（硬边界）

| 角色 | 是什么 | 不是什么 |
|------|--------|----------|
| **作者仓**（独立 git 仓） | **唯一推荐的开发面**：写代码、typecheck、`--from local --link` 进平台 | 不是 monorepo 写码处 |
| **npm registry** | **唯一官方发布源**：`@<author>/sfmc-module-<id>` 或官方 `@sfmc-bds/*` | 不是分发仓 |
| **`sfmc-modules` 仓库** | **薄 index / 检索面**（发现层）：仅条目，不存第二份源码树 | **不是**工作区、不是 monorepo 写码处 |
| **主仓 `modules/packages/<id>/`** | install 落点（含 `--link` 时 junction/symlink） | 不是「去那儿写业务源码」 |

**含义：**

- 作者 **不** clone `sfmc-modules` 来改业务；不依赖同级放置。
- 新模块开发推荐：用 `Tanya7z/sfmc-module-template`（GitHub Use this template）派生 → 在自己的仓里写代码。
- `sfmc-modules` 仅承担 registry 索引/官方组织包的角色。

## 推荐入手路径

```bash
# 1) 在 GitHub 上 Use this template Tanya7z/sfmc-module-template
#    → git clone 派生仓 → cd 进根目录
node scripts/rename.mjs my-feature --name "我的功能"
npm install
npm run typecheck

# 2) 链接到主仓 modules/packages/<id>（开发联调）
#    在主仓运行：
sfmc mod install <id> --from local --link
sfmc mod enable <id>
sfmc mod reload            # 或 sfmc mod watch 进入迭代
```

`scripts/rename.mjs` 把模板里的 `example` 占位符一键改成你的 id（同步 `package.json` / `sapi/manifest.json` / `sapi/src/index.ts`）。

## 命名约定

| 层 | 规则 | 示例 |
|----|------|------|
| 文件夹 / install id | 短名 kebab，**禁止** `feature-`/`core-` 前缀 | `land`、`my-mod`、`area` |
| npm | `@sfmc-bds/module-<folder>`（官方）或 `@<username>/sfmc-module-<folder>`（作者自己） | `@sfmc-bds/module-land` |
| manifest.id | `feature-<folder>` 或 `core-<folder>` | `feature-land` |
| configKey | folder 的 `-` → `_` | `land`、`my_mod`、`online_time` |

## 日常开发闭环

```mermaid
flowchart LR
  A[作者仓 改代码] --> B[sfmc mod watch]
  B --> C[esbuild + deploy]
  C --> D[直写 BDS stdin 发 reload]
  D --> E[游戏内验证]
```

`sfmc mod watch` 监听 `sapi/src/**`，防抖 ~200ms 后复用 `sfmc mod reload` 同一路径（build → deploy → 直写 BDS stdin 发 `reload`）。

### 命令速查

```bash
sfmc mod install --from local --link    # 在模块仓根目录：装链到主仓
sfmc mod enable <id>
sfmc mod reload                          # 一次性 rebuild + deploy + reload
sfmc mod watch                           # 迭代期：改源码即 rebuild + reload
sfmc mod test                            # node --test + @sfmc-bds/sdk/testing
sfmc mod publish --dry-run               # 预检
sfmc mod publish                         # 保姆式发布：登录引导 + bump + npm publish + 薄 index PR
```

**`reload` 语义（重要）：**

1. 把新 `main.js` 部署到世界行为包目录  
2. 向 BDS 控制台发送命令 `reload`（**不是** `restart bds`）  
3. BDS / 游戏内也可自行输入 `reload`

**改 `configs/*.json` / `sapi/manifest.json` / `@sfmc-bds/sdk` 内部源码**仍需**重启对应进程**（SAPI 配置启动期缓存 + Node 模块重载）；`sfmc mod watch` 仅对 `sapi/src/**` 自动 rebuild。

### 安装源（`--from` / 默认行为）

| 来源 | 何时用 | 例子 |
|------|--------|------|
| `npm:@scope/name`（**默认**） | 远端模块已发到 npm；`mod install <id>` 自动按 `@sfmc-bds/module-<id>` 解析 | `sfmc mod install land` |
| `local:`（无路径默认 cwd） | 在模块仓根目录：作者小改自测；离线分享 `.tgz` / `.zip` | `sfmc mod install --from local` / `--from local:./x.tgz` |
| `dir:` + `--link` | 开发联调（junction/symlink） | `--from dir:D:/my-mod --link` |
| `github:owner/repo@tag` | 兼容旧 first-party `Tanya7z/sfmc-modules` Release | `--from github:Tanya7z/sfmc-modules@main` |

**`sfmc mod install <id>` 缺省 --from 时的解析顺序**（单一权威：`tools/fetch-module.mjs#defaultSourceFor`）：

1. first-party registry index 命中 → `github:`
2. 否则按 `@sfmc-bds/module-<folder>` 走 `npm:`
3. 解析失败 → 报 `无法解析 npm 包名`，建议 `--from local:<dir|tgz|zip>` 或 `--from npm:<scope>/<name>`

**`--from local:<file.zip>` 的额外校验**（zip 仅作离线分享）：CLI 必须校验内含 `package.json` + `sapi/manifest.json`，缺则清掉污染目录并报错。

## 目录结构（作者仓 = 包根）

```
my-feature/                  # 仓库根 = 包根
├── package.json             # @<author>/sfmc-module-my-feature
├── scripts/
│   └── rename.mjs           # 模板自带的改名脚本
├── sapi/
│   ├── manifest.json        # id: feature-my-feature
│   ├── tsconfig.json        # 自包含（不 depends 主仓路径）
│   └── src/
│       ├── index.ts         # ModuleRegistry.register
│       ├── types.ts         # 本模块权威类型（可选）
│       └── client.ts        # 对外简洁 API（有 provides 时推荐）
├── test/
│   └── my-feature.test.ts   # 走 @sfmc-bds/sdk/testing
└── resource_pack/           # 可选
```

模块配置缺省由首次写入 `configs/<configKey>.json` 或模块代码内默认提供（平台不再播种 `configs-default/`）。



## 目录结构

```
packages/land/
├── package.json              # @sfmc-bds/module-land
├── sapi/
│   ├── manifest.json         # id: feature-land
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # ModuleRegistry.register
│       ├── types.ts          # 本模块权威类型（可选）
│       └── client.ts         # 对外简洁 API（有 provides 时推荐）
└── resource_pack/            # 可选
```

模块配置缺省由首次写入 `configs/<configKey>.json` 或模块代码内默认提供（平台不再播种 `configs-default/`）。

## 最小入口

```ts
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Permission, Command } from "@sfmc-bds/sdk/sapi/runtime";

ModuleRegistry.register({
  id: "feature-afk",
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("afk.use", Permission.Any);
    },
    registerCommands() {
      Command.register("afk", "afk.use", (player) => { /* … */ }, "AFK");
    },
    async init() { /* db / config / service */ },
    cleanup() {},
  },
});
```

## SDK 四抽屉

| 导入 | 用途 |
|------|------|
| `@sfmc-bds/sdk/sapi/runtime` | 消息、命令、权限、菜单、`Money`（余额**缓存**） |
| `@sfmc-bds/sdk/sapi/db` | 表定义、CRUD、事务 |
| `@sfmc-bds/sdk/sapi/config` | 模块配置读写 |
| `@sfmc-bds/sdk/sapi/service` | 调其它模块的 service（无 typed client 时） |

查表见 [SDK 接口](../api/sdk/index.md)。各模块对外能力见 [模块服务目录](../api/modules/index.md)。

## 跨模块调用规则

1. **不要** import 其它模块业务源码；**不要**直接读写对方私有表（如 `sfmc_economy_*`）。  
2. 优先用对方提供的 **typed client**（例：`@sfmc-bds/module-economy/client`）。  
3. 无 client 时用 `service.get("name", input)`；在 `db.tx` 内用 `tx.call` / `economy.account.inTx(tx)`。  
4. `package.json` 声明对 `@sfmc-bds/module-*` 的依赖；`manifest.requires` / `services.requires` 声明运行时依赖。  
5. 玩家消息用 `Msg.*`，别直接 `player.sendMessage()`。

```ts
import { economy } from "@sfmc-bds/module-economy/client";

await economy.account.get({ playerId });
await db.tx(async (tx) => {
  await economy.account.inTx(tx).debit({ playerId, amount: 10, reason: "buy" });
});
```

## `@minecraft/*` 版本

以主仓 / sfmc-modules **仓库根** `devDependencies` + 主仓 `overrides` 为权威 pin。  
业务模块 **不要** 在 `package.json` 里声明 `@minecraft/*`（含 peerDependencies）；类型由 workspace 根提升提供。校验：

```bash
node tools/check-minecraft-versions.mjs
```

详见 sfmc-modules `CONTRIBUTING.md`。

## Lint

使用 `@sfmc-bds/eslint-plugin`（仓库路径 `modules/sdk/@sfmc-eslint-plugin/`，形态对齐 Minecraft 官方 lint 插件）：

| 规则 | 默认 | 说明 |
|------|------|------|
| `@sfmc-bds/no-player-send-message` | warn | 用 `Msg.*`，勿 `sendMessage` |
| `@sfmc-bds/no-sfmc-sdk-alias` | error | 用 `@sfmc-bds/sdk`，勿 `@sfmc/sdk` |
| `@sfmc-bds/no-sdk-deep-import` | error | 勿相对路径深挖 SDK 源码 |
| `@sfmc-bds/no-sdk-private-export` | error | 仅允许 SDK 公开 `exports` 子路径 |
| `@sfmc-bds/require-module-registry` | warn | `sapi/src/index.ts` 须 `ModuleRegistry.register` |
| `@sfmc-bds/no-db-toplevel-in-tx` | error | `db.tx` 内用 `tx.*` / `tx.call`，勿顶层 `db.*` / `service.get` |
| `@sfmc-bds/require-command-permission` | warn | `Command.register` 字符串权限须同包 `Permission.register` |
| `@sfmc-bds/no-httpdb-legacy` | warn | 勿用 `HttpDB`；改用 `db` / `service` / `config` |
| `@sfmc-bds/require-service-requires` | warn | `service.get` / `tx.call` 须声明 `services.requires` |
| `@sfmc-bds/valid-config-key` | warn | `config.get/set` 字段对照默认配置 |
| `@sfmc-bds/require-await-sdk-promise` | warn | SDK 异步 API 须 `await` |
| `@sfmc-bds/no-economy-private-tables` | error | 勿读写 `sfmc_economy_*`；用 economy client |
| `@sfmc-bds/no-platform-internal-import` | error | 勿 import 平台内部（db-server / sfmc / …） |
| `@sfmc-bds/no-cross-module-source-import` | error | 勿深挖其它模块源码；用公开 client |

```bash
# 主仓：SDK 源码（Msg 实现处已关闭 no-player-send-message）
npm run lint

# sfmc-modules：packages/*/sapi/src
cd ../sfmc-modules && npm run lint
```

更严预设：`sfmc.configs.all`（见插件 README）。

## 发布

1. sfmc-modules 打 GitHub Release，更新 `index.json`  
2. 主仓 `sfmc mod install land`（默认 copy）  
3. `sfmc mod enable …` → `sfmc reload`（或 `start bds` 触发装载闸门）

契约字段见 [manifest](./manifest.md)。
