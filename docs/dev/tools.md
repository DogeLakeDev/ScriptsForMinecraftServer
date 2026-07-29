# 工具脚本

根目录 `tools/*.mjs`，配合 `npm run` 使用。

## 常用

| 命令 | 作用 |
|------|------|
| `npm run check-ootb` | 开箱自检 |
| `npm run catalog-sync` | 扫 packages → 写 `catalog.json` |
| `npm run check-modules` | 校验 catalog + v2 manifest |
| `node tools/fetch-module.mjs search` | 查注册表 |
| `node tools/fetch-module.mjs install <id>` | 安装模块 |
| `node tools/new-module.mjs <id>` | 在**空目录 cwd** 生成单包根 |
| `npm run smoke-modules` | 模块 API 冒烟 |

## fetch-module

```bash
node tools/fetch-module.mjs install afk
node tools/fetch-module.mjs install foo --from dir:/path --link
node tools/fetch-module.mjs install foo --from local:/path --link
node tools/fetch-module.mjs uninstall afk
```

`--link` 支持 `dir:` 与 `local:<dir>`。默认注册表：`Tanya7z/sfmc-modules` 的 `index.json`（npm 字段优先）。

## new-module

```bash
mkdir my-mod && cd my-mod
node /path/to/tools/new-module.mjs my-mod --name "我的模块"
# --official → @sfmc-bds/module-*；默认 @CHANGE_ME/sfmc-module-*
```

注意：`sfmc module create` / `sfmc mod create` 已被移除；脚手架请直接调用 `tools/new-module.mjs`（或 clone `Tanya7z/sfmc-module-template` 派生仓）。`--root` / `SFMC_MODULES_ROOT` 已移除。

## 共享库

`tools/lib/`：`catalog.mjs`、`packages.mjs`、`lock.mjs`、`paths.mjs`、`link-from.mjs`、`registry-index.mjs` 等。
