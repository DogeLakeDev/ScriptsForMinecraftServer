/**
 * @sfmc/module-land — SAPI 侧入口
 *
 * 暴露给行为包启动期 (ModuleRegistry.register 调用点):
 *   - LandSystem:注册命令/权限
 *   - LandEvents:注册事件订阅
 *   - LandSystem.init() / cleanup():生命周期
 *   - Database.loadFromServer() / refresh():数据加载
 *
 * 跨包依赖的相对路径保留 — 仓内 BP 暂未拆出,Stage D-G 把 gui/libs/api 等
 * 迁到各自模块后再修。本批 (Stage C) 行为包仍通过 entry.ts 的 module loader
 * 间接引用,完整迁移后再切到 controller 形态。
 *
 * 类型从 @sfmc/sdk/contracts 重导出(原 shared/sfmc-types/land.ts),SAPI 端
 * 不用重复声明。
 */

export { LandSystem } from "./LandSystem.js";
export { LandEvents } from "./LandEvents.js";
export { LandCore } from "./LandCore.js";
export { Database } from "./LandDatabase.js";
export { LandTax } from "./LandTax.js";
export {
  getPlayerRole,
  canManage,
  isPublicLand,
  canUse,
  canUseAt,
} from "./LandPolicy.js";
export type { LandCapability as LandPolicyCapability } from "./LandPolicy.js";
export { defaultConfig, defaultPermissions, DEFAULT_CONFIG, DEFAULT_PERMISSIONS, DEFAULT_TAX, generateLandId } from "./defaults.js";
export { LAND_ROLES, ROLE_CAPABILITIES, ROLE_LABELS_CN, SERVER_VALID_ROLES, isValidRole } from "./LandRoles.js";
export type { LandRole, LandCapability, LandActionCapability } from "./LandRoles.js";

// 类型重导出(从 @sfmc/sdk/contracts)
export type {
  LandData,
  LandPos,
  LandMember,
  LandPermissions,
  LandTaxConfig,
  LandConfig,
  LandRow,
  LandAuditLog,
  LandInviteRow,
  LandMemberRow,
  LandMemberInviteResult,
  LandMemberResult,
  DeleteLandResult,
  CreateLandRequest,
  LandErrorCode,
  LandApiResult,
  TransferLandResult,
  LandValidation,
} from "@sfmc/sdk/contracts";
