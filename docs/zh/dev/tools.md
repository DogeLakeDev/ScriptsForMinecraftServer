# 工具脚本

`packages/tools/` 为 **monorepo 私有**脚本（不发 npm）。模块安装在 `@sfmc-bds/cli`，建仓在 `@sfmc-bds/create-module`。

## 常用

| 命令 | 作用 |
|------|------|
| `npm run verify` | 平台集成自检（CI 默认） |
| `sfmc mod install <id>` | 安装模块（独立 SFMC 根，非主仓） |
| `npm create @sfmc-bds/module@latest` | 建仓（`@sfmc-bds/create-module`） |

主仓默认 **不装业务模块**；catalog / lock 由用户环境里的 `mod install` 维护，主仓不再提供 `catalog-sync` / `check-modules` 入口。

## 发版

日常：`npx changeset` → push `main` → Version Packages PR → 合并后 CI `ci-release-packages`。

## 共享库

- 模块 catalog / lock / install：`packages/cli/scripts/module-install/`
- 仓内自检 / 发版：`packages/tools/lib/`
