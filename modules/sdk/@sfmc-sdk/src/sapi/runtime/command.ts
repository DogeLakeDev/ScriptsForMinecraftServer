import { Player, system } from "@minecraft/server";
import { Permission } from "./permission.js";
import { debug } from "./debug-log.js";
import { Msg } from "./msg.js";

let moduleGuard: (moduleId: string) => boolean = () => true;

/** 注入模块守卫：`Command.trigger` 执行前检查所属模块是否启用。 */
export function setModuleGuard(guard: (moduleId: string) => boolean): void {
  moduleGuard = guard;
}

/** 指令执行费用配置。 */
export type CommandCost = {
  /** 扣费金额。 */
  amount: number;
  /** 是否每次执行都扣费；默认仅首次。 */
  perUse?: boolean;
  /** 每日免费次数。 */
  dailyFree?: number;
};

/** 已注册指令的元数据与回调。 */
export type CommandEntry = {
  /** 指令执行回调。 */
  callback: Function;
  /** 所需权限等级（数字）或权限名（字符串）。 */
  permission: number | string;
  /** 指令说明（`!help` 展示）。 */
  description: string;
  /** 所属模块 id；用于 moduleGuard 拦截已禁用模块。 */
  moduleId?: string;
  /** 可选执行费用。 */
  cost?: CommandCost;
};

/** 游戏内 `!` 前缀指令的注册表与触发器。 */
export class Command {
  /** 已注册指令表（名称 → 条目）。 */
  static list: Record<string, CommandEntry> = {};
  /** 费用扣减回调；由 Economy 模块在启动时注入。 */
  static deductCost: ((player: Player, amount: number, commandName: string) => Promise<boolean>) | null = null;

  /** 注册一条 `!` 指令；`description` 缺省则用 `name`。 */
  static register(
    name: string,
    permission: number | string,
    callback: (player: Player | undefined) => any,
    description?: string,
    moduleId?: string,
    cost?: CommandCost
  ) {
    const entry: CommandEntry = {
      callback,
      permission,
      description: description === undefined ? name : description,
    };
    if (moduleId !== undefined) entry.moduleId = moduleId;
    if (cost !== undefined) entry.cost = cost;
    this.list[name] = entry;
    debug.i("CMD", `register "${name}" perm=${permission} mod=${moduleId || "-"} cost=${cost?.amount || 0}`);
    return true;
  }

  /** 注销指定指令；存在则删除并返回 true。 */
  static unregister(name: string): boolean {
    if (this.list[name] !== undefined) {
      delete this.list[name];
      return true;
    }
    return false;
  }

  /** 按模块 id 批量注销指令；返回删除条数。 */
  static unregisterByModule(moduleId: string): number {
    let n = 0;
    for (const k of Object.keys(this.list)) {
      const e = this.list[k];
      if (e && e.moduleId === moduleId) {
        delete this.list[k];
        n++;
      }
    }
    return n;
  }

  /** 指令是否已注册。 */
  static has(name: string): boolean {
    return this.list[name] !== undefined;
  }

  /** 返回所有已注册指令名称。 */
  static names(): string[] {
    return Object.keys(this.list);
  }

  /** 取指令所属模块 id；无则 undefined。 */
  static getModuleId(name: string): string | undefined {
    return this.list[name]?.moduleId;
  }

  private static canExecute(player: Player | undefined, permission: number | string): boolean {
    if (player === undefined) return true;
    if (typeof permission === "string") {
      return Permission.check(player, permission);
    }
    return Permission.getPermission(player) >= permission;
  }

  /** 触发指令：校验模块守卫、权限与费用后执行回调。 */
  static trigger(player: Player | undefined, message: string) {
    const pname = player?.name || "CONSOLE";
    const pid = player?.id || "N/A";
    debug.i("CMD", `trigger by ${pname}(${pid}): "${message}"`);
    const commandInfo = this.list[message];
    if (commandInfo !== undefined) {
      if (commandInfo.moduleId && !moduleGuard(commandInfo.moduleId)) {
        debug.w("CMD", `blocked: module ${commandInfo.moduleId} disabled for ${pname}`);
        if (player) Msg.error(`该命令所属模块已禁用: ${commandInfo.moduleId}`, player);
        return;
      }
      if (!this.canExecute(player, commandInfo.permission)) {
        debug.w("CMD", `permission denied: ${pname} needs ${commandInfo.permission} for "${message}"`);
        if (player) Msg.error("你没有执行此条指令的权限。", player);
        return;
      }
      system.run(async () => {
        if (player && commandInfo.cost && this.deductCost) {
          const ok = await this.deductCost(player, commandInfo.cost.amount, message);
          if (!ok) {
            debug.w("CMD", `cost deduct failed: ${pname} needs ${commandInfo.cost.amount} for "${message}"`);
            Msg.error(`余额不足，无法执行该指令（需要 ${commandInfo.cost.amount}）。`, player);
            return;
          }
          debug.i("CMD", `cost deducted ${commandInfo.cost.amount} from ${pname} for "${message}"`);
        }
        debug.d("CMD", `executing "${message}" for ${pname}`);
        const result = await (commandInfo.callback as (player: Player | undefined) => any)(player);
        if (result !== undefined && player) debug.d("CMD", `result for "${message}": ${result}`);
        if (result !== undefined && player) Msg.success(`${result}`, player);
      });
      return;
    }
    debug.w("CMD", `unknown command "${message}" from ${pname}`);
    if (player) Msg.error("未知的命令! 发送\'!help\'查询所有指令。", player);
  }

  /** 注册内置 `!help` 指令，列出当前玩家有权限的指令。 */
  static registerHelpCommand() {
    this.register(
      "help",
      "help.see",
      (player: Player | undefined) => {
        let result = "当前可用指令列表如下：§r\n";
        for (const command in this.list) {
          const entry = this.list[command];
          if (entry && this.canExecute(player, entry.permission)) {
            result += `  ${command} - ${entry.description}\n`;
          }
        }
        return result;
      },
      "获取所有指令"
    );
  }

  /** 订阅 `doge:` 命名空间 scriptEvent，将事件 id 转给 `trigger`。 */
  static registerScriptEvent() {
    system.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        this.trigger(event.sourceEntity as Player | undefined, event.id.substring(5));
      },
      { namespaces: ["doge"] }
    );
  }
}

Command.registerScriptEvent();