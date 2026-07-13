# ScriptsForMinecraftServer 设计评审

> 基于完整代码审查，总结当前架构设计要点、潜在问题及未来优化方向。

---

## 一、当前设计要点

### 1.1 整体架构

项目以 **Minecraft Bedrock SAPI** 行为包为核心，围绕其构建了三层支撑体系：

```
MC Bedrock (SAPI TypeScript)
       ↕ HTTP (server-net)
┌─────────────────────┐
│     db-server       │ ← SQLite HTTP REST (Node.js, 单一文件, ~2000 行)
│     :3001           │
└──┬──────────────┬───┘
   ↕ HTTP         ↕ HTTP
┌──┴──┐      ┌────┴─────┐
│Panel│      │QQ-Bridge │──WS──→ LLBot (OneBot 11)
│(Ink)│      │:3002/3003│
└─────┘      └──────────┘
```

**五个组件，四种运行时**，通过 HTTP + WebSocket 通信，无消息队列或 RPC 框架。

### 1.2 关键设计决策

| 决策 | 现状 | 考量 |
|------|------|------|
| **模块系统** | `catalog.json` (元数据) + `module-lock.json` (安装状态) + SQLite (启用状态) + `configs/modules.json` (遗留) | 单一数据源 + 多层冗余，意在兼容旧版迁移 |
| **配置管理** | 三层缓存：JSON 文件 → SQLite → SAPI 内存 (`ConfigManager` 每 2s 轮询) | 无推送机制，纯拉取；热加载通过 `_reload_signal` 标记触发全量刷新 |
| **命令系统** | `beforeEvents.chatSend` 拦截 `!`/`！` 前缀 → `Command.trigger()` → 权限校验 + `moduleGuard` | 仿传统 MC 插件模式，无注册表树，纯字符串匹配 |
| **生命周期** | `ModuleRegistry.register()` 接受 `{registerPermissions, registerCommands, registerEvents, init, cleanup}` 五个钩子 | 类似微内核模式，模块动态注册/注销 |
| **数据持久化** | `world.setDynamicProperty` (旧) + db-server SQLite (新，正在迁移中) | 双轨并存，迁移未完成 |
| **进程管理** | Panel 直接 `child_process.spawn()` 管理 db-server/qq-bridge；`bds-manager.js` 管理 BDS | 无监督/看门狗机制，Panel 本身即监视器 |

### 1.3 通信模式

- **SAPI ↔ db-server**：HTTP 短连接，`@minecraft/server-net` 发起请求，无重连逻辑
- **QQ Bridge ↔ LLBot**：WebSocket 长连接 (reverse)，`qq-bridge` 作为 WS 服务端
- **db-server ↔ QQ Bridge**：HTTP POST (`/forward`)，含循环保护 (`fromId.startsWith("qq_")`)
- **Panel ↔ db-server**：HTTP API 调用 + 直接读写 `configs/*.json`

### 1.4 代码质量亮点

- **全面的文档**：README.md (329行) + AGENTS.md (250行) 涵盖架构、FAQ、常见坑
- **用户消息标准化**：`Msg.info/success/error/warning/tips()` 统一前缀色码 + 音效
- **防御性错误处理**：`checkHealth()` 重试、`_shouldLogError()` 频率限制、`ModuleRegistry` 各生命周期 try-catch 隔离
- **工作区隔离**：`SFMC_ROOT` 环境变量支持沙盒测试
- **原子写入**：`saveJsonAtomic()` 先写 `.tmp` 再 `rename()`
- **CI 集成**：GitHub Actions 执行 OOTB 检查 + 模块冒烟测试

---

## 二、现存问题与修复方案

### 🔴 P0 — 运行时崩溃

#### 2.1 `adm-zip` / `cheerio` 未声明依赖

**问题**：`BDSTools/check-update.js` 动态 `require('adm-zip')` 和 `require('cheerio')`，均不在 `BDSTools/package.json` 中。若全局未安装则会直接崩溃。

**修复**：
```json
// BDSTools/package.json
"dependencies": {
  "adm-zip": "^0.5.16",
  "cheerio": "^1.0.0",
  "extract-zip": "^2.0.1",
  "node-html-parser": "^6.1.13"
}
```

同时将顶层 `require` 改为懒加载并给出友好提示，或将 `adm-zip` 替换为已有的 `extract-zip`。

#### 2.2 `node:sqlite` 运行时要求不匹配

**问题**：`db-server/index.js` 使用 `node:sqlite`（Node 22.5+ 实验性 / Node 23+ 稳定），但 README 标注最低 Node 18，且 `engines` 字段未设置。Node 18-22 用户会在启动时静默崩溃。

**修复**：
```json
// db-server/package.json
"engines": { "node": ">=22.5.0" }
// 或加上 --experimental-sqlite 的检测与提示
```

#### 2.3 `panel/index.js` ESM + `.js` 后缀陷阱

**问题**：Panel 使用 ESM (`"type": "module"`)，但 `package.json` 中依赖的本地模块 `scriptsforminecraft/db-server` 指向 CommonJS 格式的 `db-server/index.js`，Node 在 ESM 中 `require()` CJS 模块可能因路径解析失败而抛错。

**修复**：确保 db-server 也声明 `"type": "commonjs"`，或 Panel 改用 `createRequire()` 导入。

---

### 🟠 P1 — 架构与维护性

#### 2.4 `db-server/index.js` 单一文件 ~2000 行

**问题**：路由、数据库初始化、配置管理、QQ 转发、监控指标全部耦合在一个文件中。无中间件模式，URL 匹配用 `if/else if` 链。

**建议拆分结构**：
```
db-server/
├── index.js            # 入口：启动服务器
├── app.js              # HTTP 框架层：路由注册 + 中间件
├── routes/
│   ├── health.js
│   ├── world.js
│   ├── chat.js
│   ├── players.js
│   ├── modules.js
│   ├── setup.js
│   └── admin.js
├── db/
│   ├── init.js         # 建表 + 数据导入
│   └── queries.js      # 查询函数
├── config/
│   └── sync.js         # JSON ↔ SQLite 同步
├── middleware/
│   ├── auth.js         # Token 校验
│   ├── loopback.js     # IP 限制
│   └── bodyLimit.js    # 请求体大小
└── lib/
    ├── forward.js      # QQ 转发逻辑
    └── metrics.js      # 监控指标
```

#### 2.5 SQL 注入风险

**问题**：多处直接拼接标识符/值到 SQL：
```js
// line ~1517
const rows = db.prepare(`SELECT * FROM ${tbl} WHERE ...`).all(...values)
// line ~1864
const stmt = db.prepare(`SELECT COUNT(*) AS cnt FROM "${t.name}"`)
```

虽然 `t.name` 来自 `sqlite_master` 并有正则校验，但 `tbl` 由请求参数传入时风险较高。

**修复**：
- 动态表名统一通过白名单校验
- 值绑定始终用 `?` 占位符
- 引入参数化查询 lint 规则

#### 2.6 三/四源模块状态冗余

**问题**：
- `modules/catalog.json` -- 元数据（唯一正确）
- `modules/module-lock.json` -- 安装状态（启用的 subset）
- `sfmc_config_modules` (SQLite) -- 启用状态
- `configs/modules.json` -- 遗留，只作导入用

同一个概念在 3-4 个地方表达，同步逻辑复杂，容易出现状态不一致。

**建议**：合并为 **catalog（只读元数据）+ lock（安装 + 启用状态）** 两源，废除 SQLite 中的 modules 表和 `configs/modules.json`。db-server 仅从 lock 文件读取，Panel 和 API 均写 lock 文件。

---

### 🟡 P2 — 代码质量与健壮性

#### 2.7 `ConfigManager` 静默吞错误

```js
// scripts/libs/ConfigManager.ts
try { this._fetchWorldData(); } catch { /* ignore */ }
try { this._fetchModules(); } catch { /* ignore */ }
```

至少 6 个 `_fetch*` 方法使用空 `catch`。当 db-server 不可用时，所有配置保持旧值，不会报错，调试极其困难。

**修复**：在首次加载和轮询中加入日志，至少输出 `debug` 级别的错误信息；失败时只静默初次之后的错误，但标记 `_configStale = true`。

#### 2.8 Panel `app.js` 的 `useInput` 深度嵌套

`app.js` ~370 行的 `useInput` 处理器包含多层 `switch/if` 判断，涉及面板状态机、Tab 切换、编辑模式、搜索模式等，逻辑复杂且难以测试。

**建议**：将键盘事件分发拆为独立处理器函数，按 `view` 分派不同 handler，每个 handler 文件控制在 50 行以内。

#### 2.9 db-server 缺乏请求日志

无请求方法、路径、状态码、耗时的记录。生产排障只能依赖应用层错误日志。

**修复**：在路由入口添加简单计时中间件：
```js
const start = Date.now();
// ... handle request
console.log(`[${new Date().toISOString()}] ${req.method} ${path} ${statusCode} ${Date.now() - start}ms`);
```

#### 2.10 迁移未完成 — `world.setDynamicProperty` 仍在使用

shop、coop、land、invswitcher 等模块仍使用 `world.setDynamicProperty`，但 README 标明"正在被 db-server SQLite 替代"。双轨并存增加了维护成本和数据不一致风险。

**建议**：完成迁移路线图，统一使用 db-server HTTP API，移除 `setDynamicProperty` 调用。

---

### 🔵 P3 — 可改进的设计方向

#### 3.1 引入请求校验层

当前所有 HTTP API 端点均不校验请求 body 格式。`FieldMap` (line 1332) 是好的局部模式，但未全局应用。

**建议方向**：引入轻量 JSON Schema 校验（如 `zod`），或统一 `validate(body, schema)` 工具函数。

#### 3.2 配置推送替代轮询

SAPI 每 2 秒轮询 db-server → `_reload_signal`，带宽和性能浪费。但 SAPI 环境限制（无法作为服务端监听），可行方案：

- **缩短轮询间隔 + 增量响应**：返回仅变动的配置项 hash map，减少传输量
- **利用 `/tick` 事件调整**：仅在 tick 事件中间隔检查，避免每 tick 都发 HTTP

#### 3.3 全局速率限制

db-server 无全局限流，恶意客户端或 Bug 可导致 SQLite 锁争用。

**建议**：基于 Token Bucket 的每 IP 限流，写入端点更低阈值。

#### 3.4 TypeScript 覆盖 Node.js 组件

db-server、qq-bridge、BDSTools、Panel 均为纯 JavaScript。转 TypeScript 可显著提升重构安全性（尤其是 db-server 拆分的场景）。

#### 3.5 测试体系建立

当前零单元测试。建议优先级：
1. `ModuleRegistry` 钩子编排
2. `ConfigManager` 缓存逻辑
3. db-server CRUD API (可 mock SQLite)
4. Panel 状态机
5. QQ 消息转发循环保护

#### 3.6 Holoprint 路径与构建解耦

`holoprint/` 目录中的 JS 工具 (`blockGeoMaker.js`、`nbtParser.js` 等) 硬编码了部分路径。应改为配置化并纳入 npm scripts。

#### 3.7 `copy.bat` 退役

使用用户特定路径（`C:\Users\Dell\...`）和弃用命令 (`xcopy`)。应统一使用 `npm run local-deploy`。

---

## 三、推荐短期行动项（优先级排序）

| # | 行动 | 影响 | 工作量 |
|---|------|------|--------|
| 1 | 修复 `BDSTools` 缺失依赖 | 🔴 运行时崩溃 | 5min |
| 2 | 设置 `node:sqlite` 最低 Node 版本检测 | 🔴 新用户无法启动 | 15min |
| 3 | db-server 动态表名白名单 + 参数化查询 | 🟠 SQL 注入 | 1d |
| 4 | `ConfigManager` 错误日志输出 | 🟡 调试困难 | 30min |
| 5 | db-server 请求日志中间件 | 🟡 排障无头绪 | 30min |
| 6 | Panel 键盘事件分发拆分 | 🟡 维护性 | 2d |
| 7 | 模块状态合并为两源 | 🟡 状态不一致 | 3d |
| 8 | 从 `setDynamicProperty` 迁移到 SQLite | 🟡 双轨数据 | 5d |
| 9 | db-server 拆分多文件 | 🟠 架构债务 | 5-7d |
| 10 | 引入 JSON Schema 校验 | 🔵 防御深度 | 2d |

---

## 四、长期架构演进方向

```
当前                             未来
────                              ────
db-server 单体                  → 拆为 db / api / forward 三层
纯 HTTP 轮询                    → 增量推送 + 长轮询 fallback
手动路由                        → 声明式路由 + 中间件链
零测试                          → 单元 + 集成 + E2E
JS Node.js 组件                 → 全 TypeScript
多源模块状态                    → catalog + lock 两源
Panel ↔ db-server 双重写路径    → 统一 API 网关
copy.bat 手动部署               → unified deploy CLI
```

---

*生成日期：2026-07-13 | 基于 commit `HEAD` 的完整代码审查*
