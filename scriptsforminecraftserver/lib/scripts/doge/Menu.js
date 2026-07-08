import { forms, menuItems } from "../data/menu/index";
import { Permission } from "../libs/Permission";
import { world } from "@minecraft/server";
import { Gui } from "../libs/Gui";
import { CustomForm } from "@minecraft/server-ui";
import { Command } from "../libs/Command";
export class Menu {
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
        const form = new CustomForm(player, formData["title"]);
        if (formData["content"])
            form.label(formData["content"]);
        for (let btn of formData["buttons"]) {
            const data = btn["onClick"];
            form.button(btn["title"] || "", () => {
                this.clickButton(player, data);
            });
        }
        form.closeButton();
        Gui.showForm(player, form, formData["title"]);
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
        try {
            world.afterEvents.itemUseOn?.subscribe((event) => {
                if (menuItems.includes(event.itemStack.typeId)) {
                    this.show(event.source, "main");
                }
            });
        }
        catch { }
    }
}
export function init() {
    Menu.registerMenuItem();
}
//# sourceMappingURL=Menu.js.map