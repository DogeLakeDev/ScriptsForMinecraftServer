# 安装

## 环境

```bash
node -v   # 需要 v22.13 或更高
```

Windows 上 BDS 与本机 Node 互通，管理员 PowerShell 执行一次：

```powershell
CheckNetIsolation LoopbackExempt -is -n=Microsoft.MinecraftUWP_8wekyb3d8bbwe
```

## 方式一：SEA 单文件

1. 打开 [Releases](https://github.com/DogeLakeDev/ScriptsForMinecraftServer/releases)，下载对应平台的 `sfmc`
2. 放到空目录，直接运行
3. 没有配置时会自动进向导

SEA 不含固定行为包，模块要另外装。

## 方式二：npm monorepo

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
