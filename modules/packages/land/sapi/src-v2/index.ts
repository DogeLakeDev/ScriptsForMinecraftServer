/**
 * @sfmc/module-land — v2 入口
 *
 * 与 src/index.ts (v1) 并存:v1 保留所有 route/handler 业务;v2 用 SDK
 * db.defineTable + db.tx() 走新协议。本文件是 PoC 标准例子。
 *
 * 关键不变量:
 *   - 平台不 import 模块 JS。本文件只在 BDS/SAPI 进程内运行,SAPI 启动
 *     期 installHostBootstrap 会按 catalog 顺序装填模块上下文。
 *   - 数据库业务全走 SDK:db.defineTable + db.tx,不允许 require("fs") /
 *     fetch 等直连。
 */

import { db } from "@sfmc/sdk/sapi/db";
import { service } from "@sfmc/sdk/sapi/service";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

import { transferLand } from "./land-transfer.js";
import { validateLandBox, findLandsByOwner } from "./land-validate.js";
import { queryAuditLog } from "./land-audit.js";

const MODULE_ID = "feature-land";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("land.use", Permission.Any);
      Permission.register("land.admin", Permission.OP);
    },

    async init() {
      // ── 1. 声明表 schema(走 schema-registry)
      await db.defineTable(
        "lands",
        {
          id: { type: "text", primary: true },
          owner_player_id: { type: "text", notNull: true, index: true },
          owner_name_snapshot: { type: "text", default: "" },
          dimension: { type: "integer", notNull: true },
          min_x: { type: "integer", notNull: true },
          min_y: { type: "integer", notNull: true },
          min_z: { type: "integer", notNull: true },
          max_x: { type: "integer", notNull: true },
          max_y: { type: "integer", notNull: true },
          max_z: { type: "integer", notNull: true },
          name: { type: "text", default: "" },
          status: { type: "text", default: "active", index: true },
          created_at: { type: "integer", notNull: true },
          updated_at: { type: "integer", notNull: true },
          expires_at: { type: "integer" },
          protection_profile: { type: "text", default: "{}" },
          version: { type: "integer", default: 1 },
          purchase_price: { type: "integer", default: 0 },
          refund_rate: { type: "real", default: 0.7 },
          tax_rate: { type: "integer", default: 0 },
          tax_due_at: { type: "integer" },
          tax_frozen: { type: "integer", default: 0 },
        },
        { softDelete: true }
      );

      await db.defineTable(
        "land_members",
        {
          // 合成主键:sha256(land_id + "|" + player_id);land 转让时 pk 变(可接受)
          id: { type: "text", primary: true },
          land_id: { type: "text", notNull: true, index: true },
          player_id: { type: "text", notNull: true, index: true },
          player_name_snapshot: { type: "text", default: "" },
          role: { type: "text", default: "admin" },
          created_at: { type: "integer", notNull: true },
          expires_at: { type: "integer" },
        },
        { softDelete: true }
      );

      await db.defineTable(
        "land_audit_logs",
        {
          id: { type: "integer", primary: true },
          land_id: { type: "text", notNull: true, index: true },
          actor_id: { type: "text", notNull: true },
          action: { type: "text", notNull: true, index: true },
          payload: { type: "text", default: "{}" },
          created_at: { type: "integer", notNull: true },
        },
        { softDelete: false }
      );

      await db.defineTable(
        "land_operations",
        {
          request_id: { type: "text", primary: true },
          operation_type: { type: "text", notNull: true },
          actor_id: { type: "text", notNull: true },
          land_id: { type: "text" },
          status: { type: "text", notNull: true },
          response_json: { type: "text", notNull: true, default: "{}" },
          created_at: { type: "integer", notNull: true },
        },
        { softDelete: false }
      );

      // ── 2. 注册 service.get 后端
      // 注意:service.provide 在 db-server 进程内注册,这里通过 RPC
      //     POST /api/sfmc/services/register 通知 platform。
      //     为简化 PoC:把 handler 列表抛给 platform 派发,RPC 端点由
      //     service-routes.ts 提供(下一阶段添加)。
      await registerServiceHandlers();

      // ── 3. 注册模块命令(示例,沿用 src/index.ts 的命令集合)
      registerLandCommands();
    },

    cleanup() {
      // 无清理工作(schema 注册一次,服务一次)
    },
  },
});

/* ── Service 派发注册 ──────────────────────────────────────── */

/**
 * 将 land 提供的 service 列表注册到 db-server serviceRegistry。
 * 协议:POST /api/sfmc/services/register { moduleId, services: [{name, handler}] }
 *        handler 不能序列化 — 必须用模块化投递(runner-side import)。
 * PoC 简化:仅列名称注册(metadata-only),真实 handler 派发在 db-server
 *          进程内由 land 模块初始化时主动注册。
 *
 * 当前实现:走 RPC + 模块化;但 SAPI (BDS) 进程 ≠ db-server 进程,
 *   handler 不能跨进程。所以**真正可用方案**:land 在 db-server 进程
 *   里跑一个 child service(daemon-mode),db-server 端启动时
 *   `npm` 模块自动 import 加载。当前 PoC 跳过,P1 改造。
 */
async function registerServiceHandlers(): Promise<void> {
  // metadata 通告而已;真实注册由 db-server side land-daemon 接管(P1)
  try {
    await (service as unknown as { list(): Promise<unknown> }).list();
  } catch {
    // 暂时不可用,PoC 接受
  }
}

/* ── 命令 ──────────────────────────────────────────────────── */

function registerLandCommands() {
  // 沿用 LandSystem.registerCommandsAndPermissions() 的接口契约,
  // 这里只挂一个 transferLand 演示入口,其它 v1 Command 保留。
  // Command.register 仍在 @sfmc/sdk/sapi/runtime 之内(待 Phase C)
  void MODULE_ID;
}

/* ── 重导出给同进程其它模块用 ──────────────────────────────── */

export { transferLand } from "./land-transfer.js";
export { validateLandBox, findLandsByOwner } from "./land-validate.js";
export { queryAuditLog } from "./land-audit.js";

/* ── 业务内部引用 ──────────────────────────────────────────── */
void transferLand;
void validateLandBox;
void queryAuditLog;
