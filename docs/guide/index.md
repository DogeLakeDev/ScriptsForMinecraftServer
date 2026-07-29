# 安装

## npm 聚合包

```bash
> node -v   # 需要nodejs v22.13 或更高

> npm i -g @sfmc-bds/sfmc@beta
> mkdir my-server && cd my-server # 建议创建一个空文件夹作为工作目录
> sfmc
```

> 当前仅开放 **beta** 通道。详见 [npm 发布指南](../dev/npm-publish.md)。

## npm monorepo

```bash
> git clone https://github.com/DogeLakeDev/ScriptsForMinecraftServer.git
> cd ScriptsForMinecraftServer
> npm i
> npm run build --workspaces --if-present # 第一次使用请先编译
> npm run check-ootb
> sfmc # 或者 npm run start 或者 node sfmc/dist/main.js

> git clone https://github.com/Tanya7z/sfmc-modules.git # 如需制作模块 还需克隆模组源
> npm i
```

> 首次运行会进入初始化向导。工作根默认为**当前目录**（可用环境变量 `SFMC_ROOT` 覆盖）。

下一章：[首次运行](./first-run.md)
