# 工具脚本

<<<<<<< HEAD
`packages/tools/` 为 **monorepo 私有**脚本（不发 npm）。模块安装在 `@sfmc-bds/cli`，建仓在 `@sfmc-bds/create-module`。
=======
`packages/tools/` 为 **monorepo 私有**脚本（不发 npm）。模块安装在 `@sfmc-bds/cli`，脚手架在 `@sfmc-bds/devkit`。
>>>>>>> chore/tools-drop-unused-scripts

## 常用

| 命令 | 作用 |
|------|------|
<<<<<<< HEAD
<<<<<<< HEAD
| `pnpm run verify` | 平台集成自检（CI 默认） |
| `sfmc mod install <id>` | 安装模块（独立 SFMC 根，非主仓） |
| `pnpm dlx @sfmc-bds/create-module@latest` | 建仓（`@sfmc-bds/create-module`） |
=======
| `npm run verify` | 平台集成自检（CI 默认） |
| `sfmc mod install <id>` | 安装模块（独立 SFMC 根，非主仓） |
| `npx sfmc-new-module <id>` | 脚手架（`@sfmc-bds/devkit`） |
>>>>>>> chore/tools-drop-unused-scripts
=======
| `pnpm run verify` | 平台集成自检（CI 默认） |
| `sfmc mod install <id>` | 安装模块（独立 SFMC 根，非主仓） |
| `pnpm dlx @sfmc-bds/create-module@latest` | 建仓（`@sfmc-bds/create-module`） |
>>>>>>> chore/pnpm-stable-release-prep

主仓默认 **不装业务模块**；catalog / lock 由用户环境里的 `mod install` 维护，主仓不再提供 `catalog-sync` / `check-modules` 入口。

## 发版

<<<<<<< HEAD
<<<<<<< HEAD
日常：`pnpm run changeset` → push `main` → Version Packages PR → 合并后 CI `ci-release-packages`。
=======
日常：`npx changeset` → push `main` → Version Packages PR → 合并后 CI `ci-release-packages`。
>>>>>>> chore/tools-drop-unused-scripts
=======
日常：`pnpm run changeset` → push `main` → Version Packages PR → 合并后 CI `ci-release-packages`。
>>>>>>> chore/pnpm-stable-release-prep

## 共享库

- 模块 catalog / lock / install：`packages/cli/scripts/module-install/`
- 仓内自检 / 发版：`packages/tools/lib/`
