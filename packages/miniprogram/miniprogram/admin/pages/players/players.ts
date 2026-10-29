/**
 * players — 玩家与权限
 *
 * 使用场景：查看在线玩家快照（5 秒轮询）；「允许名单」展示绑定记录（只读）；
 * 「BDS 权限」「SFMC 权限」在本地草稿中增删改，点「保存并应用」后提交 players.apply（同桌面端 PlayersPage）。
 * 支持列表与 JSON 两种视图，JSON 视图为纯文本编辑。
 * 平台带 activity 能力时，点按绑定记录进入「行为日志」并只看该玩家。
 */
import type { SwipeAction } from "../../../components/swipe-row/index";
import { ask, submit } from "../../../core/actions";
import { errorText, fullTime, hashHue, isTaskDone, relativeTime } from "../../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import type { ManagementMethodMap } from "../../../core/types";

/** 名单种类（与 players.apply 的 kind 一致） */
type Kind = "allowlist" | "permissions" | "sfmcPermissions";
type PlayersData = ManagementMethodMap["players.list"];
type Entry = Record<string, unknown>;

const KINDS: { value: Kind; label: string }[] = [
  { value: "allowlist", label: "允许名单" },
  { value: "permissions", label: "BDS 权限" },
  { value: "sfmcPermissions", label: "SFMC 权限" },
];
const BDS_LEVELS: Record<string, string> = { visitor: "访客", member: "成员", operator: "管理员" };
const BDS_LEVEL_KEYS = ["visitor", "member", "operator"];
const SFMC_LEVELS = ["游客", "成员", "管理员", "Admin"];
/** QQ 通道在绑定表里的取值 */
const QQ_BACKENDS: Record<string, string> = { official: "官方 Bot", llbot: "LLBot" };
/** 名单条目左滑露出的操作（swipe-row actions），key 由 onEntryAction 分派 */
const ENTRY_ACTIONS: SwipeAction[] = [
  { key: "edit", icon: "pencil", label: "编辑" },
  { key: "remove", icon: "trash", tone: "danger", label: "删除" },
];
/** 在线快照超过这么久视为不新鲜 */
const PLAYERS_STALE_MS = 60_000;

/** 页面状态（不放进 data） */
const view = {
  data: null as PlayersData | null,
  kind: "allowlist" as Kind,
  text: "[]",
  baseline: "[]",
  json: false,
  pendingSave: null as { operationId: string; kind: Kind; text: string } | null,
  timer: null as number | null,
};

/** 解析草稿 JSON 为条目数组；语法错误返回 undefined */
function parseEntries(text: string): Entry[] | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Entry[]) : undefined;
  } catch {
    return undefined;
  }
}

/** 玩家名所在字段：SFMC 权限用 player_name，BDS 名单用 name */
const nameKey = (kind: Kind) => (kind === "sfmcPermissions" ? "player_name" : "name");
const entryName = (row: Entry) => String(row.player_name ?? row.name ?? "");

/** 条目校验（与桌面端 validateEntry 一致） */
function validateEntry(kind: Kind, draft: Entry): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = String(draft[nameKey(kind)] ?? "").trim();
  if (kind !== "permissions" && !name) errors.name = "请输入玩家名";
  if (kind === "permissions" && !/^\d+$/.test(String(draft.xuid ?? ""))) errors.xuid = "XUID 为纯数字";
  if (kind === "permissions" && !draft.permission) errors.permission = "请选择权限";
  if (kind === "sfmcPermissions" && (draft.level === undefined || draft.level === null || draft.level === "")) errors.level = "请选择权限等级";
  return errors;
}

/** 只保留当前名单种类的字段，去掉空字符串（与桌面端 formValues 一致） */
function formValues(kind: Kind, draft: Entry): Entry {
  const keys = [nameKey(kind), ...(kind !== "sfmcPermissions" ? ["xuid"] : []), ...(kind === "allowlist" ? ["ignoresPlayerLimit"] : []), ...(kind === "permissions" ? ["permission"] : []), ...(kind === "sfmcPermissions" ? ["level"] : [])];
  const value: Entry = {};
  for (const key of keys) {
    const raw = draft[key];
    value[key] = typeof raw === "string" ? raw.trim() || undefined : raw;
  }
  return value;
}

/** 条目的权限徽章 */
function permissionBadge(kind: Kind, row: Entry): { label: string; tone: string } {
  if (kind === "permissions") {
    const level = String(row.permission ?? "");
    return { label: BDS_LEVELS[level] ?? level, tone: level === "operator" ? "warning" : level === "member" ? "info" : "neutral" };
  }
  const level = Number(row.level);
  return { label: `${level} ${SFMC_LEVELS[level] ?? "未知"}`, tone: level >= 3 ? "danger" : level === 2 ? "warning" : level === 1 ? "info" : "neutral" };
}

function render(state: SessionState) {
  const now = Date.now();
  const data = view.data;
  const connected = state.status === "online";
  const fresh = Boolean(connected && data?.fresh && now - Date.parse(data.updatedAt) < PLAYERS_STALE_MS);
  const entries = parseEntries(view.text);
  const showingBindings = view.kind === "allowlist";
  return {
    ...connectionView(state),
    loaded: Boolean(data),
    fresh,
    synced: data?.updatedAt ? `同步于 ${relativeTime(data.updatedAt, now)}` : "尚无实时快照",
    players: (data?.players ?? []).map((player) => ({ name: player.name, initial: player.name.slice(0, 1).toUpperCase(), hue: hashHue(player.name) })),
    kind: view.kind,
    kinds: KINDS.map((row) => ({
      ...row,
      count: data ? (row.value === "allowlist" ? data.bindings?.length ?? 0 : (data[row.value] as unknown[]).length) : "",
    })),
    json: view.json,
    showingBindings,
    /** 握手带 activity 能力时，点按绑定记录可查看该玩家的行为日志 */
    activityEnabled: Boolean(state.handshake?.capabilities.includes("activity")),
    bindings: (data?.bindings ?? []).map((row) => {
      const name = row.playerName || "未记录玩家名";
      return {
        key: row.playerXuid || row.qqUserOpenid,
        name,
        initial: name.slice(0, 1).toUpperCase(),
        hue: hashHue(name),
        xuid: row.playerXuid,
        channel: `${QQ_BACKENDS[row.qqBackend] ?? (row.qqBackend || "未知通道")} · ${row.qqUserOpenid || "未记录 QQ"}`,
        time: relativeTime(row.boundAt, now),
        full: fullTime(row.boundAt),
      };
    }),
    bindingsJson: showingBindings && view.json ? JSON.stringify(data?.bindings ?? [], null, 2) : "",
    syntaxError: !entries,
    entries: (entries ?? []).map((row, index) => {
      const name = entryName(row) || "—";
      return {
        index,
        name,
        initial: name.slice(0, 1).toUpperCase(),
        hue: hashHue(name),
        sub: row.xuid ? `XUID ${String(row.xuid)}` : view.kind === "sfmcPermissions" ? "按玩家名匹配" : "未记录 XUID",
        badge: permissionBadge(view.kind, row),
      };
    }),
    dirty: view.text !== view.baseline,
    saving: Boolean(view.pendingSave),
  };
}

Page({
  data: {
    ...render(session.state),
    text: "[]",
    /** 条目编辑弹窗 */
    editing: null as null | { mode: "new" | "edit"; index: number },
    draft: {} as Entry,
    draftErrors: {} as Record<string, string>,
    bdsLevels: BDS_LEVEL_KEYS.map((key) => BDS_LEVELS[key]),
    sfmcLevels: SFMC_LEVELS.map((label, level) => `${level} ${label}`),
    entryActions: ENTRY_ACTIONS,
  },
  onLoad() {
    view.data = null;
    view.kind = "allowlist";
    view.text = view.baseline = "[]";
    view.json = false;
    view.pendingSave = null;
    void this.load(true);
  },
  onShow() {
    watchSession(this, ["connection", "tasks"], (state) => {
      this.checkSave(state);
      return render(state);
    });
    view.timer = setInterval(() => void this.load(false), 5000) as unknown as number;
  },
  onHide() {
    this.stop();
  },
  onUnload() {
    this.stop();
    wx.disableAlertBeforeUnload();
  },
  stop() {
    unwatchSession(this);
    if (view.timer !== null) clearInterval(view.timer);
    view.timer = null;
  },
  async onPullDownRefresh() {
    await this.load(false);
    wx.stopPullDownRefresh();
  },
  rerender() {
    this.setData(render(session.state));
    if (view.text !== view.baseline) wx.enableAlertBeforeUnload({ message: "当前玩家权限有尚未保存的修改，离开后将丢失。" });
    else wx.disableAlertBeforeUnload();
  },

  /** 读取名单；reset 为 true 时用服务器数据覆盖当前草稿 */
  async load(reset: boolean) {
    if (session.state.status !== "online") return;
    try {
      const value = await session.request("players.list");
      view.data = value;
      if (reset) this.resetDraft(view.kind);
      this.rerender();
    } catch (error) {
      if (reset) wx.showToast({ title: `读取玩家名单失败：${errorText(error)}`, icon: "none" });
    }
  },
  resetDraft(kind: Kind) {
    const json = JSON.stringify(view.data?.[kind] ?? [], null, 2);
    view.text = view.baseline = json;
    this.setData({ text: json });
  },

  /** 点按绑定记录：进入行为日志页并只看该玩家（对应桌面端玩家页的「查看行为记录」） */
  openActivity(event: WechatMiniprogram.TouchEvent) {
    const { xuid, name } = event.currentTarget.dataset as { xuid?: string; name?: string };
    if (!this.data.activityEnabled || !xuid) return;
    wx.navigateTo({ url: `/admin/pages/activity/activity?actorId=${encodeURIComponent(xuid)}&name=${encodeURIComponent(name ?? "")}` });
  },

  async switchKind(event: WechatMiniprogram.TouchEvent) {
    const next = event.currentTarget.dataset.value as Kind;
    if (next === view.kind) return;
    if (view.text !== view.baseline && !(await ask("放弃未保存的更改？", "当前名单有尚未保存的修改，切换后将丢失。", "放弃并切换", true))) return;
    view.kind = next;
    this.resetDraft(next);
    this.rerender();
  },
  toggleJson() {
    view.json = !view.json;
    this.setData({ text: view.text });
    this.rerender();
  },
  onJsonInput(event: WechatMiniprogram.Input) {
    view.text = event.detail.value;
    this.rerender();
  },

  /** 写回草稿 */
  commitEntries(entries: Entry[]) {
    view.text = JSON.stringify(entries, null, 2);
    this.setData({ text: view.text });
    this.rerender();
  },
  /** 名单条目左滑操作：edit 打开编辑弹窗，remove 从草稿删除（data-index 挂在 swipe-row 上） */
  onEntryAction(event: WechatMiniprogram.CustomEvent<{ key: string }>) {
    if (event.detail.key === "edit") this.openEditor(event);
    else if (event.detail.key === "remove") this.removeEntry(event);
  },
  removeEntry(event: WechatMiniprogram.BaseEvent) {
    if (!this.data.editable) return;
    const index = Number(event.currentTarget.dataset.index);
    const entries = parseEntries(view.text);
    if (!entries) return;
    this.commitEntries(entries.filter((_, position) => position !== index));
  },
  openEditor(event: WechatMiniprogram.BaseEvent) {
    if (!this.data.editable) return;
    const raw = event.currentTarget.dataset.index;
    const entries = parseEntries(view.text);
    if (!entries) return;
    const index = raw === undefined ? -1 : Number(raw);
    const initial = index >= 0 ? { ...entries[index] } : {};
    this.setData({ editing: { mode: index >= 0 ? "edit" : "new", index }, draft: initial, draftErrors: {} });
  },
  closeEditor() {
    this.setData({ editing: null });
  },
  onDraftInput(event: WechatMiniprogram.Input) {
    const field = String(event.currentTarget.dataset.field);
    this.setData({ [`draft.${field}`]: event.detail.value });
  },
  toggleIgnoresLimit() {
    this.setData({ "draft.ignoresPlayerLimit": this.data.draft.ignoresPlayerLimit !== true });
  },
  onBdsLevel(event: WechatMiniprogram.PickerChange) {
    this.setData({ "draft.permission": BDS_LEVEL_KEYS[Number(event.detail.value)] });
  },
  onSfmcLevel(event: WechatMiniprogram.PickerChange) {
    this.setData({ "draft.level": Number(event.detail.value) });
  },
  commitEditor() {
    const editing = this.data.editing;
    if (!editing) return;
    const errors = validateEntry(view.kind, this.data.draft);
    if (Object.keys(errors).length) {
      this.setData({ draftErrors: errors });
      return;
    }
    const entries = [...(parseEntries(view.text) ?? [])];
    const value = formValues(view.kind, this.data.draft);
    if (editing.mode === "new") entries.push(value);
    else entries[editing.index] = { ...entries[editing.index], ...value };
    this.setData({ editing: null });
    this.commitEntries(entries);
  },

  discard() {
    if (view.pendingSave) return;
    view.text = view.baseline;
    this.setData({ text: view.text });
    this.rerender();
  },
  async save() {
    if (view.pendingSave || !this.data.editable) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(view.text);
    } catch {
      wx.showToast({ title: "权限 JSON 语法错误", icon: "none" });
      return;
    }
    const submittedText = view.text;
    const submittedKind = view.kind;
    const label = KINDS.find((row) => row.value === view.kind)!.label;
    const operationId = await submit(this, "players.apply", { kind: view.kind, entries: parsed }, "保存玩家权限并应用", {
      description: `将写入${label}（${Array.isArray(parsed) ? parsed.length : 0} 项）并在维护任务中应用。`,
      okText: "保存并应用",
    });
    if (!operationId) return;
    view.pendingSave = { operationId, kind: submittedKind, text: submittedText };
    this.rerender();
  },
  /** 保存任务结束后重新读取名单 */
  checkSave(state: SessionState) {
    const pending = view.pendingSave;
    if (!pending) return;
    const record = state.tasks.find((row) => row.id === pending.operationId);
    if (!record || !isTaskDone(record.status)) return;
    view.pendingSave = null;
    if (record.status !== "succeeded") return;
    session
      .request("players.list")
      .then((value) => {
        view.data = value;
        if (view.kind === pending.kind) {
          const accepted = JSON.stringify(value[pending.kind] ?? [], null, 2);
          view.baseline = accepted;
          if (view.text === pending.text) {
            view.text = accepted;
            this.setData({ text: accepted });
          }
        }
        this.rerender();
      })
      .catch((error) => wx.showModal({ title: "读取应用后的权限失败，草稿已保留", content: errorText(error), showCancel: false }));
  },
});
