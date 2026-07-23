# 安装

## ⚡️ 方式一：SEA 单文件（.exe）

1. 在 [Releases](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases) 下载对应平台的 `sfmc_v*.*.*.exe`；
2. 放到空目录，直接运行；
3. 第一次安装进入初始化向导即可。

>（工作根 = **exe 所在目录**；也可用系统变量 `SFMC_ROOT` 覆盖）

## ⚡️ 方式二：通过包管理器安装聚合包

```bash
> node -v   # 需要 v22.13 或更高

> npm i -g @sfmc-bds/sfmc
> mkdir my-server && cd my-server # 建议创建一个空文件夹作为工作目录
> sfmc
```

## 🪄 方式三：npm monorepo（适用于开发者/贡献者）

```bash
> git clone https://github.com/DogeLakeDev/ScriptsForMinecraftServer.git
> cd ScriptsForMinecraftServer
> npm i
> npm run build --workspaces --if-present # 第一次使用请先编译
> npm run check-ootb
> sfmc # 或者 npm run start 或者 node sfmc/dist/main.js

> git https://github.com/Tanya7z/sfmc-modules.git # 如需制作模块 还需克隆模组源
> npm i
```

下一章：[首次运行](./first-run.md)
