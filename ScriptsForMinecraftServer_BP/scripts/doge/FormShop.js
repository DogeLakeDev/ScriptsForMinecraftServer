import { ItemStack, Player, system } from "@minecraft/server";
import { shopData } from "../data/Shop";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { Command } from "../core/Command";
import { Permission } from "../core/Permission";
import { Money } from "../core/Money";

import { logger } from "../libs/Tools";

export class FormShop{
    /**
     * 由物品/编组信息获取显示名称
     * @param {Object} data 
     * @returns {Object[]}
     */
    static getNameByData(data){
        if(data["type"] === "exam"){
            if(data["name"] != undefined && data["name"] != ""){
                return [{"text": `§l`}, {"translate": data["name"]},
                        {"text": `\n§r§l§a$${data["data"]["money"]}`}];
            }
            else{
                return [{"text": `§l`}, {"translate": data["data"]["type"]},
                        {"text": `\n§r§l§a$${data["data"]["money"]}`}];
            }
        }
        else{
            return [{"text": data["name"]}];
        }
    }
    /**
     * 
     * @param {Player} player 
     */
    static showFormMain(player){
        let form = new ActionFormData();
        form.title("商店");

        for(let root of shopData){
            form.button({"rawtext": FormShop.getNameByData(root)}, root["image"]);
        }

        form.show(player).then((res)=>{
            if(res.selection < shopData.length){
                FormShop.showForm(player, shopData[res.selection], [res.selection], shopData[res.selection]["sell"]);
                return;
            }
        });
    }

    /**
     * 
     * @param {Player} player 
     * @param {Object} formData 
     * @param {String[]} callList 到这一步经过的组 包含当前显示的组
     * @param {boolean} isSell 是否是售出表单
     */
    static showForm(player, formData, callList, isSell){
        if(formData === undefined){
            player.sendMessage("分类不存在^ ^");
            return;
        }
        if(formData["type"] === "group" || formData["type"] === "root"){
            let form = new ActionFormData();
            form.title({"rawtext": this.getNameByData(formData)});
            
            if(callList.length >= 1){
                form.button("返回上一页");
            }

            let data = formData["data"];
            for(let item of data){
                form.button({"rawtext": this.getNameByData(item)}, item["image"]);
            }

            form.show(player).then((res)=>{
                if(res.canceled) return;

                let selection = res.selection;
                if(callList.length >= 1){
                    if(selection === 0){
                        if(callList.length === 1){
                            this.showFormMain(player);
                        }
                        else{
                            let newList = callList.slice(0, callList.length - 1);
                            let preForm = this.getFormDataByCallList(newList);
                            this.showForm(player, preForm, newList, isSell);
                        }
                        return;
                    }
                    selection--;
                }
                
                if(selection < data.length){
                    let newList = callList;
                    newList.push(selection);
    
                    this.showForm(player, data[selection], newList, isSell);
                }
            });
        }
        else if(formData["type"] === "exam"){
            let form = new ModalFormData();
            let itemName = this.getNameByData(formData);
            form.title({"rawtext": itemName.slice(0, 2)});

            form.textField(
                {"rawtext": [
                    {"text": "\n 名称: "}, {"translate": formData["data"]["type"]},
                    {"text": `\n 价格: ${formData["data"]["money"]}`},
                    {"text": `\n 特殊值: ${formData["data"]["aux"]}`},
                    {"text": `\n 备注: ${formData["data"]["remark"]}\n\n`}
                ]},
                `输入${isSell?"售出":"买入"}数量`
            );
            form.toggle("取消并返回上一页", false);
            form.submitButton("确 认");
            
            form.show(player).then((res)=>{
                if(res.canceled) return;
                if(res.formValues[1]===true){
                    if(callList.length === 1){
                        this.showFormMain(player);
                    }
                    else{
                        let newList = callList.slice(0, callList.length - 1);
                        let preForm = this.getFormDataByCallList(newList);
                        this.showForm(player, preForm, newList, isSell);
                    }
                }
                else{
                    let amount = parseInt(res.formValues[0]);

                    if(amount !== undefined && !Number.isNaN(amount)){
                        this.trade(player, formData["data"], amount, isSell, itemName);
                    }
                    else{
                        player.sendMessage("无效的数字");
                    }
                }
            })
        }
        else{
            player.sendMessage("未知的商店类型: " + formData["type"]);
        }
    }
    /**
     * 返回上一页的数据，必定是组/根
     * @param {Number[]} callList 
     * @returns {Object}
     */
    static getFormDataByCallList(callList){
        let data = shopData;
        let isRoot = true;
        for(let index of callList){
            if(isRoot){
                data = data[index];
                isRoot = false;
            }
            else{
                data = data["data"][index];
            }
        }
        return data;
    }
    /**
     * 进行交易
     * @param {Player} player 
     * @param {{type:String; money: Number; aux: Number}} data 
     * @param {Number} amount
     * @param {boolean} isSell
     */
    static trade(player, data, amount, isSell, itemName){
        // 创建模板物品
        let tempEntity = player.dimension.spawnEntity("doge:shop_aux_item", player.location);
        tempEntity.runCommand(`replaceitem entity @s slot.inventory 0 ${data.type} 1 ${data.aux}`);
        system.runTimeout(()=>{
            let tempContainer = tempEntity.getComponent("inventory").container;
            let targetItem = tempContainer.getItem(0);
            
            if(isSell){// 卖出
                let remainingAmount = amount;
                let playerContainer = player.getComponent("inventory").container;
                for(let i = 0; i < playerContainer.size; i++){
                    let playerItem = playerContainer.getItem(i);
                    if(playerItem !== undefined && playerItem.isStackableWith(targetItem)){
                        if(remainingAmount >= playerItem.amount){
                            remainingAmount -= playerItem.amount;
                            playerContainer.setItem(i);
                        }
                        else{
                            let newItem = playerItem.clone()
                            newItem.amount = playerItem.amount - remainingAmount;
                            playerContainer.setItem(i, newItem);
                            remainingAmount = 0;
                            break;
                        }
                    }
                    if(remainingAmount===0) break;
                }
                tempEntity.triggerEvent("despawn");

                let successAmount = amount - remainingAmount;
                
                if(successAmount > 0){
                    let price = data.money * successAmount;
                    let preMoney = Money.get(player);
                    Money.set(player, preMoney + price);
                    system.runTimeout(()=>{
                        let rawtext = [{"text": `[商店] 卖出 §e§l${successAmount}§r 个 §e`}];
                        rawtext.push(itemName[0]);
                        rawtext.push(itemName[1])
                        rawtext.push({"text": `§r , 获得 §a$${price}§r , 当前 §a$${Money.get(player)}§r`});

                        player.sendMessage({"rawtext": rawtext});
                    }, 1);
                }
                else{
                    player.sendMessage({"rawtext":[
                        {"text": "§c你没有足够的 "},
                        itemName[1],
                        {"text": " ^ ^"}
                    ]});
                }
            }
            else{// 买入
                // 计算价格
                let price = amount*data.money;
                let playerMoney = Money.get(player);
                if(playerMoney < price){
                    player.sendMessage("§c你没有足够的 $ ");
                    return;
                }

                let remainingAmount = amount;
                let playerContainer = player.getComponent("inventory").container;
                const maxAmount = targetItem.maxAmount;
                for(let i = 0; i < playerContainer.size; i++){
                    let playerItem = playerContainer.getItem(i);
                    if(playerItem === undefined){
                        if(remainingAmount >= maxAmount){
                            let newItem = targetItem.clone();
                            newItem.amount = maxAmount;
                            playerContainer.setItem(i, newItem);
                            remainingAmount -= maxAmount
                        }
                        else{
                            let newItem = targetItem.clone();
                            newItem.amount == remainingAmount;
                            playerContainer.setItem(i, newItem);
                            remainingAmount = 0;
                            break;
                        }
                    }
                    else if(playerItem.isStackableWith(targetItem)){
                        let space = maxAmount - playerItem.amount;

                        if(space > 0){
                            if(space <= remainingAmount){
                                let newItem = targetItem.clone();
                                newItem.amount = maxAmount;
                                playerContainer.setItem(i, newItem);
                                remainingAmount -= space;
                            }
                            else{
                                let newItem = playerItem.clone();
                                newItem.amount += remainingAmount;
                                playerContainer.setItem(i, newItem);
                                remainingAmount = 0;
                                break;
                            }
                        }
                    }

                    if(remainingAmount===0) break;
                }

                let successAmount = amount - remainingAmount;
                if(successAmount > 0){
                    let truePrice = data.money * successAmount;
                    let preMoney = Money.get(player);
                    Money.set(player, preMoney - truePrice);
                    system.runTimeout(()=>{
                        let rawtext = [{"text": `[商店] 买入 §e§l${successAmount}§r 个 §e`}];
                        rawtext.push(itemName[0]);
                        rawtext.push(itemName[1])
                        rawtext.push({"text": `§r , 消耗 §a$${truePrice}§r , 当前 §a$${Money.get(player)}§r`});

                        player.sendMessage({"rawtext": rawtext});
                    }, 1);
                }
                else{
                    player.sendMessage({"rawtext":[
                        {"text": "§c你没有足够的空位 ^ ^"}
                    ]});
                }
            }
        }, 1);
    }

    /**
     * 注册命令
     */
    static registerScriptCommand(){
        Command.register("shop", Permission.Any, this.showFormMain, "打开商店");
    }
}

FormShop.registerScriptCommand();