import { Player, system } from "@minecraft/server";
import { shopData, ShopItemData, ShopRoot, ShopGroup, ShopExam } from "../data/Shop";
import { ActionFormData, ModalFormData, ModalFormDataToggleOptions } from "@minecraft/server-ui";
import { Command } from "../core/Command";
import { Permission } from "../core/Permission";
import { Money } from "../core/Money";

type ShopNode = ShopRoot | ShopGroup | ShopExam;

export class FormShop {
    static getNameByData(data: ShopNode): any[] {
        if (data.type === "exam") {
            const exam = data as ShopExam;
            if (exam.name !== undefined && exam.name !== "") {
                return [
                    { text: "§l" },
                    { translate: exam.name },
                    { text: `\n§r§l§a$${exam.data.money}` }
                ];
            } else {
                return [
                    { text: "§l" },
                    { translate: exam.data.type },
                    { text: `\n§r§l§a$${exam.data.money}` }
                ];
            }
        } else {
            return [{ text: data.name }];
        }
    }

    static showFormMain(player: Player): void {
        const form = new ActionFormData();
        form.title("商店");

        for (const root of shopData) {
            form.button({ rawtext: FormShop.getNameByData(root) }, root.image);
        }

        form.show(player).then((res) => {
            if (res.selection !== undefined && res.selection < shopData.length) {
                FormShop.showForm(player, shopData[res.selection], [res.selection], shopData[res.selection].sell);
            }
        });
    }

    static showForm(player: Player, formData: ShopNode | undefined, callList: number[], isSell: boolean): void {
        if (formData === undefined) {
            player.sendMessage("分类不存在^ ^");
            return;
        }
        if (formData.type === "group" || formData.type === "root") {
            const form = new ActionFormData();
            form.title({ rawtext: this.getNameByData(formData) });

            if (callList.length >= 1) {
                form.button("返回上一页");
            }

            const data = (formData as ShopRoot | ShopGroup).data!;
            for (const item of data) {
                form.button({ rawtext: this.getNameByData(item) }, item.image);
            }

            form.show(player).then((res) => {
                if (res.canceled) return;

                let selection = res.selection!;
                if (callList.length >= 1) {
                    if (selection === 0) {
                        if (callList.length === 1) {
                            this.showFormMain(player);
                        } else {
                            const newList = callList.slice(0, callList.length - 1);
                            const preForm = this.getFormDataByCallList(newList);
                            this.showForm(player, preForm, newList, isSell);
                        }
                        return;
                    }
                    selection--;
                }

                if (selection < data.length) {
                    const newList = [...callList, selection];
                    this.showForm(player, data[selection], newList, isSell);
                }
            });
        } else if (formData.type === "exam") {
            const examData = formData as ShopExam;
            const form = new ModalFormData();
            const itemName = this.getNameByData(examData);
            form.title({ rawtext: itemName.slice(0, 2) });

            form.textField(
                { rawtext: [
                    { text: "\n 名称: " },
                    { translate: examData.data.type },
                    { text: `\n 价格: ${examData.data.money}` },
                    { text: `\n 特殊值: ${examData.data.aux}` },
                    { text: `\n 备注: ${examData.data.remark}\n\n` }
                ] },
                `输入${isSell ? "售出" : "买入"}数量`
            );
            form.toggle("取消并返回上一页", { defaultValue: false });
            form.submitButton("确 认");

            form.show(player).then((res) => {
                if (res.canceled) return;
                if (res.formValues![1] === true) {
                    if (callList.length === 1) {
                        this.showFormMain(player);
                    } else {
                        const newList = callList.slice(0, callList.length - 1);
                        const preForm = this.getFormDataByCallList(newList);
                        this.showForm(player, preForm, newList, isSell);
                    }
                } else {
                    const amount = parseInt(res.formValues![0] as string);

                    if (amount !== undefined && !Number.isNaN(amount)) {
                        this.trade(player, examData.data, amount, isSell, itemName);
                    } else {
                        player.sendMessage("无效的数字");
                    }
                }
            });
        } else {
            player.sendMessage("未知的商店类型: " + (formData as any).type);
        }
    }

    static getFormDataByCallList(callList: number[]): ShopNode {
        let data: any = shopData;
        let isRoot = true;
        for (const index of callList) {
            if (isRoot) {
                data = data[index];
                isRoot = false;
            } else {
                data = data.data[index];
            }
        }
        return data;
    }

    static trade(player: Player, data: ShopItemData, amount: number, isSell: boolean, itemName: any[]): void {
        const tempEntity = player.dimension.spawnEntity("doge:shop_aux_item", player.location);
        tempEntity.runCommand(`replaceitem entity @s slot.inventory 0 ${data.type} 1 ${data.aux}`);
        system.runTimeout(() => {
            const tempContainer = tempEntity.getComponent("inventory")!.container!;
            const targetItem = tempContainer.getItem(0)!;

            if (isSell) {
                let remainingAmount = amount;
                const playerContainer = player.getComponent("inventory")!.container!;
                for (let i = 0; i < playerContainer.size; i++) {
                    const playerItem = playerContainer.getItem(i);
                    if (playerItem !== undefined && playerItem.isStackableWith(targetItem)) {
                        if (remainingAmount >= playerItem.amount) {
                            remainingAmount -= playerItem.amount;
                            playerContainer.setItem(i);
                        } else {
                            const newItem = playerItem.clone();
                            newItem.amount = playerItem.amount - remainingAmount;
                            playerContainer.setItem(i, newItem);
                            remainingAmount = 0;
                            break;
                        }
                    }
                    if (remainingAmount === 0) break;
                }
                tempEntity.triggerEvent("despawn");

                const successAmount = amount - remainingAmount;

                if (successAmount > 0) {
                    const price = data.money * successAmount;
                    const preMoney = Money.get(player);
                    Money.set(player, preMoney + price);
                    system.runTimeout(() => {
                        const rawtext: any[] = [{ text: `[商店] 卖出 §e§l${successAmount}§r 个 §e` }];
                        rawtext.push(itemName[0]);
                        rawtext.push(itemName[1]);
                        rawtext.push({ text: `§r , 获得 §a$${price}§r , 当前 §a$${Money.get(player)}§r` });

                        player.sendMessage({ rawtext: rawtext });
                    }, 1);
                } else {
                    player.sendMessage({ rawtext: [
                        { text: "§c你没有足够的 " },
                        itemName[1],
                        { text: " ^ ^" }
                    ] });
                }
            } else {
                const price = amount * data.money;
                const playerMoney = Money.get(player);
                if (playerMoney < price) {
                    player.sendMessage("§c你没有足够的 $ ");
                    return;
                }

                let remainingAmount = amount;
                const playerContainer = player.getComponent("inventory")!.container!;
                const maxAmount = targetItem.maxAmount;
                for (let i = 0; i < playerContainer.size; i++) {
                    const playerItem = playerContainer.getItem(i);
                    if (playerItem === undefined) {
                        if (remainingAmount >= maxAmount) {
                            const newItem = targetItem.clone();
                            newItem.amount = maxAmount;
                            playerContainer.setItem(i, newItem);
                            remainingAmount -= maxAmount;
                        } else {
                            const newItem = targetItem.clone();
                            newItem.amount = remainingAmount;
                            playerContainer.setItem(i, newItem);
                            remainingAmount = 0;
                            break;
                        }
                    } else if (playerItem.isStackableWith(targetItem)) {
                        const space = maxAmount - playerItem.amount;

                        if (space > 0) {
                            if (space <= remainingAmount) {
                                const newItem = targetItem.clone();
                                newItem.amount = maxAmount;
                                playerContainer.setItem(i, newItem);
                                remainingAmount -= space;
                            } else {
                                const newItem = playerItem.clone();
                                newItem.amount = playerItem.amount + remainingAmount;
                                playerContainer.setItem(i, newItem);
                                remainingAmount = 0;
                                break;
                            }
                        }
                    }

                    if (remainingAmount === 0) break;
                }

                const successAmount = amount - remainingAmount;
                if (successAmount > 0) {
                    const truePrice = data.money * successAmount;
                    const preMoney = Money.get(player);
                    Money.set(player, preMoney - truePrice);
                    system.runTimeout(() => {
                        const rawtext: any[] = [{ text: `[商店] 买入 §e§l${successAmount}§r 个 §e` }];
                        rawtext.push(itemName[0]);
                        rawtext.push(itemName[1]);
                        rawtext.push({ text: `§r , 消耗 §a$${truePrice}§r , 当前 §a$${Money.get(player)}§r` });

                        player.sendMessage({ rawtext: rawtext });
                    }, 1);
                } else {
                    player.sendMessage({ rawtext: [
                        { text: "§c你没有足够的空位 ^ ^" }
                    ] });
                }
            }
        }, 1);
    }

    static registerScriptCommand(): void {
        Command.register("shop", Permission.Any, FormShop.showFormMain, "打开商店");
    }
}

FormShop.registerScriptCommand();
