# 首次运行

## 向导

```bash
node sfmc/dist/main.js
# 或 SEA: ./sfmc.exe
```

没有 `configs/runtime.json` 的 `initialized_at` 时会自动进向导（配置 JSON 骨架可能已由进程启动时创建，不能靠「有没有 db_config」判断）：

- BDS 路径、备份目录
- db-server 端口（默认 3001）
- 可选 LLBot 路径（要 QQ 互通时）

也可手动：`sfmc init` / `node sfmc/dist/main.js init`。

npm 聚合包用户：

```bash
npm install -g @sfmc-bds/sfmc
mkdir my-server && cd my-server && sfmc
```

## 默认配置从哪来

平台模板在 `configs-default/`：

| 文件 | 用途 |
|------|------|
| `db_config.json` | db-server 端口、数据路径、模块目录 |
| `qq_config.json` | QQ 桥、LLBot 连接 |
| `bds_updater.json` | BDS 更新与备份 |
| `permissions.json` | 权限种子 |

首次可手工复制：

```powershell
New-Item -ItemType Directory -Force configs | Out-Null
Copy-Item configs-default\*.json configs\
```

模块自己的默认配置在 `modules/packages/<id>/configs-default/`，装模块后由平台合并。

## db_config 示例

```json
{
  "db_port": 3001,
  "http_auth": "",
  "dbDir": "./data/sfmc_data.db",
  "modulesDir": "modules"
}
```

`modulesDir` 相对仓库根（或 SEA 工作目录），填 `"modules"` 即可，不要写成 `"../modules"`。

## 环境变量

| 变量 | 作用 |
|------|------|
| `SFMC_ROOT` | 配置与数据根目录（SEA 默认 = exe 所在目录） |
| `DB_PORT` | 覆盖 db 端口 |
| `HTTP_AUTH` | 覆盖 Bearer 鉴权 |

下一章：[服务管理](./services.md)
