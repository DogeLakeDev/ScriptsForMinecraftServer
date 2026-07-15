import { Player } from "@minecraft/server";
import { LandCore } from "./LandCore";
import { Database, LandData, LandPermissions, LandPos, LandRole } from "./LandDatabase";
import { ROLE_CAPABILITIES, type LandActionCapability } from "./LandRoles";
import { Permission } from "../libs/Permission";

// 玩家在土地上能动手的具体动作（用于 canUse）— LandActionCapability 由 LandRoles 提供
export type { LandActionCapability as LandCapability };

// capability 到 permissions 字段的映射（visitor 默认 false）
const CAPABILITY_TO_PERMISSION_FIELD: Record<LandActionCapability, keyof LandPermissions> = {
  place: "allow_place",
  break: "allow_destroy",
  container: "open_container",
  door: "use_door",
  button: "use_button",
  redstone: "use_redstone",
  attack_entity: "attack_entity",
  interact_entity: "interact_entity",
  pickup_item: "pickup_item",
};

export function getPlayerRole(land: LandData, playerId: string): LandRole | null {
  if (land.ownerplid === playerId) return "owner";
  const now = Date.now();
  const member = (land.members || []).find((m) => m.player_id === playerId && (m.expires_at == null || m.expires_at > now));
  return member?.role || (land.managers.includes(playerId) ? "admin" : null);
}

export function canManage(
  land: LandData,
  playerId: string,
  capability: "manage_members" | "manage_permissions" | "rename" | "transfer" | "delete"
): boolean {
  const role = getPlayerRole(land, playerId);
  return !!role && ROLE_CAPABILITIES[role].includes(capability);
}

export function isPublicLand(land: LandData): boolean {
  return land.status === "public";
}

export function canUse(land: LandData, playerId: string, capability: LandActionCapability): boolean {
  // 公共广场 / 公共领地：所有玩家默认可动手。
  if (isPublicLand(land)) return true;
  const role = getPlayerRole(land, playerId);
  if (role && ROLE_CAPABILITIES[role].includes(capability)) return true;
  const field = CAPABILITY_TO_PERMISSION_FIELD[capability];
  return land.permissions[field] === true;
}

export function canUseAt(player: Player, pos: LandPos, dimid: number, capability: LandActionCapability): boolean {
  if (Permission.getPermission(player) >= Permission.OP) return true;
  if (!Database.hasAuthoritativeSnapshot()) return false;
  const land = LandCore.getLandByPos(pos, dimid);
  if (!land) return true; // 无领地保护 — 默认允许
  if (isPublicLand(land)) return true;
  return canUse(land, player.id, capability);
}
