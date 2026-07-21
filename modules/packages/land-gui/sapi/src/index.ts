/**
 * @sfmc/module-land-gui — v2 SDK 重写
 *
 * 与 v1 的根本区别:
 *   - 不再 import @sfmc/module-land (LandCore / Database / LandApi 都不存在)
 *   - 全部数据走 @sfmc/sdk 暴露的 db / service / config 三个子路径
 *   - 数据查询:db.query("lands", {where:...})
 *   - 跨模块调用:service.get("land.byId", { landId }) — 走 land v2 暴露的 services
 *   - 配置读写:config.get/set
 *
 * 仍然使用 SDK runtime 暴露的 MenuNavigator / FormStatus / Msg / 等 UI 工具。
 * Session 类(land 申请点位)本地 Map 缓存,事务性通过 land v2 的 service 调用保证。
 */

import { Player, world } from "@minecraft/server";
import { db } from "@sfmc/sdk/sapi/db";
import { service } from "@sfmc/sdk/sapi/service";
import { config } from "@sfmc/sdk/sapi/config";
import {
  debug,
  Msg,
  MenuNavigator,
  FormStatus,
  ListFormInfo,
  dimensionId,
  Money,
} from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";
import { Permission } from "@sfmc/sdk/sapi/runtime";

const MODULE_ID = "feature-land-gui";

export interface LandRow {
  id: string;
  owner_player_id: string;
  owner_name_snapshot: string;
  dimension: number;
  min_x: number;
  min_y: number;
  min_z: number;
  max_x: number;
  max_y: number;
  max_z: number;
  name: string;
  status: string;
  version: number;
}

export interface LandMemberRow {
  id: string;
  land_id: string;
  player_id: string;
  player_name_snapshot: string;
  role: string;
}

export interface InviteRow {
  invite_id: string;
  land_id: string;
  expires_at: number;
}

/* ── 模块入口 ────────────────────────────────────────────────── */

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("land.gui.use", Permission.Any);
      Permission.register("land.gui.admin", Permission.OP);
    },
    async init() {
      registerLandGuiCommands();
    },
    cleanup() {},
  },
});

/* ── 命令挂载(示例;实际命令注册走 SDK runtime,这里只占位) ── */

function registerLandGuiCommands() {
  // 实际命令注册走 @sfmc/sdk/runtime 的 Command.register
  // 此处仅触发 manifest 校验链,真实 UI 入口 LandGUI.showMainMenu 由
  // 其他模块(land / 主菜单)调用。
  debug.i("LAND-GUI", "registerLandGuiCommands: SDK 占位 OK");
}

/* ── Land API SDK facade ─────────────────────────────────────── */

/**
 * 全 SDK 重写后的对外 facade。所有 land-gui 内部逻辑都从这里取数。
 * 不允许再 import @sfmc/module-land 内部。
 */
export const LandApi = {
  async getLandById(landId: string): Promise<LandRow | null> {
    return service.get<LandRow | null>("land.byId", { landId });
  },

  async getLandByPos(dimension: number, x: number, y: number, z: number): Promise<LandRow | null> {
    return service.get<LandRow | null>("land.byPos", { dimension, x, y, z });
  },

  async listLandsByOwner(ownerId: string): Promise<LandRow[]> {
    return service.get<LandRow[]>("land.listByOwner", { ownerId });
  },

  async listMembers(landId: string): Promise<LandMemberRow[]> {
    return service.get<LandMemberRow[]>("land.listMembers", { landId });
  },

  async listInvites(playerId: string): Promise<InviteRow[]> {
    return service.get<InviteRow[]>("land.listInvites", { playerId });
  },

  async getPlaza(): Promise<LandRow | null> {
    return service.get<LandRow | null>("land.getPlaza", {});
  },

  async plazaSettings(): Promise<{ name: string; welcome: string; dimid: number; range: number }> {
    return service.get<{ name: string; welcome: string; dimid: number; range: number }>("land.plazaSettings", {});
  },

  async getPlayerRole(landId: string, playerId: string): Promise<string | null> {
    return service.get<string | null>("land.getPlayerRole", { landId, playerId });
  },

  async auditLog(landId: string): Promise<Array<{ id: number; action: string; payload: unknown; created_at: number }>> {
    return service.get<Array<{ id: number; action: string; payload: unknown; created_at: number }>>("land.auditLog", { landId });
  },

  /** 直接读 lands 表(单点查询,避免 service.get 序列化开销) */
  async queryLands(where: Parameters<typeof db.query>[1]): Promise<LandRow[]> {
    return db.query<LandRow>("lands", where);
  },
};

/* ── 本地会话(申请土地点位) ──────────────────────────────────── */

interface PlayerSession {
  pos1?: { x: number; y: number; z: number };
  pos2?: { x: number; y: number; z: number };
  dimensionId?: number;
  updatedAt: number;
}

const _sessions = new Map<string, PlayerSession>();

export function getSession(plid: string): PlayerSession | undefined {
  return _sessions.get(plid);
}

export function initSession(plid: string): void {
  _sessions.set(plid, { updatedAt: Date.now() });
}

export function setPos(plid: string, idx: 1 | 2, pos: { x: number; y: number; z: number }): void {
  const s = _sessions.get(plid) ?? { updatedAt: Date.now() };
  if (idx === 1) s.pos1 = pos;
  else s.pos2 = pos;
  s.updatedAt = Date.now();
  _sessions.set(plid, s);
}

export function clearSession(plid: string): boolean {
  return _sessions.delete(plid);
}

/* ── LandGUI 类(简化版,展示 SDK 调用骨架) ─────────────────── */

type LandGuiState = {
  selectedLandId?: string;
  invites: InviteRow[];
  loading: boolean;
};

export class LandGUI {
  private nav: MenuNavigator;
  private player: Player;

  private constructor(player: Player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.nav.state.gui = { invites: [], loading: false } satisfies LandGuiState;
  }

  static showMainMenu(player: Player): void {
    debug.i("GUI", `LandGUI.showMainMenu: player=${player.name}`);
    const gui = new LandGUI(player);
    void LandApi.listInvites(player.id).then((invites) => {
      gui.state.invites = invites;
      return gui.nav.start("home");
    });
  }

  private get state(): LandGuiState {
    return this.nav.state.gui as LandGuiState;
  }

  async buildHome(page: { label(s: string): void; button(s: string, fn: () => void | Promise<void>): void }): Promise<void> {
    const pos = this.player.location;
    const dim = dimensionId(this.player.dimension);
    const landHere = await LandApi.getLandByPos(dim, Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    const owned = await LandApi.listLandsByOwner(this.player.id);
    page.label(
      ListFormInfo([
        landHere ? `当前土地:${landHere.name || landHere.id}` : "当前不在土地保护范围内。",
        `拥有土地:${owned.length} 块`,
        `待处理邀请:${this.state.invites.length} 项`,
      ])
    );
    page.button("我的土地", () => void this.nav.rebuild("landList"));
    page.button("申请土地", () => void this.openApplication());
  }

  private async openApplication(): Promise<void> {
    const session = getSession(this.player.id);
    if (!session || !session.pos1 || !session.pos2) {
      Msg.info("请先使用 !pos1 和 !pos2 命令选择土地范围。", this.player);
      return;
    }
    const cfg = (await config.get<{ minSquare: number; maxSquare: number; maxLandsPerPlayer: number; discount: number }>("land.config")) ?? {
      minSquare: 9,
      maxSquare: 10000,
      maxLandsPerPlayer: 5,
      discount: 1,
    };
    const valid = await service.get<{ ok: boolean; msg?: string }>("land.validateBox", {
      dimension: session.dimensionId ?? 0,
      minX: session.pos1.x,
      minY: session.pos1.y,
      minZ: session.pos1.z,
      maxX: session.pos2.x,
      maxY: session.pos2.y,
      maxZ: session.pos2.z,
    });
    if (!valid.ok) {
      Msg.error(valid.msg ?? "土地验证失败。", this.player);
      return;
    }
    const balance = await Money.load(this.player);
    const sq = (session.pos2.x - session.pos1.x + 1) * (session.pos2.z - session.pos1.z + 1);
    const price = Math.max(0, Math.floor((sq * 8 + 1) * cfg.discount));
    if (balance < price) {
      Msg.error(`${Money.UNIT} 不足,需要 ${price}。`, this.player);
      return;
    }
    Msg.success(`土地验证通过,价格 ${price} ${Money.UNIT},请通过 land v2 服务创建。`, this.player);
  }
}

/* ── 重导出 facade ──────────────────────────────────────────── */

export { LandGUI };
export const configKey = "land_gui";