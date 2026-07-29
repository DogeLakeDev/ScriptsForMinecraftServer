import { Player, PlayerPermissionLevel } from "@minecraft/server";
import { Command } from "./command.js";
import { ConfigManager } from "../../module-loader/internal/config-manager.js";
// (DataAdapter 现位于 module-loader/data-adapter.ts — 本文件未引用,无需改)
import { Msg } from "./msg.js";

/**
 * 权限等级(与原生 PlayerPermissionLevel 对齐)
 *   0 Visitor  访客
 *   1 Member   普通玩家
 *   2 Operator 管理员
 *   3 Custom   自定义(脚本指定)
 */
export class Permission {
  /** 访客以下（仅内部占位，不参与比较）。 */
  static Guest = -1;
  /** 任意玩家（等级 0）。 */
  static Any = 0;
  /** 普通成员（等级 1）。 */
  static Member = 1;
  /** 管理员 OP（等级 2）。 */
  static OP = 2;
  /** 自定义/脚本指定（等级 3）。 */
  static Admin = 3;

  private static registry: Map<string, number> = new Map();

  /** 注册命名权限及其最低等级要求。 */
  static register(name: string, level: number) {
    this.registry.set(name, level);
  }

  /** 检查玩家是否满足命名权限；未注册权限名一律拒绝。 */
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

  /** 取玩家有效权限等级：配置覆盖优先，否则映射原生 PlayerPermissionLevel。 */
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

  /** 注册内置 `!permlist` 指令，按等级分组展示已注册权限。 */
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