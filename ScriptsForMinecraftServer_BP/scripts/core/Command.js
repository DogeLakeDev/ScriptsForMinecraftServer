import { Player, system } from "@minecraft/server";
import { Permission } from "./Permission";
import { logger } from "../libs/Tools";

export class Command{
    static list = {
    };

    /**
     * 
     * @param {String} name 
     * @param {Permission} permission 
     * @param {Function} callback 
     * @param {String|undefined} [description=undefined] 
     */
    static register(name, permission, callback, description=undefined){
        if(this.list[name] === undefined){
            this.list[name] = {
                "callback" : callback,
                "permission": permission,
                "description": description===undefined ? name : description
            };
        }
        return false;
    }

    /**
     * @param {Player} player 
     * @param {String} message 
     */
    static trigger(player, message){
        let commandInfo = this.list[message];
        if(commandInfo !== undefined){
            if(Permission.getPermission(player) >= commandInfo.permission){
                system.run(()=>{
                    let result = commandInfo.callback(player);
                    if(result !== undefined){
                        player.sendMessage(`${result}`);
                    }
                });
                return;
            }
            else{
                player.sendMessage(`§c你没有执行此条指令的权限。`);
                return;
            }
        }
        player.sendMessage(`§c未知的命令! 发送\"!help\"查询所有指令。`);
        return;
    }

    static registerHelpCommand(){
        this.register("help", Permission.Any, 
            /**
             * @param {Player} player 
             */
            (player) => {
                let result = "";
                let permission = Permission.getPermission(player);
                for(let command in this.list){
                    if(this.list[command].permission <= permission){
                        result += `${command} - ${this.list[command].description}\n`
                    }
                }
                return result;
            },
            "获取所有指令"
        );
    }

    static registerScriptEvent(){
        system.afterEvents.scriptEventReceive.subscribe((event)=>{
            if(event.sourceEntity===undefined) return;
            this.trigger(event.sourceEntity, event.id.substring(5));
        }, {"namespaces": ["doge"]})
    }
}

Command.registerScriptEvent();

