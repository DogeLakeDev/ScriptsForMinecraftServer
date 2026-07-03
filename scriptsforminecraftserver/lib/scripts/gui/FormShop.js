/* ---------------------------------------- *\
 *  Name        :  表单商店                   *
 *  Description :  表单商店                   *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { shopData } from "../data/Shop";
import { Gui } from "../libs/Gui";
import { Msg } from "../libs/Tools";
export class FormShop {
    /**
     * 由物品/编组信息获取显示名称
     */
    static getNameByData(data) {
        if (data["type"] === "exam") {
            if (data["name"] !== undefined && data["name"] !== "") {
                return [{ "text": `\u00a7l` }, { "translate": data["name"] },
                    { "text": `\n\u00a7r\u00a7l\u00a7a$${data["data"]["money"]}` }];
            }
            else {
                return [{ "text": `\u00a7l` }, { "translate": data["data"]["type"] },
                    { "text": `\n\u00a7r\u00a7l\u00a7a$${data["data"]["money"]}` }];
            }
        }
        else {
            let total = data["data"]["items"].length;
            if (data["name"] !== undefined && data["name"] !== "") {
                return [{ "text": `\u00a7l` }, { "translate": data["name"] },
                    { "text": `\n\u00a7a$${data["data"]["money"]}\n\u00a77${total}` }];
            }
            else {
                return [{ "text": `\u00a7l` }, { "translate": data["data"]["type"] },
                    { "text": `\n\u00a7a$${data["data"]["money"]}\n\u00a77${total}` }];
            }
        }
    }
    /**
     * @param player
     */
    static showFormMain(player) {
        let form = Gui.simpleForm("商店");
        for (let root of shopData) {
            form.button({ "rawtext": FormShop.getNameByData(root) }, root["image"]);
        }
        form.show(player).then((res) => {
            if (res.selection < shopData.length) {
                FormShop.showForm(player, shopData[res.selection], [res.selection], shopData[res.selection]["sell"]);
                return;
            }
        });
    }
    /**
     * @param player
     * @param formData
     * @param callList 到这一步经过的组 包含当前显示的组
     * @param isSell 是否是售出表单
     */
    static showForm(player, formData, callList, isSell) {
        if (formData === undefined) {
            Msg.error("分类不存在。", player);
            return;
        }
        if (formData["type"] === "group" || formData["type"] === "root") {
            let form = Gui.simpleForm({ "rawtext": this.getNameByData(formData) });
            if (callList.length >= 1) {
                form.button("返回上一页");
            }
            let data = formData["data"];
            for (let item of data) {
                form.button({ "rawtext": this.getNameByData(item) }, item["image"]);
            }
            form.show(player).then((res) => {
                if (res.canceled)
                    return;
                let selection = res.selection;
                if (callList.length >= 1) {
                    if (selection === 0) {
                        if (callList.length === 1) {
                            this.showFormMain(player);
                        }
                        else {
                            let newList = callList.slice(0, callList.length - 1);
                            let preForm = this.getFormDataByCallList(newList);
                            this.showForm(player, preForm, newList, isSell);
                        }
                        return;
                    }
                    selection--;
                }
                if (selection < data.length) {
                    let newList = callList;
                    newList.push(selection);
                    this.showForm(player, data[selection], newList, isSell);
                }
            });
        }
        else if (formData["type"] === "exam") {
            let form = Gui.modalForm({ "rawtext": this.getNameByData(formData).slice(0, 2) });
            form.textField({ "rawtext": [
                    { "text": "\n 名称: " }, { "translate": formData["data"]["type"] },
                    { "text": `\n 价格: ${formData["data"]["money"]}` },
                    { "text": `\n 特殊值: ${formData["data"]["aux"]}` },
                    { "text": `\n 备注: ${formData["data"]["remark"]}\n\n` }
                ] }, `输入${isSell ? "售出" : "买入"}数量`);
            form.toggle("取消并返回上一页", { defaultValue: false });
            form.submitButton("确认");
            form.show(player).then((res) => {
                if (res.canceled)
                    return;
                if (res.formValues[1] === true) {
                    if (callList.length === 1) {
                        this.showFormMain(player);
                    }
                    else {
                        let newList = callList.slice(0, callList.length - 1);
                        let preForm = this.getFormDataByCallList(newList);
                        this.showForm(player, preForm, newList, isSell);
                    }
                }
                else {
                    let amount = parseInt(res.formValues[0]);
                    if (amount !== undefined && !Number.isNaN(amount)) {
                        this.trade(player, formData["data"], amount, isSell, formData["data"]["type"]);
                    }
                    else {
                        Msg.error("无效的数量。", player);
                    }
                }
            });
        }
        else {
            console.log("error!");
        }
    }
    static getFormDataByCallList(callList) {
        return undefined;
    }
    static trade(player, data, amount, isSell, itemName) {
        Msg.warning("交易功能未实现。", player);
    }
}
//# sourceMappingURL=FormShop.js.map