import { forms } from "../data/menu";
import { Permission } from "../core/Permission";
import { Player } from "@minecraft/server";
import * as MCUI from "@minecraft/server-ui";

export class Menu{
    /**
     * 
     * @param {Player} player 
     * @param {string} formName 
     */
    static show(player, formName){
        let formData = forms[formName];
        if(formData.permission === undefined){
            player.sendMessage("菜单不存在");
            return;
        }
        if(formData.permission > Permission.getPermission(player)){
            player.sendMessage("你没有查看该菜单的权限");
            return;
        }

        // 构建菜单
        const form = new MCUI.ActionFormData()
        
    }
}