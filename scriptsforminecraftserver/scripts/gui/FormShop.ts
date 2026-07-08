/* ---------------------------------------- *\
 *  Name        :  表单商店                   *
 *  Description :  表单商店                   *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Player } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { shopData } from "../data/Shop";
import { Gui, ObservableString, ObservableBoolean } from "../libs/Gui";
import { Msg } from "../libs/Tools";

export class FormShop {
  static getNameByData(data: any) {
    if (data["type"] === "exam") {
      if (data["name"] !== undefined && data["name"] !== "") {
        return [
          { text: `\u00a7l` },
          { translate: data["name"] },
          { text: `\n\u00a7r\u00a7l\u00a7a$${data["data"]["money"]}` },
        ];
      } else {
        return [
          { text: `\u00a7l` },
          { translate: data["data"]["type"] },
          { text: `\n\u00a7r\u00a7l\u00a7a$${data["data"]["money"]}` },
        ];
      }
    } else {
      let total = data["data"]["items"].length;
      if (data["name"] !== undefined && data["name"] !== "") {
        return [
          { text: `\u00a7l` },
          { translate: data["name"] },
          { text: `\n\u00a7a$${data["data"]["money"]}\n\u00a77${total}` },
        ];
      } else {
        return [
          { text: `\u00a7l` },
          { translate: data["data"]["type"] },
          { text: `\n\u00a7a$${data["data"]["money"]}\n\u00a77${total}` },
        ];
      }
    }
  }

  static showFormMain(player: Player) {
    let form = new CustomForm(player, "商店");

    for (let i = 0; i < shopData.length; i++) {
      const root = shopData[i];
      const idx = i;
      form.button({ rawtext: FormShop.getNameByData(root) }, () => {
        FormShop.showForm(player, root, [idx], root["sell"]);
      });
    }

    form.closeButton();
    Gui.showForm(player, form, "商店");
  }

  static showForm(player: Player, formData: any, callList: number[], isSell: boolean) {
    if (formData === undefined) {
      Msg.error("分类不存在。", player);
      return;
    }
    if (formData["type"] === "group" || formData["type"] === "root") {
      let form = new CustomForm(player, { rawtext: this.getNameByData(formData) });

      if (callList.length >= 1) {
        form.button("返回上一页", () => {
          if (callList.length === 1) {
            this.showFormMain(player);
          } else {
            let newList = callList.slice(0, callList.length - 1);
            let preForm = this.getFormDataByCallList(newList);
            this.showForm(player, preForm, newList, isSell);
          }
        });
      }

      let data = formData["data"];
      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const idx = i;
        form.button({ rawtext: this.getNameByData(item) }, () => {
          let newList = [...callList, idx];
          this.showForm(player, item, newList, isSell);
        });
      }

      form.closeButton();
      Gui.showForm(player, form, "商店");
    } else if (formData["type"] === "exam") {
      const amountObs = new ObservableString("");
      const cancelObs = new ObservableBoolean(false);

      let form = new CustomForm(player, { rawtext: this.getNameByData(formData).slice(0, 2) as any });

      form.label({
        rawtext: [
          { text: "\n 名称: " },
          { translate: formData["data"]["type"] },
          { text: `\n 价格: ${formData["data"]["money"]}` },
          { text: `\n 特殊值: ${formData["data"]["aux"]}` },
          { text: `\n 备注: ${formData["data"]["remark"]}\n\n` },
        ],
      });

      form.textField(`输入${isSell ? "售出" : "买入"}数量`, amountObs);

      form.toggle("取消并返回上一页", cancelObs);

      form.button("确认", () => {
        if (cancelObs.getData()) {
          if (callList.length === 1) {
            this.showFormMain(player);
          } else {
            let newList = callList.slice(0, callList.length - 1);
            let preForm = this.getFormDataByCallList(newList);
            this.showForm(player, preForm, newList, isSell);
          }
        } else {
          let amount = parseInt(amountObs.getData());
          if (amount !== undefined && !Number.isNaN(amount)) {
            this.trade(player, formData["data"], amount, isSell, formData["data"]["type"]);
          } else {
            Msg.error("无效的数量。", player);
          }
        }
      });

      form.closeButton();
      Gui.showForm(player, form, "商店");
    } else {
      console.log("error!");
    }
  }

  static getFormDataByCallList(callList: number[]): any {
    return undefined;
  }

  static trade(player: Player, data: any, amount: number, isSell: boolean, itemName: string): void {
    Msg.warning("交易功能未实现。", player);
  }
}
