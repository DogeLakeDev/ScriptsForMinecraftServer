# @sfmc-bds/sfmc

SFMC 聚合包：  
✨ 一次性安装 CLI + db-server + qq-bridge + bds-tools + tools + sdk，装完即可在工作目录里初始化并管理全部服务。

## 安装

```bash
npm install -g @sfmc-bds/sfmc
```

或在项目目录本地安装：

```bash
mkdir my-server && cd my-server
npm init -y
npm install @sfmc-bds/sfmc
npx sfmc
```

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
| `@sfmc-bds/tools` | `fetch-module` 等工具 |
| `@sfmc-bds/sdk` | 共享 SDK |

## 环境变量

| 变量 | 说明 |
| ------ | ------ |
| `SFMC_ROOT` | 配置与数据根（默认 cwd） |
| `SFMC_SERVICE_*_ENTRY` | 覆盖各服务入口脚本（一般由本包 bin 自动注入） |
| `SFMC_FETCH_MODULE` | `fetch-module.mjs` 路径 |
| `SFMC_DEFAULTS_DIR` | 首次初始化用的默认配置模板目录 |

## 仓库

<https://github.com/DogeLakeDev/ScriptsForMinecraftServer/tree/main/sfmc-meta>
