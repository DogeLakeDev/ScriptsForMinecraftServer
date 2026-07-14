import { Player } from "@minecraft/server";
import { LandCore } from "./LandCore";
import { Database, LandData, LandRole, ROLE_PERMISSIONS, LandPermissions, LandPos } from "./LandDatabase";
import { Permission } from "../libs/Permission";

export type LandCapability =
  | "place"
  | "break"
  | "container"
  | "door"
  | "button"
  | "redstone"
  | "attack_entity"
  | "interact_entity"
  | "pickup_item";

const DEFAULT_FIELD: Record<LandCapability, keyof LandPermissions> = {
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
  const member = (
    land as LandData & { members?: Array<{ player_id: string; role: LandRole; expires_at?: number | null }> }
  ).members?.find((m) => m.player_id === playerId && (m.expires_at == null || m.expires_at > now));
  return member?.role || (land.managers.includes(playerId) ? "admin" : null);
}

export function canManage(
  land: LandData,
  playerId: string,
  capability: "manage_members" | "manage_permissions" | "rename" | "transfer" | "delete"
): boolean {
  const role = getPlayerRole(land, playerId);
  return !!role && ROLE_PERMISSIONS[role].includes(capability);
}

export function canUse(land: LandData, playerId: string, capability: LandCapability): boolean {
  const role = getPlayerRole(land, playerId);
  if (role && ROLE_PERMISSIONS[role].includes(capability)) return true;
  const field = DEFAULT_FIELD[capability];
  return land.permissions[field] === true;
}

export function canUseAt(player: Player, pos: LandPos, dimid: number, capability: LandCapability): boolean {
  if (Permission.getPermission(player) >= Permission.OP) return true;
  if (!Database.hasAuthoritativeSnapshot()) return false;
  const land = LandCore.getLandByPos(pos, dimid);
  return !land || canUse(land, player.id, capability);
}
