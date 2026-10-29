/**
 * lands — 玩家端「我的领地」
 *
 * 使用场景：「我的」→「我的领地」。只读列出绑定账号相关的领地（状态、等级、区块数、下次维护），
 * 「在地图中查看」写入 mapFocusLandId 后 switchTab 到地图页由地图选中该领地；不提供续费（只读）。
 */
import { errorText, fullTime } from "../../core/format";
import { landStatusLabel } from "../../core/map-lands";
import { homePlayerApi, type PlayerLand } from "../../core/player-api";
import { hasHomeServer } from "../../core/server";

/** 地图页读取的「聚焦领地」存储键（lands → map switchTab 传参，与 map.ts onShow 一致） */
const MAP_FOCUS_LAND_ID_KEY = "mapFocusLandId";

/** 列表行视图 */
interface LandRow {
  id: string;
  name: string;
  statusLabel: string;
  statusTone: string;
  levelText: string;
  chunksText: string;
  upkeepText: string;
  dueText: string;
  delinquent: boolean;
  relation: string;
  ownerName: string;
}

/** 状态 → 徽章语气 */
function statusTone(status: string): string {
  if (status === "active") return "success";
  if (status === "delinquent") return "danger";
  if (status === "frozen") return "warning";
  return "";
}

/** 把网关领地摘要转成列表行 */
function landRow(land: PlayerLand): LandRow {
  const delinquent = land.status === "delinquent" || land.upkeepDue > 0;
  return {
    id: land.id,
    name: land.name || land.id,
    statusLabel: landStatusLabel(land.status),
    statusTone: statusTone(land.status),
    levelText: `Lv.${land.level}`,
    chunksText: `${land.chunks} 区块`,
    upkeepText: land.nextUpkeepAt ? `下次维护 ${fullTime(land.nextUpkeepAt)}` : "下次维护 —",
    dueText: delinquent && land.upkeepDue > 0 ? `欠费 ${land.upkeepDue}` : "",
    delinquent,
    relation: land.relation || "",
    ownerName: land.ownerName || "",
  };
}

Page({
  data: {
    configured: hasHomeServer(),
    loading: true,
    error: "",
    bound: true,
    lands: [] as LandRow[],
  },
  onShow() {
    void this.load();
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 拉取我的领地列表 */
  async load() {
    if (!this.data.configured) {
      this.setData({ loading: false, lands: [], bound: false });
      return;
    }
    try {
      const result = await homePlayerApi().lands();
      this.setData({
        loading: false,
        error: "",
        bound: result.bound,
        lands: result.lands.map(landRow),
      });
    } catch (error) {
      this.setData({ loading: false, error: errorText(error), lands: [] });
    }
  },

  /**
   * 在地图中查看：写入聚焦领地 id 后切到地图标签页。
   * switchTab 不能带 query，故用本地存储传参（地图 onShow 读取并清除）。
   */
  openOnMap(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id) return;
    wx.setStorageSync(MAP_FOCUS_LAND_ID_KEY, id);
    wx.switchTab({ url: "/pages/map/map" });
  },

  /** 未绑定时回「我的」绑定 */
  openMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },
});
