/**
 * @sfmc-bds/module-land — v2 入口（含领地 GUI）
 *
 * ModuleRegistry + db.defineTable。跨模块扣款走 @sfmc-bds/module-economy/client。
 * land.* service provides 在 manifest 声明；GUI（原 feature-land-gui）已并入本模块。
 */

import { db } from "@sfmc-bds/sdk/sapi/db";
import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
import { Permission } from "@sfmc-bds/sdk/sapi/runtime";
import { registerLandGuiCommands } from "./land-gui.js";

const MODULE_ID = "feature-land";

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("land.use", Permission.Any);
      Permission.register("land.admin", Permission.OP);
      Permission.register("land.gui.use", Permission.Any);
      Permission.register("land.gui.admin", Permission.OP);
    },

    async init() {
      await db.defineTable(
        "lands",
        {
          id: { type: "TEXT", primary: true },
          owner_player_id: { type: "TEXT", notNull: true, index: true },
          owner_name_snapshot: { type: "TEXT", default: "" },
          dimension: { type: "INTEGER", notNull: true },
          min_x: { type: "INTEGER", notNull: true },
          min_y: { type: "INTEGER", notNull: true },
          min_z: { type: "INTEGER", notNull: true },
          max_x: { type: "INTEGER", notNull: true },
          max_y: { type: "INTEGER", notNull: true },
          max_z: { type: "INTEGER", notNull: true },
          name: { type: "TEXT", default: "" },
          status: { type: "TEXT", default: "active", index: true },
          created_at: { type: "INTEGER", notNull: true },
          updated_at: { type: "INTEGER", notNull: true },
          expires_at: { type: "INTEGER" },
          protection_profile: { type: "TEXT", default: "{}" },
          version: { type: "INTEGER", default: 1 },
          purchase_price: { type: "INTEGER", default: 0 },
          refund_rate: { type: "REAL", default: 0.7 },
          tax_rate: { type: "INTEGER", default: 0 },
          tax_due_at: { type: "INTEGER" },
          tax_frozen: { type: "INTEGER", default: 0 },
        },
        { softDelete: true }
      );

      await db.defineTable(
        "land_members",
        {
          id: { type: "TEXT", primary: true },
          land_id: { type: "TEXT", notNull: true, index: true },
          player_id: { type: "TEXT", notNull: true, index: true },
          player_name_snapshot: { type: "TEXT", default: "" },
          role: { type: "TEXT", default: "admin" },
          created_at: { type: "INTEGER", notNull: true },
          expires_at: { type: "INTEGER" },
        },
        { softDelete: true }
      );

      await db.defineTable(
        "land_audit_logs",
        {
          id: { type: "INTEGER", primary: true },
          land_id: { type: "TEXT", notNull: true, index: true },
          actor_id: { type: "TEXT", notNull: true },
          action: { type: "TEXT", notNull: true, index: true },
          payload: { type: "TEXT", default: "{}" },
          created_at: { type: "INTEGER", notNull: true },
        },
        { softDelete: false }
      );

      await db.defineTable(
        "land_operations",
        {
          request_id: { type: "TEXT", primary: true },
          operation_type: { type: "TEXT", notNull: true },
          actor_id: { type: "TEXT", notNull: true },
          land_id: { type: "TEXT" },
          status: { type: "TEXT", notNull: true },
          response_json: { type: "TEXT", notNull: true, default: "{}" },
          created_at: { type: "INTEGER", notNull: true },
        },
        { softDelete: false }
      );

      registerLandGuiCommands();
    },

    cleanup() {},
  },
});

export { transferLand } from "./land-transfer.js";
export { validateLandBox, findLandsByOwner } from "./land-validate.js";
export { queryAuditLog } from "./land-audit.js";
export type * from "./types.js";
export {
  LandGUI,
  LandApi,
  getSession,
  initSession,
  setPos,
  clearSession,
  registerLandGuiCommands,
} from "./land-gui.js";
export type { InviteRow, LandGuiLandRow, LandGuiMemberRow } from "./land-gui.js";
