import { Player, world } from "@minecraft/server";
import {
  acceptInvite,
  declineInvite,
  getInvites,
  inviteMember,
  removeLandMember,
  updateLandMember,
} from "../api/LandApi.js";
import { LandCore } from "../land/LandCore.js";
import { Database, LandData, LandPos, LandRole } from "../land/LandDatabase.js";
import { canManage, getPlayerRole } from "../land/LandPolicy.js";
import { debug } from "../libs/DebugLog.js";
import { Money } from "../libs/Economy.js";
import { FormStatus, MenuNavigator, obsBool, obsNum, obsStr } from "../libs/MenuNavigator.js";
import { dimensionId, ListFormInfo, Msg } from "../libs/Tools.js";

const ROLES: LandRole[] = ["builder", "container", "visitor", "redstone", "entity", "admin"];
const ROLE_NAMES: Record<LandRole, string> = {
  owner: "所有者",
  admin: "管理员",
  builder: "建造者",
  container: "容器访问",
  visitor: "访客",
  redstone: "红石",
  entity: "实体交互",
};

type LandGuiState = {
  selectedLandId?: string;
  application?: { pos1?: LandPos; pos2?: LandPos; dimensionId?: number };
  invites: any[];
  loading: boolean;
  error?: string;
  previewPrice?: number;
};

export class LandGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    debug.i("GUI", `LandGUI: constructor player=${player.name}`);
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.nav.state.gui = { invites: [], loading: false } satisfies LandGuiState;
    this.registerSections();
  }

  static showMainMenu(player: Player): void {
    debug.i("GUI", `LandGUI.showMainMenu: player=${player.name}`);
    const gui = new LandGUI(player);
    const session = LandCore.getSession(player.id);
    if (session)
      gui.nav.state.gui.application = { ...session, dimensionId: session.dimensionId ?? dimensionId(player.dimension) };
    void getInvites(player.id)
      .then((invites) => {
        gui.state.invites = invites;
        return gui.nav.start("home");
      })
      .catch(() => void gui.nav.start("home"));
  }

  static startApplication(player: Player): void {
    debug.i("GUI", `LandGUI.startApplication: player=${player.name}`);
    LandCore.initSession(player.id);
    Msg.info("请使用 !pos1 和 !pos2 选择土地范围，然后重新打开 !land 确认购买。", player);
  }

  private get state(): LandGuiState {
    return this.nav.state.gui as LandGuiState;
  }
  private currentLand(): LandData | undefined {
    return this.state.selectedLandId ? Database.getById(this.state.selectedLandId) : undefined;
  }

  private registerSections(): void {
    this.nav.section("home", "土地中心", (page) => this.buildHome(page));
    this.nav.section("current", "当前土地", (page) => this.buildCurrent(page));
    this.nav.section("landList", "我的土地", (page) => this.buildLandList(page));
    this.nav.section("landDetail", "土地详情", (page) => this.buildLandDetail(page));
    this.nav.section("members", "成员与邀请", (page) => this.buildMembers(page));
    this.nav.section("invite", "邀请成员", (page) => this.buildInvite(page));
    this.nav.section("memberEdit", "成员角色", (page) => this.buildMemberEdit(page));
    this.nav.section("invites", "收到的邀请", (page) => this.buildInvites(page));
    this.nav.section("protection", "访客保护", (page) => this.buildProtection(page));
    this.nav.section("basic", "基本信息", (page) => this.buildBasic(page));
    this.nav.section("risk", "所有权与风险", (page) => this.buildRisk(page));
    this.nav.section("transferSelect", "转让土地", (page) => this.buildTransferSelect(page));
    this.nav.section("application", "土地申请", (page) => this.buildApplication(page));
    this.nav.section("plaza", "公共广场", (page) => void this.buildPlaza(page));
  }

  private buildHome(page: any): void {
    debug.i("GUI", "LandGUI.buildHome");
    const land = LandCore.getLandByPos(
      {
        x: Math.floor(this.player.location.x),
        y: Math.floor(this.player.location.y),
        z: Math.floor(this.player.location.z),
      },
      dimensionId(this.player.dimension)
    );
    const owned = LandCore.getPlayerLands(this.player.id);
    const application = this.state.application;
    page.label(
      ListFormInfo([
        land ? `当前土地：${land.nickname || land.id} · ${roleText(land, this.player.id)}` : "当前不在土地保护范围内。",
        `拥有土地：${owned.length} 块`,
        application?.pos1 || application?.pos2
          ? `申请状态：已选择 ${application.pos1 && application.pos2 ? "两点，等待确认" : "一点"}`
          : "申请状态：未开始",
        `待处理邀请：${this.state.invites.length} 项`,
      ])
    );
    if (land) page.button("当前土地", () => this.openLand(land, "current"));
    page.button("我的土地", () => void this.nav.rebuild("landList"));
    page.button("🏛️ 公共广场", () => void this.nav.rebuild("plaza"));
    page.button(application?.pos1 || application?.pos2 ? "继续申请" : "申请土地", () => void this.openApplication());
    page.button(
      `收到的邀请${this.state.invites.length ? ` (${this.state.invites.length})` : ""}`,
      () => void this.loadInvites()
    );
  }

  private async buildPlaza(page: any): Promise<void> {
    debug.i("GUI", "LandGUI.buildPlaza");
    const status = new FormStatus(page);
    const plaza = Database.getById("PUBLIC-PLAZA");
    if (!plaza) {
      page.label(ListFormInfo(["§c公共广场尚未初始化（db-server 重启后会自愈）。", "请稍后重试或联系管理员。"]));
      return;
    }
    const settings = await this.fetchPlazaSettings();
    const info = LandCore.getCubeInfo(plaza.posA, plaza.posB);
    const role = getPlayerRole(plaza, this.player.id);
    page.label(
      ListFormInfo([
        `§e${settings.name} §7· ${LandCore.getDimensionName(plaza.dimid)}`,
        "",
        `范围：§f${plaza.posA.x}..${plaza.posB.x} §8| §f${plaza.posA.z}..${plaza.posB.z}`,
        `覆盖面积：§a${info.square} §7格`,
        `你的角色：§b${role ? ROLE_NAMES[role] : "访客（默认开放建造）"}`,
        "",
        `§7${settings.welcome}`,
        "",
        "§7在这里所有玩家都可以放置、破坏、互动。",
        "§7用作服务器起点、议事厅、临时建造。",
      ])
    );
    // 引导按钮：传送到中心点
    page.button(
      "§l传送至广场中心",
      () =>
        void this.nav.runTask(status, async () => {
          try {
            await this.player.teleport({ x: 0.5, y: 64, z: 0.5 });
          } catch {
            // 1.20.0 API：传单个 Vector3 即可
          }
          Msg.success(`已传送至${settings.name}`, this.player);
        })
    );
    page.button("查看土地详情", () => this.openLand(plaza, "current"));
    page.button("← 返回主页", () => void this.nav.replace("home"));
  }

  private async fetchPlazaSettings(): Promise<{ name: string; welcome: string; dimid: number; range: number }> {
    try {
      const { HttpDB } = await import("../libs/HttpDB.js");
      const body = await HttpDB.get("/api/sfmc/settings/land:plaza");
      if (body) {
        const parsed = JSON.parse(body);
        if (parsed?.value !== null && parsed?.value !== undefined) {
          const value = typeof parsed.value === "string" ? JSON.parse(parsed.value) : parsed.value;
          return {
            name: "公共广场",
            welcome: "欢迎来到服务器！这里是公共领地，所有人都可以建造。",
            dimid: 0,
            range: 32,
            ...value,
          };
        }
      }
    } catch {}
    return {
      name: "公共广场",
      welcome: "欢迎来到服务器！这里是公共领地，所有人都可以建造。",
      dimid: 0,
      range: 32,
    };
  }

  private buildCurrent(page: any): void {
    debug.i("GUI", "LandGUI.buildCurrent");
    const land = this.currentLand();
    if (!land) {
      page.label(ListFormInfo(["土地数据已更新，请返回土地中心。"]));
      return;
    }
    this.buildLandSummary(page, land);
    page.button("查看详情", () => void this.nav.rebuild("landDetail"));
  }

  private buildLandList(page: any): void {
    debug.i("GUI", "LandGUI.buildLandList");
    const lands = LandCore.getPlayerLands(this.player.id);
    page.label(ListFormInfo([`拥有 §e${lands.length}§r / ${Database.getConfig().maxLandsPerPlayer} 块土地。`]));
    if (!lands.length) {
      page.label("你还没有土地。");
      page.button("申请土地", () => void this.openApplication());
      return;
    }
    for (const land of lands) {
      const info = LandCore.getCubeInfo(land.posA, land.posB);
      page.button(
        `${land.nickname || land.id}\n${LandCore.getDimensionName(land.dimid)} · ${info.square} 格 · ${(land.members || []).length} 名成员`,
        () => this.openLand(land, "landDetail")
      );
    }
  }

  private buildLandDetail(page: any): void {
    debug.i("GUI", "LandGUI.buildLandDetail");
    const land = this.currentLand();
    if (!land) {
      page.label("土地数据已更新，请返回重试。");
      return;
    }
    this.buildLandSummary(page, land);
    if (canManage(land, this.player.id, "manage_members"))
      page.button("成员与邀请", () => void this.nav.rebuild("members"));
    if (canManage(land, this.player.id, "manage_permissions"))
      page.button("访客保护", () => void this.nav.rebuild("protection"));
    if (canManage(land, this.player.id, "rename")) page.button("基本信息", () => void this.nav.rebuild("basic"));
    if (LandCore.isOwner(land, this.player.id)) page.button("所有权与风险", () => void this.nav.rebuild("risk"));
  }

  private buildLandSummary(page: any, land: LandData): void {
    const info = LandCore.getCubeInfo(land.posA, land.posB);
    page.label(
      ListFormInfo([
        `土地：${land.nickname || land.id}`,
        `所有者：${land.ownerName || "未知"}`,
        `你的角色：${roleText(land, this.player.id)}`,
        `维度：${LandCore.getDimensionName(land.dimid)}`,
        `范围：X ${land.posA.x}..${land.posB.x} / Y ${land.posA.y}..${land.posB.y} / Z ${land.posA.z}..${land.posB.z}`,
        `面积：${info.square} 格 · 版本：${land.version || 1}`,
      ])
    );
  }

  private buildMembers(page: any): void {
    debug.i("GUI", "LandGUI.buildMembers");
    const land = this.currentLand();
    if (!land) return;
    page.label(
      ListFormInfo([
        "所有者",
        `${land.ownerName}`,
        "成员与角色",
        ...(land.members || [])
          .filter((m) => m.player_id !== land.ownerplid)
          .map((m) => `${m.player_name_snapshot || m.player_id} · ${ROLE_NAMES[m.role]}`),
      ])
    );
    if (canManage(land, this.player.id, "manage_members"))
      page.button("邀请成员", () => void this.nav.rebuild("invite"));
    for (const member of (land.members || []).filter((m) => m.player_id !== land.ownerplid)) {
      const canEdit = member.role !== "admin" || LandCore.isOwner(land, this.player.id);
      if (canEdit)
        page.button(`${member.player_name_snapshot || member.player_id} · ${ROLE_NAMES[member.role]}`, () => {
          this.nav.state.memberId = member.player_id;
          void this.nav.rebuild("memberEdit");
        });
    }
  }

  private buildInvite(page: any): void {
    debug.i("GUI", "LandGUI.buildInvite");
    const land = this.currentLand();
    if (!land) return;
    const status = new FormStatus(page);
    const online = world
      .getPlayers()
      .filter((p) => p.id !== land.ownerplid && !(land.members || []).some((m) => m.player_id === p.id));
    const names = online.map((p) => p.name);
    if (!names.length) {
      page.label("没有可邀请的在线玩家。");
      return;
    }
    const target = obsNum(0);
    const roleItems = (LandCore.isOwner(land, this.player.id) ? ROLES : ROLES.filter((r) => r !== "admin")).map(
      (role) => ({ value: role, label: ROLE_NAMES[role] })
    );
    const role = obsNum(0);
    page.dropdown(
      "玩家",
      target,
      names.map((name, value) => ({ value, label: name }))
    );
    page.dropdown(
      "角色",
      role,
      roleItems.map((item, value) => ({ value, label: item.label }))
    );
    page.button(
      "发送邀请",
      () =>
        void this.nav.runTask(status, async () => {
          const player = online[target.getData()];
          const selectedRole = roleItems[role.getData()]?.value;
          if (!player || !selectedRole) throw new Error("请选择玩家和角色");
          const result = await inviteMember(land.id, this.player.id, player.id, selectedRole);
          if (!result.ok) throw new Error(result.message || result.error || "邀请失败");
          status.ok(`已向 ${player.name} 发送${ROLE_NAMES[selectedRole]}邀请。`);
          await Database.refresh();
        })
    );
  }

  private buildMemberEdit(page: any): void {
    debug.i("GUI", "LandGUI.buildMemberEdit");
    const land = this.currentLand();
    const memberId = this.nav.state.memberId as string;
    const member = land?.members?.find((item) => item.player_id === memberId);
    if (!land || !member) return;
    const status = new FormStatus(page);
    const canChangeAdmin = LandCore.isOwner(land, this.player.id);
    const roles = canChangeAdmin ? ROLES : ROLES.filter((r) => r !== "admin");
    const role = obsNum(Math.max(0, roles.indexOf(member.role)));
    page.label(
      ListFormInfo([`玩家：${member.player_name_snapshot || member.player_id}`, `当前角色：${ROLE_NAMES[member.role]}`])
    );
    page.dropdown(
      "新角色",
      role,
      roles.map((item, value) => ({ value, label: ROLE_NAMES[item] }))
    );
    page.button(
      "保存角色",
      () =>
        void this.nav.runTask(status, async () => {
          const next = roles[role.getData()];
          const result = await updateLandMember(land.id, this.player.id, member.player_id, next);
          if (!result.ok || !result.land) throw new Error(result.message || result.error || "member update failed");
          Database.upsert(result.land);
          status.ok("成员角色已更新。");
        })
    );
    page.button("移除成员", () => void this.removeMember(land, member.player_id, status));
  }

  private buildInvites(page: any): void {
    debug.i("GUI", "LandGUI.buildInvites");
    const status = new FormStatus(page);
    if (!this.state.invites.length) {
      page.label("没有待处理邀请。");
      return;
    }
    for (const invite of this.state.invites) {
      page.label(
        ListFormInfo([
          `土地：${invite.land_id}`,
          `角色：${ROLE_NAMES[invite.role as LandRole] || invite.role}`,
          `邀请人：${invite.inviter_id}`,
        ])
      );
      page.button(
        "接受",
        () =>
          void this.nav.runTask(status, async () => {
            const land = await acceptInvite(this.player.id, invite.id);
            if (!land) throw new Error("accept failed");
            Database.upsert(land);
            await this.loadInvites();
          })
      );
      page.button(
        "拒绝",
        () =>
          void this.nav.runTask(status, async () => {
            if (!(await declineInvite(this.player.id, invite.id))) throw new Error("decline failed");
            await this.loadInvites();
          })
      );
    }
  }

  private buildProtection(page: any): void {
    debug.i("GUI", "LandGUI.buildProtection");
    const land = this.currentLand();
    if (!land) return;
    const status = new FormStatus(page);
    const fields = [
      ["允许建造", "allow_place", land.permissions.allow_place || land.permissions.allow_destroy],
      ["允许打开容器", "open_container", land.permissions.open_container],
      ["允许使用门和按钮", "use_door", land.permissions.use_door || land.permissions.use_button],
      ["允许使用红石", "use_redstone", land.permissions.use_redstone],
      ["允许交互实体", "interact_entity", land.permissions.interact_entity],
      ["允许攻击实体", "attack_entity", land.permissions.attack_entity],
      ["允许拾取物品", "pickup_item", land.permissions.pickup_item],
    ] as const;
    const values = fields.map((field) => obsBool(!!field[2]));
    fields.forEach((field, index) => page.toggle(field[0], values[index]));
    page.button(
      "保存保护设置",
      () =>
        void this.nav.runTask(status, async () => {
          const permissions = {
            ...land.permissions,
            allow_place: values[0].getData(),
            allow_destroy: values[0].getData(),
            open_container: values[1].getData(),
            use_door: values[2].getData(),
            use_button: values[2].getData(),
            use_redstone: values[3].getData(),
            interact_entity: values[4].getData(),
            attack_entity: values[5].getData(),
            pickup_item: values[6].getData(),
          };
          const updated = await Database.update({ ...land, permissions }, this.player.id);
          if (!updated) throw new Error("protection update failed");
          status.ok("访客保护已保存。");
        })
    );
  }

  private buildBasic(page: any): void {
    debug.i("GUI", "LandGUI.buildBasic");
    const land = this.currentLand();
    if (!land) return;
    const status = new FormStatus(page);
    const name = obsStr(land.nickname || "");
    page.textField("土地名称", name, { description: "留空则使用土地编号" });
    page.label(
      ListFormInfo([
        `范围：${land.posA.x}..${land.posB.x}, ${land.posA.y}..${land.posB.y}, ${land.posA.z}..${land.posB.z}`,
        `创建时间：${new Date(land.createdAt).toLocaleString()}`,
      ])
    );
    page.button(
      "保存名称",
      () =>
        void this.nav.runTask(status, async () => {
          const updated = await Database.update({ ...land, nickname: name.getData().trim() }, this.player.id);
          if (!updated) throw new Error("name update failed");
          status.ok("土地名称已保存。");
        })
    );
  }

  private buildRisk(page: any): void {
    debug.i("GUI", "LandGUI.buildRisk");
    const land = this.currentLand();
    if (!land || !LandCore.isOwner(land, this.player.id)) return;
    const status = new FormStatus(page);
    page.label(
      ListFormInfo([
        "这些操作会改变土地所有权或永久删除土地。",
        "转让给在线玩家会立刻变更所有者并退你为管理员；",
        "若目标玩家暂时离线，请改在「成员与邀请」邀请对方为管理员。",
        "删除后土地将进入已删除状态并按比例退款。",
      ])
    );
    page.button("转让土地（在线）", () => void this.nav.rebuild("transferSelect"));
    page.button("删除土地", () => void this.deleteLand(land, status));
  }

  private buildApplication(page: any): void {
    debug.i("GUI", "LandGUI.buildApplication");
    const status = new FormStatus(page);
    // Opening the application page starts the selection session when needed.
    const session =
      LandCore.getSession(this.player.id) ||
      (LandCore.initSession(this.player.id), LandCore.getSession(this.player.id));
    const application = this.state.application || {
      ...session,
      dimensionId: session?.dimensionId ?? dimensionId(this.player.dimension),
    };
    this.state.application = application;
    const body = [
      `第一点：${application.pos1 ? `(${application.pos1.x}, ${application.pos1.y}, ${application.pos1.z})` : "未设置"}`,
      `第二点：${application.pos2 ? `(${application.pos2.x}, ${application.pos2.y}, ${application.pos2.z})` : "未设置"}`,
    ];
    page.label(ListFormInfo(body));
    if (application.pos1 && application.pos2) {
      const info = LandCore.getCubeInfo(application.pos1, application.pos2);
      // 价格从服务端权威获取，避免 UI 预览和服务端报价脱钩。
      void this.refreshPreviewPrice(application.pos1, application.pos2, application.dimensionId!, info);
      page.label(
        ListFormInfo([
          `面积：${info.square} 格`,
          `预估价格：${this.state.previewPrice ?? "-"} ${Money.UNIT}`,
          `当前余额：${Money.get(this.player)} ${Money.UNIT}`,
        ])
      );
      page.button(
        "确认购买",
        () =>
          void this.nav.runTask(status, async () => {
            const result = await LandCore.validateCreation(
              this.player,
              application.pos1!,
              application.pos2!,
              application.dimensionId!
            );
            if (!result.ok) throw new Error(result.msg || "validation failed");
            const land = await LandCore.createLand(
              this.player,
              application.pos1!,
              application.pos2!,
              application.dimensionId!
            );
            if (!land) throw new Error("purchase failed");
            this.state.application = undefined;
            this.state.previewPrice = undefined;
            this.state.selectedLandId = land.id;
            await this.nav.replace("landDetail");
            const balance = await Money.load(this.player);
            Msg.success(`土地购买成功，已扣除费用。当前余额：${balance} ${Money.UNIT}`, this.player);
          })
      );
    } else {
      page.label("请在游戏内使用 !pos1 和 !pos2 设置两个角点。");
    }
    page.button("取消申请", () => {
      LandCore.clearSession(this.player.id);
      this.state.application = undefined;
      this.state.previewPrice = undefined;
      void this.nav.replace("home");
    });
  }

  private async loadInvites(): Promise<void> {
    debug.i("GUI", "LandGUI.loadInvites");
    this.state.invites = await getInvites(this.player.id);
    await this.nav.replace("invites");
  }

  /**
   * 通过服务端 validateLand 拿到权威价；client 公式不再用于报价。
   * 受网络 / 服务端故障时仍降级显示 client 估算，避免 UI 卡死。
   */
  private async refreshPreviewPrice(
    posA: LandPos,
    posB: LandPos,
    dimid: number,
    info: { square: number; height: number }
  ): Promise<void> {
    try {
      const { validateLand } = await import("../api/LandApi.js");
      const r = await validateLand({ ownerId: this.player.id, ownerName: this.player.name, dimid, posA, posB });
      if (r.ok && typeof r.price === "number") {
        if (this.state.previewPrice !== r.price) {
          this.state.previewPrice = r.price;
          void this.nav.refresh();
        }
        return;
      }
    } catch (error) {
      debug.w("GUI", `refreshPreviewPrice fallback: ${(error as Error).message}`);
    }
    // 降级：用 client 公式估算（含 cfg.discount），仍优于固定硬编码
    const cfg = Database.getConfig();
    const local = Math.max(0, Math.floor((info.square * 8 + info.height * 20) * cfg.discount));
    if (this.state.previewPrice !== local) {
      this.state.previewPrice = local;
      void this.nav.refresh();
    }
  }

  private openLand(land: LandData, section: string): void {
    this.state.selectedLandId = land.id;
    void this.nav.rebuild(section);
  }

  private openApplication(): void {
    if (!LandCore.getSession(this.player.id)) LandCore.initSession(this.player.id);
    const session = LandCore.getSession(this.player.id);
    this.state.application = session
      ? { ...session, dimensionId: session.dimensionId ?? dimensionId(this.player.dimension) }
      : undefined;
    void this.nav.rebuild("application");
  }

  private async removeMember(land: LandData, memberId: string, status: FormStatus): Promise<void> {
    const result = await removeLandMember(land.id, this.player.id, memberId);
    if (!result.ok || !result.land) {
      status.fail(result.message || "移除成员失败。");
      return;
    }
    Database.upsert(result.land);
    status.ok("成员已移除。");
    await this.nav.refresh();
  }

  private buildTransferSelect(page: any): void {
    const land = this.currentLand();
    if (!land || !LandCore.isOwner(land, this.player.id)) return;
    const status = new FormStatus(page);
    const online = world.getPlayers().filter((p) => p.id !== this.player.id);
    if (!online.length) {
      page.label(ListFormInfo(["当前没有其他在线玩家。", "请稍后重试。"]));
      return;
    }
    const target = obsNum(0);
    page.dropdown(
      "选择接收玩家",
      target,
      online.map((p, i) => ({ value: i, label: p.name }))
    );
    page.button(
      "确认转让",
      () =>
        void this.nav.runTask(status, async () => {
          const player = online[target.getData()];
          if (!player) return;
          const requestId = `land-transfer:${this.player.id}:${land.id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
          const { transferLand } = await import("../api/LandApi.js");
          const result = await transferLand(land.id, this.player.id, player.id, player.name, land.version, requestId);
          if (!result.ok || !result.land) {
            if (result.error === "version_conflict") {
              await this.refreshAfterConflict();
              return;
            }
            await this.nav.replace("home");
            Msg.error(landErrorMessage(result.error, result.message), this.player);
            return;
          }
          Database.upsert(result.land);
          await this.nav.replace("home");
          Msg.success(`土地已转让给 ${player.name}。`, this.player);
        })
    );
  }

  private async deleteLand(land: LandData, status: FormStatus): Promise<void> {
    if (
      !(await this.nav.confirmMessage(
        "删除土地",
        `确定删除 ${land.nickname || land.id} 吗？此操作不可撤销，退款由服务器按规则计算。`,
        "确认删除",
        "返回"
      ))
    )
      return;
    await this.nav.runTask(status, async () => {
      const requestId = `land-delete:${this.player.id}:${land.id}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
      const deleted = await LandCore.deleteLand(land.id, this.player, requestId);
      if (!deleted.ok) {
        if (deleted.error === "version_conflict") {
          await this.refreshAfterConflict();
          return;
        }
        this.state.selectedLandId = undefined;
        await this.nav.replace("home");
        Msg.error(landErrorMessage(deleted.error, deleted.message), this.player);
        return;
      }
      if (deleted.balance !== undefined) Money.setCached(this.player, deleted.balance, deleted.balanceVersion || 0);
      this.state.selectedLandId = undefined;
      await this.nav.replace("home");
      Msg.success(`土地已删除，获得 ${deleted.refund || 0} ${Money.UNIT}。`, this.player);
    });
  }

  private async refreshAfterConflict(): Promise<void> {
    await Database.refresh();
    await this.nav.replace("landDetail");
    await this.nav.message("土地数据已更新", "土地数据已被其他操作更新。\n已刷新最新数据，请重新确认本次操作。");
  }
}

function roleText(land: LandData, playerId: string): string {
  const role = getPlayerRole(land, playerId);
  return role ? ROLE_NAMES[role] : "访客";
}

function landErrorMessage(error?: string, message?: string): string {
  const known: Record<string, string> = {
    forbidden: "你没有权限执行此操作。",
    not_found: "土地不存在或已被删除。",
    already_deleted: "土地已经被删除。",
    version_conflict: "土地数据已更新，请返回后重新确认。",
    database_unavailable: "数据库暂时不可用，请稍后重试。",
    transaction_failed: "服务器事务失败，土地状态未改变。",
    invalid_target: "不能将土地转让给自己。",
  };
  return (error && known[error]) || message || "操作失败，请稍后重试。";
}
