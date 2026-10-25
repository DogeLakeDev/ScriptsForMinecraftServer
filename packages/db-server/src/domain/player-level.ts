/**
 * domain/player-level.ts — 宿主侧计算玩家的 SFMC 有效权限等级
 *
 * 使用场景：GET /api/sfmc/wechat/bind/me 返回绑定玩家的等级，mp-gateway 据此判断微信用户是否为管理员（等级 3）。
 * 游戏内由 Permission.getPermission 计算，宿主侧没有 Player 对象，这里改从两份文件取输入，
 * 合成规则共用 @sfmc-bds/sdk/contracts 的 effectivePermissionLevel（DRY）。
 * 每次调用都现读文件，管理员在桌面端或游戏里调整权限后立即生效。
 */

import { effectivePermissionLevel, nativeLevelFromBdsPermission } from "@sfmc-bds/sdk/contracts";

/**
 * 等级的数据来源（DIP：路由不关心文件位置，由 index.ts 注入读取函数）。
 * 读取失败或文件不存在时返回 null。
 */
export interface PlayerLevelSources {
  /** configs/permissions.json：数组 `{ player_name, level }` */
  readSfmcPermissions(): unknown;
  /** BDS 根目录 permissions.json：数组 `{ xuid, permission }` */
  readBdsPermissions(): unknown;
}

/** 在 configs/permissions.json 中按玩家名查覆盖等级（与 ConfigManager.getPermissions 的解析口径一致） */
function overrideLevel(raw: unknown, name: string): number | undefined {
  if (!Array.isArray(raw) || !name) return undefined;
  let found: number | undefined;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const entry = row as { player_name?: unknown; level?: unknown };
    // 同名多条时后者覆盖前者，与 ConfigManager 逐条写入 map 的结果一致
    if (entry.player_name === name && typeof entry.level === "number") found = entry.level;
  }
  return found;
}

/** 在 BDS permissions.json 中按 xuid 查原生等级 */
function nativeLevel(raw: unknown, xuid: string): number | undefined {
  if (!Array.isArray(raw) || !xuid) return undefined;
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const entry = row as { xuid?: unknown; permission?: unknown };
    if (String(entry.xuid ?? "") === xuid) return nativeLevelFromBdsPermission(entry.permission);
  }
  return undefined;
}

/**
 * 计算玩家有效等级。
 *
 * @param player.xuid 玩家 XUID（查 BDS 原生权限）。
 * @param player.name 玩家名（查 SFMC 覆盖等级）。
 */
export function resolvePlayerLevel(sources: PlayerLevelSources, player: { xuid: string; name: string }): number {
  return effectivePermissionLevel(
    overrideLevel(sources.readSfmcPermissions(), player.name.trim()),
    nativeLevel(sources.readBdsPermissions(), player.xuid.trim())
  );
}
