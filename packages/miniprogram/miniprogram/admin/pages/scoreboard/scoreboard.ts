/**
 * scoreboard — 管理端「计分板」
 *
 * 使用场景：「管理」页的「计分板」入口（握手带 scoreboard 能力时显示），对应桌面端 ScoreboardPage：
 * 查看全部计分项与参与者分数，统计卡片、排行前 10 与分数分布；新建 / 删除计分项，
 * 修改（设为 / 增加 / 减少）或重置分数，添加虚拟玩家。
 * 数据来自游戏内脚本同步到数据服务的快照，修改经 BDS 控制台的 scoreboard 命令下发；
 * 离线玩家与实体无法被控制台命令定位，只读显示原因。
 * 页面显示期间定时刷新：数据服务只在有人查看时要求游戏内脚本上报。
 */
import { ask, guard } from "../../../core/actions";
import { errorText, hashHue, relativeTime } from "../../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import type { ScoreboardObjectiveRow, ScoreboardOperation, ScoreboardParticipant, ScoreboardReadResult, ScoreboardScoreMode } from "../../../core/types";
import {
  SCORE_MODES,
  SCOREBOARD_SORTS,
  binLabel,
  filterParticipants,
  formatScore,
  formatStat,
  objectiveFormError,
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

/** 参与者排序方式（取自共用的排序选项） */
type Sort = (typeof SCOREBOARD_SORTS)[number]["value"];

/** 页面显示期间的刷新间隔；需短于数据服务的关注期（30 秒），游戏内脚本才会持续同步 */
const POLL_MS = 5_000;
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

/** 「新建计分项」表单草稿 */
interface ObjectiveDraft {
  id: string;
  displayName: string;
  submitted: boolean;
}

/** 页面状态（不放进 data） */
const view = {
  result: null as ScoreboardReadResult | null,
  selectedId: null as string | null,
  objectiveKeyword: "",
  keyword: "",
  sort: "score-desc" as Sort,
  visible: LIST_STEP,
  loading: false,
  error: "",
  /** 读取请求序号，丢弃被后发请求取代的响应 */
  seq: 0,
  /** 进行中的读取数；定时刷新在有读取未完成时跳过，以免顶掉编辑后等待新快照的那次读取 */
  inflight: 0,
  timer: null as number | null,
  /** 上次渲染时是否在线；从离线恢复时重新读取 */
  online: false,
  saving: false,
  objectiveDraft: null as ObjectiveDraft | null,
  scoreDraft: null as ScoreDraft | null,
};

/** 按显示名排序后、经关键词筛选的计分项 */
function shownObjectives(): ScoreboardObjectiveRow[] {
  const text = view.objectiveKeyword.trim().toLowerCase();
  const list = [...(view.result?.objectives ?? [])].sort((a, b) => objectiveTitle(a).localeCompare(objectiveTitle(b), "zh-CN"));
  return text ? list.filter((row) => row.id.toLowerCase().includes(text) || objectiveTitle(row).toLowerCase().includes(text)) : list;
}

/** 当前选中的计分项；选中项被删除或首次载入时取筛选后的第一个 */
function selectedObjective(): ScoreboardObjectiveRow | null {
  const objectives = view.result?.objectives ?? [];
  return objectives.find((row) => row.id === view.selectedId) ?? shownObjectives()[0] ?? null;
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

/** 新建计分项表单的视图 */
function objectiveFormView() {
  const draft = view.objectiveDraft;
  if (!draft) return null;
  const operation: ScoreboardOperation = { op: "objective.add", objective: draft.id, ...(draft.displayName.trim() ? { displayName: draft.displayName } : {}) };
  const error = objectiveFormError(view.result?.objectives ?? [], operation);
  return {
    id: draft.id,
    displayName: draft.displayName,
    error: draft.submitted ? error ?? "" : "",
    command: error ? "" : `/${scoreboardCommand(operation)}`,
  };
}

/** 修改分数表单：草稿对应的计分项、参与者与组装好的操作；计分项或参与者已不在快照中时为 null */
function scoreFormState() {
  const draft = view.scoreDraft;
  const objective = draft ? view.result?.objectives.find((row) => row.id === draft.objectiveId) : undefined;
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
  const now = Date.now();
  const result = view.result;
  const selected = selectedObjective();
  const participants = selected ? sortParticipants(filterParticipants(selected.participants, view.keyword), view.sort) : [];
  const connection = connectionView(state);
  return {
    ...connection,
    /** 可以下发编辑：连接可写且数据服务可用 */
    canEdit: connection.editable && Boolean(result?.available),
    loaded: Boolean(result),
    loading: view.loading,
    saving: view.saving,
    error: view.error,
    synced: result?.updatedAt ? `同步于 ${relativeTime(result.updatedAt, now)}` : "",
    /** 不可用或不新鲜时的说明，以及提示语气 */
    note: result && (!result.available || !result.fresh) ? result.note ?? "" : "",
    noteTone: result?.available ? "warning" : "info",
    truncated: Boolean(result?.truncated),
    empty: Boolean(result && !result.objectives.length),
    objectives: shownObjectives().map((row) => ({
      id: row.id,
      title: objectiveTitle(row),
      count: row.participants.length,
      shown: objectiveSlots(result ?? undefined, row.id).length > 0,
      active: row.id === selected?.id,
    })),
    selected: selected
      ? { id: selected.id, title: objectiveTitle(selected), slots: objectiveSlots(result ?? undefined, selected.id), count: selected.participants.length, ...chartsView(selected) }
      : null,
    sorts: SCOREBOARD_SORTS.map((row) => ({ ...row, active: row.value === view.sort })),
    participants: participants.slice(0, view.visible).map(participantView),
    participantTotal: participants.length,
    hasMore: participants.length > view.visible,
    objectiveForm: objectiveFormView(),
    scoreForm: scoreFormView(),
  };
}

Page({
  data: {
    ...render(session.state),
    objectiveKeyword: "",
    keyword: "",
  },
  onLoad() {
    view.result = null;
    view.selectedId = null;
    view.objectiveKeyword = view.keyword = "";
    view.sort = "score-desc";
    view.visible = LIST_STEP;
    view.loading = view.saving = false;
    view.error = "";
    view.online = false;
    view.objectiveDraft = view.scoreDraft = null;
  },
  onShow() {
    watchSession(this, ["connection"], (state) => {
      const online = state.status === "online";
      const resumed = online && !view.online;
      view.online = online;
      if (resumed) void this.load();
      return render(state);
    });
    view.timer = setInterval(() => {
      if (view.inflight === 0) void this.load({ silent: true });
    }, POLL_MS) as unknown as number;
  },
  onHide() {
    this.stop();
  },
  onUnload() {
    this.stop();
  },
  stop() {
    unwatchSession(this);
    if (view.timer !== null) clearInterval(view.timer);
    view.timer = null;
    // 下次显示时按「恢复在线」重新读取
    view.online = false;
  },
  async onPullDownRefresh() {
    await this.load();
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

  /** 读取快照；after 用于编辑后等待包含结果的新快照，silent 为定时刷新（失败不覆盖已有数据） */
  async load(options: { after?: number; silent?: boolean } = {}) {
    if (session.state.status !== "online") return;
    const seq = ++view.seq;
    if (!options.silent) {
      view.loading = true;
      this.rerender();
    }
    view.inflight++;
    try {
      const value = await session.request("scoreboard.read", options.after === undefined ? {} : { after: options.after });
      if (seq !== view.seq) return;
      view.result = value;
      view.error = "";
    } catch (error) {
      if (seq !== view.seq) return;
      if (!options.silent || !view.result) view.error = errorText(error);
    } finally {
      view.inflight--;
      if (seq === view.seq) {
        view.loading = false;
        this.rerender();
      }
    }
  },
  reload() {
    void this.load();
  },

  /** 下发编辑操作并等待新快照；成功返回 true，失败弹窗说明 */
  async apply(operations: ScoreboardOperation[], success: string, failTitle: string): Promise<boolean> {
    if (view.saving || !this.data.canEdit) return false;
    view.saving = true;
    this.rerender();
    const done = await guard(async () => {
      const { sentAt } = await session.request("scoreboard.apply", { operations });
      wx.showToast({ title: success, icon: "success" });
      await this.load({ after: sentAt, silent: true });
      return true;
    }, failTitle);
    view.saving = false;
    this.rerender();
    return Boolean(done);
  },

  /* ---------- 计分项 ---------- */
  pickObjective(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    if (id === selectedObjective()?.id) return;
    view.selectedId = id;
    view.visible = LIST_STEP;
    this.rerender();
  },
  onObjectiveKeyword(event: WechatMiniprogram.Input) {
    view.objectiveKeyword = event.detail.value;
    this.setData({ objectiveKeyword: event.detail.value });
    this.rerender();
  },
  clearObjectiveKeyword() {
    view.objectiveKeyword = "";
    this.setData({ objectiveKeyword: "" });
    this.rerender();
  },
  openObjectiveForm() {
    if (!this.data.canEdit) return;
    view.objectiveDraft = { id: "", displayName: "", submitted: false };
    this.rerender();
  },
  closeObjectiveForm() {
    if (view.saving) return;
    view.objectiveDraft = null;
    this.rerender();
  },
  onObjectiveInput(event: WechatMiniprogram.Input) {
    const draft = view.objectiveDraft;
    if (!draft) return;
    if (event.currentTarget.dataset.field === "displayName") draft.displayName = event.detail.value;
    else draft.id = event.detail.value;
    this.rerender();
  },
  async commitObjectiveForm() {
    const draft = view.objectiveDraft;
    if (!draft || view.saving) return;
    draft.submitted = true;
    const operation: ScoreboardOperation = { op: "objective.add", objective: draft.id, ...(draft.displayName.trim() ? { displayName: draft.displayName } : {}) };
    if (objectiveFormError(view.result?.objectives ?? [], operation)) {
      this.rerender();
      return;
    }
    if (!(await this.apply([operation], "已创建", "创建计分项失败"))) return;
    view.selectedId = draft.id;
    view.objectiveDraft = null;
    this.rerender();
  },
  async removeObjective() {
    const objective = selectedObjective();
    if (!objective || !this.data.canEdit) return;
    const confirmed = await ask(
      `删除计分项「${objectiveTitle(objective)}」？`,
      `将清除其中 ${objective.participants.length} 名参与者的全部分数且无法恢复，依赖该计分项的模块或命令方块可能受影响。`,
      "删除",
      true
    );
    if (confirmed) await this.apply([{ op: "objective.remove", objective: objective.id }], "已删除", "删除计分项失败");
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
  /** 打开分数表单：带 id 时修改该参与者，否则添加参与者 */
  openScoreForm(event: WechatMiniprogram.TouchEvent) {
    const objective = selectedObjective();
    if (!objective || !this.data.canEdit) return;
    const raw = event.currentTarget.dataset.id;
    const participant = raw === undefined ? null : objective.participants.find((row) => row.id === Number(raw)) ?? null;
    if (raw !== undefined && (!participant || scoreboardTargetBlock(participant))) return;
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
    if (view.saving) return;
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
    if (!form || view.saving) return;
    form.draft.submitted = true;
    if (form.error) {
      this.rerender();
      return;
    }
    if (await this.apply([form.operation], form.participant ? "已更新" : "已添加", form.participant ? "修改分数失败" : "添加参与者失败")) {
      view.scoreDraft = null;
      this.rerender();
    }
  },
  async resetParticipant(event: WechatMiniprogram.TouchEvent) {
    const objective = selectedObjective();
    const participant = objective?.participants.find((row) => row.id === Number(event.currentTarget.dataset.id));
    if (!objective || !participant || !this.data.canEdit || scoreboardTargetBlock(participant)) return;
    const confirmed = await ask(
      `重置 ${participantName(participant)} 的分数？`,
      `将从计分项「${objectiveTitle(objective)}」中移除该参与者（当前 ${formatScore(participant.score)} 分）。`,
      "重置",
      true
    );
    if (confirmed) {
      await this.apply([{ op: "score.reset", objective: objective.id, target: participant.name, participantId: participant.id }], "已重置", "重置分数失败");
    }
  },
});
