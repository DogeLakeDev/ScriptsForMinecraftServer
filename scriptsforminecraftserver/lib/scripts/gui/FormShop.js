import { MenuNavigator, obsStr, obsBool, FormStatus } from "../libs/MenuNavigator";
import { ConfigManager } from "../libs/ConfigManager";
import { Msg } from "../libs/Tools";
let _shopTree = null;
function getShopTree() {
    if (_shopTree)
        return _shopTree;
    const categories = ConfigManager.getShopCategories();
    const items = ConfigManager.getShopItems();
    const itemByCat = {};
    for (const item of items)
        itemByCat[item.category_id] = item;
    const nodeMap = {};
    for (const cat of categories) {
        const node = {
            name: cat.name,
            type: cat.type,
            image: cat.image || "",
            data: [],
        };
        if (cat.type === "root") {
            node.sell = false;
        }
        if (cat.type === "exam") {
            const it = itemByCat[cat.id];
            if (it) {
                node.data = {
                    type: it.item_type,
                    aux: it.item_aux ?? 0,
                    remark: it.remark || "",
                    money: it.price,
                };
            }
        }
        nodeMap[cat.id] = node;
    }
    const roots = [];
    for (const cat of categories) {
        const node = nodeMap[cat.id];
        if (cat.parent_id == null) {
            if (cat.type === "root" && cat.name === "卖出")
                node.sell = true;
            roots.push(node);
        }
        else {
            const parent = nodeMap[cat.parent_id];
            if (parent)
                parent.data.push(node);
        }
    }
    _shopTree = roots;
    return roots;
}
function getFormData(callList) {
    const tree = getShopTree();
    return callList.slice(1).reduce((node, idx) => node?.data?.[idx], tree[0]);
}
function getParentList(callList) {
    return callList.length > 1 ? callList.slice(0, -1) : [];
}
function getNodeName(node) {
    if (!node)
        return "";
    if (node.type === "exam")
        return `${node.name}\n§a$${node.data?.money ?? ""}`;
    return node.name ?? "";
}
export class FormShop {
    static showFormMain(player) {
        const nav = new MenuNavigator(player);
        nav.section("list", "商店", (page) => {
            const callList = nav.state.callList ?? [0];
            const formData = getFormData(callList);
            if (!formData?.data) {
                page.label("商品数据错误。");
                return;
            }
            const parent = getParentList(callList);
            if (parent.length > 0) {
                page.button("§l返回上一页", () => {
                    nav.state.callList = parent;
                    nav.rebuild("list");
                });
            }
            else if (callList.length > 1) {
                page.button("§l返回菜单", () => {
                    nav.state.callList = [0];
                    nav.rebuild("list");
                });
            }
            const isSell = getShopTree()[0]?.sell ?? false;
            for (let i = 0; i < formData.data.length; i++) {
                const item = formData.data[i];
                const idx = i;
                if (item.type === "group" || item.type === "root") {
                    page.button(getNodeName(item), () => {
                        nav.state.callList = [...callList, idx];
                        nav.rebuild("list");
                    });
                }
                else if (item.type === "exam") {
                    page.button(getNodeName(item), () => {
                        nav.state.examData = item;
                        nav.state.isSell = isSell;
                        nav.go("buy");
                    });
                }
            }
        });
        nav.section("buy", "购买", (page) => {
            const status = new FormStatus(page);
            const examData = nav.state.examData;
            const isSell = nav.state.isSell;
            if (!examData) {
                page.label("商品数据丢失。");
                return;
            }
            const d = examData.data;
            page.label(`\n 名称: ${examData.name}\n 价格: $${d?.money ?? 0}\n 备注: ${d?.remark ?? ""}\n`);
            const amountObs = obsStr("");
            const cancelObs = obsBool(false);
            page.textField(`输入${isSell ? "售出" : "买入"}数量`, amountObs);
            page.toggle("取消并返回", cancelObs);
            page.button("确认", () => {
                if (cancelObs.getData()) {
                    nav.rebuild("list");
                    return;
                }
                const amount = parseInt(amountObs.getData());
                if (!isNaN(amount)) {
                    FormShop.trade(player, d, amount, isSell, d?.type);
                }
                else {
                    status.fail("无效的数量。");
                }
            });
        });
        nav.start("list");
    }
    static trade(player, data, amount, isSell, itemName) {
        Msg.warning("交易功能未实现。", player);
    }
}
//# sourceMappingURL=FormShop.js.map