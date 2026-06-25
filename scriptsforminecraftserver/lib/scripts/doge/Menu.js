import { forms } from "../data/menu/index";
import { Permission } from "../core/Permission";
import { world } from "@minecraft/server";
import * as MCUI from "@minecraft/server-ui";
import { Command } from "../core/Command";
export class Menu {
    static show(player, formName) {
        const formData = forms[formName];
        if (formData === undefined) {
            player.sendMessage("菜单不存在");
            return;
        }
        if (formData["permission"] > Permission.getPermission(player)) {
            player.sendMessage("你没有查看该菜单的权限");
            return;
        }
        if (formData.buttons === undefined || formData.buttons.length === 0) {
            player.sendMessage("这个菜单没有按钮^ ^");
            return;
        }
        const form = new MCUI.ActionFormData();
        form.title(formData.title);
        form.body(formData.content || "");
        for (const button of formData.buttons) {
            form.button(button.title, button.image === "" ? undefined : button.image);
        }
        form.show(player).then((response) => {
            if (response.canceled || response.selection === undefined)
                return;
            this.clickButton(player, formData.buttons[response.selection].onClick);
        });
    }
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
            default:
                break;
        }
    }
    static registerMenuItem() {
        world.afterEvents.itemUse.subscribe((event) => {
            if (event.itemStack && menuItems.includes(event.itemStack.typeId)) {
                this.show(event.source, "main");
            }
        });
    }
}
// Re-import for the event subscription
import { menuItems } from "../data/menu/index";
Menu.registerMenuItem();
//# sourceMappingURL=Menu.js.map