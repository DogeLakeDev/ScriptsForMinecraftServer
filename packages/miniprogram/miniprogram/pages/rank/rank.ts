/**
 * rank — 玩家端排行榜
 *
 * 使用场景：标签栏「排行」。分段切换在线时长 / 财富 / 计分板；在线时长再分子段今日 / 本月 / 总计；
 * 计分板先拉公开目录再按 objective 拉排行。已绑定时底部玻璃条展示 myRank。
 */
import { errorText, hashHue } from "../../core/format";
import {
  homePlayerApi,
  type OnlineRankMetric,
  type RankPage,
  type RankRow,
  type ScoreboardObjective,
} from "../../core/player-api";
import { selectPlayerTab } from "../../core/player-tabs";
import { hasHomeServer } from "../../core/server";

/** 主分段：在线时长 / 财富 / 计分板 */
type RankTab = "online" | "wealth" | "scoreboard";

/** 列表行视图（头像色相与地图一致） */
interface RankRowView {
  rank: number;
  playerId: string;
  playerName: string;
  display: string;
  initial: string;
  hue: number;
}

/** 我的名次条 */
interface MyRankBar {
  show: boolean;
  rankText: string;
  name: string;
  display: string;
  initial: string;
  hue: number;
}

/** 把网关排行行转成列表行 */
function rowView(row: RankRow): RankRowView {
  const name = row.playerName || row.playerId || "—";
  return {
    rank: row.rank,
    playerId: row.playerId,
    playerName: name,
    display: row.display,
    initial: name.slice(0, 1).toUpperCase() || "?",
    hue: hashHue(name),
  };
}

/** 整理 myRank 玻璃条；无 myRank 时隐藏 */
function myRankBar(myRank: RankRow | null | undefined): MyRankBar {
  if (!myRank) {
    return { show: false, rankText: "", name: "", display: "", initial: "?", hue: 210 };
  }
  const name = myRank.playerName || myRank.playerId || "我";
  return {
    show: true,
    rankText: myRank.rank > 0 ? `#${myRank.rank}` : "未上榜",
    name,
    display: myRank.display,
    initial: name.slice(0, 1).toUpperCase() || "?",
    hue: hashHue(name),
  };
}

Page({
  data: {
    configured: hasHomeServer(),
    loading: true,
    error: "",
    tab: "online" as RankTab,
    metric: "today" as OnlineRankMetric,
    /** 计分板公开项芯片 */
    objectives: [] as ScoreboardObjective[],
    objectiveId: "",
    rows: [] as RankRowView[],
    unit: "",
    available: true,
    fresh: true,
    note: "",
    myRank: myRankBar(null),
  },
  onShow() {
    selectPlayerTab(this);
    void this.load();
  },
  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  /** 按当前分段 / 子段拉取排行 */
  async load() {
    if (!this.data.configured) {
      this.setData({ loading: false, rows: [], myRank: myRankBar(null) });
      return;
    }
    this.setData({ loading: true, error: "" });
    try {
      const api = homePlayerApi();
      const { tab, metric, objectiveId } = this.data;
      let page: RankPage;
      let objectives = this.data.objectives;

      if (tab === "online") {
        page = await api.onlineRank(metric);
      } else if (tab === "wealth") {
        page = await api.wealthRank();
      } else {
        // 计分板：每次加载都刷新公开目录，再拉当前 objective 的排行
        const catalog = await api.scoreboardCatalog();
        objectives = catalog.objectives;
        if (!catalog.available) {
          this.setData({
            loading: false,
            objectives,
            rows: [],
            available: false,
            fresh: catalog.fresh,
            note: catalog.note || "计分板暂不可用",
            myRank: myRankBar(null),
            unit: "",
          });
          return;
        }
        if (!objectives.length) {
          this.setData({
            loading: false,
            objectives,
            rows: [],
            available: true,
            fresh: catalog.fresh,
            note: catalog.note || "还没有公开的计分项",
            myRank: myRankBar(null),
            unit: "",
            objectiveId: "",
          });
          return;
        }
        const selected = objectiveId && objectives.some((item) => item.id === objectiveId) ? objectiveId : objectives[0]!.id;
        page = await api.scoreboardRank(selected);
        this.setData({ objectiveId: selected, objectives });
      }

      this.applyPage(page, objectives);
    } catch (error) {
      this.setData({ loading: false, error: errorText(error), rows: [], myRank: myRankBar(null) });
    }
  },

  /** 把排行页结果写入 data；objectives 不传时沿用当前目录芯片 */
  applyPage(page: RankPage, objectives?: ScoreboardObjective[]) {
    this.setData({
      loading: false,
      error: "",
      objectives: objectives ?? this.data.objectives,
      rows: page.rows.map(rowView),
      unit: page.unit || "",
      available: page.available,
      fresh: page.fresh,
      note: page.note || (!page.available ? "排行暂不可用" : !page.fresh ? "数据可能不是最新" : ""),
      myRank: myRankBar(page.myRank),
    });
  },

  /** 切换主分段 */
  pickTab(event: WechatMiniprogram.BaseEvent) {
    const tab = String(event.currentTarget.dataset.tab ?? "") as RankTab;
    if (!tab || tab === this.data.tab) return;
    this.setData({
      tab,
      // 切到计分板时保留已缓存的目录；离开时不清，避免反复请求
      rows: [],
      myRank: myRankBar(null),
      note: "",
    });
    void this.load();
  },

  /** 在线时长：今日 / 本月 / 总计 */
  pickMetric(event: WechatMiniprogram.BaseEvent) {
    const metric = String(event.currentTarget.dataset.metric ?? "") as OnlineRankMetric;
    if (!metric || metric === this.data.metric) return;
    this.setData({ metric });
    void this.load();
  },

  /** 计分板：切换公开计分项 */
  pickObjective(event: WechatMiniprogram.BaseEvent) {
    const id = String(event.currentTarget.dataset.id ?? "");
    if (!id || id === this.data.objectiveId) return;
    this.setData({ objectiveId: id });
    void this.load();
  },
});
