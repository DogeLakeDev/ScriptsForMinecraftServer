/**
 * land-gui.ts — 领地 GUI（已并入 feature-land）
 *
 * 原 @sfmc-bds/module-land-gui 全部迁入本文件。
 * 土地数据走 land.* service / db.query；购地前余额校验走 SDK Money。
 */

import { Player } from "@minecraft/server";
import { db } from "@sfmc-bds/sdk/sapi/db";
import { service } from "@sfmc-bds/sdk/sapi/service";
import { config } from "@sfmc-bds/sdk/sapi/config";
import {
  debug,
  Msg,
  MenuNavigator,
  ListFormInfo,
  dimensionId,
  Money,
} from "@sfmc-bds/sdk/sapi/runtime";

export interface LandGuiLandRow extends Record<string, unknown> {
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

export interface LandGuiMemberRow {
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

/** @deprecated 兼容旧名；请优先用 LandGuiLandRow */
export type LandRow = LandGuiLandRow;
/** @deprecated 兼容旧名；请优先用 LandGuiMemberRow */
export type LandMemberRow = LandGuiMemberRow;

/* ── 命令挂载（占位；真实 UI 入口由 LandGUI.showMainMenu / 主菜单调用） ── */

export function registerLandGuiCommands(): void {
  // 实际命令注册走 @sfmc-bds/sdk/runtime 的 Command.register
  debug.i("LAND-GUI", "registerLandGuiCommands: SDK 占位 OK");
}

/* ── Land API SDK facade ─────────────────────────────────────── */

/**
 * 对外 facade：GUI / 主菜单从此取土地数据。
 * 同模块内亦可直接走 db / service，保持与历史 land-gui 行为一致。
 */
export const LandApi = {
  async getLandById(landId: string): Promise<LandGuiLandRow | null> {
    return service.get<LandGuiLandRow | null>("land.byId", { landId });
  },

  async getLandByPos(dimension: number, x: number, y: number, z: number): Promise<LandGuiLandRow | null> {
    return service.get<LandGuiLandRow | null>("land.byPos", { dimension, x, y, z });
  },

  async listLandsByOwner(ownerId: string): Promise<LandGuiLandRow[]> {
    return service.get<LandGuiLandRow[]>("land.listByOwner", { ownerId });
  },

  async listMembers(landId: string): Promise<LandGuiMemberRow[]> {
    return service.get<LandGuiMemberRow[]>("land.listMembers", { landId });
  },

  async listInvites(playerId: string): Promise<InviteRow[]> {
    return service.get<InviteRow[]>("land.listInvites", { playerId });
  },

  async getPlaza(): Promise<LandGuiLandRow | null> {
    return service.get<LandGuiLandRow | null>("land.getPlaza", {});
  },

  async plazaSettings(): Promise<{ name: string; welcome: string; dimid: number; range: number }> {
    return service.get<{ name: string; welcome: string; dimid: number; range: number }>("land.plazaSettings", {});
  },

  async getPlayerRole(landId: string, playerId: string): Promise<string | null> {
    return service.get<string | null>("land.getPlayerRole", { landId, playerId });
  },

  async auditLog(landId: string): Promise<Array<{ id: number; action: string; payload: unknown; created_at: number }>> {
    return service.get<Array<{ id: number; action: string; payload: unknown; created_at: number }>>("land.auditLog", {
      landId,
    });
  },

  /** 直接读 lands 表（单点查询，避免 service.get 序列化开销） */
  async queryLands(where: Parameters<typeof db.query>[1]): Promise<LandGuiLandRow[]> {
    return db.query<LandGuiLandRow>("lands", where);
  },
};

/* ── 本地会话（申请土地点位） ──────────────────────────────────── */

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

/* ── LandGUI 类（简化版，展示 SDK 调用骨架） ─────────────────── */

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

  async buildHome(page: {
    label(s: string): void;
    button(s: string, fn: () => void | Promise<void>): void;
  }): Promise<void> {
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
    const cfg = (await config.get<{
      minSquare: number;
      maxSquare: number;
      maxLandsPerPlayer: number;
      discount: number;
    }>("land.config")) ?? {
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
