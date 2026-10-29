/**
 * scoreboard — 管理端「计分板」：计分项列表
 *
 * 使用场景：「管理」页的「计分板」入口（握手带 scoreboard 能力时显示），对应桌面端 ScoreboardPage 的计分项部分：
 * 以 iOS 列表列出全部计分项（行尾为参与者数），点按进入计分项详情页 scoreboard-objective 查看统计、
 * 排行、分布并编辑分数；在这里新建计分项，左滑删除计分项。
 * 数据来自游戏内脚本同步到数据服务的快照（读取、定时刷新与编辑下发见 admin/core/scoreboard.ts），
 * 修改经 BDS 控制台的 scoreboard 命令下发。
 */
import { ask } from "../../../core/actions";
import { session, type SessionState } from "../../../core/session";
import type { ScoreboardObjectiveRow, ScoreboardOperation } from "../../../core/types";
import { objectiveFormError, objectiveSlots, objectiveTitle } from "../../../vendor/desktop-lib";
import { scoreboardCommand } from "../../../vendor/management";
import { applyScoreboard, loadScoreboard, resetScoreboard, scoreboard, scoreboardStatus, unwatchScoreboard, watchScoreboard } from "../../core/scoreboard";

/** 「新建计分项」表单草稿 */
interface ObjectiveDraft {
  id: string;
  displayName: string;
  submitted: boolean;
}

/** 页面状态（不放进 data） */
const view = {
  objectiveKeyword: "",
  objectiveDraft: null as ObjectiveDraft | null,
};

/** 按显示名排序后、经关键词筛选的计分项 */
function shownObjectives(): ScoreboardObjectiveRow[] {
  const text = view.objectiveKeyword.trim().toLowerCase();
  const list = [...(scoreboard.result?.objectives ?? [])].sort((a, b) => objectiveTitle(a).localeCompare(objectiveTitle(b), "zh-CN"));
  return text ? list.filter((row) => row.id.toLowerCase().includes(text) || objectiveTitle(row).toLowerCase().includes(text)) : list;
}

/** 计分项详情页地址 */
const objectiveUrl = (id: string) => `/admin/pages/scoreboard-objective/scoreboard-objective?id=${encodeURIComponent(id)}`;

/** 新建计分项表单的视图 */
function objectiveFormView() {
  const draft = view.objectiveDraft;
  if (!draft) return null;
  const operation: ScoreboardOperation = { op: "objective.add", objective: draft.id, ...(draft.displayName.trim() ? { displayName: draft.displayName } : {}) };
  const error = objectiveFormError(scoreboard.result?.objectives ?? [], operation);
  return {
    id: draft.id,
    displayName: draft.displayName,
    error: draft.submitted ? error ?? "" : "",
    command: error ? "" : `/${scoreboardCommand(operation)}`,
  };
}

function render(state: SessionState) {
  const result = scoreboard.result;
  return {
    ...scoreboardStatus(state),
    empty: Boolean(result && !result.objectives.length),
    objectives: shownObjectives().map((row) => ({
      id: row.id,
      title: objectiveTitle(row),
      count: row.participants.length,
      /** 显示在游戏内的侧边栏 / 列表 / 名字下方 */
      shown: objectiveSlots(result ?? undefined, row.id).length > 0,
    })),
    objectiveForm: objectiveFormView(),
  };
}

Page({
  data: {
    ...render(session.state),
    objectiveKeyword: "",
  },
  onLoad() {
    resetScoreboard();
    view.objectiveKeyword = "";
    view.objectiveDraft = null;
  },
  onShow() {
    watchScoreboard(this, render);
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
  rerender() {
    this.setData(render(session.state));
  },
  reload() {
    void loadScoreboard();
  },

  /** 点按计分项：进入详情页 */
  openObjective(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: objectiveUrl(String(event.currentTarget.dataset.id)) });
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

  /* ---------- 新建计分项 ---------- */
  openObjectiveForm() {
    if (!this.data.canEdit) return;
    view.objectiveDraft = { id: "", displayName: "", submitted: false };
    this.rerender();
  },
  closeObjectiveForm() {
    if (scoreboard.saving) return;
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
  /** 创建成功后直接进入新计分项的详情页 */
  async commitObjectiveForm() {
    const draft = view.objectiveDraft;
    if (!draft || scoreboard.saving || !this.data.canEdit) return;
    draft.submitted = true;
    const operation: ScoreboardOperation = { op: "objective.add", objective: draft.id, ...(draft.displayName.trim() ? { displayName: draft.displayName } : {}) };
    if (objectiveFormError(scoreboard.result?.objectives ?? [], operation)) {
      this.rerender();
      return;
    }
    if (!(await applyScoreboard([operation], "已创建", "创建计分项失败"))) return;
    view.objectiveDraft = null;
    this.rerender();
    wx.navigateTo({ url: objectiveUrl(draft.id) });
  },

  /** 左滑删除计分项（data-id 挂在 swipe-row 上） */
  async removeObjective(event: WechatMiniprogram.BaseEvent) {
    const objective = scoreboard.result?.objectives.find((row) => row.id === String(event.currentTarget.dataset.id));
    if (!objective || !this.data.canEdit) return;
    const confirmed = await ask(
      `删除计分项「${objectiveTitle(objective)}」？`,
      `将清除其中 ${objective.participants.length} 名参与者的全部分数且无法恢复，依赖该计分项的模块或命令方块可能受影响。`,
      "删除",
      true
    );
    if (confirmed) await applyScoreboard([{ op: "objective.remove", objective: objective.id }], "已删除", "删除计分项失败");
  },
});
