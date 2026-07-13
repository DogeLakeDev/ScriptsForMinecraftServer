design-review.md 中的问题总体有效，但优先级需要重新整理。当前最值得立即处理的不是直接拆分 db-server/index.js，而是先解决运行风险、数据一致性和可观测性。
# 当前确认的真实问题
## P0：立即修复
### 1. BDSTools 依赖声明不完整  
✅
BDSTools/check-update.js 使用：
- adm-zip
- cheerio
- bds-manager
- Node 内置 HTTP/HTTPS
当前 BDSTools/package.json 已声明 adm-zip、cheerio，但项目整体没有看到统一安装/运行入口验证。需要确认根目录安装方式，确保 node BDSTools/check-update.js 在干净环境可运行。
### 2. Node 版本要求未统一执行  
✅
db-server/package.json 声明：
"engines": {
  "node": ">=22.5.0"
}
但 db-server/index.js 使用 node:sqlite，启动文件没有主动检查 Node 版本。新用户可能得到难以理解的运行时错误。
建议：
- 在 db-server/index.js 启动前检查 process.versions.node
- 低于最低版本时打印明确提示并退出码 2
- Panel 启动前也检查 DB Server 所需 Node 版本
- 在 README 和 Panel help 中统一说明
✅
### 3. 动态表名需要统一白名单  
✅
目前确认存在：
const configTables = [...]
for (const tbl of configTables) {
  query(`SELECT * FROM ${tbl} WHERE updated_at > ?`, [ts]);
}
这里数组是内部常量，当前风险有限，但设计上仍应统一通过白名单函数生成。
数据库浏览接口 db/table/:name 已有正则校验，这是正确的，但建议抽成：
assertSafeIdentifier(name)
统一用于：
- 表名
- 列名
- PRAGMA
- 所有动态 SQL 标识符
## P1：下一阶段优先
### 4. 模块状态仍是三源状态，不建议继续延后
当前状态来源：
catalog.json
module-lock.json
sfmc_config_modules
configs/modules.json
Panel 当前已经新增 install_source 和 files_present，但这只是暴露问题，还没有真正消除多源状态。
建议最终收敛为：
catalog.json
  只读元数据

module-lock.json
  installed
  enabled
  installedAt
  updatedAt
迁移策略：
1. 启动时读取旧 SQLite 模块状态。
2. 如果 lock 中缺少状态，执行一次迁移补全。
3. 将 enabled 写入 lock。
4. 后续 Panel、db-server、安装工具全部只写 lock。
5. 保留 configs/modules.json 只读兼容导入一段时间。
6. 最后删除 SQLite sfmc_config_modules 的写入路径。
目前 ConfigManager.ts:216-225 仍然从 /api/sfmc/modules 读取最终合并状态，因此后端先统一状态来源即可，不必先改 SAPI。

### 5. db-server/index.js 需要拆分，但不应一次性重写
当前约 2000 行，职责包括：
- 启动
- SQLite 初始化
- 配置迁移
- REST 路由
- 模块系统
- QQ 转发
- 监控
- Setup
- Holoprint
建议分三步：
第一步：抽纯工具和数据层
db-server/
  lib/
    json.js
    identifiers.js
    http.js
  db/
    connection.js
    schema.js
    queries.js
  config/
    module-state.js
第二步：抽无状态路由
routes/
  health.js
  world.js
  players.js
  modules.js
  setup.js
  activities.js
第三步：最后再改入口
保持现有 HTTP 路径和响应格式不变，避免 Panel、SAPI、QQ Bridge 同时回归。
### 6. Panel app.js 仍然过重
虽然已经抽出了：
- ui/Shell.js
- ui/Feedback.js
- navigation/rules.js
- navigation/input.js
但 app.js 仍承担：
- 路由
- 配置编辑
- properties 解析
- 退出流程
- 服务动作
- Tab 快捷键
- 侧栏焦点
- Confirm
- Help
- 日志复制
- 更新检查
下一步应优先拆键盘路由：
panel/navigation/
  global-handler.js
  setup-handler.js
  service-handler.js
  config-handler.js
  overlay-handler.js
目标是让 App 只负责：
状态 → 当前页面 → handler → action
### 7. ConfigManager 仍有静默失败
当前 _fetchSettings()、_fetchAreas()、权限、区域、商店等多个方法仍有：
catch {
  /* ignore */
}
reloadAll() 使用 Promise.allSettled()，但没有汇总失败项。
实际风险：
- DB 中断后缓存继续使用旧值
- 用户不知道配置已过期
- 模块可能运行在旧配置上
- 热重载失败没有统一状态
建议增加：
_configStale: boolean;
_lastErrors: Map<string, string>;
行为：
- 首次加载失败：warning
- 后续轮询失败：debug/warning 节流日志
- 成功恢复：info 日志
- isReady() 只代表曾经成功，不代表当前数据新鲜
- 增加 isStale() 查询
### 8. db-server 缺少请求日志
✅
当前只有应用层日志，没有统一记录：
- HTTP 方法
- URL
- 状态码
- 耗时
- 请求失败原因
建议在 handle() 外层加请求生命周期日志，并修改 json() 记录最终状态码。
建议格式：
[HTTP] GET /api/sfmc/world 200 4ms
[HTTP] POST /api/sfmc/world 500 2ms
注意：
- 不记录 token
- 不记录完整请求 body
- 可对高频监控接口降噪
- 错误请求必须保留
### 9. 当前发现的真实 SQL 问题不应忽略
✅
db-server/index.js:1534-1537 动态表名来自内部 configTables，暂时不是外部注入，但建议立即替换为白名单映射：
const CONFIG_TABLES = new Map([
  ['modules', 'sfmc_config_modules'],
  ['settings', 'sfmc_config_settings'],
  ...
]);
禁止任何请求参数直接进入 SQL 标识符。
P2：可以随后处理
### 10. world.setDynamicProperty 双轨迁移未完成
当前仍有业务数据使用动态属性：
- InventorySwitcher
- Fly
- CreativeArea
- ShopSystem
- HoloPrint 实体属性
这里不能简单全部删除。建议按数据类型分组：
- 临时运行态：保留 DynamicProperty
- 用户长期数据：迁移 SQLite
- 世界配置：迁移 SQLite
- 实体绑定属性：继续保留 DynamicProperty
应先建立迁移表，而不是以“全部迁移”为目标。
### 11. 请求 body 校验不统一
当前部分接口有局部校验，但没有统一层。建议先不引入大型 schema 库，使用轻量工具：
requireObject(body)
requireArray(body.items)
requireString(value)
requireNumber(value)
优先覆盖写接口：
- world
- players
- messages
- modules
- setup
- activities
- configs/import
### 12. 轮询可以做增量优化
当前 SAPI 通过：
/api/sfmc/configs/updated-since/:ts
轮询，这个方向可以保留。优先优化：
- 返回变更表摘要
- 每张表只返回必要字段
- 返回 server revision
- 失败时提供 stale 状态
- 避免每次全量解析巨大配置
不建议立即改成 WebSocket，因为 Bedrock SAPI 侧仍受环境约束。
### 13. 限流和鉴权需要分层
当前有 loopback 和 token，但没有限流。建议后续添加：
- GET 监控接口较高频限制
- 写接口低频限制
- 配置导入单独限制
- QQ forward 独立限制
- 按 IP 或 token 统计
### 14. copy.bat 应退役
当前硬编码：
C:\Users\Dell\...
D:\GitHub\ScriptsForMinecraftServer\...
并使用 xcopy。建议：
- README 删除该入口
- copy.bat 改为提示迁移到 npm run local-deploy
- 或直接删除，但需要确认是否仍有人手动使用
### 15. Node.js 组件 TypeScript 化暂不应优先
db-server、Panel、QQ Bridge 全部迁移 TypeScript 工作量很大，且不能直接解决当前运行问题。建议等：
- db-server 路由拆分
- API 响应稳定
- 测试覆盖建立
之后再迁移。
建议的实施顺序
# 阶段 A：运行安全✅
~~1. Node 版本启动检测。~~
~~2. BDSTools 依赖和启动检查。~~
~~3. 动态 SQL 标识符白名单。~~
~~4. db-server 请求日志。~~
5. world/players/messages 等写接口的 undefined 参数防护。
# 阶段 B：状态一致性✅
~~1. 明确 module-lock.json 为安装/启用状态权威源。~~
~~2. 写一次旧 SQLite/configs 到 lock 的迁移。~~
~~3. Panel API 改为只读 lock 状态。~~
~~4. 安装工具和 db-server 共用状态写入逻辑。~~
~~5. 为模块状态增加集成测试。~~
阶段 C：可维护性
1. 抽 db-server identifiers、db、config 工具。
2. 抽 db-server 路由。
3. 拆 Panel 输入 handler。
4. 给 db-server API 增加集成测试。
阶段 D：数据架构
1. 盘点 DynamicProperty 的用途。
2. 区分临时状态、配置、长期数据和实体状态。
3. 分批迁移长期数据。
4. 最后删除对应旧存储路径。