import {
  CommandPermissionLevel,
  CustomCommandStatus,
  Player,
  system,
  type CustomCommandOrigin,
  type CustomCommandParamType,
  type CustomCommandParameter,
  type CustomCommandRegistry,
} from "@minecraft/server";
import { debug } from "./debug-log.js";
import { Msg } from "./msg.js";
import { Permission } from "./permission.js";

interface GlobalCommandState {
  list: Record<string, CommandEntry>;
  deductCost: ((player: Player, amount: number, commandName: string) => Promise<boolean>) | null;
  moduleGuard: (moduleId: string) => boolean;
}

const gCommandState: GlobalCommandState = (((globalThis as unknown as Record<string, unknown>)
  .__sfmcCommandState as GlobalCommandState) ??= {
  list: {},
  deductCost: null,
  moduleGuard: () => true,
});

/** 可选扩展点：`Command.trigger` 执行前检查所属模块是否启用。install 冷启动模型下不注入。 */
export function setModuleGuard(guard: (moduleId: string) => boolean): void {
  gCommandState.moduleGuard = guard;
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

/** 原生命令的单个枚举参数声明。 */
export type CommandEnumParameter = {
  /** 参数在命令补全中的名称。 */
  name: string;
  /** 可选值；由 Bedrock 原生命令补全展示。 */
  values: string[];
  /** 是否允许省略该参数。 */
  optional?: boolean;
};

/** 原生命令名称、别名与参数选项。 */
export type CommandOptions = {
  /** 与主命令执行同一回调的短别名。 */
  aliases?: string[];
  /** 当前支持的枚举参数。 */
  enumParameter?: CommandEnumParameter;
};

/** 已注册指令的元数据与回调。 */
export type CommandEntry = {
  /** 指令执行回调。 */
  callback: Function;
  /** 所需权限等级（数字）或权限名（字符串）。 */
  permission: number | string;
  /** 指令说明（`/c:help` 展示）。 */
  description: string;
  /** 所属模块 id；用于 moduleGuard 拦截已禁用模块。 */
  moduleId?: string;
  /** 可选执行费用。 */
  cost?: CommandCost;
  /** 原生命令别名与参数选项。 */
  options?: CommandOptions;
};

/** 游戏内原生自定义指令的声明表与触发器。 */
export class Command {
  /** 已注册指令表（名称 → 条目）。 */
  static get list(): Record<string, CommandEntry> {
    return gCommandState.list;
  }
  static set list(value: Record<string, CommandEntry>) {
    gCommandState.list = value;
  }
  /** 费用扣减回调；由 Economy 模块在启动时注入。 */
  static get deductCost(): ((player: Player, amount: number, commandName: string) => Promise<boolean>) | null {
    return gCommandState.deductCost;
  }
  static set deductCost(value: ((player: Player, amount: number, commandName: string) => Promise<boolean>) | null) {
    gCommandState.deductCost = value;
  }

  /**
   * 声明一条游戏内原生自定义指令。
   *
   * @param name 指令名称（不含 `c:` 命名空间）。
   * @param permission 执行该指令所需的权限等级数值或命名权限字符串。
   * @param callback 指令执行回调，接收玩家对象及原生命令参数。
   * @param description 指令功能描述，用于 `/c:help` 展示；缺省时回退为指令名称。
   * @param moduleId 所属模块的唯一标识符；仅用于模块启停守卫和命令说明，不参与公开命令命名。
   * @param cost 可选的指令执行扣费规则。
   * @param options 可选的原生命令别名与参数声明。
   * @returns 注册成功始终返回 `true`。
   */
  static register(
    name: string,
    permission: number | string,
    callback: (player: Player | undefined, ...args: unknown[]) => any,
    description?: string,
    moduleId?: string,
    cost?: CommandCost,
    options?: CommandOptions
  ) {
    const entry: CommandEntry = {
      callback,
      permission,
      description: description === undefined ? name : description,
    };
    if (moduleId !== undefined) entry.moduleId = moduleId;
    if (cost !== undefined) entry.cost = cost;
    if (options !== undefined) entry.options = options;
    this.list[name] = entry;
    debug.i("CMD", `register "${name}" perm=${permission} mod=${moduleId || "-"} cost=${cost?.amount || 0}`);
    return true;
  }

  /**
   * 注销指定的指令。
   *
   * @param name 要注销的指令名称。
   * @returns 若指令存在且成功删除返回 `true`，否则返回 `false`。
   */
  static unregister(name: string): boolean {
    const canonicalName = this.resolveName(name);
    if (canonicalName !== undefined) {
      delete this.list[canonicalName];
      return true;
    }
    return false;
  }

  /**
   * 按模块 id 批量注销该模块名下的所有指令。
   *
   * @param moduleId 模块唯一标识符。
   * @returns 实际被注销的指令条数。
   */
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

  /**
   * 判断指定指令是否已注册。
   *
   * @param name 指令名称。
   */
  static has(name: string): boolean {
    return this.resolveName(name) !== undefined;
  }

  /** 获取所有已注册指令的名称列表。 */
  static names(): string[] {
    return Object.keys(this.list);
  }

  /** 获取已注册指令的只读快照列表（沙箱装载清单及管理界面使用）。 */
  static entries(): {
    name: string;
    permission: number | string;
    description: string;
    moduleId?: string;
    aliases?: string[];
  }[] {
    return Object.entries(this.list)
      .map(([name, e]) => ({
        name,
        permission: e.permission,
        description: e.description,
        ...(e.moduleId !== undefined ? { moduleId: e.moduleId } : {}),
        ...(e.options?.aliases !== undefined ? { aliases: [...e.options.aliases] } : {}),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 获取指定指令所属的模块 id。
   *
   * @param name 指令名称。
   * @returns 若指定了所属模块则返回其 id，否则返回 `undefined`。
   */
  static getModuleId(name: string): string | undefined {
    const canonicalName = this.resolveName(name);
    return canonicalName === undefined ? undefined : this.list[canonicalName]?.moduleId;
  }

  private static resolveName(name: string): string | undefined {
    if (this.list[name] !== undefined) return name;
    return Object.entries(this.list).find(([, entry]) => entry.options?.aliases?.includes(name))?.[0];
  }

  private static canExecute(player: Player | undefined, permission: number | string): boolean {
    if (player === undefined) return true;
    if (typeof permission === "string") {
      return Permission.check(player, permission);
    }
    return Permission.getPermission(player) >= permission;
  }

  /**
   * 触发指令执行流程：依次校验模块守卫、权限与费用后执行回调。
   *
   * @param player 触发指令的玩家对象，控制台触发时为 `undefined`。
   * @param message 玩家输入的指令字符串（不含前缀）。
   */
  static trigger(player: Player | undefined, message: string, ...args: unknown[]) {
    const pname = player?.name || "CONSOLE";
    const pid = player?.id || "N/A";
    debug.i("CMD", `trigger by ${pname}(${pid}): "${message}"`);
    const canonicalName = this.resolveName(message);
    const commandInfo = canonicalName === undefined ? undefined : this.list[canonicalName];
    if (commandInfo !== undefined) {
      if (commandInfo.moduleId && !gCommandState.moduleGuard(commandInfo.moduleId)) {
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
          const ok = await this.deductCost(player, commandInfo.cost.amount, canonicalName ?? message);
          if (!ok) {
            debug.w("CMD", `cost deduct failed: ${pname} needs ${commandInfo.cost.amount} for "${message}"`);
            Msg.error(`余额不足，无法执行该指令（需要 ${commandInfo.cost.amount}）。`, player);
            return;
          }
          debug.i("CMD", `cost deducted ${commandInfo.cost.amount} from ${pname} for "${message}"`);
        }
        debug.d("CMD", `executing "${message}" for ${pname}`);
        const result = await commandInfo.callback(player, ...args);
        if (result !== undefined && player) debug.d("CMD", `result for "${message}": ${result}`);
        if (result !== undefined && player) Msg.success(`${result}`, player);
      });
      return;
    }
    debug.w("CMD", `unknown command "${message}" from ${pname}`);
    if (player) Msg.error("未知的命令！发送 '/c:help' 查询所有指令。", player);
  }

  /** 注册内置 `/c:help` 指令，列出当前玩家有权限的指令。 */
  static registerHelpCommand() {
    Permission.register("help.see", Permission.Any);
    Permission.register("permlist.see", Permission.Admin);
    this.register(
      "help",
      "help.see",
      (player: Player | undefined, action?: unknown) => {
        if (action === "permissions") {
          if (!player || !Permission.check(player, "permlist.see")) {
            if (player) Msg.error("你没有查看权限列表的权限。", player);
            return;
          }
          return Permission.formatRegistry();
        }
        let result = "当前可用指令列表如下：§r\n";
        for (const command in this.list) {
          const entry = this.list[command];
          if (entry && this.canExecute(player, entry.permission)) {
            const parameter = entry.options?.enumParameter;
            const suffix = parameter
              ? ` ${parameter.optional ? "[" : "<"}${parameter.values.join("|")}${parameter.optional ? "]" : ">"}`
              : "";
            const aliases = entry.options?.aliases?.map((alias) => `/${this.nativeName(alias)}${suffix}`).join("、");
            result += `  /${this.nativeName(command)}${suffix}${aliases ? `（别名 ${aliases}）` : ""} - ${entry.description}\n`;
          }
        }
        return result;
      },
      "获取所有指令",
      undefined,
      undefined,
      {
        aliases: ["h"],
        enumParameter: { name: "section", values: ["permissions"], optional: true },
      }
    );
  }

  /** 生成统一的原生命令名：所有命令均公开为 `c:name`。 */
  static nativeName(name: string): string {
    return `c:${name}`;
  }

  /** 在 startup early-execution 阶段把全部声明提交给原生命令注册表。 */
  static registerNativeCommands(registry: CustomCommandRegistry): void {
    for (const [name, entry] of Object.entries(this.list)) {
      const enumParameter = entry.options?.enumParameter;
      let parameter: CustomCommandParameter | undefined;
      if (enumParameter) {
        const enumName = this.nativeName(`${name}_${enumParameter.name}`);
        registry.registerEnum(enumName, enumParameter.values);
        parameter = { name: enumParameter.name, type: "Enum" as CustomCommandParamType, enumName };
      }
      for (const publicName of [name, ...(entry.options?.aliases ?? [])]) {
        const nativeName = this.nativeName(publicName);
        registry.registerCommand(
          {
            name: nativeName,
            description: entry.moduleId ? `${entry.description} - §7${entry.moduleId}` : entry.description,
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
            ...(parameter
              ? enumParameter?.optional
                ? { optionalParameters: [parameter] }
                : { mandatoryParameters: [parameter] }
              : {}),
          },
          (origin: CustomCommandOrigin, ...args: unknown[]) => {
            this.trigger(origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined, name, ...args);
            return { status: CustomCommandStatus.Success };
          }
        );
        debug.i("CMD", `native register "/${nativeName}"`);
      }
    }
  }
}
