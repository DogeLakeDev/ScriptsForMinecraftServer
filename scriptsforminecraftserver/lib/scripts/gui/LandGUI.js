/* ---------------------------------------- *\
 *  土地插件 — GUI 界面
\* ---------------------------------------- */
import { world } from "@minecraft/server";
import { CustomForm } from "@minecraft/server-ui";
import { Gui, ObservableString, ObservableBoolean } from "../libs/Gui";
import { LandCore } from "../land/LandCore";
import { Database } from "../land/LandDatabase";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
export class LandGUI {
    /** !land 入口：按状态分发 */
    static showMainMenu(player) {
        const id = player.id;
        const session = LandCore.getSession(id);
        if (session) {
            this.showStateDialog(player);
        }
        else {
            this.showHomeMenu(player);
        }
    }
    // ══════════════════════════════════════
    //  主菜单
    // ══════════════════════════════════════
    static showHomeMenu(player) {
        const plid = player.id;
        const lands = LandCore.getPlayerLands(plid);
        const landCount = lands.length;
        const body = [`当前拥有 §e${landCount}§r 块土地。`];
        const form = new CustomForm(player, "土地")
            .label(ListFormInfo(body))
            .button("申请土地", () => this.startApplication(player));
        if (landCount > 0) {
            form.button("我的土地", () => this.showLandList(player));
        }
        form.closeButton();
        Gui.showForm(player, form, "土地");
    }
    // ══════════════════════════════════════
    //  土地列表
    // ══════════════════════════════════════
    static showLandList(player) {
        const plid = player.id;
        const lands = LandCore.getPlayerLands(plid);
        if (lands.length === 0) {
            Msg.info("你还没有任何土地。", player);
            return;
        }
        const form = new CustomForm(player, "我的土地")
            .label(ListFormInfo([`当前拥有 §e${lands.length}§r 块土地。`]));
        for (const land of lands) {
            const name = land.nickname || land.id;
            const info = LandCore.getCubeInfo(land.posA, land.posB);
            form.button(`${name}\n${info.square} 格 | ${LandCore.getDimensionName(land.dimid)}`, () => {
                this.showLandManage(player, land);
            });
        }
        form.closeButton();
        Gui.showForm(player, form, "我的土地");
    }
    // ══════════════════════════════════════
    //  土地管理面板
    // ══════════════════════════════════════
    static showLandManage(player, land) {
        const plid = player.id;
        const isOwner = LandCore.isOwner(land, plid);
        const isMgr = LandCore.isManager(land, plid);
        const canManage = isOwner || isMgr;
        const name = land.nickname || land.id;
        const info = LandCore.getCubeInfo(land.posA, land.posB);
        const ownerName = land.ownerName || "§7未知§r";
        let body = [
            `土地信息：`,
            `  §7- 土地名称: §r${name}§7(${land.id})`,
            `  §7- 拥有者: §r${ownerName}`,
            `  §7- 面积: §r ${info.square}§7 格 | 体积: §r ${info.volume} §7格`,
            `  §7- 维度: §r${LandCore.getDimensionName(land.dimid)}`,
            `  §7- 管理者: §r${land.managers.length} 人`,
        ];
        if (!canManage) {
            body.push("你没有权限管理此土地。");
            Msg.info(body.join("\n"), player);
            return;
        }
        const form = new CustomForm(player, "土地管理")
            .label(ListFormInfo(body))
            .button("土地保护", () => this.showPermEditor(player, land))
            .button("管理者管理", () => this.showManagerEditor(player, land))
            .button("设置名称", () => this.showRenameDialog(player, land))
            .button("删除土地", () => this.showDeleteConfirm(player, land))
            .closeButton();
        Gui.showForm(player, form, "土地管理");
    }
    // ══════════════════════════════════════
    //  权限设置
    // ══════════════════════════════════════
    static showPermEditor(player, land) {
        const cfg = Database.getDefaultPermissions();
        const perm = land.permissions;
        const allowPlace = new ObservableBoolean(perm.allow_place);
        const allowDestroy = new ObservableBoolean(perm.allow_destroy);
        const attackEntity = new ObservableBoolean(perm.attack_entity);
        const openContainer = new ObservableBoolean(perm.open_container);
        const form = new CustomForm(player, "土地保护设置")
            .label(ListFormInfo([]))
            .toggle(`允许访客§6放置方块`, allowPlace)
            .toggle(`允许访客§6破坏方块`, allowDestroy)
            .toggle(`允许访客§6攻击实体`, attackEntity)
            .toggle(`允许访客§6打开容器`, openContainer)
            .button("确认", () => {
            land.permissions.allow_place = allowPlace.getData();
            land.permissions.allow_destroy = allowDestroy.getData();
            land.permissions.attack_entity = attackEntity.getData();
            land.permissions.open_container = openContainer.getData();
            Database.update(land);
            Msg.success("土地保护设置已更新。", player);
        })
            .closeButton();
        Gui.showForm(player, form, "土地保护设置");
    }
    // ══════════════════════════════════════
    //  管理者管理
    // ══════════════════════════════════════
    static showManagerEditor(player, land) {
        const plid = player.id;
        const isOwner = LandCore.isOwner(land, plid);
        const body = [
            "当前管理者：",
            ...land.managers.map((m) => {
                if (m === land.ownerplid)
                    return `  - ${land.ownerName} (拥有者)`;
                const p = world.getPlayers().find((pl) => pl.id === m);
                return p ? `  - ${p.name}` : `  - ${m.substring(0, 8)}...`;
            }),
        ];
        const form = new CustomForm(player, "管理者管理")
            .label(ListFormInfo(body))
            .button("添加管理者", () => this.showAddManager(player, land));
        if (isOwner && land.managers.length > 1) {
            form.button("移除管理者", () => this.showRemoveManager(player, land));
        }
        form.closeButton();
        Gui.showForm(player, form, "管理者管理");
    }
    static showAddManager(player, land) {
        const plid = player.id;
        const online = world.getPlayers().filter((p) => p.id !== plid && !land.managers.includes(p.id));
        if (online.length === 0) {
            Msg.error("没有可添加的在线玩家。", player);
            return;
        }
        const form = new CustomForm(player, "添加管理者")
            .label(ListFormInfo(["选择要添加为管理者的玩家。"]));
        for (const p of online) {
            const targetId = p.id;
            const targetName = p.name;
            form.button(p.name, () => {
                if (land.managers.includes(targetId)) {
                    Msg.error("该玩家已经是管理者。", player);
                    return;
                }
                land.managers.push(targetId);
                Database.update(land);
                Msg.success(`已将 ${targetName} 添加为管理者。`, player);
            });
        }
        form.closeButton();
        Gui.showForm(player, form, "添加管理者");
    }
    static showRemoveManager(player, land) {
        const nonOwnerMgrs = land.managers.filter((m) => m !== land.ownerplid);
        if (nonOwnerMgrs.length === 0) {
            Msg.error("没有可移除的管理者。", player);
            return;
        }
        const form = new CustomForm(player, "移除管理者")
            .label(ListFormInfo(["选择要移除的管理者。"]));
        for (const m of nonOwnerMgrs) {
            const targetId = m;
            const p = world.getPlayers().find((pl) => pl.id === m);
            form.button(p ? p.name : m.substring(0, 8) + "...", () => {
                const idx = land.managers.indexOf(targetId);
                if (idx !== -1) {
                    land.managers.splice(idx, 1);
                    Database.update(land);
                    Msg.success("已移除该管理者。", player);
                }
            });
        }
        form.closeButton();
        Gui.showForm(player, form, "移除管理者");
    }
    // ══════════════════════════════════════
    //  重命名
    // ══════════════════════════════════════
    static showRenameDialog(player, land) {
        const name = new ObservableString(land.nickname || "");
        const form = new CustomForm(player, "设置土地名称")
            .textField("土地名称", name, { description: "输入新名称（留空恢复默认）" })
            .button("确认", () => {
            const val = name.getData().trim();
            land.nickname = val;
            Database.update(land);
            Msg.success(val ? `土地已重命名为 ${val}。` : "土地名称已恢复默认。", player);
        })
            .closeButton();
        Gui.showForm(player, form, "设置土地名称");
    }
    // ══════════════════════════════════════
    //  删除土地
    // ══════════════════════════════════════
    static showDeleteConfirm(player, land) {
        const plid = player.id;
        if (!LandCore.isOwner(land, plid) && !LandCore.isManager(land, plid)) {
            Msg.error("你没有权限删除此土地。", player);
            return;
        }
        const price = LandCore.calculatePrice(land.posA, land.posB);
        const cfg = Database.getConfig();
        const refund = Math.floor(price * cfg.refundRate);
        const name = land.nickname || land.id;
        const body = [
            `§c确定要删除土地 §r${name} §c吗？`,
            `  §7- 面积: §a${LandCore.getCubeInfo(land.posA, land.posB).square} §7格`,
            `  §7- 退款: §a${refund} §7${Money.UNIT}`,
            ``,
            `§c此操作不可撤销！`,
        ].join("\n");
        Gui.confirm(player, "删除土地", body, () => {
            if (LandCore.deleteLand(land.id, player)) {
                Msg.success(`土地已删除，获得 ${refund} ${Money.UNIT}。`, player);
            }
            else {
                Msg.error("删除失败。", player);
            }
        });
    }
    // ══════════════════════════════════════
    //  状态对话框（申请流程）
    // ══════════════════════════════════════
    static showStateDialog(player) {
        const plid = player.id;
        const session = LandCore.getSession(plid);
        const hasPos1 = !!session?.pos1;
        const hasPos2 = !!session?.pos2;
        const bothSet = hasPos1 && hasPos2;
        if (!bothSet) {
            const body = ["请先完整选择土地范围。"];
            if (hasPos1 && !hasPos2)
                body.push("  §6!pos2 §r- 继续设置第二点");
            if (hasPos2 && !hasPos1)
                body.push("  §6!pos1 §r- 继续设置第一点");
            const form = new CustomForm(player, "土地申请")
                .label(ListFormInfo(body))
                .button("取消申请", () => {
                LandCore.clearSession(plid);
                Msg.warning("土地申请已取消。", player);
            })
                .closeButton();
            Gui.showForm(player, form, "土地申请");
        }
        else {
            const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
            const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid).replace(/§[cef6]/g, "");
            const body = [info, "§7确认申请该土地？"];
            const form = new CustomForm(player, "确认土地申请")
                .label(ListFormInfo(body))
                .button("确认申请", () => {
                this.handleApply(player, session?.pos1, session?.pos2, dimid);
            })
                .button("取消申请", () => {
                if (LandCore.clearSession(plid))
                    Msg.warning("土地申请已取消。", player);
                else
                    Msg.error("土地申请取消失败。", player);
            })
                .closeButton();
            Gui.showForm(player, form, "确认土地申请");
        }
    }
    // ══════════════════════════════════════
    //  申请入口
    // ══════════════════════════════════════
    static startApplication(player) {
        const plid = player.id;
        LandCore.initSession(plid);
        Msg.info([
            `可在聊天框输入以下命令完成土地申请流程：`,
            `  [1] §6§l!pos1§r §f- 设置第一点（站在对应位置输入）`,
            `  [2] §6§l!pos2§r §f- 设置第二点`,
            `  [3] §6§l!land§r §f- 打开菜单进行§e验证与确认§r`,
        ].join("\n"), player);
        Msg.tips(`在确认土地前，可重复输入 !pos1 和 !pos2 命令，来修改合适的土地范围。`, player);
    }
    // ══════════════════════════════════════
    //  处理创建
    // ══════════════════════════════════════
    static async handleApply(player, pos1, pos2, dimid) {
        const result = LandCore.validateCreation(player, pos1, pos2, dimid);
        if (!result.ok) {
            Msg.error(result.msg ?? "验证失败。", player);
            return;
        }
        const land = LandCore.createLand(player, pos1, pos2, dimid);
        if (land) {
            Msg.success(`土地创建成功！\n土地编号: ${land.id}\n面积: ${LandCore.getCubeInfo(land.posA, land.posB).square} 格`, player);
        }
        else {
            Msg.error("土地创建失败，请重试。", player);
        }
    }
}
//# sourceMappingURL=LandGUI.js.map