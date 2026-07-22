# 模块开发

业务模块写在 [sfmc-modules](https://github.com/Tanya7z/sfmc-modules)，装到主仓 `modules/packages/<folder>/` 联调。

## 目录结构

```
packages/land/
├── package.json              # @sfmc-bds/module-land
├── sapi/
│   ├── manifest.json         # id: feature-land
│   ├── tsconfig.json
│   └── src/index.ts          # ModuleRegistry.register
├── configs-default/          # 可选
└── resource_pack/            # 可选
```

## 命名

| 层 | 示例 |
|----|------|
| 文件夹 / install | `land` |
| npm | `@sfmc-bds/module-land` |
| manifest.id | `feature-land` |
| configKey | `land` |

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
| `@sfmc-bds/sdk/sapi/runtime` | 消息、命令、权限、菜单 |
| `@sfmc-bds/sdk/sapi/db` | 表定义、CRUD、事务 |
| `@sfmc-bds/sdk/sapi/config` | 模块配置读写 |
| `@sfmc-bds/sdk/sapi/service` | 调其它模块的能力 |

查表见 [SDK 接口](../api/sdk/README.md)。

## 规则

- 不要 `require("fs")`、不要手写 SQL 字符串
- 不要 import 其它模块源码；跨模块用 `service.get` 或 `tx.call`
- 玩家消息用 `Msg.*`，别直接 `player.sendMessage()`

## 本地联调

```bash
# 主仓
node tools/fetch-module.mjs install land --from dir:../sfmc-modules/packages/land/
npm run catalog-sync
node sfmc/dist/main.js behavior-pack build && node sfmc/dist/main.js behavior-pack deploy
```

## 发布

sfmc-modules 打 GitHub Release → 更新 `index.json` → 主仓 `fetch-module install land`。

契约字段见 [manifest](./manifest.md)。
