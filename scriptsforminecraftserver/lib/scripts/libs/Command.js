import { system } from "@minecraft/server";
import { Permission } from "./Permission";
import { Msg } from "./Tools";
export class Command {
    /**
     * 注册指令
     * @param name 指令名称
     * @param permission 权限等级(数字) 或 权限名(字符串)
     * @param callback 回调
     * @param description 指令描述
     */
    static register(name, permission, callback, description) {
        if (this.list[name] === undefined) {
            this.list[name] = {
                callback: callback,
                permission: permission,
                description: description === undefined ? name : description,
            };
        }
        return false;
    }
    /**
     * 检查玩家是否有权限执行该命令
     */
    static canExecute(player, permission) {
        if (player === undefined)
            return true;
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
    static trigger(player, message) {
        let commandInfo = this.list[message];
        if (commandInfo !== undefined) {
            if (this.canExecute(player, commandInfo.permission)) {
                system.run(async () => {
                    const result = await commandInfo.callback(player);
                    if (result !== undefined && player)
                        Msg.success(`${result}`, player);
                });
                return;
            }
            if (player)
                Msg.error(`你没有执行此条指令的权限。`, player);
            return;
        }
        if (player)
            Msg.error(`未知的命令! 发送\'!help\'查询所有指令。`, player);
        return;
    }
    /**
     * 注册帮助指令，在初始化时调用
     */
    static registerHelpCommand() {
        this.register("help", "help.see", (player) => {
            let result = "当前可用指令列表如下：§r\n";
            for (let command in this.list) {
                if (this.canExecute(player, this.list[command].permission)) {
                    result += `  ${command} - ${this.list[command].description}\n`;
                }
            }
            return result;
        }, "获取所有指令");
    }
    /**
     * 注册脚本事件，在初始化时调用
     */
    static registerScriptEvent() {
        system.afterEvents.scriptEventReceive.subscribe((event) => {
            this.trigger(event.sourceEntity, event.id.substring(5));
        }, { namespaces: ["doge"] });
    }
}
Command.list = {};
Command.registerScriptEvent();
//# sourceMappingURL=Command.js.map