/**
 * contracts/permission-level.ts — SFMC 有效权限等级的唯一计算规则
 *
 * 使用场景：
 * - 游戏端 `Permission.getPermission` 用它把原生 PlayerPermissionLevel 与 configs/permissions.json 覆盖值合成有效等级；
 * - db-server 在宿主侧（无 Player 对象）按绑定的 xuid / 玩家名计算等级，供小程序网关判断管理员。
 * 两端共用这一份规则（DRY），避免游戏内与宿主侧对“谁是管理员”判断不一致。
 */

/** SFMC 权限等级数值（与 Minecraft 原生 PlayerPermissionLevel 数值对齐） */
export const PERMISSION_LEVEL = {
  /** 任意玩家 / 访客（Visitor） */
  Any: 0,
  /** 普通成员（Member） */
  Member: 1,
  /** 管理员 OP（Operator） */
  OP: 2,
  /** 自定义 / 脚本高级管理员（Custom） */
  Admin: 3,
} as const;

/**
 * BDS `permissions.json` 中的权限字符串 → 原生等级数值。
 * 使用场景：db-server 读取 BDS 根目录 permissions.json（`{ xuid, permission }`）时转换；未知值返回 undefined。
 */
export function nativeLevelFromBdsPermission(permission: unknown): number | undefined {
  switch (String(permission ?? "").toLowerCase()) {
    case "visitor":
      return 0;
    case "member":
      return 1;
    case "operator":
      return 2;
    case "custom":
      return 3;
    default:
      return undefined;
  }
}

/**
 * 计算有效等级：configs/permissions.json 的覆盖值优先；否则映射原生等级；都没有时视为成员。
 *
 * @param override configs/permissions.json 中该玩家名的等级（无覆盖传 undefined）。
 * @param nativeLevel 原生 PlayerPermissionLevel 数值（0 访客 / 1 成员 / 2 操作员 / 3 自定义），未知传 undefined。
 */
export function effectivePermissionLevel(override: number | undefined, nativeLevel: number | undefined): number {
  if (override !== undefined) return override;
  switch (nativeLevel) {
    case 0:
      return PERMISSION_LEVEL.Any;
    case 1:
      return PERMISSION_LEVEL.Member;
    case 2:
      return PERMISSION_LEVEL.OP;
    case 3:
      return PERMISSION_LEVEL.Admin;
    default:
      return PERMISSION_LEVEL.Member;
  }
}
