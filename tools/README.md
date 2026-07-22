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
```

或在仓库根：`npm run check-ootb` / `node tools/check-ootb.mjs`。

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/tools>
