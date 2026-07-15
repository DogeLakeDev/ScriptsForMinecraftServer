/* ---------------------------------------- *\
 *  LandRoles.ts — 角色 / 能力键 / 角色-能力矩阵
 *
 *  单一来源 (single source of truth) — 客户端与 db-server 都通过
 *  lib/db-server 引用。未来 db-server 抽出共享 lib 后直接 import。
\* ---------------------------------------- */

export type LandRole =
  | "owner"
  | "admin"
  | "builder"
  | "container"
  | "visitor"
  | "redstone"
  | "entity";

export const LAND_ROLES: ReadonlyArray<LandRole> = [
  "builder",
  "container",
  "visitor",
  "redstone",
  "entity",
  "admin",
] as const;

export type LandCapability =
  | "place"
  | "break"
  | "container"
  | "door"
  | "button"
  | "redstone"
  | "attack_entity"
  | "interact_entity"
  | "pickup_item"
  | "manage_members"
  | "manage_permissions"
  | "rename"
  | "transfer"
  | "delete";

export const LAND_CAPABILITIES = {
  PLACE: "place",
  BREAK: "break",
  CONTAINER: "container",
  DOOR: "door",
  BUTTON: "button",
  REDSTONE: "redstone",
  ATTACK_ENTITY: "attack_entity",
  INTERACT_ENTITY: "interact_entity",
  PICKUP_ITEM: "pickup_item",
  MANAGE_MEMBERS: "manage_members",
  MANAGE_PERMISSIONS: "manage_permissions",
  RENAME: "rename",
  TRANSFER: "transfer",
  DELETE: "delete",
} as const satisfies Record<string, LandCapability>;

/**
 * 角色 → 能力映射。admin 在 owner 缺席时继承 manage_members / manage_permissions / rename
 * 但不能 transfer / delete — 这是受限角色，避免 owner 误操作被绕开。
 */
export const ROLE_CAPABILITIES: Record<LandRole, ReadonlyArray<LandCapability>> = {
  owner: [
    "place",
    "break",
    "container",
    "door",
    "button",
    "redstone",
    "attack_entity",
    "interact_entity",
    "pickup_item",
    "manage_members",
    "manage_permissions",
    "rename",
    "transfer",
    "delete",
  ],
  admin: [
    "place",
    "break",
    "container",
    "door",
    "button",
    "redstone",
    "attack_entity",
    "interact_entity",
    "pickup_item",
    "manage_members",
    "manage_permissions",
    "rename",
  ],
  builder: ["place", "break"],
  container: ["container"],
  visitor: [],
  redstone: ["redstone", "button", "door"],
  entity: ["attack_entity", "interact_entity"],
};

/** 玩家在土地上能"动手"的具体动作（用于 canUse），不含纯管理能力 */
export type LandActionCapability =
  | "place"
  | "break"
  | "container"
  | "door"
  | "button"
  | "redstone"
  | "attack_entity"
  | "interact_entity"
  | "pickup_item";

export const LAND_ACTION_CAPABILITIES: ReadonlyArray<LandActionCapability> = [
  "place",
  "break",
  "container",
  "door",
  "button",
  "redstone",
  "attack_entity",
  "interact_entity",
  "pickup_item",
] as const;

export const ROLE_LABELS_CN: Record<LandRole, string> = {
  owner: "所有者",
  admin: "管理员",
  builder: "建造者",
  container: "容器访问",
  visitor: "访客",
  redstone: "红石",
  entity: "实体交互",
};

/** 服务端字符串表，与 db-server 验证保持一致 */
export const SERVER_VALID_ROLES: ReadonlyArray<string> = [
  "builder",
  "container",
  "visitor",
  "redstone",
  "entity",
  "admin",
];

export function isValidRole(role: string): role is LandRole {
  return LAND_ROLES.includes(role as LandRole) || role === "owner";
}
