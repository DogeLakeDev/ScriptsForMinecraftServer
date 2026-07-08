import { Player, PlayerPermissionLevel } from "@minecraft/server";
import { data } from "../data/PermissionData";
import { Command } from "./Command";
import { Msg } from "./Tools";

/**
 * 权限等级（与原生 PlayerPermissionLevel 对齐）
 *   0 Visitor  访客
 *   1 Member   普通玩家
 *   2 Operator 管理员
 *   3 Custom   自定义（脚本指定）
 */
export class Permission {
  static Guest = -1; // 脚本指定的无权限访客
  static Any = 0; // 等同于原生 Visitor
  static Member = 1; // 等同于原生 Member
  static OP = 2; // 等同于原生 Operator
  static Admin = 3; // 等同于原生 Custom

  /** 权限注册表：权限名 → 所需最低等级 */
  private static registry: Map<string, number> = new Map();

  /**
   * 注册一个权限项
   * @param name 权限名（如 "creativearea.toggle"）
   * @param level 所需最低权限等级
   */
  static register(name: string, level: number) {
    this.registry.set(name, level);
  }

  /**
   * 检查玩家是否拥有指定权限
   * @param player 玩家对象或玩家名
   * @param permissionName 权限名
   * @returns 是否满足权限要求
   */
  static check(player: Player | string, permissionName: string): boolean {
    const required = this.registry.get(permissionName);
    if (required === undefined) return true; // 未注册的权限默认放行
    const playerLevel = typeof player === "string" ? (data[player] ?? this.Member) : this.getPermission(player);
    return playerLevel >= required;
  }

  static getPermission(player: Player): number {
    if (data[player.name] !== undefined) {
      return data[player.name];
    }
    switch (player.playerPermissionLevel) {
      case PlayerPermissionLevel.Visitor:
        return this.Any;
      case PlayerPermissionLevel.Member:
        return this.Member;
      case PlayerPermissionLevel.Operator:
        return this.OP;
      case PlayerPermissionLevel.Custom:
        return this.Admin;
      default:
        return this.Member;
    }
  }

  /** 注册 permlist 命令 */
  static registerPermlistCommand() {
    Command.register(
      "permlist",
      "permlist.see",
      (player: Player | undefined) => {
        if (!player) return;
        const lines: string[] = [];
        lines.push(`获取到如下权限项：§r`);
        // 按等级分组
        const byLevel: [number, string[]][] = [
          [this.Any, []],
          [this.Member, []],
          [this.OP, []],
          [this.Admin, []],
          [-1, []],
        ];
        const levelMap = new Map(byLevel);
        for (const [name, level] of this.registry) {
          const bucket = levelMap.get(level);
          if (bucket) bucket.push(name);
          else (levelMap.get(-1) ?? []).push(name);
        }
        const label: Record<number, string> = {
          [-1]: "未知",
          [this.Any]: "§a访客",
          [this.Member]: "§e成员",
          [this.OP]: "§6管理",
          [this.Admin]: "§c自定义",
        };
        for (const [level, perms] of byLevel) {
          if (perms.length === 0) continue;
          lines.push(`\n${label[level] ?? "§7其他"} (${level}+):`);
          for (const p of perms) {
            lines.push(`  §f${p}`);
          }
        }
        Msg.success(lines.join("\n"), player);
      },
      "查看所有权限列表"
    );
  }
}
