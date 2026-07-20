import { EntityInventoryComponent, Player } from "@minecraft/server";
import type { CoopMember, CoopShopItem } from "@sfmc/types";
import { CoopCore } from "@sfmc/module-coop";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { FormStatus, MenuNavigator, obsNum, obsStr } from "@sfmc/sdk/sapi/runtime";
import { ListFormInfo, Msg } from "@sfmc/sdk/sapi/runtime";
import * as CoopApi from "./CoopApi.js";

function countItemInInventory(player: Player): number {
  const inv = player.getComponent("inventory") as EntityInventoryComponent | undefined;
  if (!inv?.container) return 0;
  let total = 0;
  for (let i = 0; i < inv.container.size; i++) {
    const item = inv.container.getItem(i);
    if (item?.amount) total += item.amount;
  }
  return total;
}

function _genId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function _fmtGoodBt(name: string, unit: string, price: number, sv: number, num: number, isBuy: boolean): string {
  return isBuy ? `${name} ${unit}${price}\n已售：${sv} 库存：${num}` : `${name} ${unit}${price}\n可回收：${sv}/${num}`;
}

export class CoopGUI {
  private nav: MenuNavigator;
  private player: Player;

  constructor(player: Player) {
    debug.i("GUI", `CoopGUI: constructor player=${player.name}`);
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }

  async mainPanel() {
    debug.i("GUI", `CoopGUI.mainPanel: player=${this.player.name}`);
    const cid = await CoopApi.findPlayerCoop(this.player.id);
    if (!cid) {
      this.nav.start("noCoop");
      return;
    }
    this.nav.state.cid = cid;
    this.nav.start("coopInfo");
  }

  static async openShopMgr(player: Player) {
    debug.i("GUI", `CoopGUI.openShopMgr: player=${player.name}`);
    const gui = new CoopGUI(player);
    gui.nav.state.cid = (await CoopApi.findPlayerCoop(player.id)) ?? "";
    gui.nav.start("shopMgr");
  }

  private registerSections(): void {
    // Main
    this.nav.section("noCoop", "合作社", (p) => this.buildNoCoop(p));
    this.nav.section("coopInfo", "合作社", (p) => this.buildCoopInfo(p));
    this.nav.section("joinByCid", "加入合作社", (p) => this.buildJoinByCid(p));
    this.nav.section("coopList", "合作社列表", (p) => this.buildCoopList(p));
    this.nav.section("createCoop", "创建合作社", (p) => this.buildCreateCoop(p));
    this.nav.section("adminPanel", "管理面板", (p) => this.buildAdminPanel(p));
    this.nav.section("talkToMembers", "喊话", (p) => this.buildTalkToMembers(p));
    this.nav.section("addAdmin", "添加管理", (p) => this.buildAddAdmin(p));
    this.nav.section("bankPanel", "银行", (p) => this.buildBankPanel(p));
    this.nav.section("bankControl", "银行操作", (p) => this.buildBankControl(p));
    this.nav.section("rank", "排行榜", (p) => this.buildRank(p));
    this.nav.section("log", "更新日志", (p) => this.buildLog(p));

    // Shop
    this.nav.section("shopMgr", "商店管理后台", (p) => this.buildShopMgr(p));
    this.nav.section("shopItemOps", "商店管理后台", (p) => this.buildShopItemOps(p));
    this.nav.section("shopRestock", "补货", (p) => this.buildShopRestock(p));
    this.nav.section("shopEdit", "编辑商品信息", (p) => this.buildShopEdit(p));
    this.nav.section("shopRecycleList", "商店管理后台", (p) => this.buildShopRecycleList(p));
    this.nav.section("shopRecycleTake", "取出回收库存", (p) => this.buildShopRecycleTake(p));
    this.nav.section("shopRecycleReview", "回收招募审核列表", (p) => this.buildShopRecycleReview(p));
    this.nav.section("shopAddSelect", "上架物品", (p) => this.buildShopAddSelect(p));
    this.nav.section("shopAddItem", "商品信息", (p) => this.buildShopAddItem(p));
    this.nav.section("shopAddGroup", "添加自定义分组", (p) => this.buildShopAddGroup(p));
  }

  // ── No Coop ──

  private buildNoCoop(page: any): void {
    debug.i("GUI", "CoopGUI.buildNoCoop");
    page.label(
      ListFormInfo(["你没有加入任何一个合作社，请选择操作。\n\nCiallo～(∠・ω＜)⌢☆"])
    );
    page.button("通过 CID 加入合作社", () => this.nav.go("joinByCid"));
    page.button("查看所有合作社", () => this.nav.rebuild("coopList"));
    page.button("创建合作社", () => this.nav.go("createCoop"));
    page.button("合作社排行榜", () => this.nav.rebuild("rank"));
    page.button("插件更新日志", () => this.nav.go("log"));
  }

  private async buildJoinByCid(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildJoinByCid");
    const obsCid = obsStr("");
    const status = obsStr("");
    page.label(status);
    page.textField("CID", obsCid, { description: "仅支持英文/数字" });
    page.button("确认", async () => {
      const cid = obsCid.getData()?.trim();
      if (!cid) {
        status.setData("§c请填写CID");
        return;
      }
      const data = await CoopApi.getCoop(cid);
      if (!data) {
        status.setData("§c请检查CID是否正确");
        return;
      }
      this.nav.state.cid = cid;
      await this.nav.rebuild("coopInfo");
    });
  }

  private async buildCoopList(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildCoopList");
    const all = await CoopApi.getAllCoops();
    if (all.length === 0) {
      page.label(ListFormInfo(["还没有任何合作社"]));
      return;
    }
    for (const c of all) {
      page.button(c.name, () => {
        this.nav.state.cid = c.cid;
        this.nav.rebuild("coopInfo");
      });
    }
  }

  private buildCreateCoop(page: any): void {
    debug.i("GUI", "CoopGUI.buildCreateCoop");
    const obsName = obsStr("");
    const obsCid = obsStr("");
    const status = obsStr("");
    page.label(status);
    page.textField("合作社名称", obsName);
    page.textField("CID", obsCid, { description: "仅支持英文/数字，用作邀请码" });
    page.button("确认", async () => {
      if (!obsName.getData() || !obsCid.getData()) {
        status.setData("§c请填写完整信息");
        return;
      }
      if (await CoopCore.registerCoop(obsName.getData(), obsCid.getData(), this.player)) {
        status.setData("§a合作社创建成功！");
        this.nav.state.cid = obsCid.getData();
        await this.nav.rebuild("coopInfo");
      } else {
        status.setData(`§c你的${Money.UNIT}似乎不够或CID已被占用！`);
      }
    });
  }

  // ── Coop Info ──

  private async buildCoopInfo(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildCoopInfo");
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const text = await CoopCore.getInfo(cid);
    const isOp = await CoopCore.isOp(this.player.id, cid);
    const members = await CoopApi.getMembers(cid);
    const isMember = members.some((m: CoopMember) => m.player_id === this.player.id);

    page.label(ListFormInfo([text]));
    if (!isMember) {
      page.button("加入", async () => {
        if (await CoopCore.joinCoop(this.player, cid)) await this.nav.rebuild("coopInfo");
        else Msg.error("加入合作社失败，请稍后重试。", this.player);
      });
      return;
    }
    page.button("集体商店后台", () => {
      this.nav.state.cid = cid;
      this.nav.rebuild("shopMgr");
    });
    page.button("公有银行", () => {
      this.nav.state.cid = cid;
      this.nav.go("bankPanel");
    });
    page.button("成员列表", async () => this.infoPop((await CoopCore.getMemberList(cid)).join(", ")));
    page.button("查看所有合作社", () => this.nav.rebuild("coopList"));
    page.button("合作社排行榜", () => this.nav.rebuild("rank"));
    page.button(isOp ? "解散此合作社" : "退出此合作社", () => this.exitConfirm(cid));
    page.button("插件更新日志", () => this.nav.go("log"));
    if (isOp) page.button("管理面板", () => this.nav.rebuild("adminPanel"));
  }

  private async exitConfirm(cid: string): Promise<void> {
    const isOp = await CoopCore.isOp(this.player.id, cid);
    this.nav.confirm(
      "合作社 - 确认",
      isOp ? "确认解散合作社？所有成员也会被踢出。\n请先清空银行经济、下架商品。" : "你确认退出合作社吗？",
      async () => {
        if (isOp) {
          await CoopCore.releaseCoop(cid, this.player.id);
          this.infoPop("解散成功。");
        } else {
          await CoopCore.exitCoop(this.player.id, cid);
          this.infoPop("已退出合作社。");
          await CoopCore.sendToMembers(cid, this.player.name + " 退出了合作社。拜拜～");
        }
      },
      () => this.nav.rebuild("noCoop")
    );
  }

  // ── Admin ──

  private buildAdminPanel(page: any): void {
    debug.i("GUI", "CoopGUI.buildAdminPanel");
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    page.label(ListFormInfo(["CID: " + cid]));
    page.button("向所有成员喊话", () => this.nav.go("talkToMembers"));
    page.button("添加管理成员", () => this.nav.rebuild("addAdmin"));
  }

  private buildTalkToMembers(page: any): void {
    const status = new FormStatus(page);
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const obsMsg = obsStr("");
    page.textField("喊话内容", obsMsg, { description: "(ᵜ ˰ ᵜ)" });
    page.button("确认", async () => {
      await CoopCore.sendToMembers(cid, this.player.name + ": " + obsMsg.getData());
      status.info("喊话成功。");
    });
  }

  private async buildAddAdmin(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildAddAdmin");
    const status = new FormStatus(page);
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const members = await CoopCore.getMemberList(cid);
    if (members.length === 0) {
      page.label("没有成员。");
      return;
    }
    const memberItems = members.map((m, i) => ({ label: m, value: i }));
    const obsIdx = obsNum(0);
    page.dropdown("将成员权限提升至管理员...", obsIdx, memberItems);
    page.button("确认", () => {
      const idx = obsIdx.getData();
      this.nav.confirm(
        "合作社 - 确认",
        "目标玩家会获得管理面板的使用权，确认操作吗？",
        async () => {
          await CoopCore.setOp(cid, idx);
          status.info("操作成功。");
        },
        () => this.nav.rebuild("adminPanel")
      );
    });
  }

  // ── Bank ──

  private async buildBankPanel(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildBankPanel");
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const data = await CoopApi.getCoop(cid);
    if (!data) {
      page.label("数据丢失。");
      return;
    }
    const obsAction = obsNum(0);
    page.dropdown("请选择操作", obsAction, [
      { label: "存入", value: 0 },
      { label: "取出", value: 1 },
    ]);
    const logs = await CoopApi.getBankLog(cid);
    const moneylist = logs.length
      ? logs
          .map(
            (l) =>
              `${l.actor_name_snapshot} ${l.type === 1 ? "存入" : "取出"} ${l.amount}${l.note ? ` (${l.note})` : ""}`
          )
          .join("\n")
      : "暂无记录";
    page.label("§6合作社银行经济：§r" + (data.account?.balance || 0) + "\n§6账单：§r\n" + moneylist);
    page.button("确认", () => {
      this.nav.state.bankType = obsAction.getData() + 1;
      this.nav.go("bankControl");
    });
  }

  private buildBankControl(page: any): void {
    debug.i("GUI", "CoopGUI.buildBankControl");
    const status = new FormStatus(page);
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const type = this.nav.state.bankType as number;
    const obsAmount = obsStr("");
    const obsNote = obsStr("");
    page.textField("金额", obsAmount);
    page.textField("备注(可选)", obsNote, { description: "无" });
    page.button("确认", async () => {
      const val = parseInt(obsAmount.getData());
      if (isNaN(val) || val <= 0) {
        status.fail("金额填写不正确");
        return;
      }
      const bcResult = await CoopCore.bankControl(cid, this.player, val, obsNote.getData() || "", type === 1 ? 1 : 2);
      if (bcResult.ok) {
        status.ok((type === 1 ? "存入" : "取出") + "成功！" + Money.UNIT + "：" + val);
      } else {
        status.fail(bcResult.error || "操作失败");
      }
    });
  }

  // ── Rank & Log ──

  private async buildRank(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildRank");
    const rankType = (this.nav.state.rankType as number) ?? 1;
    page.label(await CoopCore.getRankInfo(rankType));
    if (rankType === 1) {
      page.button("切换到人数排行", () => {
        this.nav.state.rankType = 2;
        this.nav.rebuild("rank");
      });
    } else {
      page.button("切换到银行经济排行", () => {
        this.nav.state.rankType = 1;
        this.nav.rebuild("rank");
      });
    }
  }

  private buildLog(page: any): void {
    debug.i("GUI", "CoopGUI.buildLog");
    page.label(ListFormInfo(["暂无更新日志。"]));
  }
  // ── Shop Manager ──

  private async buildShopMgr(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildShopMgr");
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const isOp = await CoopCore.isOp(this.player.id, cid);
    const goods = await CoopCore.getGoods(1, true, 1, cid);

    page.label(ListFormInfo(["选择操作"]));
    page.button("上架物品", () => this.nav.go("shopAddSelect"));
    page.button("回收物品管理", () => this.nav.rebuild("shopRecycleList"));
    page.button("添加自定义分组", () => this.nav.go("shopAddGroup"));
    if (isOp) {
      page.button("回收招募审核", () => this.nav.rebuild("shopRecycleReview"));
    }
    for (const g of goods) {
      page.button(_fmtGoodBt(g.name, Money.UNIT, g.money, g.sv, g.num, true), () => {
        this.nav.state.gid = g.id;
        this.nav.state.good = g;
        this.nav.go("shopItemOps");
      });
    }
  }

  private buildShopItemOps(page: any): void {
    debug.i("GUI", "CoopGUI.buildShopItemOps");
    const gid = this.nav.state.gid as string;
    const good = this.nav.state.good as CoopShopItem;
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    if (!good) {
      page.label("商品数据丢失。");
      return;
    }

    const obsAction = obsNum(0);
    page.label("gid:" + gid);
    page.dropdown("操作", obsAction, [
      { label: "补货", value: 0 },
      { label: "下架", value: 1 },
      { label: "编辑", value: 2 },
    ]);
    page.button("确认", () => {
      const act = obsAction.getData();
      if (act === 0) this.nav.go("shopRestock");
      else if (act === 1) this.doDelist(cid, gid!, good);
      else this.nav.go("shopEdit");
    });
  }

  private buildShopRestock(page: any): void {
    debug.i("GUI", "CoopGUI.buildShopRestock");
    const status = new FormStatus(page);
    const good = this.nav.state.good as CoopShopItem;
    if (!good) {
      page.label("商品数据丢失。");
      return;
    }
    if (good.item_nbt) {
      page.label("NBT物品无法补货。");
      return;
    }

    const inv = this.player.getComponent("inventory") as EntityInventoryComponent | undefined;
    const firstItem = inv?.container?.getItem(0);
    if (!firstItem || firstItem.typeId !== good.item_type) {
      page.label("请将该商品放在物品栏第一格。");
      return;
    }
    const total = countItemInInventory(this.player);
    const sliderVal = obsNum(1);
    page.label("当前库存：" + good.num);
    page.slider("补货数量", sliderVal, 1, Math.max(total, 1), { step: 1 });
    page.button("确认", async () => {
      const num = sliderVal.getData();
      if (num <= 0) {
        status.fail("请填写完整信息！");
        return;
      }
      good.num += num;
      await CoopApi.saveShopItem(good);
      try {
        this.player.runCommand(`clear @s ${good.item_type} ${good.item_aux ?? 0} ${num}`);
      } catch {
        status.fail("补货扣除物品失败，请手动清理背包。");
        return;
      }
      status.ok("补货成功。");
      await this.nav.rebuild("shopMgr");
    });
  }

  private doDelist(_cid: string, gid: string, good: CoopShopItem): void {
    this.nav.confirm(
      "下架确认",
      "确认下架 " + good.name + " ？\n下架后库存将返还给你。",
      async () => {
        await CoopApi.deleteShopItem(good.cid, gid);
        try {
          this.player.runCommand(`give @s ${good.item_type} ${good.num} ${good.item_aux ?? 0}`);
        } catch {
          Msg.error("物品返还失败，请联系管理员。", this.player);
          return;
        }
        Msg.success("下架成功。", this.player);
      },
      () => this.nav.rebuild("shopMgr")
    );
  }

  private async buildShopEdit(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildShopEdit");
    const status = new FormStatus(page);
    const good = this.nav.state.good as CoopShopItem;
    if (!good) {
      page.label("商品数据丢失。");
      return;
    }
    const customGroups = await CoopCore.getGroups(true);
    const cgNames = ["无", ...customGroups.map((g: any) => g.displayname)];
    const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));

    const obsName = obsStr(good.name);
    const obsDes = obsStr(good.des || "");
    const obsPrice = obsStr(String(good.money));
    const obsGroup = obsNum(0);
    page.textField("商品名称", obsName);
    page.textField("商品描述", obsDes);
    page.textField("价格", obsPrice);
    page.dropdown("自定义分组", obsGroup, cgItems);
    page.button("确认", async () => {
      good.name = obsName.getData();
      good.des = obsDes.getData();
      good.money = parseInt(obsPrice.getData()) || 0;
      const cgIdx = obsGroup.getData();
      if (cgIdx > 0) {
        const groups = JSON.parse(good.groups || "[]") as string[];
        const idx = groups.findIndex((g: string) => customGroups.some((cg: any) => cg.groupid === g));
        if (idx !== -1) groups.splice(idx, 1);
        const nextGroup = customGroups[cgIdx - 1];
        if (nextGroup) groups.push(nextGroup.groupid);
        good.groups = JSON.stringify(groups);
      }
      await CoopApi.saveShopItem(good);
      status.ok("修改成功。");
      await this.nav.rebuild("shopMgr");
    });
  }

  private async buildShopRecycleList(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildShopRecycleList");
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const goods2 = await CoopCore.getGoods(1, true, 2, cid);
    for (const g of goods2) {
      page.button(_fmtGoodBt(g.name, Money.UNIT, g.money, g.sv, g.num, false), () => {
        this.nav.state.good = g;
        this.nav.state.gid = g.id;
        this.nav.go("shopRecycleTake");
      });
    }
  }

  private buildShopRecycleTake(page: any): void {
    debug.i("GUI", "CoopGUI.buildShopRecycleTake");
    const status = new FormStatus(page);
    const good = this.nav.state.good as CoopShopItem;
    if (!good || good.sv <= 0) {
      page.label("暂时没有需要取出的库存。");
      return;
    }
    const sliderVal = obsNum(1);
    page.slider("取出数量", sliderVal, 1, good.sv, { step: 1 });
    page.button("确认", async () => {
      const num = sliderVal.getData();
      good.sv -= num;
      await CoopApi.saveShopItem(good);
      try {
        this.player.runCommand(`give @s ${good.item_type} ${num} ${good.item_aux ?? 0}`);
      } catch {
        status.fail("取出物品失败，请联系管理员。");
        return;
      }
      status.ok("取出成功。");
      await this.nav.rebuild("shopRecycleList");
    });
  }

  private async buildShopRecycleReview(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildShopRecycleReview");
    const status = new FormStatus(page);
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const goods1 = await CoopCore.getGoods(1, true, 2, cid, undefined, false);
    if (goods1.length === 0) {
      page.label(ListFormInfo(["没有待审核的回收招募"]));
      return;
    }
    for (const g of goods1) {
      page.button(g.name + " " + Money.UNIT + g.money + "\n待审核", () => {
        this.nav.confirm(
          "回收招募审核",
          `名称: ${g.name}\n描述: ${g.des || ""}\n价格: ${g.money}\n库存: ${g.num}\n\n确定通过审核？`,
          async () => {
            g.is_true = true;
            await CoopApi.saveShopItem(g);
            status.ok("操作成功。");
          },
          () => this.nav.rebuild("shopRecycleReview")
        );
      });
    }
  }

  // ── Shop Add ──

  private buildShopAddSelect(page: any): void {
    debug.i("GUI", "CoopGUI.buildShopAddSelect");
    const obsSlot = obsNum(0);
    const obsType = obsNum(0);
    page.dropdown("请选择物品栏", obsSlot, [
      { label: "1", value: 0 },
      { label: "2", value: 1 },
      { label: "3", value: 2 },
      { label: "4", value: 3 },
      { label: "5", value: 4 },
      { label: "6", value: 5 },
      { label: "7", value: 6 },
      { label: "8", value: 7 },
      { label: "9", value: 8 },
    ]);
    page.dropdown("请选择操作类型", obsType, [
      { label: "求购", value: 0 },
      { label: "回收", value: 1 },
    ]);
    page.button("确认", () => {
      const selType = obsType.getData();
      const slot = obsSlot.getData();
      if (selType === 0) {
        this.nav.state.slot = slot;
        this.nav.go("shopAddItem");
      } else {
        this.errorPop("回收功能暂未完全实现");
      }
    });
  }

  private async buildShopAddItem(page: any): Promise<void> {
    debug.i("GUI", "CoopGUI.buildShopAddItem");
    const status = new FormStatus(page);
    const cid = this.nav.state.cid as string | undefined;
    if (!cid) {
      page.label("请先加入一个合作社。");
      return;
    }
    const index = this.nav.state.slot as number;
    const inv = this.player.getComponent("inventory") as EntityInventoryComponent | undefined;
    const item = inv?.container?.getItem(index ?? 0);
    if (!item) {
      page.label("请确认物品栏有物品");
      return;
    }

    const customGroups = await CoopCore.getGroups(true);
    const cgNames = ["无", ...customGroups.map((g: any) => g.displayname)];
    const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));

    const obsType = obsStr(item.typeId);
    const obsName = obsStr(item.typeId);
    const obsDes = obsStr("");
    const obsPrice = obsStr("0");
    const obsGroup = obsNum(0);

    page.textField("type: " + item.typeId, obsType, { description: item.typeId });
    page.textField("商品名称", obsName, { description: item.typeId });
    page.textField("商品描述", obsDes);
    page.textField("价格", obsPrice, { description: "0" });
    page.dropdown("自定义分组", obsGroup, cgItems);
    page.button("确认", async () => {
      const money = parseInt(obsPrice.getData()) || 0;
      const cgIdx = obsGroup.getData();
      const gt: string[] = [];
      if (cgIdx > 0) {
        const nextGroup = customGroups[cgIdx - 1];
        if (nextGroup) gt.push(nextGroup.groupid);
      }
      gt.push(...(await CoopCore.typeGood(item!)));
      const newGood: CoopShopItem = {
        id: CoopCore.generateId(),
        cid: cid,
        name: obsName.getData(),
        item_type: item.typeId,
        item_aux: 0,
        item_nbt: "",
        type: 1,
        groups: JSON.stringify(gt),
        des: obsDes.getData(),
        num: 1,
        sv: 0,
        money,
        is_true: true,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      await CoopApi.saveShopItem(newGood);
      status.ok("上架成功！");
      await this.nav.rebuild("shopMgr");
    });
  }

  private buildShopAddGroup(page: any): void {
    debug.i("GUI", "CoopGUI.buildShopAddGroup");
    const status = new FormStatus(page);
    const obsName = obsStr("");
    page.textField("分组名称", obsName);
    page.button("确认", async () => {
      const name = obsName.getData()?.trim();
      if (!name) {
        status.fail("请填写完整信息！");
        return;
      }
      await CoopApi.saveShopGroup({ groupid: "custom_" + _genId(), displayname: name });
      status.ok("操作成功。");
      await this.nav.rebuild("shopMgr");
    });
  }

  // ── Helpers ──

  private errorPop(text: string) {
    Msg.error(text, this.player);
  }
  private infoPop(text: string) {
    Msg.info(text, this.player);
  }
}