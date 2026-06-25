import { system } from "@minecraft/server";
import { Permission } from "./Permission";
export class Command {
    static register(name, permission, callback, description) {
        if (this.list[name] === undefined) {
            this.list[name] = {
                callback: callback,
                permission: permission,
                description: description === undefined ? name : description
            };
            return false;
        }
        return false;
    }
    static trigger(player, message) {
        const commandInfo = this.list[message];
        if (commandInfo !== undefined) {
            if (Permission.getPermission(player) >= commandInfo.permission) {
                system.run(() => {
                    const result = commandInfo.callback(player);
                    if (result !== undefined) {
                        player.sendMessage(`${result}`);
                    }
                });
                return;
            }
            else {
                player.sendMessage(`§c你没有执行此条指令的权限。`);
                return;
            }
        }
        player.sendMessage(`§c未知的命令! 发送\"!help\"查询所有指令。`);
        return;
    }
    static registerHelpCommand() {
        this.register("help", Permission.Any, (player) => {
            let result = "";
            const permission = Permission.getPermission(player);
            for (const command in this.list) {
                if (this.list[command].permission <= permission) {
                    result += `${command} - ${this.list[command].description}\n`;
                }
            }
            return result;
        }, "获取所有指令");
    }
    static registerScriptEvent() {
        system.afterEvents.scriptEventReceive.subscribe((event) => {
            if (event.sourceEntity === undefined)
                return;
            this.trigger(event.sourceEntity, event.id.substring(5));
        }, { namespaces: ["doge"] });
    }
}
Command.list = {};
Command.registerScriptEvent();
//# sourceMappingURL=Command.js.map