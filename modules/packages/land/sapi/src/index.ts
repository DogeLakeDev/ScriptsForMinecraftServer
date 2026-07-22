/**
 * @sfmc/module-land — v2 入口
 *
 * ModuleRegistry + db.defineTable。跨模块扣款走 tx.call('economy.account.*')。
 * land.* service provides 在 manifest 声明;SAPI 侧 handler 桥接留待后续
 * (与 economy 不同,领地业务主要在 SAPI 进程)。
 */

import { db } from "@sfmc/sdk/sapi/db";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

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
    },

    cleanup() {},
  },
});

export { transferLand } from "./land-transfer.js";
export { validateLandBox, findLandsByOwner } from "./land-validate.js";
export { queryAuditLog } from "./land-audit.js";
