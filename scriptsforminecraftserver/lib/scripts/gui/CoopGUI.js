/* ---------------------------------------- *\
 *  合作社 GUI 表单界面
\* ---------------------------------------- */
import { CustomForm, ObservableString, ObservableNumber } from "@minecraft/server-ui";
import { Gui } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { Database as DB } from "../coop/Database";
import { CoopCore } from "../coop/CoopCore";
// ===== 工具 =====
function countItemInInventory(player) {
    const inv = player.getComponent("inventory");
    if (!inv?.container)
        return 0;
    let total = 0;
    for (let i = 0; i < inv.container.size; i++) {
        const item = inv.container.getItem(i);
        if (item?.amount)
            total += item.amount;
    }
    return total;
}
function _genId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
/** 格式化商品按钮文字（无颜色代码、无加粗） */
function _fmtGoodBt(name, unit, price, sv, num, isBuy) {
    if (isBuy) {
        return `${name} ${unit}${price}\n已售：${sv} 库存：${num}`;
    }
    return `${name} ${unit}${price}\n可回收：${sv}/${num}`;
}
export class CoopGUI {
    constructor(player) {
        this.player = player;
    }
    errorPop(text) {
        Msg.error(text, this.player);
    }
    tipsPop(text) {
        Msg.tips(text, this.player);
    }
    infoPop(text) {
        Msg.info(text, this.player);
    }
    confirmPop(title, text, onConfirm) {
        Gui.confirm(this.player, title, text, onConfirm);
    }
    // ==========================================
    //  主面板
    // ==========================================
    mainPanel() {
        const cid = DB.getPlayerCid(this.player.name);
        if (!cid)
            return this.noCoopPanel();
        this.coopInfoPanel(cid, "menu");
    }
    noCoopPanel() {
        const form = new CustomForm(this.player, "合作社")
            .label(ListFormInfo(["你没有加入任何一个合作社，请选择操作。\n\nCiallo～(\u2220\u30fb\u03c9\uff1c)\u2322\u2606"]))
            .button("通过 CID 加入合作社", () => this.joinByCid())
            .button("查看所有合作社", () => this.coopList())
            .button("创建合作社", () => this.createCoop())
            .button("合作社排行榜", () => this.rank(1))
            .button("插件更新日志", () => this.log())
            .closeButton();
        Gui.showForm(this.player, form, "合作社").catch(() => { });
    }
    // ==========================================
    //  加入 / 列表 / 创建
    // ==========================================
    joinByCid() {
        let clicked = false;
        const obsCid = new ObservableString("");
        const form = new CustomForm(this.player, "合作社 - 加入合作社")
            .textField("CID", obsCid, { description: "仅支持英文/数字" })
            .button("确认", () => {
            clicked = true;
            const cid = obsCid.getData()?.trim();
            if (!cid) {
                this.errorPop("请填写CID");
                return;
            }
            const data = DB.getCoopByCid(cid);
            if (!data) {
                this.errorPop("请检查CID是否正确");
                return;
            }
            this.coopInfoPanel(cid, "join");
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 加入合作社")
            .then(() => { if (!clicked)
            this.mainPanel(); })
            .catch(() => { });
    }
    coopList() {
        const all = DB.getAllCoop();
        if (all.length === 0) {
            this.errorPop("还没有任何合作社");
            return;
        }
        let clicked = false;
        const form = new CustomForm(this.player, "合作社列表");
        for (const c of all) {
            const coopCid = c.cid;
            form.button(c.name, () => {
                clicked = true;
                this.coopInfoPanel(coopCid, "info");
            });
        }
        form
            .button("§l返回", () => { })
            .closeButton();
        Gui.showForm(this.player, form, "合作社列表")
            .then(() => { if (!clicked)
            this.mainPanel(); })
            .catch(() => { });
    }
    createCoop() {
        let clicked = false;
        const obsName = new ObservableString("");
        const obsCid = new ObservableString("");
        const form = new CustomForm(this.player, "合作社 - 创建合作社")
            .textField("合作社名称", obsName)
            .textField("CID", obsCid, { description: "仅支持英文/数字，用作邀请码" })
            .button("确认", () => {
            clicked = true;
            const name = obsName.getData();
            const cid = obsCid.getData();
            if (!name || !cid) {
                this.errorPop("请填写完整信息");
                return;
            }
            if (CoopCore.registerCoop(name, cid, this.player)) {
                this.infoPop("合作社创建成功！");
            }
            else {
                this.errorPop(`你的${Money.UNIT}似乎不够或CID已被占用！`);
            }
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 创建合作社")
            .then(() => { if (!clicked)
            this.mainPanel(); })
            .catch(() => { });
    }
    // ==========================================
    //  合作社信息面板
    // ==========================================
    coopInfoPanel(cid, returnMode) {
        const text = CoopCore.getInfo(cid);
        if (returnMode === "info") {
            this.infoPop(text);
            return;
        }
        if (returnMode === "join") {
            const form = new CustomForm(this.player, "合作社 - 加入确认")
                .label(ListFormInfo([text]))
                .button("加入", () => CoopCore.joinCoop(this.player, cid))
                .button("§l返回", () => { })
                .closeButton();
            Gui.showForm(this.player, form, "合作社 - 加入确认").catch(() => { });
            return;
        }
        const isOp = CoopCore.isOp(this.player.name, cid);
        const form = new CustomForm(this.player, "合作社")
            .label(ListFormInfo([text]))
            .button("集体商店后台", () => this.shopMgr(cid, 1))
            .button("公有银行", () => this.bankPanel(cid))
            .button("成员列表", () => this.infoPop(CoopCore.getMemberList(cid).join(", ")))
            .button("查看所有合作社", () => this.coopList())
            .button("合作社排行榜", () => this.rank(1))
            .button(isOp ? "解散此合作社" : "退出此合作社", () => this.exitConfirm(cid))
            .button("插件更新日志", () => this.log());
        if (isOp)
            form.button("管理面板", () => this.adminPanel(cid));
        form.closeButton();
        Gui.showForm(this.player, form, "合作社").catch(() => { });
    }
    exitConfirm(cid) {
        const isOp = CoopCore.isOp(this.player.name, cid);
        this.confirmPop("合作社 - 确认", isOp ? "确认解散合作社？所有成员也会被踢出。\n请先清空银行经济、下架商品。" : "你确认退出合作社吗？", () => {
            if (isOp) {
                CoopCore.releaseCoop(cid);
                this.infoPop("解散成功。");
            }
            else {
                CoopCore.exitCoop(this.player.name, cid);
                this.infoPop("已退出合作社。");
                CoopCore.sendToMembers(cid, this.player.name + " 退出了合作社。拜拜～");
            }
        });
    }
    // ==========================================
    //  管理面板
    // ==========================================
    adminPanel(cid) {
        let clicked = false;
        const form = new CustomForm(this.player, "合作社 - 管理面板")
            .label(ListFormInfo(["§6CID:§r " + cid]))
            .button("编辑公告", () => { clicked = true; this.editNotice(cid); })
            .button("向所有成员喊话", () => { clicked = true; this.talkToMembers(cid); })
            .button("添加管理成员", () => { clicked = true; this.addAdmin(cid); })
            .button("§l返回", () => { })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 管理面板")
            .then(() => { if (!clicked)
            this.coopInfoPanel(cid, "menu"); })
            .catch(() => { });
    }
    editNotice(cid) {
        let clicked = false;
        const obsNotice = new ObservableString("");
        const form = new CustomForm(this.player, "合作社 - 编辑公告")
            .textField("公告内容", obsNotice)
            .button("确认", () => {
            clicked = true;
            CoopCore.setNotice(cid, obsNotice.getData() || "");
            this.infoPop("设置成功。");
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 编辑公告")
            .then(() => { if (!clicked)
            this.coopInfoPanel(cid, "menu"); })
            .catch(() => { });
    }
    talkToMembers(cid) {
        let clicked = false;
        const obsMsg = new ObservableString("");
        const form = new CustomForm(this.player, "合作社 - 向所有成员喊话")
            .textField("喊话内容", obsMsg, { description: "(\u1d5c \u02f0 \u1d5c)" })
            .button("确认", () => {
            clicked = true;
            CoopCore.sendToMembers(cid, this.player.name + ": " + obsMsg.getData());
            this.infoPop("喊话成功。");
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 向所有成员喊话")
            .then(() => { if (!clicked)
            this.coopInfoPanel(cid, "menu"); })
            .catch(() => { });
    }
    addAdmin(cid) {
        const members = CoopCore.getMemberList(cid);
        if (members.length === 0)
            return;
        const memberItems = members.map((m, i) => ({ label: m, value: i }));
        let clicked = false;
        const obsIdx = new ObservableNumber(0);
        const form = new CustomForm(this.player, "合作社 - 添加管理")
            .dropdown("将合作社中的成员权限提升至管理员...", obsIdx, memberItems)
            .button("确认", () => {
            clicked = true;
            const idx = obsIdx.getData();
            this.confirmPop("合作社 - 确认", "目标玩家会获得管理面板的使用权，确认操作吗？", () => {
                CoopCore.setOp(cid, idx);
                this.tipsPop("操作成功。");
            });
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 添加管理")
            .then(() => { if (!clicked)
            this.coopInfoPanel(cid, "menu"); })
            .catch(() => { });
    }
    // ==========================================
    //  银行
    // ==========================================
    bankPanel(cid) {
        const data = DB.getCoopByCid(cid);
        if (!data)
            return;
        let clicked = false;
        const obsAction = new ObservableNumber(0);
        const form = new CustomForm(this.player, "合作社 - 银行")
            .dropdown("请选择操作", obsAction, [{ label: "存入", value: 0 }, { label: "取出", value: 1 }])
            .label("§6合作社银行经济：§r" + data.money + "\n§6账单：§r\n" + data.moneylist)
            .button("确认", () => {
            clicked = true;
            this.bankControl(cid, obsAction.getData() + 1);
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 银行")
            .then(() => { if (!clicked)
            this.coopInfoPanel(cid, "menu"); })
            .catch(() => { });
    }
    bankControl(cid, type) {
        const title = type === 1 ? "存入" + Money.UNIT : "取出" + Money.UNIT;
        let clicked = false;
        const obsAmount = new ObservableString("");
        const obsNote = new ObservableString("");
        const form = new CustomForm(this.player, "合作社 - " + title)
            .textField("金额", obsAmount)
            .textField("备注(可选)", obsNote, { description: "无" })
            .button("确认", () => {
            clicked = true;
            const val = parseInt(obsAmount.getData());
            if (isNaN(val) || val <= 0) {
                this.errorPop("金额填写不正确");
                return;
            }
            if (CoopCore.bankControl(cid, this.player, val, obsNote.getData() || "", type === 1 ? 1 : 2)) {
                if (type === 1)
                    Msg.success("存入成功！" + Money.UNIT + "：" + val, this.player);
                else
                    Msg.success("取出成功！" + Money.UNIT + "：" + val, this.player);
            }
            else {
                this.errorPop("金额填写不正确");
            }
        })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - " + title)
            .then(() => { if (!clicked)
            this.coopInfoPanel(cid, "menu"); })
            .catch(() => { });
    }
    // ==========================================
    //  排行榜
    // ==========================================
    rank(type) {
        const obsType = new ObservableNumber(type - 1);
        const form = new CustomForm(this.player, "合作社 - 排行榜")
            .label(CoopCore.getRankInfo(type))
            .dropdown("切换排行榜", obsType, [{ label: "银行经济", value: 0 }, { label: "人数", value: 1 }])
            .button("确认", () => this.rank(obsType.getData() + 1))
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 排行榜").catch(() => { });
    }
    // ==========================================
    //  更新日志
    // ==========================================
    log() {
        const form = new CustomForm(this.player, "合作社 - 更新日志")
            .label(ListFormInfo(["暂无更新日志。"]))
            .button("§l返回", () => { })
            .closeButton();
        Gui.showForm(this.player, form, "合作社 - 更新日志").catch(() => { });
    }
    // ==========================================
    //  商店管理
    // ==========================================
    shopMgr(cid, step, gid) {
        const isOp = CoopCore.isOp(this.player.name, cid);
        const good = gid ? DB.getGoodById(gid) : undefined;
        const unit = DB.getConfig().shop_setting.monetary_unit;
        switch (step) {
            // ---- step 1: 商店管理后台主菜单 ----
            case 1: {
                const goods = CoopCore.getGoods(1, true, 1, cid);
                const form = new CustomForm(this.player, "商店管理后台")
                    .label(ListFormInfo(["选择操作"]))
                    .button("上架物品", () => this.shopAdd(cid, 1))
                    .button("回收物品管理", () => this.shopMgr(cid, 6))
                    .button("添加自定义分组", () => this.shopAdd(cid, 4));
                if (isOp)
                    form.button("回收招募审核", () => { if (!this.shopMgr(cid, 8))
                        this.tipsPop("没有待审核的回收招募"); });
                for (const g of goods) {
                    const goodItem = g;
                    form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, true), () => this.shopMgr(cid, 2, goodItem.id));
                }
                form
                    .button("§l返回", () => this.coopInfoPanel(cid, "menu"))
                    .closeButton();
                Gui.showForm(this.player, form, "商店管理后台").catch(() => { });
                break;
            }
            // ---- step 2: 选择操作（补货/下架/编辑） ----
            case 2: {
                if (!good)
                    return;
                const obsAction = new ObservableNumber(0);
                const form = new CustomForm(this.player, "商店管理后台")
                    .label("gid:" + gid)
                    .dropdown("操作", obsAction, [{ label: "补货", value: 0 }, { label: "下架", value: 1 }, { label: "编辑", value: 2 }])
                    .button("确认", () => this.shopMgr(cid, obsAction.getData() + 3, gid))
                    .closeButton();
                Gui.showForm(this.player, form, "商店管理后台").catch(() => { });
                break;
            }
            // ---- step 3: 补货 ----
            case 3: {
                if (!good || good.item.nbt) {
                    if (good?.item.nbt)
                        this.errorPop("NBT物品无法补货，因为不能使用手持物品补充。");
                    return;
                }
                const inv = this.player.getComponent("inventory");
                const firstItem = inv?.container?.getItem(0);
                if (!firstItem || firstItem.typeId !== good.item.type) {
                    this.errorPop("请将该商品放在物品栏第一格。");
                    return;
                }
                const total = countItemInInventory(this.player);
                let clicked = false;
                const obsNum = new ObservableNumber(1);
                const form = new CustomForm(this.player, "补货")
                    .label("当前库存：" + good.num)
                    .slider("补货数量", obsNum, 1, Math.max(total, 1), { step: 1 })
                    .button("确认", () => {
                    clicked = true;
                    const num = obsNum.getData();
                    if (num <= 0) {
                        this.errorPop("请填写完整信息！");
                        return;
                    }
                    good.num += num;
                    DB.saveGood(good);
                    this.player.runCommand('clear "' + this.player.name + '" ' + good.item.type + " " + good.item.aux + " " + num);
                    Msg.success("补货成功。", this.player);
                    this.shopMgr(cid, 1);
                })
                    .closeButton();
                Gui.showForm(this.player, form, "补货")
                    .then(() => { if (!clicked)
                    this.shopMgr(cid, 1); })
                    .catch(() => { });
                break;
            }
            // ---- step 4: 下架确认 ----
            case 4: {
                if (!good)
                    return;
                this.confirmPop("下架确认", "确认下架 " + good.name + " ？\n下架后库存将返还给你。", () => {
                    DB.deleteGood(gid);
                    this.player.runCommand('give "' + this.player.name + '" ' + good.item.type + " " + good.num + " " + good.item.aux);
                    Msg.success("下架成功。", this.player);
                    this.shopMgr(cid, 1);
                });
                break;
            }
            // ---- step 5: 编辑商品信息 ----
            case 5: {
                if (!good)
                    return;
                const customGroups = CoopCore.getGroups(true);
                const cgNames = ["无", ...customGroups.map((g) => g.displayname)];
                const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));
                let clicked = false;
                const obsName = new ObservableString(good.name);
                const obsDes = new ObservableString(good.des);
                const obsPrice = new ObservableString(String(good.money));
                const obsGroup = new ObservableNumber(0);
                const form = new CustomForm(this.player, "编辑商品信息")
                    .textField("商品名称", obsName)
                    .textField("商品描述", obsDes)
                    .textField("价格", obsPrice)
                    .dropdown("自定义分组", obsGroup, cgItems)
                    .button("确认", () => {
                    clicked = true;
                    good.name = obsName.getData();
                    good.des = obsDes.getData();
                    good.money = parseInt(obsPrice.getData()) || 0;
                    const cgIdx = obsGroup.getData();
                    if (cgIdx > 0) {
                        const idx = good.groups.findIndex((g) => customGroups.some((cg) => cg.groupid === g));
                        if (idx !== -1)
                            good.groups.splice(idx, 1);
                        good.groups.push(customGroups[cgIdx - 1].groupid);
                    }
                    DB.saveGood(good);
                    Msg.success("修改成功。", this.player);
                    this.shopMgr(cid, 1);
                })
                    .closeButton();
                Gui.showForm(this.player, form, "编辑商品信息")
                    .then(() => { if (!clicked)
                    this.shopMgr(cid, 1); })
                    .catch(() => { });
                break;
            }
            // ---- step 6: 回收物品管理列表 ----
            case 6: {
                const goods2 = CoopCore.getGoods(1, true, 2, cid);
                const form = new CustomForm(this.player, "商店管理后台")
                    .label(ListFormInfo(["回收物品管理"]));
                for (const g of goods2) {
                    const goodItem = g;
                    form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, false), () => this.shopMgr(cid, 7, goodItem.id));
                }
                form
                    .button("§l返回", () => this.shopMgr(cid, 1))
                    .closeButton();
                Gui.showForm(this.player, form, "商店管理后台").catch(() => { });
                break;
            }
            // ---- step 7: 取出回收库存 ----
            case 7: {
                if (!good || good.sv <= 0) {
                    this.errorPop("暂时没有需要取出的库存。");
                    break;
                }
                let clicked = false;
                const obsNum = new ObservableNumber(1);
                const form = new CustomForm(this.player, "取出回收库存")
                    .slider("取出数量", obsNum, 1, good.sv, { step: 1 })
                    .button("确认", () => {
                    clicked = true;
                    const num = obsNum.getData();
                    good.sv -= num;
                    DB.saveGood(good);
                    this.player.runCommand('give "' + this.player.name + '" ' + good.item.type + " " + num + " " + good.item.aux);
                    Msg.success("取出成功。", this.player);
                    this.shopMgr(cid, 1);
                })
                    .closeButton();
                Gui.showForm(this.player, form, "取出回收库存")
                    .then(() => { if (!clicked)
                    this.shopMgr(cid, 1); })
                    .catch(() => { });
                break;
            }
            // ---- step 8: 回收招募审核 ----
            case 8: {
                const goods1 = CoopCore.getGoods(1, true, 2, cid, undefined, false);
                if (goods1.length === 0)
                    return false;
                const form = new CustomForm(this.player, "回收招募审核列表");
                for (const g of goods1) {
                    const goodItem = g;
                    form.button(g.name + " " + unit + g.money + "\n待审核", () => {
                        this.confirmPop("回收招募审核列表", "名称: " +
                            goodItem.name +
                            "\n描述: " +
                            (goodItem.des || "") +
                            "\n价格: " +
                            goodItem.money +
                            "\n库存: " +
                            goodItem.num +
                            "\n\n确定通过审核？", () => {
                            goodItem.isTrue = true;
                            DB.saveGood(goodItem);
                            Msg.success("操作成功。", this.player);
                        });
                    });
                }
                form.closeButton();
                Gui.showForm(this.player, form, "回收招募审核列表").catch(() => { });
                return true;
            }
        }
    }
    // ==========================================
    //  上架商品
    // ==========================================
    shopAdd(cid, step, index) {
        switch (step) {
            // ---- step 1: 选择物品栏和操作类型 ----
            case 1: {
                const obsSlot = new ObservableNumber(0);
                const obsType = new ObservableNumber(0);
                const form = new CustomForm(this.player, "上架物品")
                    .dropdown("请选择物品栏", obsSlot, [{ label: "1", value: 0 }, { label: "2", value: 1 }, { label: "3", value: 2 }, { label: "4", value: 3 }, { label: "5", value: 4 }, { label: "6", value: 5 }, { label: "7", value: 6 }, { label: "8", value: 7 }, { label: "9", value: 8 }])
                    .dropdown("请选择操作类型", obsType, [{ label: "求购", value: 0 }, { label: "回收", value: 1 }])
                    .button("确认", () => this.shopAdd(cid, obsType.getData() + 2, obsSlot.getData()))
                    .closeButton();
                Gui.showForm(this.player, form, "上架物品").catch(() => { });
                break;
            }
            // ---- step 2: 求购上架 ----
            case 2: {
                const inv = this.player.getComponent("inventory");
                const item = inv?.container?.getItem(index ?? 0);
                if (!item) {
                    this.errorPop("请确认物品栏有物品");
                    return;
                }
                const customGroups = CoopCore.getGroups(true);
                const cgNames = ["无", ...customGroups.map((g) => g.displayname)];
                const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));
                const obsType = new ObservableString(item.typeId);
                const obsName = new ObservableString(item.typeId);
                const obsDes = new ObservableString("");
                const obsPrice = new ObservableString("0");
                const obsGroup = new ObservableNumber(0);
                const form = new CustomForm(this.player, "商品信息")
                    .textField("type: " + item.typeId, obsType, { description: item.typeId })
                    .textField("商品名称", obsName, { description: item.typeId })
                    .textField("商品描述", obsDes)
                    .textField("价格", obsPrice, { description: "0" })
                    .dropdown("自定义分组", obsGroup, cgItems)
                    .button("确认", () => {
                    const money = parseInt(obsPrice.getData()) || 0;
                    const cgIdx = obsGroup.getData();
                    const gt = [];
                    if (cgIdx > 0)
                        gt.push(customGroups[cgIdx - 1].groupid);
                    gt.push(...CoopCore.typeGood(item));
                    const newGood = {
                        name: obsName.getData(),
                        id: CoopCore.generateId(),
                        time: Date.now(),
                        type: 1,
                        groups: gt,
                        des: obsDes.getData(),
                        num: 1,
                        sv: 0,
                        money,
                        cid: cid,
                        isTrue: true,
                        item: { nbt: "", type: item.typeId, aux: 0 },
                    };
                    DB.saveGood(newGood);
                    Msg.success("上架成功！", this.player);
                })
                    .closeButton();
                Gui.showForm(this.player, form, "商品信息").catch(() => { });
                break;
            }
            // ---- step 3: 回收功能（暂未实现） ----
            case 3: {
                this.errorPop("回收功能暂未完全实现");
                break;
            }
            // ---- step 4: 添加自定义分组 ----
            case 4: {
                const obsName = new ObservableString("");
                const form = new CustomForm(this.player, "添加自定义分组")
                    .textField("分组名称", obsName)
                    .button("确认", () => {
                    const name = obsName.getData()?.trim();
                    if (!name) {
                        this.errorPop("请填写完整信息！");
                        return;
                    }
                    DB.saveGroup({ groupid: "custom_" + _genId(), displayname: name });
                    Msg.success("操作成功。", this.player);
                })
                    .closeButton();
                Gui.showForm(this.player, form, "添加自定义分组").catch(() => { });
                break;
            }
        }
    }
}
//# sourceMappingURL=CoopGUI.js.map