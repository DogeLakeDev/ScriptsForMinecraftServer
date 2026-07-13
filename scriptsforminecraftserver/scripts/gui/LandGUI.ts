import { Player, world } from "@minecraft/server";
import { MenuNavigator, ObservableString, ObservableBoolean, obsStr, obsBool, FormStatus } from "../libs/MenuNavigator";
import { LandCore, ValidationResult } from "../land/LandCore";
import { Database, LandData, LandPos } from "../land/LandDatabase";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";

export class LandGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }

  static showMainMenu(player: Player): void {
    const id = player.id;
    const session = LandCore.getSession(id);
    const gui = new LandGUI(player);
    if (session) {
      gui.nav.state.session = session;
      gui.nav.start("stateDialog");
    } else {
      gui.nav.start("home");
    }
  }

  static startApplication(player: Player): void {
    const plid = player.id;
    LandCore.initSession(plid);
    Msg.info(
      [
        `可在聊天框输入以下命令完成土地申请流程：`,
        `  [1] §6§l!pos1§r §f- 设置第一点（站在对应位置输入）`,
        `  [2] §6§l!pos2§r §f- 设置第二点`,
        `  [3] §6§l!land§r §f- 打开菜单进行§e验证与确认§r`,
      ].join("\n"),
      player
    );
    Msg.tips("在确认土地前，可重复输入 !pos1 和 !pos2 命令，来修改合适的土地范围。", player);
  }

  private registerSections(): void {
    this.nav.section("home", "土地", (page) => this.buildHome(page));
    this.nav.section("landList", "我的土地", (page) => this.buildLandList(page));
    this.nav.section("landManage", "土地管理", (page) => this.buildLandManage(page));
    this.nav.section("permEditor", "土地保护设置", (page) => this.buildPermEditor(page));
    this.nav.section("managerEditor", "管理者管理", (page) => this.buildManagerEditor(page));
    this.nav.section("addManager", "添加管理者", (page) => this.buildAddManager(page));
    this.nav.section("removeManager", "移除管理者", (page) => this.buildRemoveManager(page));
    this.nav.section("renameDialog", "设置土地名称", (page) => this.buildRenameDialog(page));
    this.nav.section("stateDialog", "土地申请", (page) => this.buildStateDialog(page));
  }

  private buildHome(page: any): void {
    const plid = this.player.id;
    const lands = LandCore.getPlayerLands(plid);
    page.label(ListFormInfo([`当前拥有 §e${lands.length}§r 块土地。`]));
    page.button("申请土地", () => this.nav.leave(() => LandGUI.startApplication(this.player)));
    if (lands.length > 0) {
      page.button("我的土地", () => this.nav.rebuild("landList"));
    }
  }

  private buildLandList(page: any): void {
    const lands = LandCore.getPlayerLands(this.player.id);
    if (lands.length === 0) {
      page.label(ListFormInfo(["你还没有任何土地。"]));
      return;
    }
    page.label(ListFormInfo([`当前拥有 §e${lands.length}§r 块土地。`]));
    for (const land of lands) {
      const name = land.nickname || land.id;
      const info = LandCore.getCubeInfo(land.posA, land.posB);
      page.button(`${name}\n${info.square} 格 | ${LandCore.getDimensionName(land.dimid)}`, () => {
        this.nav.state.land = land;
        this.nav.rebuild("landManage");
      });
    }
  }

  private buildLandManage(page: any): void {
    const land = this.nav.state.land as LandData;
    if (!land) {
      page.label("土地数据丢失。");
      return;
    }
    const plid = this.player.id;
    const isOwner = LandCore.isOwner(land, plid);
    const isMgr = LandCore.isManager(land, plid);
    const canManage = isOwner || isMgr;
    const name = land.nickname || land.id;
    const info = LandCore.getCubeInfo(land.posA, land.posB);
    const ownerName = land.ownerName || "§7未知§r";

    page.label(
      ListFormInfo([
        `土地信息：`,
        `  §7- 土地名称: §r${name}§7(${land.id})`,
        `  §7- 拥有者: §r${ownerName}`,
        `  §7- 面积: §r ${info.square}§7 格 | 体积: §r ${info.volume} §7格`,
        `  §7- 维度: §r${LandCore.getDimensionName(land.dimid)}`,
        `  §7- 管理者: §r${land.managers.length} 人`,
      ])
    );

    if (!canManage) {
      page.label("你没有权限管理此土地。");
      return;
    }

    page.button("土地保护", () => this.nav.rebuild("permEditor"));
    page.button("管理者管理", () => this.nav.rebuild("managerEditor"));
    page.button("设置名称", () => this.nav.rebuild("renameDialog"));
    page.button("删除土地", () => this.showDeleteConfirm(land, page));
  }

  private buildPermEditor(page: any): void {
    const status = new FormStatus(page);
    const land = this.nav.state.land as LandData;
    if (!land) {
      page.label("土地数据丢失。");
      return;
    }
    const perm = land.permissions;
    const allowPlace = obsBool(perm.allow_place);
    const allowDestroy = obsBool(perm.allow_destroy);
    const attackEntity = obsBool(perm.attack_entity);
    const openContainer = obsBool(perm.open_container);

    page.label(ListFormInfo([]));
    page.toggle("允许访客§6放置方块", allowPlace);
    page.toggle("允许访客§6破坏方块", allowDestroy);
    page.toggle("允许访客§6攻击实体", attackEntity);
    page.toggle("允许访客§6打开容器", openContainer);
    page.button("确认", () => {
      land.permissions.allow_place = allowPlace.getData();
      land.permissions.allow_destroy = allowDestroy.getData();
      land.permissions.attack_entity = attackEntity.getData();
      land.permissions.open_container = openContainer.getData();
       void Database.update(land);
      status.ok("土地保护设置已更新。");
      this.nav.rebuild("landManage");
    });
  }

  private buildManagerEditor(page: any): void {
    const land = this.nav.state.land as LandData;
    if (!land) {
      page.label("土地数据丢失。");
      return;
    }
    const plid = this.player.id;
    page.label(
      ListFormInfo([
        "当前管理者：",
        ...land.managers.map((m) => {
          if (m === land.ownerplid) return `  - ${land.ownerName} (拥有者)`;
          const p = world.getPlayers().find((pl) => pl.id === m);
          return p ? `  - ${p.name}` : `  - ${m.substring(0, 8)}...`;
        }),
      ])
    );
    page.button("添加管理者", () => this.nav.rebuild("addManager"));
    if (LandCore.isOwner(land, plid) && land.managers.length > 1) {
      page.button("移除管理者", () => this.nav.rebuild("removeManager"));
    }
  }

  private buildAddManager(page: any): void {
    const status = new FormStatus(page);
    const land = this.nav.state.land as LandData;
    if (!land) {
      page.label("土地数据丢失。");
      return;
    }
    const online = world.getPlayers().filter((p) => p.id !== this.player.id && !land.managers.includes(p.id));
    if (online.length === 0) {
      page.label(ListFormInfo(["没有可添加的在线玩家。"]));
      return;
    }
    page.label(ListFormInfo(["选择要添加为管理者的玩家。"]));
    for (const p of online) {
      page.button(p.name, () => {
        if (land.managers.includes(p.id)) {
          status.fail("该玩家已经是管理者。");
          return;
        }
        land.managers.push(p.id);
         void Database.update(land);
        status.ok(`已将 ${p.name} 添加为管理者。`);
        this.nav.rebuild("managerEditor");
      });
    }
  }

  private buildRemoveManager(page: any): void {
    const status = new FormStatus(page);
    const land = this.nav.state.land as LandData;
    if (!land) {
      page.label("土地数据丢失。");
      return;
    }
    const nonOwnerMgrs = land.managers.filter((m) => m !== land.ownerplid);
    if (nonOwnerMgrs.length === 0) {
      page.label(ListFormInfo(["没有可移除的管理者。"]));
      return;
    }
    page.label(ListFormInfo(["选择要移除的管理者。"]));
    for (const m of nonOwnerMgrs) {
      const p = world.getPlayers().find((pl) => pl.id === m);
      page.button(p ? p.name : m.substring(0, 8) + "...", () => {
        const idx = land.managers.indexOf(m);
        if (idx !== -1) {
          land.managers.splice(idx, 1);
           void Database.update(land);
          status.ok("已移除该管理者。");
        }
        this.nav.rebuild("managerEditor");
      });
    }
  }

  private buildRenameDialog(page: any): void {
    const status = new FormStatus(page);
    const land = this.nav.state.land as LandData;
    if (!land) {
      page.label("土地数据丢失。");
      return;
    }
    const name = obsStr(land.nickname || "");
    page.textField("土地名称", name, { description: "输入新名称（留空恢复默认）" });
    page.button("确认", () => {
      const val = name.getData().trim();
      land.nickname = val;
       void Database.update(land);
      status.ok(val ? `土地已重命名为 ${val}。` : "土地名称已恢复默认。");
      this.nav.rebuild("landManage");
    });
  }

  private buildStateDialog(page: any): void {
    const status = new FormStatus(page);
    const session = this.nav.state.session;
    const hasPos1 = !!session?.pos1;
    const hasPos2 = !!session?.pos2;
    const bothSet = hasPos1 && hasPos2;

    if (!bothSet) {
      const body = ["请先完整选择土地范围。"];
      if (hasPos1 && !hasPos2) body.push("  §6!pos2 §r- 继续设置第二点");
      if (hasPos2 && !hasPos1) body.push("  §6!pos1 §r- 继续设置第一点");
      page.label(ListFormInfo(body));
      page.button("取消申请", () => {
        LandCore.clearSession(this.player.id);
        status.fail("土地申请已取消。");
        this.nav.leave(() => {});
      });
    } else {
      const dimid =
        this.player.dimension.id === "minecraft:overworld"
          ? 0
          : this.player.dimension.id === "minecraft:nether"
            ? 1
            : 2;
      const info = LandCore.formatLandInfo(session.pos1!, session.pos2!, dimid).replace(/§[cef6]/g, "");
      page.label(ListFormInfo([info, "§7确认申请该土地？"]));
      page.button("确认申请", () => this.handleApply(session.pos1!, session.pos2!, dimid, page));
      page.button("取消申请", () => {
        if (LandCore.clearSession(this.player.id)) {
          status.fail("土地申请已取消。");
        } else {
          status.fail("土地申请取消失败。");
        }
        this.nav.leave(() => {});
      });
    }
  }

  private showDeleteConfirm(land: LandData, page: any): void {
    const status = new FormStatus(page);
    if (!LandCore.isOwner(land, this.player.id) && !LandCore.isManager(land, this.player.id)) {
      status.fail("你没有权限删除此土地。");
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
    this.nav.confirm(
      "删除土地",
      body,
      () => {
        void LandCore.deleteLand(land.id, this.player).then((deleted) => {
          if (deleted) {
          status.ok(`土地已删除，获得 ${deleted} ${Money.UNIT}。`);
          } else {
          status.fail("删除失败。");
          }
        });
      },
      () => this.nav.rebuild("landList")
    );
  }

  private async handleApply(pos1: LandPos, pos2: LandPos, dimid: number, page: any): Promise<void> {
    const status = new FormStatus(page);
    const result: ValidationResult = await LandCore.validateCreation(this.player, pos1, pos2, dimid);
    if (!result.ok) {
      status.fail(result.msg ?? "验证失败。");
      return;
    }
    const land = await LandCore.createLand(this.player, pos1, pos2, dimid);
    if (land) {
      status.ok(
        `土地创建成功！\n土地编号: ${land.id}\n面积: ${LandCore.getCubeInfo(land.posA, land.posB).square} 格`
      );
      this.nav.leave(() => {});
    } else {
      status.fail("土地创建失败，请重试。");
    }
  }
}
