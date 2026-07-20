import { Player, PlayerPermissionLevel } from "@minecraft/server";
import { Command } from "./command.js";
import { ConfigManager } from "../../module-loader/internal/config-manager.js";
import { Msg } from "./msg.js";

/**
 * 权限等级(与原生 PlayerPermissionLevel 对齐)
 *   0 Visitor  访客
 *   1 Member   普通玩家
 *   2 Operator 管理员
 *   3 Custom   自定义(脚本指定)
 */
export class Permission {
  static Guest = -1;
  static Any = 0;
  static Member = 1;
  static OP = 2;
  static Admin = 3;

  private static registry: Map<string, number> = new Map();

  static register(name: string, level: number) {
    this.registry.set(name, level);
  }

  static check(player: Player | string, permissionName: string): boolean {
    const required = this.registry.get(permissionName);
    if (required === undefined) {
      console.warn(`[Permission] 未注册的权限被拒绝: ${permissionName}`);
      return false;
    }
    const perms = ConfigManager.getPermissions();
    const playerLevel = typeof player === "string" ? (perms[player] ?? this.Member) : this.getPermission(player);
    return playerLevel >= required;
  }

  static getPermission(player: Player): number {
    const perms = ConfigManager.getPermissions();
    const override = perms[player.name];
    if (override !== undefined) return override;
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

  static registerPermlistCommand() {
    Command.register(
      "permlist",
      "permlist.see",
      (player: Player | undefined) => {
        if (!player) return;
        const lines: string[] = [];
        lines.push("获取到如下权限项：§r");
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
          for (const p of perms) lines.push(`  §f${p}`);
        }
        Msg.success(lines.join("\n"), player);
      },
      "查看所有权限列表"
    );
  }
}