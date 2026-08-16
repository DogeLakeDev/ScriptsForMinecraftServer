# 工具脚本

平台脚本在 `packages/tools/*.mjs`，配合 `npm run`。模块作者日常用扩展「SFMC Module」；本页偏平台自检与脚手架。Watch / 重建实现见 `@sfmc-bds/devkit`（`packages/devkit/`）。

**目录约定：** `packages/*` = 平台包；`modules/packages/*` = 业务模块（不变）。`catalog-sync` 扫描的是后者。

## 常用

| 命令                                                | 作用                                                    |
| --------------------------------------------------- | ------------------------------------------------------- |
| `npm run verify`                                    | 平台集成自检（CI 默认；合并原 ootb/smoke/sim-new-user） |
| `npm run check-ootb`                                | `verify` 别名                                           |
| `npm run catalog-sync`                              | 扫 `modules/packages` → `catalog.json`（装模块后用）    |
| `npm run check-modules`                             | 离线校验 catalog + manifest                             |
| `node packages/tools/fetch-module.mjs search`       | 查注册表                                                |
| `node packages/tools/fetch-module.mjs install <id>` | 安装模块（装完后自动 check-modules）                    |
| `node packages/tools/new-module.mjs <id>`           | 在空目录生成单包根                                      |

## 平台自检

主仓默认无业务模块。`npm run verify` 一次完成离线检查 + db-server 集成 + 隔离 `SFMC_ROOT` 模拟。

| 脚本                | 何时用                                          |
| ------------------- | ----------------------------------------------- |
| `verify.mjs`        | CI / 本地「平台能不能跑」                       |
| `catalog-sync.mjs`  | `fetch-module install` 或本地装包后投影 catalog |
| `check-modules.mjs` | 离线校验；`fetch-module` 安装后也会自动跑       |

旧命令 `check-ootb` / `smoke-modules` / `sim-new-user` 已合并进 `verify`（保留 deprecate shim）。

约定检查见 [ESLint 约定](./eslint.md)。

## fetch-module

```bash
node packages/tools/fetch-module.mjs install afk
node packages/tools/fetch-module.mjs install foo --from dir:/path --link
node packages/tools/fetch-module.mjs uninstall afk
```

默认注册表：`Tanya7z/sfmc-modules` 的 `index.json`（`npm` 字段优先）。CLI 等价：`sfmc mod install|uninstall|search`。

## new-module

```bash
mkdir my-mod && cd my-mod
node <主仓>/packages/tools/new-module.mjs my-mod --name "我的模块"
```

`--official` → `@sfmc-bds/module-*`。脚手架会写入 `eslint.config.js` 与 `.vscode/`（推荐 ESLint / SFMC Module / nodejs-testing）。也可用 [sfmc-module-template](https://github.com/Tanya7z/sfmc-module-template) 或扩展 `SFMC: New Module`。

（作者测试）见 [测试沙箱](./testing.md)（`npm test`）。

## 共享库

`packages/tools/lib/`：`catalog.mjs`、`packages.mjs`、`lock.mjs`、`paths.mjs`、`link-from.mjs`、`registry-index.mjs` 等。新脚本优先复用，勿复制 lock/catalog 读写。
