# 工具脚本

根目录 `tools/*.mjs`，配合 `npm run`。模块作者日常用扩展「SFMC Module」；本页偏平台自检与脚手架。Watch / 重建实现见 `@sfmc-bds/devkit`（`devkit/`）。

## 常用

| 命令 | 作用 |
| ------ | ------ |
| `npm run check-ootb` | 开箱自检 |
| `npm run catalog-sync` | 扫 packages → `catalog.json` |
| `npm run check-modules` | 校验 catalog + v2 manifest |
| `node tools/fetch-module.mjs search` | 查注册表 |
| `node tools/fetch-module.mjs install <id>` | 安装模块 |
| `node tools/new-module.mjs <id>` | 在空目录生成单包根 |
| `npm run smoke-modules` | 模块 API 冒烟（需 live db-server；平台 CI） |
| （作者测试） | 见 [测试沙箱](./testing.md) / 扩展「SFMC Module」 |

约定检查见 [ESLint 约定](./eslint.md)。

## fetch-module

```bash
node tools/fetch-module.mjs install afk
node tools/fetch-module.mjs install foo --from dir:/path --link
node tools/fetch-module.mjs uninstall afk
```

默认注册表：`Tanya7z/sfmc-modules` 的 `index.json`（`npm` 字段优先）。CLI 等价：`sfmc mod install|uninstall|search`。

## new-module

```bash
mkdir my-mod && cd my-mod
node <主仓>/tools/new-module.mjs my-mod --name "我的模块"
```

`--official` → `@sfmc-bds/module-*`。脚手架会写入 `eslint.config.js` 与 `.vscode/`（推荐 ESLint / SFMC Module / nodejs-testing）。也可用 [sfmc-module-template](https://github.com/Tanya7z/sfmc-module-template) 或扩展 `SFMC: New Module`。

## 平台冒烟

| 脚本 | 前置 | 作用 |
| ------ | ------ | ------ |
| `smoke-modules.mjs` | db-server 已起、`/api/health` 通 | 模块 HTTP / service 路径 |
| `sim-new-user.mjs` | 无 | 临时 `SFMC_ROOT` 模拟新用户目录 |

CI（`ootb.yml`）会跑 check-ootb，并在 db 起来后跑 smoke。

## 共享库

`tools/lib/`：`catalog.mjs`、`packages.mjs`、`lock.mjs`、`paths.mjs`、`link-from.mjs`、`registry-index.mjs` 等。新脚本优先复用，勿复制 lock/catalog 读写。
