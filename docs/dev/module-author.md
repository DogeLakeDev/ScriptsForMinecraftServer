# 模块开发（纯 index + 一模块一仓）

## 三层模型（硬边界）

| 角色 | 是什么 | 不是什么 |
|------|--------|----------|
| **作者仓**（独立 git 仓） | **唯一开发面**：写代码、typecheck、`--from dir:… --link` 进平台 | 不是 monorepo 写码处 |
| **npm registry** | **唯一官方发布源**：`@<author>/sfmc-module-<id>` 或官方 `@sfmc-bds/module-<id>` | 不是分发仓源码树 |
| **`sfmc-modules` 仓库** | **薄 index / 检索面**：仅 `index.json` + 登记说明 | **不是**工作区、不是 monorepo |
| **主仓 `modules/packages/<id>/`** | install 落点（含 `--link` 时 junction/symlink） | 不是「去那儿写业务源码」 |

**含义：**

- 作者 **不** clone `sfmc-modules` 来改业务。
- 新模块：用 `Tanya7z/sfmc-module-template`（GitHub Use this template）派生，或直接调用 `node tools/new-module.mjs <id>` 生成单包根（见 [tools.md](./tools.md)）。

## 推荐入手路径

```bash
# 1) GitHub Use this template → Tanya7z/sfmc-module-template
node scripts/rename.mjs my-feature --name "我的功能" --scope <npm用户>
npm install
npm run typecheck

# 2) 在主仓联调
sfmc mod install my-feature --from dir:D:/path/to/my-feature --link
sfmc mod enable my-feature
sfmc mod reload            # 或 sfmc mod watch
```

也可：`sfmc mod install --from local:D:/path/to/my-feature --link`（可省略 id，从 package 推导）。

## 命名约定

| 层 | 规则 | 示例 |
|----|------|------|
| 文件夹 / install id | 短名 kebab | `land`、`my-mod` |
| npm（社区） | `@<user>/sfmc-module-<folder>` | `@alice/sfmc-module-my-mod` |
| npm（官方） | `@sfmc-bds/module-<folder>` | `@sfmc-bds/module-economy` |
| manifest.id | `feature-<folder>` 或 `core-<folder>` | `feature-land` |
| configKey | folder 的 `-` → `_` | `my_mod` |

## 日常开发闭环

```mermaid
flowchart LR
  A[作者仓 改代码] --> B[sfmc mod watch]
  B --> C[esbuild + deploy]
  C --> D[直写 BDS stdin 发 reload]
  D --> E[游戏内验证]
```

### 命令速查

```bash
sfmc mod install <id> --from dir:<作者仓> --link
sfmc mod enable <id>
sfmc mod reload
sfmc mod watch
sfmc mod test
sfmc mod publish --dry-run
sfmc mod publish
```

**`reload` 语义：** build → deploy → 向 BDS 发 `reload`（不是 restart）。  
改 `configs/*.json` / `sapi/manifest.json` / SDK 仍需重启对应进程。

### 安装源

| 来源 | 何时用 |
|------|--------|
| `npm:@scope/name`（默认） | 远端已发布；index 命中 `npm` 字段优先 |
| `local:` / `dir:` + `--link` | 作者仓联调 |
| `github:…` | **deprecated** 兼容旧 index `{repo,tag}` |

## 目录结构（作者仓 = 包根）

```
my-feature/
├── package.json
├── scripts/rename.mjs          # 模板自带
├── sapi/
│   ├── manifest.json
│   ├── tsconfig.json
│   └── src/index.ts
└── test/
```

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
    async init() { /* … */ },
    cleanup() {},
  },
});
```

## SDK 四抽屉

| 导入 | 用途 |
|------|------|
| `@sfmc-bds/sdk/sapi/runtime` | 消息、命令、权限、菜单、`Money` |
| `@sfmc-bds/sdk/sapi/db` | 表定义、CRUD、事务 |
| `@sfmc-bds/sdk/sapi/config` | 模块配置读写 |
| `@sfmc-bds/sdk/sapi/service` | 调其它模块 service |

跨模块：**不要** import 其它模块源码；用 typed client 或 `service.get` / `tx.call`。玩家消息用 `Msg.*`。

## `@minecraft/*` 版本

独立作者仓可在 **devDependencies** 钉与主仓相同的 preview 线。勿在业务逻辑里假设 monorepo 提升。

## 发布

1. `sfmc mod publish`（登录引导 + bump + npm publish + 薄 index PR）  
2. 官方 scope 需 `SFMC_OFFICIAL_PUBLISH=1`  
3. `private: true` 会被预检拒绝  

契约字段见 [manifest](./manifest.md)。
