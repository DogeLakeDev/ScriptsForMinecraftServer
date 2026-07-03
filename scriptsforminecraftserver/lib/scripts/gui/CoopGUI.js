/* ---------------------------------------- *\
 *  合作社 GUI 表单界面
\* ---------------------------------------- */
import { Gui } from "../libs/Gui";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { Database as DB } from "../coop/Database";
import { CoopCore } from "../coop/CoopCore";
// ===== 工具 =====
function countItemInInventory(player) {
    const inv = player.getComponent("inventory");
    if (!(inv === null || inv === void 0 ? void 0 : inv.container))
        return 0;
    let total = 0;
    for (let i = 0; i < inv.container.size; i++) {
        const item = inv.container.getItem(i);
        if (item === null || item === void 0 ? void 0 : item.amount)
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
    constructor(player) { this.player = player; }
    errorPop(text) { Msg.error(text, this.player); }
    tipsPop(text) { Msg.tips(text, this.player); }
    infoPop(text) { Msg.info(text, this.player); }
    confirmPop(title, text, onConfirm) { Gui.confirm(this.player, title, text, onConfirm); }
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
        Gui.simpleForm()
            .title("合作社")
            .body(ListFormInfo(["你没有加入任何一个合作社，请选择操作。\n\nCiallo～(\u2220\u30fb\u03c9\uff1c)\u2322\u2606"]))
            .button("通过 CID 加入合作社")
            .button("查看所有合作社")
            .button("创建合作社")
            .button("合作社排行榜")
            .button("插件更新日志")
            .show(this.player).then((res) => {
            if (res.canceled)
                return;
            switch (res.selection) {
                case 0:
                    this.joinByCid();
                    break;
                case 1:
                    this.coopList();
                    break;
                case 2:
                    this.createCoop();
                    break;
                case 3:
                    this.rank(1);
                    break;
                case 4:
                    this.log();
                    break;
            }
        }).catch(() => { });
    }
    // ==========================================
    //  加入 / 列表 / 创建
    // ==========================================
    joinByCid() {
        Gui.modalForm()
            .title("合作社 - 加入合作社")
            .textField("CID", "仅支持英文/数字")
            .show(this.player).then((res) => {
            var _a;
            if (res.canceled) {
                this.mainPanel();
                return;
            }
            const cid = (_a = res.formValues[0]) === null || _a === void 0 ? void 0 : _a.trim();
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
        }).catch(() => { });
    }
    coopList() {
        const all = DB.getAllCoop();
        if (all.length === 0) {
            this.errorPop("还没有任何合作社");
            return;
        }
        const form = Gui.simpleForm().title("合作社列表");
        for (const c of all)
            form.button(c.name);
        form.button("§l返回");
        form.show(this.player).then((res) => {
            if (res.canceled) {
                this.mainPanel();
                return;
            }
            if (res.selection === all.length) {
                this.mainPanel();
                return;
            }
            this.coopInfoPanel(all[res.selection].cid, "info");
        }).catch(() => { });
    }
    createCoop() {
        Gui.modalForm()
            .title("合作社 - 创建合作社")
            .textField("合作社名称", "")
            .textField("CID", "仅支持英文/数字，用作邀请码")
            .show(this.player).then((res) => {
            if (res.canceled) {
                this.mainPanel();
                return;
            }
            const vals = res.formValues;
            const name = vals[0];
            const cid = vals[1];
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
        }).catch(() => { });
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
            Gui.simpleForm().title("合作社 - 加入确认").body(ListFormInfo([text])).button("加入").button("§l返回")
                .show(this.player).then((res) => {
                if (!res.canceled && res.selection === 0)
                    CoopCore.joinCoop(this.player, cid);
            }).catch(() => { });
            return;
        }
        const isOp = CoopCore.isOp(this.player.name, cid);
        const form = Gui.simpleForm().title("合作社").body(ListFormInfo([text]))
            .button("集体商店后台")
            .button("公有银行")
            .button("成员列表")
            .button("查看所有合作社")
            .button("合作社排行榜")
            .button(isOp ? "解散此合作社" : "退出此合作社")
            .button("插件更新日志");
        if (isOp)
            form.button("管理面板");
        form.show(this.player).then((res) => {
            if (res.canceled)
                return;
            switch (res.selection) {
                case 0:
                    this.shopMgr(cid, 1);
                    break;
                case 1:
                    this.bankPanel(cid);
                    break;
                case 2:
                    this.infoPop(CoopCore.getMemberList(cid).join(", "));
                    break;
                case 3:
                    this.coopList();
                    break;
                case 4:
                    this.rank(1);
                    break;
                case 5:
                    this.exitConfirm(cid);
                    break;
                case 6:
                    this.log();
                    break;
                case 7:
                    this.adminPanel(cid);
                    break;
            }
        }).catch(() => { });
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
        Gui.simpleForm().title("合作社 - 管理面板")
            .body(ListFormInfo(["§6CID:§r " + cid]))
            .button("编辑公告")
            .button("向所有成员喊话")
            .button("添加管理成员")
            .button("§l返回")
            .show(this.player).then((res) => {
            if (res.canceled) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            if (res.selection === 3) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            switch (res.selection) {
                case 0:
                    this.editNotice(cid);
                    break;
                case 1:
                    this.talkToMembers(cid);
                    break;
                case 2:
                    this.addAdmin(cid);
                    break;
            }
        }).catch(() => { });
    }
    editNotice(cid) {
        Gui.modalForm().title("合作社 - 编辑公告").textField("公告内容", "")
            .show(this.player).then((res) => {
            if (res.canceled) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            CoopCore.setNotice(cid, res.formValues[0] || "");
            this.infoPop("设置成功。");
        }).catch(() => { });
    }
    talkToMembers(cid) {
        Gui.modalForm().title("合作社 - 向所有成员喊话").textField("喊话内容", "( \u1d5c \u02f0 \u1d5c )")
            .show(this.player).then((res) => {
            if (res.canceled) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            CoopCore.sendToMembers(cid, this.player.name + ": " + res.formValues[0]);
            this.infoPop("喊话成功。");
        }).catch(() => { });
    }
    addAdmin(cid) {
        const members = CoopCore.getMemberList(cid);
        if (members.length === 0)
            return;
        Gui.modalForm().title("合作社 - 添加管理").dropdown("将合作社中的成员权限提升至管理员...", members)
            .show(this.player).then((res) => {
            if (res.canceled) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            const idx = res.formValues[0];
            this.confirmPop("合作社 - 确认", "目标玩家会获得管理面板的使用权，确认操作吗？", () => {
                CoopCore.setOp(cid, idx);
                this.tipsPop("操作成功。");
            });
        }).catch(() => { });
    }
    // ==========================================
    //  银行
    // ==========================================
    bankPanel(cid) {
        const data = DB.getCoopByCid(cid);
        if (!data)
            return;
        Gui.modalForm().title("合作社 - 银行")
            .dropdown("请选择操作", ["存入", "取出"])
            .textField("§6合作社银行经济：§r" + data.money + "\n§6账单：§r\n" + data.moneylist, "")
            .show(this.player).then((res) => {
            if (res.canceled) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            this.bankControl(cid, res.formValues[0] + 1);
        }).catch(() => { });
    }
    bankControl(cid, type) {
        const title = type === 1 ? "存入" + Money.UNIT : "取出" + Money.UNIT;
        const form = Gui.modalForm().title("合作社 - " + title)
            .textField("金额", "").textField("备注(可选)", "无");
        form.show(this.player).then((res) => {
            if (res.canceled) {
                this.coopInfoPanel(cid, "menu");
                return;
            }
            const val = parseInt(res.formValues[0]);
            if (isNaN(val) || val <= 0) {
                this.errorPop("金额填写不正确");
                return;
            }
            if (CoopCore.bankControl(cid, this.player, val, res.formValues[1] || "", type === 1 ? 1 : 2)) {
                if (type === 1)
                    Msg.success("存入成功！" + Money.UNIT + "：" + val, this.player);
                else
                    Msg.success("取出成功！" + Money.UNIT + "：" + val, this.player);
            }
            else {
                this.errorPop("金额填写不正确");
            }
        }).catch(() => { });
    }
    // ==========================================
    //  排行榜
    // ==========================================
    rank(type) {
        Gui.modalForm().title("合作社 - 排行榜")
            .textField(CoopCore.getRankInfo(type), "")
            .dropdown("切换排行榜", ["银行经济", "人数"], { defaultValueIndex: type - 1 })
            .show(this.player).then((res) => {
            if (!res.canceled)
                this.rank(res.formValues[1] + 1);
        }).catch(() => { });
    }
    // ==========================================
    //  更新日志
    // ==========================================
    log() {
        Gui.simpleForm().title("合作社 - 更新日志")
            .body(ListFormInfo(["暂无更新日志。"]))
            .button("§l返回")
            .show(this.player).catch(() => { });
    }
    // ==========================================
    //  商店管理
    // ==========================================
    shopMgr(cid, step, gid) {
        var _a;
        const isOp = CoopCore.isOp(this.player.name, cid);
        const good = gid ? DB.getGoodById(gid) : undefined;
        const unit = DB.getConfig().shop_setting.monetary_unit;
        switch (step) {
            // ---- step 1: 商店管理后台主菜单 ----
            case 1: {
                const goods = CoopCore.getGoods(1, true, 1, cid);
                const form = Gui.simpleForm().title("商店管理后台").body(ListFormInfo(["选择操作"]))
                    .button("上架物品")
                    .button("回收物品管理")
                    .button("添加自定义分组");
                if (isOp)
                    form.button("回收招募审核");
                for (const g of goods)
                    form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, true));
                const goodsCount = goods.length;
                form.button("§l返回");
                form.show(this.player).then((res) => {
                    if (res.canceled)
                        return;
                    const idx = res.selection;
                    const offset = isOp ? 4 : 3;
                    const backIdx = offset + goodsCount;
                    if (idx === backIdx) {
                        this.coopInfoPanel(cid, "menu");
                        return;
                    }
                    if (idx === 0)
                        this.shopAdd(cid, 1);
                    else if (idx === 1)
                        this.shopMgr(cid, 6);
                    else if (idx === 2)
                        this.shopAdd(cid, 4);
                    else if (isOp && idx === 3) {
                        if (!this.shopMgr(cid, 8))
                            this.tipsPop("没有待审核的回收招募");
                    }
                    else {
                        this.shopMgr(cid, 2, goods[idx - offset].id);
                    }
                }).catch(() => { });
                break;
            }
            // ---- step 2: 选择操作（补货/下架/编辑） ----
            case 2: {
                if (!good)
                    return;
                Gui.modalForm().title("商店管理后台").textField("gid:" + gid, "")
                    .dropdown("操作", ["补货", "下架", "编辑"])
                    .show(this.player).then((res) => {
                    if (!res.canceled)
                        this.shopMgr(cid, res.formValues[1] + 3, gid);
                }).catch(() => { });
                break;
            }
            // ---- step 3: 补货 ----
            case 3: {
                if (!good || good.item.nbt) {
                    if (good === null || good === void 0 ? void 0 : good.item.nbt)
                        this.errorPop("NBT物品无法补货，因为不能使用手持物品补充。");
                    return;
                }
                const inv = this.player.getComponent("inventory");
                const firstItem = (_a = inv === null || inv === void 0 ? void 0 : inv.container) === null || _a === void 0 ? void 0 : _a.getItem(0);
                if (!firstItem || firstItem.typeId !== good.item.type) {
                    this.errorPop("请将该商品放在物品栏第一格。");
                    return;
                }
                const total = countItemInInventory(this.player);
                Gui.modalForm().title("补货").textField("当前库存：" + good.num, "")
                    .slider("补货数量", 1, Math.max(total, 1), { valueStep: 1, defaultValue: 1 })
                    .show(this.player).then((res) => {
                    if (res.canceled) {
                        this.shopMgr(cid, 1);
                        return;
                    }
                    const num = res.formValues[1];
                    if (num <= 0) {
                        this.errorPop("请填写完整信息！");
                        return;
                    }
                    good.num += num;
                    DB.saveGood(good);
                    this.player.runCommand('clear "' + this.player.name + '" ' + good.item.type + ' ' + good.item.aux + ' ' + num);
                    Msg.success("补货成功。", this.player);
                    this.shopMgr(cid, 1);
                }).catch(() => { });
                break;
            }
            // ---- step 4: 下架确认 ----
            case 4: {
                if (!good)
                    return;
                this.confirmPop("下架确认", "确认下架 " + good.name + " ？\n下架后库存将返还给你。", () => {
                    DB.deleteGood(gid);
                    this.player.runCommand('give "' + this.player.name + '" ' + good.item.type + ' ' + good.num + ' ' + good.item.aux);
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
                Gui.modalForm().title("编辑商品信息")
                    .textField("商品名称", good.name, { defaultValue: good.name })
                    .textField("商品描述", good.des, { defaultValue: good.des })
                    .textField("价格", String(good.money), { defaultValue: String(good.money) })
                    .dropdown("自定义分组", cgNames)
                    .show(this.player).then((res) => {
                    if (res.canceled) {
                        this.shopMgr(cid, 1);
                        return;
                    }
                    const vals = res.formValues;
                    good.name = vals[0];
                    good.des = vals[1];
                    good.money = parseInt(vals[2]) || 0;
                    const cgIdx = vals[3];
                    if (cgIdx > 0) {
                        const idx = good.groups.findIndex((g) => customGroups.some((cg) => cg.groupid === g));
                        if (idx !== -1)
                            good.groups.splice(idx, 1);
                        good.groups.push(customGroups[cgIdx - 1].groupid);
                    }
                    DB.saveGood(good);
                    Msg.success("修改成功。", this.player);
                    this.shopMgr(cid, 1);
                }).catch(() => { });
                break;
            }
            // ---- step 6: 回收物品管理列表 ----
            case 6: {
                const goods2 = CoopCore.getGoods(1, true, 2, cid);
                const form = Gui.simpleForm().title("商店管理后台").body(ListFormInfo(["回收物品管理"]));
                for (const g of goods2)
                    form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, false));
                form.button("§l返回");
                form.show(this.player).then((res) => {
                    if (res.canceled) {
                        this.shopMgr(cid, 1);
                        return;
                    }
                    if (res.selection === goods2.length) {
                        this.shopMgr(cid, 1);
                        return;
                    }
                    this.shopMgr(cid, 7, goods2[res.selection].id);
                }).catch(() => { });
                break;
            }
            // ---- step 7: 取出回收库存 ----
            case 7: {
                if (!good || good.sv <= 0) {
                    this.errorPop("暂时没有需要取出的库存。");
                    break;
                }
                Gui.modalForm().title("取出回收库存")
                    .slider("取出数量", 1, good.sv, { valueStep: 1, defaultValue: 1 })
                    .show(this.player).then((res) => {
                    if (res.canceled) {
                        this.shopMgr(cid, 1);
                        return;
                    }
                    const num = res.formValues[0];
                    good.sv -= num;
                    DB.saveGood(good);
                    this.player.runCommand('give "' + this.player.name + '" ' + good.item.type + ' ' + num + ' ' + good.item.aux);
                    Msg.success("取出成功。", this.player);
                    this.shopMgr(cid, 1);
                }).catch(() => { });
                break;
            }
            // ---- step 8: 回收招募审核 ----
            case 8: {
                const goods1 = CoopCore.getGoods(1, true, 2, cid, undefined, false);
                if (goods1.length === 0)
                    return false;
                const form = Gui.simpleForm().title("回收招募审核列表");
                for (const g of goods1) {
                    form.button(g.name + " " + unit + g.money + "\n待审核");
                }
                form.show(this.player).then((res) => {
                    if (res.canceled)
                        return;
                    const g = goods1[res.selection];
                    this.confirmPop("回收招募审核列表", "名称: " + g.name + "\n描述: " + (g.des || "") + "\n价格: " + g.money + "\n库存: " + g.num + "\n\n确定通过审核？", () => {
                        g.isTrue = true;
                        DB.saveGood(g);
                        Msg.success("操作成功。", this.player);
                    });
                }).catch(() => { });
                return true;
            }
        }
    }
    // ==========================================
    //  上架商品
    // ==========================================
    shopAdd(cid, step, index) {
        var _a;
        switch (step) {
            // ---- step 1: 选择物品栏和操作类型 ----
            case 1: {
                Gui.modalForm().title("上架物品")
                    .dropdown("请选择物品栏", ["1", "2", "3", "4", "5", "6", "7", "8", "9"])
                    .dropdown("请选择操作类型", ["求购", "回收"])
                    .show(this.player).then((res) => {
                    if (!res.canceled)
                        this.shopAdd(cid, res.formValues[1] + 2, res.formValues[0]);
                }).catch(() => { });
                break;
            }
            // ---- step 2: 求购上架 ----
            case 2: {
                const inv = this.player.getComponent("inventory");
                const item = (_a = inv === null || inv === void 0 ? void 0 : inv.container) === null || _a === void 0 ? void 0 : _a.getItem(index !== null && index !== void 0 ? index : 0);
                if (!item) {
                    this.errorPop("请确认物品栏有物品");
                    return;
                }
                const customGroups = CoopCore.getGroups(true);
                const cgNames = ["无", ...customGroups.map((g) => g.displayname)];
                Gui.modalForm().title("商品信息")
                    .textField("type: " + item.typeId, item.typeId, { defaultValue: item.typeId })
                    .textField("商品名称", item.typeId, { defaultValue: item.typeId })
                    .textField("商品描述", "")
                    .textField("价格", "0")
                    .dropdown("自定义分组", cgNames)
                    .show(this.player).then((res) => {
                    if (res.canceled)
                        return;
                    const vals = res.formValues;
                    const money = parseInt(vals[3]) || 0;
                    const cgIdx = vals[4];
                    const gt = [];
                    if (cgIdx > 0)
                        gt.push(customGroups[cgIdx - 1].groupid);
                    gt.push(...CoopCore.typeGood(item));
                    const newGood = {
                        name: vals[1],
                        id: CoopCore.generateId(),
                        time: Date.now(),
                        type: 1,
                        groups: gt,
                        des: vals[2],
                        num: 1,
                        sv: 0,
                        money,
                        cid: cid,
                        isTrue: true,
                        item: { nbt: "", type: item.typeId, aux: 0 },
                    };
                    DB.saveGood(newGood);
                    Msg.success("上架成功！", this.player);
                }).catch(() => { });
                break;
            }
            // ---- step 3: 回收功能（暂未实现） ----
            case 3: {
                this.errorPop("回收功能暂未完全实现");
                break;
            }
            // ---- step 4: 添加自定义分组 ----
            case 4: {
                Gui.modalForm().title("添加自定义分组").textField("分组名称", "")
                    .show(this.player).then((res) => {
                    var _a;
                    if (res.canceled)
                        return;
                    const name = (_a = res.formValues[0]) === null || _a === void 0 ? void 0 : _a.trim();
                    if (!name) {
                        this.errorPop("请填写完整信息！");
                        return;
                    }
                    DB.saveGroup({ groupid: "custom_" + _genId(), displayname: name });
                    Msg.success("操作成功。", this.player);
                }).catch(() => { });
                break;
            }
        }
    }
}
//# sourceMappingURL=CoopGUI.js.map