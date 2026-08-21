# 工具脚本

`packages/tools/` 为 **monorepo 私有**脚本（不发 npm）。模块安装在 `@sfmc-bds/cli`，脚手架在 `@sfmc-bds/devkit`；作者日常用扩展「SFMC Module」。Watch / 重建见 `packages/devkit/`。

**目录约定：** `packages/*` = 平台包；`modules/packages/*` = 业务模块。`catalog-sync` 扫描的是后者。

## 常用

| 命令 | 作用 |
|------|------|
| `npm run verify` | 平台集成自检（CI 默认） |
| `npm run catalog-sync` | 扫 `modules/packages` → `catalog.json` |
| `npm run check-modules` | 离线校验 catalog + manifest |
| `sfmc mod search` / `sfmc mod install <id>` | 查注册表 / 安装（`@sfmc-bds/cli`） |
| `npx sfmc-new-module <id>` | 在空目录生成单包根（`@sfmc-bds/devkit`） |

## 平台自检

主仓默认无业务模块。`npm run verify` 一次完成离线检查 + db-server 集成 + 隔离 `SFMC_ROOT` 模拟。

| 脚本 | 何时用 |
|------|--------|
| `packages/tools/verify.mjs` | CI / 本地「平台能不能跑」 |
| `packages/tools/catalog-sync.mjs` | 装包后投影 catalog |
| `packages/tools/check-modules.mjs` | 离线校验（薄封装 → CLI 权威实现） |

约定检查见 [ESLint 约定](./eslint.md)。

## fetch-module（CLI）

```bash
sfmc mod install afk
sfmc mod install foo --from dir:/path --link
sfmc mod uninstall afk
# 等价：node packages/cli/scripts/module-install/fetch-module.mjs …
```

默认注册表：`Tanya7z/sfmc-modules` 的 `index.json`（`npm` 字段优先）。

## new-module（devkit）

```bash
mkdir my-mod && cd my-mod
npx sfmc-new-module my-mod --name "我的模块"
# monorepo：node packages/devkit/scripts/new-module.mjs …
```

`--official` → `@sfmc-bds/module-*`。脚手架会写入 `eslint.config.js` 与 `.vscode/`。也可用 [sfmc-module-template](https://github.com/Tanya7z/sfmc-module-template) 或扩展 `SFMC: New Module`。

（作者测试）见 [测试沙箱](./testing.md)（`npm test`）。

## 共享库

- 模块 catalog / lock / install：`packages/cli/scripts/module-install/lib/`
- 仓内自检 / 发版：`packages/tools/lib/`（`paths`、`proc`、`npm-publish-packages` 等）

新脚本优先复用，勿复制 lock/catalog 读写。
