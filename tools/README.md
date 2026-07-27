# SFMC dev tools - testing before build

开箱自检、模块安装、冒烟等脚本。面向 monorepo / 已部署的 SFMC 根目录使用。

## 安装

```bash
npm install @sfmc-bds/tools
```

从 npm 安装到非 monorepo `tools/` 路径时，请设置 `SFMC_ROOT` 指向 SFMC 根目录。

## 常用命令

```bash
npx sfmc-check-ootb
npx sfmc-fetch-module search
npx sfmc-catalog-sync
npx sfmc-esbuild-transpile [--dts]   # 各包 `npm run build` 用（勿写 ../../../tools/...）
npx tsc7 --noEmit                    # TS7 typecheck / emit
```

或在仓库根：`npm run check-ootb` / `node tools/check-ootb.mjs`。

包内脚本应走 bin（`sfmc-esbuild-transpile` / `tsc7`），不要写相对仓库布局的 `node ../tools/...`。

npm 包只发布上述 bin + `lib/`（不含 changeset / docs / pack-verify 等 monorepo 基建脚本；那些仍在仓库 `tools/` 供 CI 调用，发版共用库为 `changeset-release-lib.mjs`）。

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/tools>
