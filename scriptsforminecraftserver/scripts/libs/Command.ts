import { Player, system } from "@minecraft/server";
import { debug } from "./DebugLog";
import { Permission } from "./Permission";
import { Msg } from "./Tools";

let moduleGuard: (moduleId: string) => boolean = () => true;
export function setModuleGuard(guard: (moduleId: string) => boolean): void {
  moduleGuard = guard;
}

export type CommandCost = {
  amount: number;
  perUse?: boolean;
  dailyFree?: number;
};

export type CommandEntry = {
  callback: Function;
  permission: number | string;
  description: string;
  moduleId?: string;
  cost?: CommandCost;
};

export class Command {
  static list: Record<string, CommandEntry> = {};
  static deductCost: ((player: Player, amount: number, commandName: string) => Promise<boolean>) | null = null;

  /**
   * 注册指令
   * @param name 指令名称
   * @param permission 权限等级(数字) 或 权限名(字符串)
   * @param callback 回调
   * @param description 指令描述
   * @param moduleId 所属模块 ID（可选），用于模块禁用时拦截
   * @param cost 指令费用配置
   */
  static register(
    name: string,
    permission: number | string,
    callback: (player: Player | undefined) => any,
    description?: string,
    moduleId?: string,
    cost?: CommandCost
  ) {
    this.list[name] = {
      callback: callback,
      permission: permission,
      description: description === undefined ? name : description,
      moduleId: moduleId,
      cost,
    };
    debug.i("CMD", `register "${name}" perm=${permission} mod=${moduleId || "-"} cost=${cost?.amount || 0}`);
    return true;
  }

  static unregister(name: string): boolean {
    if (this.list[name] !== undefined) {
      delete this.list[name];
      return true;
    }
    return false;
  }

  static unregisterByModule(moduleId: string): number {
    let n = 0;
    for (const k of Object.keys(this.list)) {
      if (this.list[k].moduleId === moduleId) {
        delete this.list[k];
        n++;
      }
    }
    return n;
  }

  static has(name: string): boolean {
    return this.list[name] !== undefined;
  }

  static names(): string[] {
    return Object.keys(this.list);
  }

  static getModuleId(name: string): string | undefined {
    return this.list[name]?.moduleId;
  }

  /**
   * 检查玩家是否有权限执行该命令
   */
  private static canExecute(player: Player | undefined, permission: number | string): boolean {
    if (player === undefined) return true;
    if (typeof permission === "string") {
      return Permission.check(player, permission);
    }
    return Permission.getPermission(player) >= permission;
  }

  /**
   * 触发指令
   * @param player 触发指令的玩家，不指定时使用最高权限执行
   * @param message
   */
  static trigger(player: Player | undefined, message: string) {
    const pname = player?.name || "CONSOLE";
    const pid = player?.id || "N/A";
    debug.i("CMD", `trigger by ${pname}(${pid}): "${message}"`);
    let commandInfo = this.list[message];
    if (commandInfo !== undefined) {
      if (commandInfo.moduleId && !moduleGuard(commandInfo.moduleId)) {
        debug.w("CMD", `blocked: module ${commandInfo.moduleId} disabled for ${pname}`);
        if (player) Msg.error(`该命令所属模块已禁用: ${commandInfo.moduleId}`, player);
        return;
      }
      if (!this.canExecute(player, commandInfo.permission)) {
        debug.w("CMD", `permission denied: ${pname} needs ${commandInfo.permission} for "${message}"`);
        if (player) Msg.error(`你没有执行此条指令的权限。`, player);
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
    if (player) Msg.error(`未知的命令! 发送\'!help\'查询所有指令。`, player);
    return;
  }

  /**
   * 注册帮助指令，在初始化时调用
   */
  static registerHelpCommand() {
    this.register(
      "help",
      "help.see",
      (player: Player | undefined) => {
        let result = "当前可用指令列表如下：§r\n";
        for (let command in this.list) {
          if (this.canExecute(player, this.list[command].permission)) {
            result += `  ${command} - ${this.list[command].description}\n`;
          }
        }
        return result;
      },
      "获取所有指令"
    );
  }

  /**
   * 注册脚本事件，在初始化时调用
   */
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
