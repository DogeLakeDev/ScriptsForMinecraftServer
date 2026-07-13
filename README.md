# ScriptsForMinecraftServer

基于 Minecraft Bedrock Script API (SAPI) 的服务器插件 + SQLite 后端 + QQ 桥接 + TUI 管理面板。

整个项目从 0 用户视角设计：**克隆下来能在几分钟内跑起来**。

---

## 1. 一分钟上手

### 1.1 系统要求

| 工具 | 版本 | 说明 |
|---|---|---|
| Node.js | 18+；db-server 需要 22.5+ | SAPI 编译 + db-server + qq-bridge + panel |
| Minecraft Bedrock | 1.21.60+ | 推荐开启 Beta APIs |
| PowerShell | 5.1+ (Windows) | 部署脚本依赖 |
| BDS | 任意版本 | 默认放 `D:\Minecraft\BEServer`，可改 |

### 1.2 克隆与初始化

```powershell
git clone <repo-url>
cd ScriptsForMinecraftServer

# 安装 SAPI 依赖（必须）
cd scriptsforminecraftserver
npm install
Copy-Item .env.example .env -ErrorAction SilentlyContinue
# 编辑 .env 填 PROJECT_NAME / CUSTOM_DEPLOYMENT_PATH
cd ..

# 一键自检（不污染工作区，会自动备份还原）
node tools/check-ootb.js
```

如果 `check-ootb.js` 全部 PASS，说明环境正常。

### 1.3 启动服务（三选一）

```bash
# A. 启动面板 (推荐：UI 引导初始化 + 模块管理)
node panel/index.js

# B. 不进 UI，只起 db-server + qq-bridge（保持进程）
node panel/index.js --no-tui

# C. CLI 模式（管道友好，打印当前模块状态）
node panel/index.js --cli
```

**第一次启动会自动进入 setup 向导**：5 步填写 DB 端口 / BDS 路径 / LLBot 路径 / 默认模块，确认后写入 `panel-state.json` + `configs/*.json` + `modules/module-lock.json`。

### 1.4 部署到 BDS

```bash
cd scriptsforminecraftserver
npm run build              # tsc + esbuild bundle
npm run local-deploy       # 复制到 .env 里配置的 BDS 路径
# 或：node scriptsforminecraftserver/just.config.js local-deploy
```

---

## 2. 模块系统

### 2.1 概念

每个模块是"项目级能力单元"，不是单个源码文件。元数据存在 `modules/catalog.json`，运行时启用状态存在 `db-server` + `modules/module-lock.json`，控制入口在面板「模块」Tab。

模块按类型分：

```text
core-*      必需基础模块（不能禁用/卸载）
feature-*   游戏功能模块
service-*   外部 Node 进程（db / qq-bridge / panel）
tool-*      维护工具
asset-*     资源包/资产
```

### 2.2 配置文件

| 文件 | 作用 |
|---|---|
| `modules/catalog.json` | 模块目录真理源（29 个模块，类型/依赖/权限/默认状态） |
| `modules/module-lock.json` | 模块安装状态（运行时维护） |
| `modules/lock.json` | 文件指纹快照，由 `tools/lock.js` 生成 |
| `configs/modules.json` | 旧版启用/禁用平面表（兼容层，仍由 setup 向导生成） |
| `panel-state.json` | 项目级初始化状态（`~/.sim-workspace.bak/` 备份在 setup 重置时使用） |

### 2.3 模块管理命令

```bash
# 安装 / 卸载（逻辑态 + 文件级 trash）
node tools/install-module.js install <id>
node tools/install-module.js uninstall <id> --dry-run
node tools/install-module.js uninstall <id> --no-files   # 只改 lock

# 状态
node tools/install-module.js status

# 依赖闭环 / 文件漂移
node tools/lock.js rebuild
node tools/lock.js drift
```

### 2.4 模块 API

```
GET    /api/sfmc/modules
GET    /api/sfmc/modules/catalog
GET    /api/sfmc/modules/:id
PATCH  /api/sfmc/modules/:id        { enabled }
POST   /api/sfmc/modules/:id/enable
POST   /api/sfmc/modules/:id/disable
POST   /api/sfmc/modules/:id/install
POST   /api/sfmc/modules/:id/uninstall
```

错误码：

| code | 含义 |
|---|---|
| `module_cannot_disable` | 模块 `canDisable=false` |
| `module_cannot_uninstall` | 模块 `canUninstall=false` |
| `dependency_unmet` (409) | 启用 / 安装时 requires 不满足 |
| `dependency_required` (409) | 卸载时仍被其他 installed 模块引用 |

---

## 3. 数据库服务（db-server）

SQLite + Node.js HTTP REST。监听 127.0.0.1:3001（默认）。

```bash
# 启动（独立）
node db-server/index.js

# 端口冲突检测已内置；如被占用会直接报错退出
$env:DB_PORT=4000; node db-server/index.js
```

### 3.1 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `SFMC_ROOT` | `<db-server>` 的父目录 | 让 db-server 从指定根读 configs/modules |
| `SFMC_DB_PATH` | `<db-server>/sfmc_data.db` | SQLite 文件路径 |
| `SFMC_MODULES_DIR` | `<SFMC_ROOT>/modules` | modules 目录 |
| `DB_PORT` | `3001` | 监听端口 |
| `DB_AUTH_TOKEN` | 空 | 写接口 token（留空=loopback 仅） |
| `DB_MAX_BODY` | `1048576` | 请求体字节上限 |

### 3.2 初始化向导接口

```
GET  /api/sfmc/setup/state
POST /api/sfmc/setup/init     { paths, tokens, ui, locale }
POST /api/sfmc/setup/reset
POST /api/sfmc/setup/check    { db, bds, qq }
```

完整 payload 示例：

```json
{
  "paths": {
    "bdsPath": "D:\\Minecraft\\BEServer",
    "llbotPath": "D:\\LLBot-CLI-win-x64\\llbot.exe",
    "llbotCwd": "D:\\LLBot-CLI-win-x64",
    "dbPort": 3001
  },
  "tokens": { "dbAuthToken": "", "bridgeAuthToken": "" },
  "ui": {
    "defaultModules": ["money", "chat", "afk", "shop", "land", "tps"],
    "defaultServices": ["db", "qq"],
    "skipGuidedSetup": false
  },
  "locale": "zh-CN"
}
```

---

## 4. QQ 桥接（qq-bridge）

独立 Node 进程，监听 127.0.0.1:3002 (WebSocket, LLBot) + 127.0.0.1:3003 (HTTP, db-server/面板)。

```bash
node qq-bridge/index.js
```

配置在 `configs/qq_config.json`。鉴权 token 推荐设置 `bridge_auth_token`。

---

## 5. 管理面板（panel）

```bash
node panel/index.js                  # 默认 TUI 模式
node panel/index.js --cli            # CLI 模式
node panel/index.js --no-tui         # 启动服务不进入 TUI
node panel/index.js --setup          # 强制重开 setup
node panel/index.js --help
```

### 5.1 Tab 列表

- **总览**：日志流、服务状态
- **监控**：TPS / 在线人数 / 实体数
- **模块**：29 个模块的启用/禁用/安装/卸载
- **频道**：频道聊天历史
- **数据**：数据库表查看（HTTP 或直连）
- **BDS**：BDS 进程控制 + 日志
- **LLBot**：LLBot 控制
- **QQ-Bridge**：QQ Bridge 控制
- **DB-Server**：db-server 控制

### 5.2 面板内命令

进入输入栏后：

```
start / stop / restart  控制当前 Tab 服务
help                    服务帮助
clear                   清屏
back / 0                返回总览
```

### 5.3 第一次启动

如果 `panel-state.json._initialized=false`，会自动进入 setup 向导（首屏）。完成后才能用模块面板。

---

## 6. 开发工具

| 命令 | 作用 |
|---|---|
| `node tools/check-ootb.js` | 开箱即用自检（推荐 CI 跑） |
| `node tools/check-catalog.js` | catalog.json 静态校验 |
| `node tools/smoke-modules.js` | 模块系统冒烟（需 db-server） |
| `node tools/sim-new-user.js` | 模拟新用户从 0 到 init 全流程（自动备份/还原） |
| `node tools/install-module.js` | 安装/卸载/状态 |
| `node tools/lock.js rebuild` | 生成文件指纹快照 |
| `node tools/lock.js drift` | 检测文件漂移 |

---

## 7. 项目结构

```
ScriptsForMinecraftServer/
├── modules/                      模块目录真理源
│   ├── catalog.json              29 个模块元数据
│   ├── module-lock.json          安装状态
│   └── lock.json                 文件指纹快照
├── configs/                      运行时配置
├── scriptsforminecraftserver/    SAPI 行为包
│   ├── scripts/
│   │   ├── entry.ts              模块启动入口
│   │   ├── libs/                 Command / ConfigManager / ModuleRegistry / MenuNavigator
│   │   ├── chat/ coop/ land/ holo/ area/ data/ doge/ gui/ shop/ shit/ temp/
│   ├── behavior_packs/
│   ├── tsconfig.json + just.config.ts
│   └── package.json
├── db-server/                    SQLite HTTP REST (127.0.0.1:3001)
├── qq-bridge/                    QQ Bridge (3002/3003)
├── panel/                        TUI 管理面板
│   ├── index.js                  入口
│   ├── app.js                    主 App
│   ├── views/                    各 Tab 内容组件
│   ├── services/manager.js       服务依赖图编排
│   └── setup/                    初始化向导
├── BDSTools/                     BDS 自动更新器
├── tools/                        工程工具（check / smoke / sim / lock / install）
├── holoprint/                    全息投影资源（迁移后位置）
├── .github/workflows/ootb.yml    GitHub Actions CI
└── README.md
```

---

## 8. 常见问题（FAQ）

### 8.1 启动报 `Raw mode is not supported`
你在非交互终端跑（如 PowerShell 管道 / IDE / 子进程）。改用：
```bash
node panel/index.js --cli    # 打印状态
node panel/index.js --no-tui # 启服务但不进 TUI
```
或在真正的终端窗口中运行（PowerShell ISE 不行，需 conhost / Windows Terminal / cmd）。

### 8.2 db-server 启动报 `unable to open database file`
检查 `SFMC_DB_PATH` 指向的目录是否存在，或权限不足。默认 `<db-server>/sfmc_data.db` 由 Node 创建，父目录会自动 mkdir。

### 8.3 db-server 报 `port 3001 in use`
```bash
$env:DB_PORT=4000; node db-server/index.js
$env:DB_PORT=4000; node panel/index.js  # panel 自动跟随
```

### 8.4 npm run build 报 `Cannot find module .env`
```bash
cd scriptsforminecraftserver
Copy-Item .env.example .env
# 编辑 .env 填 PROJECT_NAME="ScriptsForMinecraftServer" 和你的 BDS 路径
```

### 8.5 模块 disable 后命令还能用？
默认行为已修：禁用模块的命令会被 `Command.trigger` 守卫拦截。若仍能执行，请确认面板模块页显示状态已切到「禁用」，并查看 SAPI 是否已加载新版（重启 BDS）。

### 8.6 sim-new-user 失败
`sim-new-user.js` 自动备份/还原。如果中途崩溃留下 `.sim-workspace.bak/`，下次运行会覆盖。可以手动删除 `tools/.sim-workspace/` 和 `tools/.sim-workspace.bak/`。

---

## 9. Roadmap

- 模块可热卸载（已实现 cleanup 钩子）
- 服务安装引导（已集成 setup step 3 路径检测）
- Holoprint 投影 UI 闭环（按需推进）
- 远程部署面板（按需推进）

---

## 10. 许可

MIT
