import { Player, type PlayerPermissionLevel } from "@minecraft/server";
import { Command } from "./command.js";
import { ConfigManager } from "../../module-loader/index.js";
import { Msg } from "./msg.js";

/** 原生 PlayerPermissionLevel 对应数值映射（避免作为运行时值导出导致低版本/稳定版缺失符号而加载失败）。 */
const NativePlayerPermissionLevel = {
  Visitor: 0,
  Member: 1,
  Operator: 2,
  Custom: 3,
} as const;

/**
 * 权限等级（与 Minecraft 原生 PlayerPermissionLevel 对齐）：
 * - `Guest = -1`：访客以下（仅作内部占位，不参与常规比较）
 * - `Any = 0`：任意玩家 / 访客（Visitor）
 * - `Member = 1`：普通成员（Member）
 * - `OP = 2`：管理员（Operator）
 * - `Admin = 3`：自定义 / 脚本高级管理员（Custom）
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
  /** 自定义 / 脚本指定（等级 3）。 */
  static Admin = 3;

  private static registry: Map<string, number> = new Map();

  /**
   * 注册命名权限及其满足所需的最低等级。
   *
   * @param name 权限标识名（例如 "home.use"、"teleport.tp"）。
   * @param level 满足该权限所需的最低等级（参考 Permission 常量）。
   */
  static register(name: string, level: number) {
    this.registry.set(name, level);
  }

  /** 清空命名权限表（仅供测试沙箱环境清理使用）。 */
  static clearRegistry(): void {
    this.registry.clear();
  }

  /**
   * 获取已注册命名权限的只读快照列表（沙箱装载清单及管理界面使用）。
   *
   * @returns 按权限名称字母序排列的权限项列表。
   */
  static entries(): { name: string; level: number }[] {
    return [...this.registry.entries()]
      .map(([name, level]) => ({ name, level }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 检查玩家是否满足指定的命名权限；未注册的权限默认拒绝。
   *
   * @param player 目标玩家对象或玩家名称字符串。
   * @param permissionName 权限标识名。
   * @returns 若玩家权限等级大于或等于所需等级则返回 `true`，否则返回 `false`。
   */
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

  /**
   * 计算玩家的当前有效权限等级。优先读取平台配置文件中的覆盖项，否则映射原生 PlayerPermissionLevel。
   *
   * @param player 目标玩家对象。
   * @returns 玩家当前的有效权限等级数值。
   */
  static getPermission(player: Player): number {

    const perms = ConfigManager.getPermissions();
    const override = perms[player.name];
    if (override !== undefined) return override;
    const rawLevel = (player as { playerPermissionLevel?: PlayerPermissionLevel | number }).playerPermissionLevel;
    switch (rawLevel) {
      case NativePlayerPermissionLevel.Visitor:
        return this.Any;
      case NativePlayerPermissionLevel.Member:
        return this.Member;
      case NativePlayerPermissionLevel.Operator:
        return this.OP;
      case NativePlayerPermissionLevel.Custom:
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