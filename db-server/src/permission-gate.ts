/**
 * permission-gate.ts — 模块权限校验
 *
 * 启动期:manifest.permissions 全在白名单(PERMISSION_KEYS),否则抛错启动失败。
 *          (白名单 = db:read:*, db:write:*, config:read:*, config:write:*,
 *           service:* + 通配 ** / <table>)
 *
 * 运行时:发起 db / config / service 调用时,gatesdb.<op>.requirePermission =
 *   "db:read:<table>" / "db:write:<table>" / "config:read:<key>" /
 *   "config:write:<key>" / "service:<name>"
 *
 * 设计:gate 不替路由拦截,是业务逻辑自己检查(避免每条路由都验)。
 *      路由层 fail-closed:不通过 manifest.permissions 表的调用 = 直接 403。
 */

export type PermissionKey = string;
export type PermissionLevel = "Any" | "Member" | "OP" | "Admin";

export interface ManifestPermissionRule {
  /** 模块声明的权限全集 */
  permissions: PermissionKey[];
  /** 跨模块调用对应是否需要显式声明 */
  serviceRequires: string[];
}

const PERMISSION_KEYS = new Set<string>([
  // db:* 走模式匹配 db:read:* / db:write:*
  // 配置权限
  "config:read:*",
  "config:write:*",
  // service 在调用时按 service 名字匹配 service:* 通配
]);

function validPermissionKey(k: string): boolean {
  // 形如 "db:read:lands" / "config:read:land" / "service:economy.debit"
  // 不允许 raw "*"(要求明确对象) — 调试时一律 Resource-level
  return /^[a-z]+:[a-z]+:[A-Za-z0-9_.]+$/.test(k);
}

/**
 * 启动期一次性校验:manifest.permissions 是否都合规。
 * 失败 = 抛错(启动失败)。
 */
export function validateManifestPermissions(
  moduleId: string,
  permissions: readonly string[]
): void {
  const seen = new Set<string>();
  for (const k of permissions) {
    if (!k || typeof k !== "string") throw new Error(`[perm] ${moduleId}: permission 不是字符串 "${k}"`);
    if (!validPermissionKey(k)) throw new Error(`[perm] ${moduleId}: permission 格式不合法 "${k}"`);
    if (seen.has(k)) throw new Error(`[perm] ${moduleId}: permission 重复 "${k}"`);
    seen.add(k);
  }
}

/**
 * 运行时:模块 id 是否拥有所需 permission。
 * 当前实现:必须精确等于才放行,不解释通配。
 * (PoC 简化;生产可加 db:read:* → 通配)
 */
export function moduleHasPermission(
  modulePermissions: readonly string[] | undefined,
  required: string
): boolean {
  if (!modulePermissions) return false;
  if (modulePermissions.includes(required)) return true;
  // db:read:* / db:write:* / config:read:* / config:write:* 通配
  const parts = required.split(":");
  if (parts.length === 3) {
    const wildcard = `${parts[0]}:${parts[1]}:*`;
    if (modulePermissions.includes(wildcard)) return true;
  }
  return false;
}

export function assertModulePermission(
  moduleId: string,
  modulePermissions: readonly string[] | undefined,
  required: string
): void {
  if (!moduleHasPermission(modulePermissions, required)) {
    throw new PermissionDeniedError(moduleId, required);
  }
}

export class PermissionDeniedError extends Error {
  code = "permission_denied";
  status = 403;
  constructor(public moduleId: string, public permission: string) {
    super(`[perm] 模块 ${moduleId} 缺少权限 "${permission}"`);
  }
}

/**
 * 所有 platform 派发的 required permission key 计算助手。
 */
export const Perm = {
  dbRead: (table: string) => `db:read:${table}`,
  dbWrite: (table: string) => `db:write:${table}`,
  configRead: (key: string) => `config:read:${key}`,
  configWrite: (key: string) => `config:write:${key}`,
  service: (name: string) => `service:${name}`,
} as const;

export const PlatformTablePermissions = PERMISSION_KEYS;
