# @sfmc-bds/sfmc

SFMC 聚合包：  
✨ 一次性安装 CLI + db-server + qq-bridge + bds-tools + sdk，装完即可在工作目录里初始化并管理全部服务。

## 安装

```bash
<<<<<<< HEAD
pnpm add -g @sfmc-bds/sfmc@0.2.2
=======
pnpm add -g @sfmc-bds/sfmc@beta
>>>>>>> chore/pnpm-stable-release-prep
```

或在项目目录本地安装：

```bash
mkdir my-server && cd my-server
pnpm init
<<<<<<< HEAD
pnpm add @sfmc-bds/sfmc@0.2.2
=======
pnpm add @sfmc-bds/sfmc@beta
>>>>>>> chore/pnpm-stable-release-prep
pnpm exec sfmc
```

正式版已发布到 npm `latest`。[pnpm v11 起默认要求新版本发布满 24 小时](https://pnpm.io/settings/dependency-resolution#minimumreleaseage)才参与无版本号解析；如需在发布当天安装，请像上面一样指定精确版本。可用 `pnpm view @sfmc-bds/sfmc version` 查询当前 `latest`；试用预发布版本时才使用 `@beta`。

## 首次使用

```bash
mkdir my-server && cd my-server
sfmc
```

- 工作根 = **当前目录**（`SFMC_ROOT`，可用环境变量覆盖）
- 未初始化时自动进入向导：播种 `configs/`、`modules/`，填写 BDS / 端口等
- 之后在 REPL 中：`start -all`、`module install <id>`、`behavior-pack build` …

```bash
sfmc > status
sfmc > init          # 重跑向导
sfmc > start -all
```

## 包含依赖

| 包 | 作用 |
| ---- | ------ |
| `@sfmc-bds/cli` | `sfmc` 管理 CLI / REPL |
| `@sfmc-bds/db-server` | SQLite HTTP 后端 |
| `@sfmc-bds/qq-bridge` | QQ 互通桥接服务 |
| `@sfmc-bds/bds-tools` | BDS 更新与行为包装配 |
| `@sfmc-bds/sdk` | 共享 SDK |

## 环境变量

| 变量 | 说明 |
| ------ | ------ |
| `SFMC_ROOT` | 配置与数据根（默认 cwd） |
| `SFMC_SERVICE_*_ENTRY` | 覆盖各服务入口脚本（一般由本包 bin 自动注入） |
| `SFMC_FETCH_MODULE` | `fetch-module.mjs` 路径 |

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/packages/meta>
