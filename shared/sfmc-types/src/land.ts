/**
 * types/land.ts — 领地 共享数据模型
 *
 * db-server 与 sapi 之间通过 @sfmc/types/land 别名共享。
 * - snake_case 行类型对应数据库列；
 * - camelCase 视图类型对应 API / 客户端使用。
 *
 * sapi 旧版本曾在 land/LandDatabase.ts 中本地定义 LandData / LandMember /
 * LandPermissions 等。本文件统一后，sapi 应改为 import 自 @sfmc/types/land。
 */

// ──────────────────────────────────────────────────────────────────────────────
// DB 行类型（snake_case）— 直接对应 sfmc_lands / sfmc_land_members 等表
// ──────────────────────────────────────────────────────────────────────────────

export interface LandRow {
  id: string;
  owner_player_id: string;
  owner_name_snapshot: string;
  dimension: number;
  min_x: number;
  min_y: number;
  min_z: number;
  max_x: number;
  max_y: number;
  max_z: number;
  name: string;
  status: string;
  protection_profile: string;
  created_at: number;
  updated_at: number;
  version: number;
  purchase_price: number;
  refund_rate: number;
  tax_rate?: number;
  tax_due_at?: number;
  tax_frozen?: number;
}

export interface LandMemberRow {
  land_id: string;
  player_id: string;
  player_name_snapshot: string;
  role: string;
  status: string;
  expires_at: number | null;
  created_at: number;
  joined_at?: number;
  version?: number;
}

export interface LandInviteRow {
  id: string;
  land_id: string;
  inviter_id: string;
  invitee_id: string;
  role: string;
  status: string;
  expires_at: number;
  created_at: number;
  invitee_name_snapshot?: string;
}

export interface LandAuditLog {
  land_id: string;
  actor_id: string;
  action: string;
  payload: string;
  created_at: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// API 视图类型（camelCase）— routes/lands.ts 通过 mapLandRow 输出
// ──────────────────────────────────────────────────────────────────────────────

export type LandRole = "owner" | "admin" | "member" | "builder" | "container" | "visitor" | "redstone" | "entity";

export interface LandPos {
  x: number;
  y: number;
  z: number;
}

export interface LandPermissions {
  allow_place: boolean;
  allow_destroy: boolean;
  attack_entity: boolean;
  open_container: boolean;
  use_door?: boolean;
  use_button?: boolean;
  use_redstone?: boolean;
  interact_entity?: boolean;
  pickup_item?: boolean;
}

export interface LandMember {
  player_id: string;
  player_name_snapshot?: string;
  role: LandRole;
  status?: string;
  expires_at?: number | null;
  joined_at?: number;
}

export interface LandData {
  id: string;
  ownerplid: string;
  ownerName: string;
  managers: string[];
  members?: LandMember[];
  dimid: number;
  posA: LandPos;
  posB: LandPos;
  permissions: LandPermissions;
  nickname: string;
  createdAt: number;
  status?: string;
  version?: number;
  purchasePrice?: number;
  refundRate?: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// 配置类型（来自 configs/land.json）
// ──────────────────────────────────────────────────────────────────────────────

export interface LandConfig {
  priceFormula: string;
  maxLandsPerPlayer: number;
  minSquare: number;
  maxSquare: number;
  discount: number;
  refundRate: number;
}

export interface LandTaxConfig {
  enabled: boolean;
  defaultRate: number;
  periodDays: number;
  freezeOnInsufficient: boolean;
  fallbackPurchasePrice: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// SAPI 使用的请求 / 响应类型
// ──────────────────────────────────────────────────────────────────────────────

export interface CreateLandRequest {
  ownerId: string;
  ownerName: string;
  dimid: number;
  posA: LandPos;
  posB: LandPos;
  requestId?: string;
}

export interface LandValidation {
  ok: boolean;
  error?: string;
  price?: number;
  status?: number;
  square?: number;
  volume?: number;
  refundRate?: number;
}

export type LandErrorCode =
  | "not_found"
  | "forbidden"
  | "already_deleted"
  | "invalid_request"
  | "invalid_target"
  | "invalid_role"
  | "overlap"
  | "land_limit"
  | "insufficient_funds"
  | "database_unavailable"
  | "version_conflict"
  | "transaction_failed"
  | "request_id_conflict";

/** 领地业务操作的通用响应壳 */
export interface LandApiResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: LandErrorCode | string;
  message?: string;
  status?: number;
  transactionId?: string;
}

/** DELETE /api/sfmc/lands/:id 的响应 */
export interface DeleteLandResult extends LandApiResult {
  refund?: number;
  balance?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  balanceVersion?: number;
}

/** POST /api/sfmc/lands/:id/transfer 的响应 */
export interface TransferLandResult extends LandApiResult<LandData> {
  land?: LandData;
}

/** POST /api/sfmc/lands/:id/members (邀请) 的响应 */
export interface LandMemberInviteResult {
  ok: boolean;
  inviteId?: string;
  expiresAt?: number;
  error?: LandErrorCode | string;
  message?: string;
}

/** POST/DELETE /api/sfmc/lands/:id/members/:playerId 的响应 */
export interface LandMemberResult {
  ok: boolean;
  land?: LandData | null;
  error?: LandErrorCode | string;
  message?: string;
}
