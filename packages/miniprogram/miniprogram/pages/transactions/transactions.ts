/**
 * transactions — 玩家端「交易记录」
 *
 * 使用场景：「我的」→「交易记录」。分页列出绑定账号的经济流水；下拉刷新重载，触底加载更多。
 */
import { errorText, fullTime } from "../../core/format";
import { homePlayerApi, type PlayerTransaction } from "../../core/player-api";
import { hasHomeServer } from "../../core/server";

/** 每页条数 */
const PAGE_SIZE = 30;

/** 列表行视图 */
interface TxRow {
  id: string;
  amountText: string;
  amountClass: string;
  reason: string;
  timeText: string;
  balanceText: string;
}

/** 流水金额展示：带正负号与颜色类 */
function amountView(amount: number): { amountText: string; amountClass: string } {
  const sign = amount > 0 ? "+" : "";
  return {
    amountText: `${sign}${amount}`,
    amountClass: amount > 0 ? "text-success" : amount < 0 ? "text-danger" : "",
  };
}

/** 把网关流水行转成列表行 */
function txRow(row: PlayerTransaction): TxRow {
  const { amountText, amountClass } = amountView(row.amount);
  return {
    id: row.id,
    amountText,
    amountClass,
    reason: row.reason || row.type || "交易",
    timeText: fullTime(row.createdAt),
    balanceText: `余额 ${row.balanceAfter}`,
  };
}

Page({
  data: {
    configured: hasHomeServer(),
    loading: true,
    loadingMore: false,
    error: "",
    bound: true,
    records: [] as TxRow[],
    total: 0,
    hasMore: false,
  },
  onShow() {
    void this.reload();
  },
  async onPullDownRefresh() {
    await this.reload();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    void this.loadMore();
  },

  /** 重新加载第一页 */
  async reload() {
    if (!this.data.configured) {
      this.setData({ loading: false, records: [], bound: false, hasMore: false });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const result = await homePlayerApi().transactions({ limit: PAGE_SIZE, offset: 0 });
      const records = result.records.map(txRow);
      this.setData({
        loading: false,
        bound: result.bound,
        records,
        total: result.total,
        hasMore: records.length < result.total,
      });
    } catch (error) {
      this.setData({ loading: false, error: errorText(error), records: [], hasMore: false });
    }
  },

  /** 触底追加下一页 */
  async loadMore() {
    if (!this.data.hasMore || this.data.loadingMore || this.data.loading) return;
    this.setData({ loadingMore: true });
    try {
      const offset = this.data.records.length;
      const result = await homePlayerApi().transactions({ limit: PAGE_SIZE, offset });
      const appended = result.records.map(txRow);
      const records = this.data.records.concat(appended);
      this.setData({
        loadingMore: false,
        records,
        total: result.total,
        hasMore: records.length < result.total,
      });
    } catch (error) {
      this.setData({ loadingMore: false });
      wx.showToast({ title: errorText(error), icon: "none" });
    }
  },

  openMe() {
    wx.switchTab({ url: "/pages/me/me" });
  },
});
