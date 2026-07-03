/* ---------------------------------------- *\
 *  Name        :  菜单                      *
 *  Description :  菜单                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { forms, menuItems } from "../data/menu/index";
import { Permission } from "../libs/Permission";
import { world } from "@minecraft/server";
import { Gui } from "../libs/Gui";
import { Command } from "../libs/Command";
// 注册权限
Permission.register('menu.use', Permission.Any);
export class Menu {
    /**
     * @param player
     * @param formName
     */
    static show(player, formName) {
        let formData = forms[formName];
        if (formData === undefined) {
            player.sendMessage("菜单不存在");
            return;
        }
        if (formData["permission"] > Permission.getPermission(player)) {
            player.sendMessage("你没有查看该菜单的权限");
            return;
        }
        if (formData["buttons"] === undefined || formData["buttons"].length === 0) {
            player.sendMessage("这个菜单没有按钮^ ^");
            return;
        }
        // 构建菜单
        const form = Gui.simpleForm(formData["title"], formData["content"]);
        for (let button of formData["buttons"]) {
            form.button(button["title"], button["image"] === "" ? undefined : button["image"]);
        }
        form.show(player).then((response) => {
            if (response.canceled || response.selection === undefined)
                return;
            if (response.selection >= formData.length)
                return;
            this.clickButton(player, formData["buttons"][response.selection]["onClick"]);
        });
    }
    /**
     * 按下某个按钮
     */
    static clickButton(player, data) {
        switch (data.type) {
            case "playerCmd":
                player.runCommand(data.run);
                break;
            case "scriptCmd":
                Command.trigger(player, data.run);
                break;
            case "form":
                this.show(player, data.run);
                break;
            default: break;
        }
    }
    static registerMenuItem() {
        world.afterEvents.itemUseOn.subscribe((event) => {
            if (menuItems.includes(event.itemStack.typeId)) {
                this.show(event.source, "main");
            }
        });
    }
}
Menu.registerMenuItem();
//# sourceMappingURL=Menu.js.map