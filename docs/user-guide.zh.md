# ScriptsForMinecraftServer 使用文档

> 把 Minecraft BDS 服务器从零部署到日常运维的完整流程。读完本文你能:
> 1. 装好整套环境(Node 18+ / Node 22.5+ / Windows Loopback Exemption)
> 2. 初始化配置(`db_config.json` / `qq_config.json` / BP `.env`)
> 3. 启动 5 个仓顶服务(db-server / qq-bridge / bds-tools / sfmc / BP)
> 4. 在 BDS 内启用 / 关闭模块
> 5. 备份、升级、应急恢复

## 1. 架构速览

```
┌─────────────────────────────────────────────────────────┐
│  Minecraft Bedrock Dedicated Server (BDS)               │
│  └─ behavior_packs/ScriptsForMinecraftServer/scripts    │
│     main.js (esbuild 产物,341KB)                         │
└──────────┬───────────────────────────────────────────────┘
           │ HTTP @ 127.0.0.1:3001
           ▼
┌─────────────────────────────────────────────────────────┐
│  db-server (Node 22.5+)                                  │
│  └─ SQLite @ ./data/sfmc_data.db                         │
│     REST API /api/sfmc/*                                 │
│     manifest loader @ modules/_manifests/...json         │
└──────────┬─────────────────────────┬────────────────────┘
           │ WS @ 127.0.0.1:3002     │
           ▼                         │
┌────────────────────┐                │
│  qq-bridge         │                │
│  └─ LLBot OneBot 11│                │
│     入站 WS:3002   │                │
└────────────────────┘                │
                                      │
┌──────────────────────────────────────┴──────────────────┐
│  sfmc-cil (REPL)                                        │
│  └─ db / qq / llbot / bds 服务生命周期                    │
│     manifest 读取 / 模块启停 / 远程 agent 注册              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  bds-tools (BDS 自动更新 + 进程管理)                       │
│  └─ check-update.js / bds-manager.js                     │
└─────────────────────────────────────────────────────────┘
```

**端口速查**:
- `3001` — db-server REST API (BP / sfmc / qq-bridge 都打这里)
- `3002` — qq-bridge 接入 LLBot OneBot 11 的 WebSocket
- `3003` — (旧版预留,目前**不使用**;MC→QQ 由 db-server 直接连 LLBot:3004)

## 2. 系统要求

| 组件 | 要求 |
|------|------|
| Node.js | 18.x(SAPI bundle)+ 22.5+(db-server) |
| 操作系统 | Windows 10/11(主要平台),Linux/macOS 也支持 |
| BDS | Bedrock Dedicated Server 1.26.x(已测试 preview.30) |
| 磁盘 | ~500MB(含 BP + 服务 + node_modules) |

**Node 安装**:从 [nodejs.org](https://nodejs.org/) 拉 22.5+ LTS。装完后:

```bash
node -v    # 应输出 v22.x.x
npm -v
```

**Windows Loopback Exemption**(BDS 与本机 Node 互通必需):

```powershell
# 管理员权限 PowerShell
cd scriptsforminecraftserver
npm run enablemcloopback
npm run enablemcpreviewloopback
```

## 3. 初始化仓库

```bash
git clone <repo-url> ScriptsForMinecraftServer
cd ScriptsForMinecraftServer
npm install
```

`npm install` 会触发 workspace 链接,把所有仓顶服务和 SDK 都装好。验证:

```bash
node tools/check-ootb.js
```

预期输出:
```
[check-ootb] OK: <N> checks passed
```

如果缺 Node 版本,会立即报错。

## 4. 第一次配置

### 4.1 启动 sfmc 向导(推荐)

```bash
node sfmc/dist/main.js
```

sfmc 检测到没有 `configs/db_config.json` 时会自动运行 wizard,引导你设置:
- db-server 端口(默认 3001)
- db-server 数据目录(默认 `./data`)
- modules 目录(默认 `./modules`)
- LLBot controller URL(可选,如果你要接 QQ 桥)

完成后 `configs/db_config.json` 自动生成,内容形如:

```json
{
  "db_port": 3001,
  "http_auth": "",
  "dbDir": "./data/sfmc_data.db",
  "modulesDir": "./modules"
}
```

> 退出向导后 sfmc 进入 REPL 模式,输入 `help` 看可用命令。

### 4.2 BP .env 准备

```bash
cd scriptsforminecraftserver
cp .env.example .env   # 如果有模板
```

`.env` 必须包含:

```
PROJECT_NAME=ScriptsForMinecraftServer
CUSTOM_DEPLOYMENT_PATH=C:/path/to/BDS/behavior_packs
```

`CUSTOM_DEPLOYMENT_PATH` 指向 BDS 安装目录下的 `behavior_packs/`。**正斜杠或反斜杠都可以**,脚本会 normalize。

### 4.3 默认配置覆盖

`configs-default/` 内有 7 个 JSON 模板:
- `db_config.json` — db-server 端口
- `banned_items.json` — 创造区域禁止物品
- `areas.json` — fly/creative/peace 区域定义
- `land.json` — 领地系统默认值
- `permissions.json` — 权限节点默认映射
- `daily_task.json` — 每日任务白名单
- `tps.json` — TPS 监控阈值

启动时 db-server 读 `configs/<name>.json`,如果不存在回退到 `configs-default/<name>.json`。**首次使用直接复制即可**:

```bash
cp -r configs-default/* configs/
```

## 5. 启动 5 个服务

### 5.1 启动 db-server

```bash
cd db-server
npm run dev    # tsx 实时;或 npm run build && npm start
```

预期日志:
```
[manifest] loaded schemaVersion=1 modules=22 routes=34
[initSchema] created 12 tables
HTTP 服务已启动,端口 3001 (loopback only)
API 健康检查: http://127.0.0.1:3001/api/health
```

健康检查:
```bash
curl http://127.0.0.1:3001/api/health
# {"ok": true}
```

### 5.2 启动 qq-bridge(可选,接 QQ 时才需要)

```bash
cd qq-bridge
npm run dev
```

预期日志:
```
[qq-bridge] WS server listening on 127.0.0.1:3002
[qq-bridge] waiting for LLBot connection...
```

在 LLBot 端配置反向 WS 连接到 `ws://127.0.0.1:3002`,qq-bridge 即可接收 QQ 群消息。

### 5.3 启动 sfmc REPL

```bash
node sfmc/dist/main.js
```

REPL 可用命令:

| 命令 | 作用 |
|------|------|
| `status` | 查看所有服务运行态 |
| `start db` / `stop db` | 启停 db-server |
| `start qq` / `stop qq` | 启停 qq-bridge |
| `start llbot` / `stop llbot` | 启停 LLBot |
| `start -all` / `stop -all` | 一键 |
| `restart <svc>` | 重启单个服务 |
| `logs [N]` | 查看最近 N 行日志 |
| `update` | 通过 bds-tools 检查 BDS 更新 |
| `init` | 重跑初始化向导 |
| `remote enroll <url> <token> [name]` | 注册远程控制 agent |
| `help` | 完整命令列表 |
| `Ctrl+C` | 退出 REPL(子服务继续运行) |

### 5.4 部署行为包到 BDS

```bash
cd scriptsforminecraftserver
npm run build:full    # clean → bundle → copy → emit-manifest
npm run build:deploy  # build + 自动复制到 .env 配置的 BDS 路径
```

`build:deploy` 等价于 `build + deploy`。BDS 检测到 `behavior_packs/` 文件变化会在世界重载时重新加载 BP。

### 5.5 启动 BDS

正常启动你的 BDS 服务器。第一次启动后,主菜单默认注册 22 个 SAPI 模块,你会在控制台看到:

```
[manifest] loaded schemaVersion=1 modules=22 routes=34
[SYS] 22 modules loaded
```

进游戏 `/menu` 打开主菜单;`/admin` 是管理面板入口。

## 6. 日常操作

### 6.1 启用 / 关闭模块

有两种方式:

**方式 1 — sfmc REPL**(不重启 BDS):
```
sfmc> modules list              # 列出所有模块 + 启停状态
sfmc> modules enable feature-economy
sfmc> modules disable feature-chat-sounds
sfmc> modules refresh           # 推送给 db-server 与 SAPI
```

**方式 2 — 直接编辑 `modules/module-lock.json`**:
```json
{
  "modules": {
    "feature-economy":    { "enabled": true,  "updatedAt": 1721548800000 },
    "feature-chat-sounds":{ "enabled": false, "updatedAt": 1721548800000 }
  }
}
```
保存后 **重启 BDS** 生效(no hot-reload)。

### 6.2 修改配置

`configs/*.json` 任何修改**都需要重启 BDS**。常见配置:

| 文件 | 修改后影响 |
|------|-----------|
| `configs/db_config.json` | db-server 重启生效 |
| `configs/areas.json` | 区域模块重读(fly/creative/peace) |
| `configs/land.json` | 领地默认值,新领地生效 |
| `configs/permissions.json` | 权限节点绑定 |
| `configs/banned_items.json` | 创造区域放置限制 |

修改后验证:
```bash
node tools/check-catalog.js   # catalog + modules 自检
```

### 6.3 看日志

**BDS 控制台**:`debug.i/w/e` 输出到 BDS 日志,前缀为 `[MODULE_TAG]`。

**db-server**:`./data/sfmc.db-server.log`(配置可改)+ stdout。

**sfmc REPL**:`logs 100` 看最近 100 行。

**qq-bridge**:同 sfmc,通过 `logs` 通道。

### 6.4 模块启停状态查询

```bash
curl http://127.0.0.1:3001/api/sfmc/modules
# 返回 22 行,每行 {id, enabled, canDisable, ...}
```

## 7. 备份与恢复

### 7.1 数据备份

```bash
# 停 db-server(确保 SQLite 一致)
node sfmc/dist/main.js
sfmc> stop db

# 备份整个 data/ 目录
tar -czf backup-$(date +%Y%m%d).tar.gz data/ configs/

sfmc> start db
```

> 不要在 db-server 运行时拷贝 SQLite 文件 —— SQLite WAL 模式下文件可能不一致。

### 7.2 模块清单备份

`modules/catalog.json` 和 `modules/module-lock.json` 是模块真理源。建议:

```bash
cp modules/catalog.json modules/catalog.json.bak
cp modules/module-lock.json modules/module-lock.json.bak
```

`configs/*.json` 一并备份。

### 7.3 BP 重部署

代码修改后:
```bash
cd scriptsforminecraftserver
npm run build:deploy    # build + 复制到 .env 配置路径
# 然后在 BDS 控制台 reload 行为包,或在 sfmc 里 restart bds
```

## 8. 升级

### 8.1 BP 升级

```bash
cd scriptsforminecraftserver
git pull   # 或 npm update
npm run build:deploy
# 重启 BDS
```

### 8.2 db-server 升级

```bash
cd db-server
git pull
npm install
npm run build
# 停旧实例 → 启新实例
node sfmc/dist/main.js
sfmc> stop db
sfmc> start db
```

db-server 自动跑 `initSchema` 增量迁移;老 SQLite 文件不会丢失。

### 8.3 bds-tools 升级 BDS

```bash
node bds-tools/dist/check-update.js          # 检查更新
node bds-tools/dist/check-update.js --check-only   # 只看不装
node bds-tools/dist/check-update.js --force        # 强制装
```

sfmc REPL `update` 是上面这条命令的封装。

## 9. 应急恢复

### 9.1 BDS 启动后 BP 报错

1. 看 BDS 日志,定位第一个 `[E]` 行
2. `cd scriptsforminecraftserver && npm run tsc` 看类型错误
3. `node tools/check-catalog.js` 看 catalog 是否一致
4. `node tools/emit-manifest.mjs` 重生成 manifest
5. `npm run build:deploy` 重部署

### 9.2 db-server 起不来

```bash
cd db-server
cat .sfmc.db-server.log | tail -50
```

常见原因:
- 端口 3001 被占 → 改 `configs/db_config.json` 的 `db_port`
- SQLite 文件损坏 → 用 `sqlite3 data/sfmc_data.db ".recover"` 抢救
- manifest 缺失 → `cd scriptsforminecraftserver && npm run build:full`

### 9.3 qq-bridge 连不上 LLBot

1. LLBot 端反向 WS 目标是否为 `ws://127.0.0.1:3002`
2. qq-bridge stdout 是否报 `[qq-bridge] LLBot connected`
3. 防火墙是否拦截 3002

### 9.4 模块启用后 SAPI 不响应

1. `curl http://127.0.0.1:3001/api/sfmc/modules/<id>` 看 enabled
2. BDS 日志里搜 `[MODULE_ID]` 看是否有 init 错误
3. 最简恢复:编辑 `modules/module-lock.json` 把该模块 enabled=false,重启 BDS

## 10. 常用工具脚本

| 命令 | 作用 |
|------|------|
| `node tools/check-catalog.js` | 校验 catalog + 模块路径完整性 |
| `node tools/check-ootb.js` | 自检 Node 版本 / 必需文件 |
| `node tools/emit-manifest.mjs` | 重生成 `modules/_manifests/module-manifests.json` |
| `node tools/smoke-modules.js` | 模块系统端到端冒烟(需要 db-server 在线) |
| `node tools/test-db-api.js` | 直接打 db-server API 测试 |
| `node tools/sim-new-user.js` | 模拟新用户首次进入流程 |

---

**常用路径速查**:
- BP 部署路径:`<CUSTOM_DEPLOYMENT_PATH>/ScriptsForMinecraftServer`
- 行为包入口:`scriptsforminecraftserver/dist/scripts/main.js`
- db-server 配置:`configs/db_config.json`
- db-server 数据:`data/sfmc_data.db`
- 模块真理源:`modules/catalog.json` + `modules/module-lock.json`
- 模块契约:`modules/_manifests/module-manifests.json`

下一步:要写/改模块,看 [module-author.zh.md](./module-author.zh.md);查 SDK API,看 [sdk-reference.zh.md](./sdk-reference.zh.md)。