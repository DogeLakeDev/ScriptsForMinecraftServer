import { Player, system } from "@minecraft/server";
import { Permission } from "./Permission";

interface CommandEntry {
    callback: (player: Player) => string | undefined | void;
    permission: number;
    description: string;
}

export class Command {
    static list: Record<string, CommandEntry> = {};

    static register(
        name: string,
        permission: number,
        callback: (player: Player) => string | undefined | void,
        description?: string
    ): false | undefined {
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

    static trigger(player: Player, message: string): void {
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
            } else {
                player.sendMessage(`§c你没有执行此条指令的权限。`);
                return;
            }
        }
        player.sendMessage(`§c未知的命令! 发送\"!help\"查询所有指令。`);
        return;
    }

    static registerHelpCommand(): void {
        this.register("help", Permission.Any,
            (player) => {
                let result = "";
                const permission = Permission.getPermission(player);
                for (const command in this.list) {
                    if (this.list[command].permission <= permission) {
                        result += `${command} - ${this.list[command].description}\n`;
                    }
                }
                return result;
            },
            "获取所有指令"
        );
    }

    static registerScriptEvent(): void {
        system.afterEvents.scriptEventReceive.subscribe((event) => {
            if (event.sourceEntity === undefined) return;
            this.trigger(event.sourceEntity as Player, event.id.substring(5));
        }, { namespaces: ["doge"] });
    }
}

Command.registerScriptEvent();
