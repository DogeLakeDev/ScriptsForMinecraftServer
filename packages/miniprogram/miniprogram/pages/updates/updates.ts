/**
 * updates — 更新与备份
 *
 * 使用场景：展示 updates.check 的三类结果（SFMC 平台 / 模块 / BDS）并提交 updates.run；
 * 手动创建、恢复、删除全量备份（备份编号即任务编号）。恢复与删除前强确认（同桌面端 UpdatesPage）。
 * 进入页面检查一次，也可下拉或点按钮重新检查。
 */
import { copy, submit } from "../../core/actions";
import { errorText, isTaskDone, relativeTime, taskLabel } from "../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../core/page";
import { session, type SessionState } from "../../core/session";
import type { AttachmentPlan } from "../../core/types";

/** 检查失败时守护进程返回的形状 */
type Failed = { error: string };
interface ModuleUpgrade { id: string; fromVersion: string | null; toVersion: string | null }
interface ModuleSkip { id: string; reason: string; fromVersion: string | null; toVersion: string | null; detail?: string }
interface ModulePlan { upgrades: ModuleUpgrade[]; skipped: ModuleSkip[] }
interface BdsCheck { currentVersion: string; latestVersion: string; result: string }
/** updates.check 的结果（协议中为 unknown，按守护进程实现收窄，与桌面端一致） */
interface CheckResult { platform?: AttachmentPlan | Failed; modules?: ModulePlan | Failed; bds?: BdsCheck | Failed }

/** 模块跳过原因 → 中文说明（与桌面端 SKIP_REASONS 一致） */
const SKIP_REASONS: Record<string, string> = {
  "up-to-date": "已是最新",
  "local-source": "本地来源",
  "dev-link": "开发链接",
  "auto-off": "未开启自动更新",
  "registry-offline": "注册表离线",
  "no-installed-version": "无安装版本",
  "bad-version": "版本号无法比较",
  "installed-newer": "本地版本更新",
  major: "跨主版本，需手动",
  sdk: "SDK 不兼容",
  "missing-module": "模块不存在",
  "missing-dependency": "缺少依赖",
  "dependency-failed": "依赖更新失败",
  "github-manual": "需手动更新",
  "no-target": "无目标版本",
  retired: "已收编至平台",
};

const failed = (value: unknown): value is Failed => Boolean(value && typeof value === "object" && "error" in value);

/** 页面状态（不放进 data） */
const view = {
  result: undefined as CheckResult | undefined,
  checkedAt: 0,
  checking: false,
  backups: [] as string[],
  backupsLoading: false,
  backupsError: "",
  /** 备份相关任务的指纹：变化时重新读取备份列表 */
  fingerprint: "",
  /** 本次进入页面是否已自动检查过（进入时尚未连上的话，连上后补一次） */
  autoChecked: false,
};

/** 一张更新卡片的展示数据 */
function card(kind: "platform" | "modules" | "bds", result: CheckResult | undefined) {
  const checking = view.checking;
  const pending = { tone: "neutral", status: checking ? "检查中…" : "未检查", error: "", from: "", to: "", available: false, action: "", items: [] as { id: string; text: string }[], notes: "", warning: "" };
  if (kind === "platform") {
    const platform = result?.platform;
    if (!platform) return pending;
    if (failed(platform)) return { ...pending, tone: "danger", status: "检查失败", error: errorText(platform.error) };
    return {
      ...pending,
      tone: platform.upgradeRequired ? "warning" : "success",
      status: platform.upgradeRequired ? "可升级" : platform.development ? "开发版本" : "已是最新",
      from: platform.currentVersion,
      to: platform.upgradeRequired ? platform.targetVersion : "",
      available: platform.upgradeRequired,
      action: platform.upgradeRequired ? `升级到 ${platform.targetVersion}` : "",
      notes: !platform.development && platform.releaseNotes?.status === "available" ? platform.releaseNotes.body : "",
      warning: platform.externalServices.length ? `外部进程 ${platform.externalServices.join("、")} 需先通过原管理器停止` : "",
    };
  }
  if (kind === "modules") {
    const modules = result?.modules;
    if (!modules) return pending;
    if (failed(modules)) return { ...pending, tone: "danger", status: "检查失败", error: errorText(modules.error) };
    const skipped = modules.skipped.filter((row) => row.reason !== "up-to-date");
    return {
      ...pending,
      tone: modules.upgrades.length ? "warning" : "success",
      status: modules.upgrades.length ? `${modules.upgrades.length} 个可更新` : "全部最新",
      available: modules.upgrades.length > 0,
      action: modules.upgrades.length ? "更新全部模块" : "重新同步",
      items: [
        ...modules.upgrades.map((row) => ({ id: row.id.replace(/^sfmc-module-/, ""), text: `${row.fromVersion ?? "—"} → ${row.toVersion ?? "—"}` })),
        ...skipped.map((row) => ({ id: row.id.replace(/^sfmc-module-/, ""), text: SKIP_REASONS[row.reason] ?? row.reason })),
      ],
    };
  }
  const bds = result?.bds;
  if (!bds) return pending;
  if (failed(bds)) return { ...pending, tone: "danger", status: "检查失败", error: errorText(bds.error) };
  const available = bds.latestVersion !== "unknown" && bds.latestVersion !== bds.currentVersion && bds.result !== "uptodate";
  return {
    ...pending,
    tone: available ? "warning" : "success",
    status: available ? "有新版本" : "已是最新",
    from: bds.currentVersion,
    to: available ? bds.latestVersion : "",
    available,
    action: available ? `更新到 ${bds.latestVersion}` : "重新部署当前版本",
  };
}

function render(state: SessionState) {
  const tasks = new Map(state.tasks.map((row) => [row.id, row]));
  const manualBackup = session.can("manual-backup");
  return {
    ...connectionView(state),
    checking: view.checking,
    checked: view.result !== undefined,
    checkedAt: view.checkedAt ? `上次检查 ${relativeTime(view.checkedAt)}` : "",
    platform: card("platform", view.result),
    modules: card("modules", view.result),
    bds: card("bds", view.result),
    manualBackup,
    legacyBackup: Boolean(state.handshake) && !manualBackup,
    canDeleteBackup: session.can("backup-delete"),
    backupRunning: state.tasks.some((task) => task.kind === "backups.create" && !isTaskDone(task.status)),
    backupsLoading: view.backupsLoading,
    backupsError: view.backupsError,
    backups: [...view.backups].reverse().map((id) => {
      const task = tasks.get(id);
      return {
        id,
        short: id.slice(0, 8),
        title: task?.kind === "backups.create" ? "手动备份" : task ? `${taskLabel(task)}前的备份` : "备份",
        time: task ? relativeTime(task.createdAt) : "",
      };
    }),
  };
}

/** 备份相关任务的指纹（数量不变时也能识别备份完成与终态） */
function backupFingerprint(state: SessionState): string {
  return state.tasks
    .map((task) => {
      const phase = task.phases.find((row) => row.name === "backup");
      const tracked = phase || task.kind === "backups.create" || task.kind === "backups.delete";
      return tracked ? `${task.id}:${phase?.status ?? ""}:${task.status}` : "";
    })
    .filter(Boolean)
    .sort()
    .join("|");
}

Page({
  data: render(session.state),
  onLoad() {
    view.result = undefined;
    view.checkedAt = 0;
    view.backups = [];
    // 用不可能出现的值初始化，保证首次连上时一定读取一次备份列表
    view.fingerprint = "\0";
    view.autoChecked = false;
  },
  onShow() {
    watchSession(this, ["connection", "tasks"], (state) => {
      if (state.status === "online" && !view.autoChecked) {
        view.autoChecked = true;
        void this.check(false);
      }
      const fingerprint = backupFingerprint(state);
      if (state.status === "online" && fingerprint !== view.fingerprint) {
        view.fingerprint = fingerprint;
        void this.refreshBackups();
      }
      return render(state);
    });
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
  },
  async onPullDownRefresh() {
    await Promise.all([this.check(false), this.refreshBackups()]);
    wx.stopPullDownRefresh();
  },
  rerender() {
    this.setData(render(session.state));
  },

  async check(silent: boolean) {
    if (session.state.status !== "online" || view.checking) return;
    view.checking = true;
    this.rerender();
    try {
      view.result = (await session.request("updates.check", {}, 120_000)) as CheckResult;
      view.checkedAt = Date.now();
    } catch (error) {
      if (!silent) wx.showModal({ title: "检查更新失败", content: errorText(error), showCancel: false });
    } finally {
      view.checking = false;
      this.rerender();
    }
  },
  checkNow() {
    void this.check(false);
  },
  async refreshBackups() {
    if (session.state.status !== "online" || view.backupsLoading) return;
    view.backupsLoading = true;
    this.rerender();
    try {
      view.backups = (await session.request("backups.list")).backups;
      view.backupsError = "";
    } catch (error) {
      view.backupsError = errorText(error);
    } finally {
      view.backupsLoading = false;
      this.rerender();
    }
  },

  /** 执行更新 */
  run(event: WechatMiniprogram.TouchEvent) {
    const kind = event.currentTarget.dataset.kind as "platform" | "modules" | "bds";
    if (view.result === undefined) return;
    const name = kind === "platform" ? "SFMC 平台" : kind === "modules" ? "模块" : "BDS";
    const plan = kind === "platform" && view.result.platform && !failed(view.result.platform) ? view.result.platform : undefined;
    const backupNote = session.can("manual-backup")
      ? "将停服更新，完成后恢复此前运行的服务。此任务不创建全量备份；如需保留当前状态，请先点击“手动备份”。"
      : "当前平台仍会在维护任务前自动创建全量备份；升级平台并重新连接后，改用手动备份。";
    void submit(this, "updates.run", { kind, ...(plan ? { targetVersion: plan.targetVersion } : {}) }, `更新 ${name}`, {
      description: backupNote,
      okText: "开始更新",
    });
  },
  createBackup() {
    if (!session.can("manual-backup") || this.data.backupRunning) return;
    void submit(this, "backups.create", {}, "手动备份", {
      description: "将短暂停止服务，完整备份配置、模块、数据库和 BDS（含世界数据），完成后恢复此前运行的服务。备份会占用与这些文件相近的磁盘空间。",
      okText: "开始备份",
    });
  },
  restore(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const task = session.state.tasks.find((row) => row.id === id);
    void submit(this, "backups.restore", { id, confirmDataLoss: true }, "停止服务并恢复备份", {
      danger: true,
      okText: "恢复数据",
      description: `将停止全部服务并恢复备份 ${id.slice(0, 8)}${task ? `（${relativeTime(task.createdAt)}，${taskLabel(task)}）` : ""}。`,
      acknowledge: "我了解此操作会丢弃备份之后的配置和玩家数据变化",
    });
  },
  removeBackup(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const task = session.state.tasks.find((row) => row.id === id);
    void submit(this, "backups.delete", { id }, "删除备份", {
      danger: true,
      okText: "删除备份",
      description: `将永久删除备份 ${id.slice(0, 8)}${task ? `（${relativeTime(task.createdAt)}）` : ""}。此操作不停止服务，也不改动当前世界。`,
      acknowledge: "我了解此备份删除后无法恢复",
    });
  },
  copyId(event: WechatMiniprogram.TouchEvent) {
    copy(String(event.currentTarget.dataset.id), "已复制备份编号");
  },
});
