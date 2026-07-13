import { Player, world } from "@minecraft/server";
import { MenuNavigator, obsBool, obsNum, obsStr, FormStatus } from "../libs/MenuNavigator";
import { LandCore } from "../land/LandCore";
import { Database, LandData, LandPos, LandRole, ROLE_PERMISSIONS } from "../land/LandDatabase";
import { Msg, ListFormInfo } from "../libs/Tools";
import { Money } from "../libs/Money";
import { canManage, getPlayerRole } from "../land/LandPolicy";
import { acceptInvite, declineInvite, getInvites, inviteMember, removeLandMember, updateLandMember } from "../api/LandApi";

const ROLES: LandRole[] = ["builder", "container", "visitor", "redstone", "entity", "admin"];
const ROLE_NAMES: Record<LandRole, string> = {
  owner: "所有者", admin: "管理员", builder: "建造者", container: "容器访问", visitor: "访客", redstone: "红石", entity: "实体交互",
};

type LandGuiState = {
  selectedLandId?: string;
  application?: { pos1?: LandPos; pos2?: LandPos; dimensionId?: number };
  invites: any[];
  loading: boolean;
  error?: string;
};

export class LandGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.nav.state.gui = { invites: [], loading: false } satisfies LandGuiState;
    this.registerSections();
  }

  static showMainMenu(player: Player): void {
    const gui = new LandGUI(player);
    const session = LandCore.getSession(player.id);
    if (session) gui.nav.state.gui.application = { ...session, dimensionId: dimensionId(player) };
    void getInvites(player.id).then((invites) => {
      gui.state.invites = invites;
      return gui.nav.start("home");
    }).catch(() => void gui.nav.start("home"));
  }

  static startApplication(player: Player): void {
    LandCore.initSession(player.id);
    Msg.info("请使用 !pos1 和 !pos2 选择土地范围，然后重新打开 !land 确认购买。", player);
  }

  private get state(): LandGuiState { return this.nav.state.gui as LandGuiState; }
  private currentLand(): LandData | undefined { return this.state.selectedLandId ? Database.getById(this.state.selectedLandId) : undefined; }

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
    this.nav.section("application", "土地申请", (page) => this.buildApplication(page));
  }

  private buildHome(page: any): void {
    const land = LandCore.getLandByPos({ x: Math.floor(this.player.location.x), y: Math.floor(this.player.location.y), z: Math.floor(this.player.location.z) }, dimensionId(this.player));
    const owned = LandCore.getPlayerLands(this.player.id);
    const application = this.state.application;
    page.label(ListFormInfo([
      land ? `当前土地：${land.nickname || land.id} · ${roleText(land, this.player.id)}` : "当前不在土地保护范围内。",
      `拥有土地：${owned.length} 块`,
      application?.pos1 || application?.pos2 ? `申请状态：已选择 ${application.pos1 && application.pos2 ? "两点，等待确认" : "一点"}` : "申请状态：未开始",
      `待处理邀请：${this.state.invites.length} 项`,
    ]));
    if (land) page.button("当前土地", () => this.openLand(land, "current"));
    page.button("我的土地", () => void this.nav.rebuild("landList"));
    page.button(application?.pos1 || application?.pos2 ? "继续申请" : "申请土地", () => void this.nav.rebuild("application"));
    page.button(`收到的邀请${this.state.invites.length ? ` (${this.state.invites.length})` : ""}`, () => void this.loadInvites());
  }

  private buildCurrent(page: any): void {
    const land = this.currentLand();
    if (!land) { page.label(ListFormInfo(["土地数据已更新，请返回土地中心。"])); return; }
    this.buildLandSummary(page, land);
    page.button("查看详情", () => void this.nav.rebuild("landDetail"));
  }

  private buildLandList(page: any): void {
    const lands = LandCore.getPlayerLands(this.player.id);
    page.label(ListFormInfo([`拥有 §e${lands.length}§r / ${Database.getConfig().maxLandsPerPlayer} 块土地。`]));
    if (!lands.length) { page.label("你还没有土地。"); page.button("申请土地", () => void this.nav.rebuild("application")); return; }
    for (const land of lands) {
      const info = LandCore.getCubeInfo(land.posA, land.posB);
      page.button(`${land.nickname || land.id}\n${LandCore.getDimensionName(land.dimid)} · ${info.square} 格 · ${(land.members || []).length} 名成员`, () => this.openLand(land, "landDetail"));
    }
  }

  private buildLandDetail(page: any): void {
    const land = this.currentLand();
    if (!land) { page.label("土地数据已更新，请返回重试。"); return; }
    this.buildLandSummary(page, land);
    if (canManage(land, this.player.id, "manage_members")) page.button("成员与邀请", () => void this.nav.rebuild("members"));
    if (canManage(land, this.player.id, "manage_permissions")) page.button("访客保护", () => void this.nav.rebuild("protection"));
    if (canManage(land, this.player.id, "rename")) page.button("基本信息", () => void this.nav.rebuild("basic"));
    if (LandCore.isOwner(land, this.player.id)) page.button("所有权与风险", () => void this.nav.rebuild("risk"));
  }

  private buildLandSummary(page: any, land: LandData): void {
    const info = LandCore.getCubeInfo(land.posA, land.posB);
    page.label(ListFormInfo([
      `土地：${land.nickname || land.id}`,
      `所有者：${land.ownerName || "未知"}`,
      `你的角色：${roleText(land, this.player.id)}`,
      `维度：${LandCore.getDimensionName(land.dimid)}`,
      `范围：X ${land.posA.x}..${land.posB.x} / Y ${land.posA.y}..${land.posB.y} / Z ${land.posA.z}..${land.posB.z}`,
      `面积：${info.square} 格 · 版本：${land.version || 1}`,
    ]));
  }

  private buildMembers(page: any): void {
    const land = this.currentLand();
    if (!land) return;
    page.label(ListFormInfo(["所有者", `${land.ownerName}`, "成员与角色", ...(land.members || []).filter((m) => m.player_id !== land.ownerplid).map((m) => `${m.player_name_snapshot || m.player_id} · ${ROLE_NAMES[m.role]}`)]));
    if (canManage(land, this.player.id, "manage_members")) page.button("邀请成员", () => void this.nav.rebuild("invite"));
    for (const member of (land.members || []).filter((m) => m.player_id !== land.ownerplid)) {
      const canEdit = member.role !== "admin" || LandCore.isOwner(land, this.player.id);
      if (canEdit) page.button(`${member.player_name_snapshot || member.player_id} · ${ROLE_NAMES[member.role]}`, () => { this.nav.state.memberId = member.player_id; void this.nav.rebuild("memberEdit"); });
    }
  }

  private buildInvite(page: any): void {
    const land = this.currentLand();
    if (!land) return;
    const status = new FormStatus(page);
    const online = world.getPlayers().filter((p) => p.id !== land.ownerplid && !(land.members || []).some((m) => m.player_id === p.id));
    const names = online.map((p) => p.name);
    if (!names.length) { page.label("没有可邀请的在线玩家。"); return; }
    const target = obsNum(0);
    const roleItems = (LandCore.isOwner(land, this.player.id) ? ROLES : ROLES.filter((r) => r !== "admin")).map((role) => ({ value: role, label: ROLE_NAMES[role] }));
    const role = obsNum(0);
    page.dropdown("玩家", target, names.map((name, value) => ({ value, label: name })));
    page.dropdown("角色", role, roleItems.map((item, value) => ({ value, label: item.label })));
    page.button("发送邀请", () => void this.nav.runTask(status, async () => {
      const player = online[target.getData()];
      const selectedRole = roleItems[role.getData()]?.value;
      if (!player || !selectedRole || !(await inviteMember(land.id, this.player.id, player.id, selectedRole))) throw new Error("invite failed");
      status.ok(`已向 ${player.name} 发送${ROLE_NAMES[selectedRole]}邀请。`);
      await Database.refresh();
    }));
  }

  private buildMemberEdit(page: any): void {
    const land = this.currentLand();
    const memberId = this.nav.state.memberId as string;
    const member = land?.members?.find((item) => item.player_id === memberId);
    if (!land || !member) return;
    const status = new FormStatus(page);
    const canChangeAdmin = LandCore.isOwner(land, this.player.id);
    const roles = canChangeAdmin ? ROLES : ROLES.filter((r) => r !== "admin");
    const role = obsNum(Math.max(0, roles.indexOf(member.role)));
    page.label(ListFormInfo([`玩家：${member.player_name_snapshot || member.player_id}`, `当前角色：${ROLE_NAMES[member.role]}`]));
    page.dropdown("新角色", role, roles.map((item, value) => ({ value, label: ROLE_NAMES[item] })));
    page.button("保存角色", () => void this.nav.runTask(status, async () => {
      const next = roles[role.getData()];
      const updated = await updateLandMember(land.id, this.player.id, member.player_id, next);
      if (!updated) throw new Error("member update failed");
      Database.upsert(updated);
      status.ok("成员角色已更新。");
    }));
    page.button("移除成员", () => void this.removeMember(land, member.player_id, status));
  }

  private buildInvites(page: any): void {
    const status = new FormStatus(page);
    if (!this.state.invites.length) { page.label("没有待处理邀请。"); return; }
    for (const invite of this.state.invites) {
      page.label(ListFormInfo([`土地：${invite.land_id}`, `角色：${ROLE_NAMES[invite.role as LandRole] || invite.role}`, `邀请人：${invite.inviter_id}`]));
      page.button("接受", () => void this.nav.runTask(status, async () => {
        const land = await acceptInvite(this.player.id, invite.id);
        if (!land) throw new Error("accept failed");
        Database.upsert(land); await this.loadInvites();
      }));
      page.button("拒绝", () => void this.nav.runTask(status, async () => {
        if (!(await declineInvite(this.player.id, invite.id))) throw new Error("decline failed");
        await this.loadInvites();
      }));
    }
  }

  private buildProtection(page: any): void {
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
    page.button("保存保护设置", () => void this.nav.runTask(status, async () => {
      const permissions = { ...land.permissions, allow_place: values[0].getData(), allow_destroy: values[0].getData(), open_container: values[1].getData(), use_door: values[2].getData(), use_button: values[2].getData(), use_redstone: values[3].getData(), interact_entity: values[4].getData(), attack_entity: values[5].getData(), pickup_item: values[6].getData() };
      const updated = await Database.update({ ...land, permissions }, this.player.id);
      if (!updated) throw new Error("protection update failed");
      status.ok("访客保护已保存。");
    }));
  }

  private buildBasic(page: any): void {
    const land = this.currentLand();
    if (!land) return;
    const status = new FormStatus(page);
    const name = obsStr(land.nickname || "");
    page.textField("土地名称", name, { description: "留空则使用土地编号" });
    page.label(ListFormInfo([`范围：${land.posA.x}..${land.posB.x}, ${land.posA.y}..${land.posB.y}, ${land.posA.z}..${land.posB.z}`, `创建时间：${new Date(land.createdAt).toLocaleString()}`]));
    page.button("保存名称", () => void this.nav.runTask(status, async () => {
      const updated = await Database.update({ ...land, nickname: name.getData().trim() }, this.player.id);
      if (!updated) throw new Error("name update failed");
      status.ok("土地名称已保存。");
    }));
  }

  private buildRisk(page: any): void {
    const land = this.currentLand();
    if (!land || !LandCore.isOwner(land, this.player.id)) return;
    page.label(ListFormInfo(["这些操作会改变土地所有权或永久删除土地。", "转让后你将成为管理员，删除后土地将进入已删除状态。"]));
    page.button("转让土地", () => void this.transferLand(land));
    page.button("删除土地", () => void this.deleteLand(land));
  }

  private buildApplication(page: any): void {
    const status = new FormStatus(page);
    const session = LandCore.getSession(this.player.id);
    const application = this.state.application || { ...session, dimensionId: dimensionId(this.player) };
    this.state.application = application;
    const body = [`第一点：${application.pos1 ? `(${application.pos1.x}, ${application.pos1.y}, ${application.pos1.z})` : "未设置"}`, `第二点：${application.pos2 ? `(${application.pos2.x}, ${application.pos2.y}, ${application.pos2.z})` : "未设置"}`];
    page.label(ListFormInfo(body));
    if (application.pos1 && application.pos2) {
      const info = LandCore.getCubeInfo(application.pos1, application.pos2);
      const price = LandCore.calculatePrice(application.pos1, application.pos2);
      page.label(ListFormInfo([`面积：${info.square} 格`, `预估价格：${price} ${Money.UNIT}`, `当前余额：${Money.get(this.player)} ${Money.UNIT}`]));
      page.button("确认购买", () => void this.nav.runTask(status, async () => {
        const result = await LandCore.validateCreation(this.player, application.pos1!, application.pos2!, application.dimensionId!);
        if (!result.ok) throw new Error(result.msg || "validation failed");
        const land = await LandCore.createLand(this.player, application.pos1!, application.pos2!, application.dimensionId!);
        if (!land) throw new Error("purchase failed");
        this.state.application = undefined; this.nav.state.selectedLandId = land.id;
        await this.nav.replace("landDetail");
      }));
    } else {
      page.label("请在游戏内使用 !pos1 和 !pos2 设置两个角点。");
    }
    page.button("取消申请", () => { LandCore.clearSession(this.player.id); this.state.application = undefined; void this.nav.replace("home"); });
  }

  private async loadInvites(): Promise<void> {
    this.state.invites = await getInvites(this.player.id);
    await this.nav.replace("invites");
  }

  private openLand(land: LandData, section: string): void {
    this.nav.state.selectedLandId = land.id;
    void this.nav.rebuild(section);
  }

  private async removeMember(land: LandData, memberId: string, status: FormStatus): Promise<void> {
    const updated = await removeLandMember(land.id, this.player.id, memberId);
    if (!updated) { status.fail("移除成员失败。"); return; }
    Database.upsert(updated); status.ok("成员已移除。"); await this.nav.refresh();
  }

  private async transferLand(land: LandData): Promise<void> {
    const target = world.getPlayers().find((p) => p.id !== this.player.id);
    if (!target) { Msg.error("没有可转让的在线玩家。", this.player); return; }
    if (!(await this.nav.confirmMessage("转让土地", `确定将 ${land.nickname || land.id} 转让给 ${target.name} 吗？转让后你将成为管理员。`, "确认转让", "返回"))) return;
    const { transferLand } = await import("../api/LandApi");
    const updated = await transferLand(land.id, this.player.id, target.id, target.name);
    if (!updated) { Msg.error("土地转让失败。", this.player); return; }
    Database.upsert(updated); await this.nav.replace("home");
  }

  private async deleteLand(land: LandData): Promise<void> {
    if (!(await this.nav.confirmMessage("删除土地", `确定删除 ${land.nickname || land.id} 吗？此操作不可撤销，退款由服务器按规则计算。`, "确认删除", "返回"))) return;
    const deleted = await LandCore.deleteLand(land.id, this.player);
    if (deleted === false) { Msg.error("土地删除失败。", this.player); return; }
    await this.nav.replace("home");
    Msg.success(`土地已删除，获得 ${deleted} ${Money.UNIT}。`, this.player);
  }
}

function dimensionId(player: Player): number {
  return player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
}

function roleText(land: LandData, playerId: string): string {
  const role = getPlayerRole(land, playerId);
  return role ? ROLE_NAMES[role] : "访客";
}
