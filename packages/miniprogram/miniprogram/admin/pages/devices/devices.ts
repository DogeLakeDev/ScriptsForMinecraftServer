/**
 * devices — 已授权的桌面设备
 *
 * 使用场景：管理端「管理 → 已授权设备」（当前实例为微信身份档案时显示）。列出经小程序扫码 / 登录码
 * 批准的桌面端设备，可撤销；撤销后该设备下次连接即被拒绝。授权人被降级时网关也会自动拒绝其设备。
 */
import { ask, guard } from "../../../core/actions";
import { errorText } from "../../../core/format";
import { createPlayerApi, type DeviceGrant, type PlayerApi } from "../../../core/player-api";
import { session } from "../../../core/session";

/** 时间戳 → 本地日期时间文案 */
function stamp(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 设备记录 → 列表行 */
function deviceRow(grant: DeviceGrant) {
  return {
    id: grant.id,
    name: grant.name,
    meta: `${grant.approvedByName} 批准 · ${grant.lastUsedAt ? `最近使用 ${stamp(grant.lastUsedAt)}` : "尚未使用"}`,
    expires: `${stamp(grant.expiresAt)} 到期`,
  };
}

/** 当前实例的玩家端接口（设备授权挂在同一网关上） */
function currentApi(): PlayerApi | null {
  const profile = session.state.profile;
  return profile ? createPlayerApi(profile.endpoint) : null;
}

Page({
  data: {
    loading: true,
    error: "",
    rows: [] as ReturnType<typeof deviceRow>[],
  },
  onShow() {
    void this.load();
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },
  async load() {
    const api = currentApi();
    if (!api) {
      this.setData({ loading: false, error: "未选择实例", rows: [] });
      return;
    }
    try {
      const devices = await api.devices();
      this.setData({ loading: false, error: "", rows: devices.map(deviceRow) });
    } catch (error) {
      this.setData({ loading: false, error: errorText(error), rows: [] });
    }
  },
  async revoke(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const row = this.data.rows.find((item) => item.id === id);
    const api = currentApi();
    if (!row || !api) return;
    if (!(await ask("撤销授权？", `设备「${row.name}」将无法再连接管理端，需要重新扫码登录。`, "撤销", true))) return;
    const revoked = await guard(() => api.revokeDevice(id), "撤销失败");
    if (revoked === undefined) return;
    wx.showToast({ title: revoked ? "已撤销" : "设备已不存在", icon: "none" });
    void this.load();
  },
});
