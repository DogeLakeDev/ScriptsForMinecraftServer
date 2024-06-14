import { forms, menuItems } from "../data/menu/index";
import { Permission } from "../core/Permission";
import { Player, world } from "@minecraft/server";
import * as MCUI from "@minecraft/server-ui";
import { logger } from "../libs/Tools";
import { Command } from "../core/Command";

export class Menu{
    /**
     * 
     * @param {Player} player 
     * @param {string} formName 
     */
    static show(player, formName){
        let formData = forms[formName];
        if(formData === undefined){
            player.sendMessage("菜单不存在");
            return;
        }
        if(formData["permission"] > Permission.getPermission(player)){
            player.sendMessage("你没有查看该菜单的权限");
            return;
        }
        if(formData["buttons"] === undefined || formData["buttons"].length === 0){
            player.sendMessage("这个菜单没有按钮^ ^");
            return;
        }

        // 构建菜单
        const form = new MCUI.ActionFormData()
        form.title(formData["title"]);
        form.body(formData["content"]);
        
        for(let button of formData["buttons"]){
            form.button(button["title"], button["image"] === "" ? undefined : button["image"]);
        }

        form.show(player).then((response) => {
            if(response.canceled || response.selection === undefined) return;
            if(response.selection >= formData.length) return;
            this.clickButton(player, formData["buttons"][response.selection]["onClick"])
        });
    }

    /**
     * 按下某个按钮
     * @param {{type:String; run: String}} data
     * @param {Player} player 
     */
    static clickButton(player, data){
        switch(data.type){
            case "playerCmd": player.runCommand(data.run); break;
            case "scriptCmd": Command.trigger(player, data.run); break;
            case "form": this.show(player, data.run); break;
            default: break;
        }
    }
    static registerMenuItem(){
        world.afterEvents.itemUseOn.subscribe((event)=>{
            if(menuItems.includes(event.itemStack.typeId)){
                this.show(event.source, "main");
            }
        })
    }
}

Menu.registerMenuItem();