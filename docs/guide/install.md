# 安装

## 方式一：SEA 单文件（.exe）

1. 打开 [Releases](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases)，下载对应平台的 `sfmc_v*.*.*.exe`；
2. 放到空目录，直接运行；
3. 第一次安装进入初始化向导即可。

>（工作根 = **exe 所在目录**；也可用系统变量 `SFMC_ROOT` 覆盖）

## 方式二：通过包管理器安装聚合包

```bash
> node -v   # 需要 v22.13 或更高

> npm install -g @sfmc-bds/sfmc
> mkdir my-server && cd my-server # 建议创建空文件夹作为工作目录
> sfmc
```

一条命令装齐 CLI、db-server、qq-bridge、bds-tools。工作根 = 当前目录；未初始化时自动进向导。

## 方式三：npm monorepo

```bash
git clone https://github.com/DogeLakeDev/ScriptsForMinecraftServer
cd ScriptsForMinecraftServer
npm install
npm run build --workspaces --if-present
npm run check-ootb
```

`dist/` 不在 git 里，**必须先 build**，否则服务起不来。

自检通过后再跑：

```bash
node sfmc/dist/main.js
```

## 装模块（两条路都一样）

```bash
node tools/fetch-module.mjs search
node tools/fetch-module.mjs install afk land
```

下一章：[首次运行](./first-run.md)
