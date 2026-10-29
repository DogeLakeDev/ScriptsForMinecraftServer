/**
 * scoreboard-objective — 管理端计分项详情（从计分项列表 scoreboard 点按进入，?id=<计分项 ID>）
 *
 * 使用场景：查看某个计分项的统计卡片、排行前 10 与分数分布，管理参与者：点按参与者修改分数（设为 / 增加 / 减少），
 * 左滑重置（移除该参与者），添加参与者（虚拟玩家或在线玩家）；页面底部删除整个计分项。
 * 离线玩家与实体无法被控制台命令定位：不能左滑，点按时提示原因。
 * 快照读取、定时刷新与编辑下发与列表页共用 admin/core/scoreboard.ts。
 */
import { ask } from "../../../core/actions";
import { errorText, hashHue } from "../../../core/format";
import { session, type SessionState } from "../../../core/session";
import type { ScoreboardObjectiveRow, ScoreboardParticipant, ScoreboardScoreMode } from "../../../core/types";
import {
  SCORE_MODES,
  SCOREBOARD_SORTS,
  binLabel,
  filterParticipants,
  formatScore,
  formatStat,
  objectiveSlots,
  objectiveTitle,
  participantName,
  participantTag,
  previewScore,
  scoreForm,
  scoreHistogram,
  scoreRanking,
  scoreStats,
  sortParticipants,
} from "../../../vendor/desktop-lib";
import { scoreboardCommand, scoreboardTargetBlock } from "../../../vendor/management";
import { applyScoreboard, loadScoreboard, scoreboard, scoreboardStatus, unwatchScoreboard, watchScoreboard } from "../../core/scoreboard";

/** 参与者排序方式（取自共用的排序选项） */
type Sort = (typeof SCOREBOARD_SORTS)[number]["value"];

/** 排行显示的名次数（与桌面端一致） */
const RANK_ROWS = 10;
/** 分布图的最多柱数；手机屏幕较窄，比桌面端少 */
const HISTOGRAM_BINS = 8;
/** 参与者列表每次多显示的行数 */
const LIST_STEP = 100;

/** 「修改分数 / 添加参与者」表单草稿；participantId 为 null 表示添加参与者 */
interface ScoreDraft {
  objectiveId: string;
  participantId: number | null;
  target: string;
  mode: ScoreboardScoreMode;
  /** 分数输入框的原始文本（允许负号，提交时再解析） */
  text: string;
  submitted: boolean;
}

/** 页面状态（不放进 data） */
const view = {
  /** 当前计分项 ID（页面参数） */
  id: "",
  keyword: "",
  sort: "score-desc" as Sort,
  visible: LIST_STEP,
  scoreDraft: null as ScoreDraft | null,
  /** 已设置的导航栏标题，计分项显示名变化时才更新 */
  title: "",
  /** 玩家端排行公开名单（scoreboard.publicObjectives）；null 表示尚未读取 */
  publicIds: null as string[] | null,
  /** 公开开关读写中 */
  publicBusy: false,
};

/** 当前计分项；不在快照中（已被删除或尚未读取）时为 undefined */
function currentObjective(): ScoreboardObjectiveRow | undefined {
  return scoreboard.result?.objectives.find((row) => row.id === view.id);
}

/** 分数输入框文本 → 数值：空白为 null（未填写），其他交给协议校验（非整数会被拒绝） */
function parseScore(text: string): number | null {
  return text.trim() ? Number(text.trim()) : null;
}

/** 统计卡片、排行与分布的视图 */
function chartsView(objective: ScoreboardObjectiveRow) {
  const stats = scoreStats(objective.participants);
  const histogram = scoreHistogram(objective.participants, HISTOGRAM_BINS);
  return {
    stats: [
      { label: "参与者", value: formatStat(stats.count) },
      { label: "总分", value: formatStat(stats.sum) },
      { label: "平均", value: formatStat(stats.mean) },
      { label: "中位数", value: formatStat(stats.median) },
      { label: "最高", value: formatStat(stats.max) },
      { label: "最低", value: formatStat(stats.min) },
    ],
    rankTitle: `排行前 ${Math.min(RANK_ROWS, stats.count)}`,
    ranking: scoreRanking(objective.participants, RANK_ROWS).map((row) => ({
      id: row.participant.id,
      rank: row.rank,
      name: participantName(row.participant),
      score: formatScore(row.participant.score),
      width: row.ratio,
      negative: row.participant.score < 0,
    })),
    histogram: histogram.map((bin) => ({
      key: bin.from,
      count: bin.count,
      /** 柱高百分比；有人的区间保留最小高度，数量很少时也能看见 */
      height: Math.max(bin.count ? 4 : 0, bin.ratio),
      label: binLabel(bin),
    })),
    axisFrom: histogram.length ? formatScore(histogram[0].from) : "",
    axisTo: histogram.length ? formatScore(histogram[histogram.length - 1].to) : "",
  };
}

/** 参与者列表的一行 */
function participantView(participant: ScoreboardParticipant) {
  const name = participantName(participant);
  const tag = participantTag(participant);
  return {
    id: participant.id,
    name,
    initial: name.slice(0, 1).toUpperCase(),
    hue: hashHue(name),
    tag: tag.label,
    tone: tag.tone,
    score: formatScore(participant.score),
    /** 无法经控制台命令修改的原因；为空表示可编辑 */
    block: scoreboardTargetBlock(participant) ?? "",
  };
}

/** 修改分数表单：草稿对应的计分项、参与者与组装好的操作；计分项或参与者已不在快照中时为 null */
function scoreFormState() {
  const draft = view.scoreDraft;
  const objective = draft ? scoreboard.result?.objectives.find((row) => row.id === draft.objectiveId) : undefined;
  if (!draft || !objective) return null;
  const participant = draft.participantId === null ? null : objective.participants.find((row) => row.id === draft.participantId) ?? null;
  if (draft.participantId !== null && !participant) return null;
  const value = parseScore(draft.text);
  return { draft, objective, participant, value, ...scoreForm(objective, participant, draft.mode, draft.target, value) };
}

/** 修改分数表单的视图 */
function scoreFormView() {
  const form = scoreFormState();
  if (!form) return null;
  const { draft, objective, participant, value, operation, error } = form;
  const current = participant?.score ?? 0;
  return {
    adding: !participant,
    title: participant ? `修改 ${participantName(participant)} 的分数` : "添加参与者",
    subtitle: `计分项：${objectiveTitle(objective)}`,
    target: draft.target,
    modes: SCORE_MODES.map((row) => ({ ...row, active: row.value === draft.mode })),
    valueLabel: draft.mode === "set" ? "分数" : draft.mode === "add" ? "增加" : "减少",
    text: draft.text,
    error: draft.submitted ? error ?? "" : "",
    preview: participant && value !== null && Number.isFinite(value) ? `${formatScore(current)} → ${formatScore(previewScore(current, draft.mode, value))}` : "",
    command: error ? "" : `/${scoreboardCommand(operation)}`,
  };
}

function render(state: SessionState) {
  const objective = currentObjective();
  const participants = objective ? sortParticipants(filterParticipants(objective.participants, view.keyword), view.sort) : [];
  const title = objective ? objectiveTitle(objective) : "";
  if (title && title !== view.title) {
    view.title = title;
    wx.setNavigationBarTitle({ title });
  }
  return {
    ...scoreboardStatus(state),
    selected: objective
      ? { id: objective.id, title, slots: objectiveSlots(scoreboard.result ?? undefined, objective.id), count: objective.participants.length, ...chartsView(objective) }
      : null,
    sorts: SCOREBOARD_SORTS.map((row) => ({ ...row, active: row.value === view.sort })),
    participants: participants.slice(0, view.visible).map(participantView),
    participantTotal: participants.length,
    hasMore: participants.length > view.visible,
    scoreForm: scoreFormView(),
    /** 当前计分项是否已在玩家端排行公开 */
    publicOn: Boolean(view.id && view.publicIds?.includes(view.id)),
    publicBusy: view.publicBusy,
  };
}

Page({
  data: {
    ...render(session.state),
    keyword: "",
  },
  onLoad(query: Record<string, string | undefined>) {
    view.id = decodeURIComponent(query.id ?? "");
    view.keyword = "";
    view.sort = "score-desc";
    view.visible = LIST_STEP;
    view.scoreDraft = null;
    view.title = "";
    view.publicIds = null;
    view.publicBusy = false;
    this.setData({ keyword: "" });
  },
  onShow() {
    watchScoreboard(this, render);
    void this.loadPublic();
  },
  onHide() {
    unwatchScoreboard(this);
  },
  onUnload() {
    unwatchScoreboard(this);
  },
  async onPullDownRefresh() {
    await loadScoreboard();
    wx.stopPullDownRefresh();
  },
  onReachBottom() {
    if (!this.data.hasMore) return;
    view.visible += LIST_STEP;
    this.rerender();
  },
  rerender() {
    this.setData(render(session.state));
  },
  reload() {
    void loadScoreboard();
    void this.loadPublic();
  },

  /** 读取玩家端排行公开名单；失败时保持 null，开关显示为关 */
  async loadPublic() {
    if (session.state.status !== "online") return;
    try {
      const result = await session.request("scoreboard.publicObjectives", {});
      view.publicIds = result.ids;
    } catch {
      view.publicIds = view.publicIds ?? [];
    }
    this.rerender();
  },

  /**
   * 切换「在排行中公开」。
   * 使用场景：玩家端排行「计分板」分类只展示公开名单里的计分项。
   */
  async togglePublic() {
    const objective = currentObjective();
    if (!objective || !this.data.canEdit || view.publicBusy) return;
    const next = !this.data.publicOn;
    view.publicBusy = true;
    this.rerender();
    try {
      const result = await session.request("scoreboard.setPublicObjective", { objectiveId: objective.id, public: next });
      view.publicIds = result.ids;
      wx.showToast({ title: next ? "已在排行中公开" : "已取消公开", icon: "success" });
    } catch (error) {
      wx.showToast({ title: errorText(error), icon: "none" });
    } finally {
      view.publicBusy = false;
      this.rerender();
    }
  },

  /** 页面底部「删除计分项」：删除后回到计分项列表 */
  async removeObjective() {
    const objective = currentObjective();
    if (!objective || !this.data.canEdit) return;
    const confirmed = await ask(
      `删除计分项「${objectiveTitle(objective)}」？`,
      `将清除其中 ${objective.participants.length} 名参与者的全部分数且无法恢复，依赖该计分项的模块或命令方块可能受影响。`,
      "删除",
      true
    );
    if (confirmed && (await applyScoreboard([{ op: "objective.remove", objective: objective.id }], "已删除", "删除计分项失败"))) {
      wx.navigateBack();
    }
  },

  /* ---------- 参与者 ---------- */
  onKeyword(event: WechatMiniprogram.Input) {
    view.keyword = event.detail.value;
    view.visible = LIST_STEP;
    this.setData({ keyword: event.detail.value });
    this.rerender();
  },
  clearKeyword() {
    view.keyword = "";
    view.visible = LIST_STEP;
    this.setData({ keyword: "" });
    this.rerender();
  },
  pickSort(event: WechatMiniprogram.TouchEvent) {
    const value = event.currentTarget.dataset.value as Sort;
    if (value === view.sort) return;
    view.sort = value;
    view.visible = LIST_STEP;
    this.rerender();
  },
  /** 打开分数表单：点按参与者行（带 id）时修改该参与者，「添加」按钮（不带 id）时添加参与者；无法修改的参与者提示原因 */
  openScoreForm(event: WechatMiniprogram.TouchEvent) {
    const objective = currentObjective();
    if (!objective || !this.data.canEdit) return;
    const raw = event.currentTarget.dataset.id;
    const participant = raw === undefined ? null : objective.participants.find((row) => row.id === Number(raw)) ?? null;
    if (raw !== undefined && !participant) return;
    const block = participant ? scoreboardTargetBlock(participant) : undefined;
    if (block) {
      wx.showToast({ title: block, icon: "none" });
      return;
    }
    view.scoreDraft = {
      objectiveId: objective.id,
      participantId: participant?.id ?? null,
      target: "",
      mode: "set",
      text: String(participant?.score ?? 0),
      submitted: false,
    };
    this.rerender();
  },
  closeScoreForm() {
    if (scoreboard.saving) return;
    view.scoreDraft = null;
    this.rerender();
  },
  onScoreTarget(event: WechatMiniprogram.Input) {
    if (!view.scoreDraft) return;
    view.scoreDraft.target = event.detail.value;
    this.rerender();
  },
  onScoreText(event: WechatMiniprogram.Input) {
    if (!view.scoreDraft) return;
    view.scoreDraft.text = event.detail.value;
    this.rerender();
  },
  /** 切换修改方式时换掉输入值：「设为」回到当前分数，「增加 / 减少」从步长 1 开始，避免把绝对分数误当增量 */
  pickMode(event: WechatMiniprogram.TouchEvent) {
    const form = scoreFormState();
    const mode = event.currentTarget.dataset.value as ScoreboardScoreMode;
    if (!form || mode === form.draft.mode) return;
    form.draft.mode = mode;
    form.draft.text = mode === "set" ? String(form.participant?.score ?? 0) : "1";
    form.draft.submitted = false;
    this.rerender();
  },
  /** 分数步进按钮（±1） */
  stepScore(event: WechatMiniprogram.TouchEvent) {
    const draft = view.scoreDraft;
    if (!draft) return;
    const current = parseScore(draft.text);
    const base = current !== null && Number.isInteger(current) ? current : 0;
    draft.text = String(base + Number(event.currentTarget.dataset.step));
    this.rerender();
  },
  async commitScoreForm() {
    const form = scoreFormState();
    if (!form || scoreboard.saving || !this.data.canEdit) return;
    form.draft.submitted = true;
    if (form.error) {
      this.rerender();
      return;
    }
    if (await applyScoreboard([form.operation], form.participant ? "已更新" : "已添加", form.participant ? "修改分数失败" : "添加参与者失败")) {
      view.scoreDraft = null;
      this.rerender();
    }
  },
  /** 左滑「重置」：从计分项中移除该参与者（data-id 挂在 swipe-row 上） */
  async resetParticipant(event: WechatMiniprogram.BaseEvent) {
    const objective = currentObjective();
    const participant = objective?.participants.find((row) => row.id === Number(event.currentTarget.dataset.id));
    if (!objective || !participant || !this.data.canEdit || scoreboardTargetBlock(participant)) return;
    const confirmed = await ask(
      `重置 ${participantName(participant)} 的分数？`,
      `将从计分项「${objectiveTitle(objective)}」中移除该参与者（当前 ${formatScore(participant.score)} 分）。`,
      "重置",
      true
    );
    if (confirmed) {
      await applyScoreboard([{ op: "score.reset", objective: objective.id, target: participant.name, participantId: participant.id }], "已重置", "重置分数失败");
    }
  },
});
