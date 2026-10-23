/**
 * UpdatesPage.tsx — 更新与备份
 *
 * 使用场景：展示 updates.check 的三类结果（SFMC 平台 / 模块 / BDS）并提交 updates.run；
 * 手动创建、恢复和删除全量备份（备份编号即任务编号）。恢复前强确认数据丢失，删除前确认备份不可恢复。
 * 检查逻辑与原实现一致：进入页面检查一次，之后每 15 分钟自动复查，也可手动检查。
 */
import type { AttachmentPlan } from "@sfmc-bds/management";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useDesktop } from "../app/desktop.js";
import { hasCapability } from "../../shared/platform-next.js";
import { Button } from "../components/controls.js";
import { toast } from "../components/feedback.js";
import { Icon, type IconName } from "../components/icons.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, Callout, CopyText, EmptyState, IconTile, PageHeader, Surface } from "../components/ui.js";
import { errorText, fullTime, isTaskDone, relativeTime, taskLabel, type Tone } from "../lib/format.js";
import { ReleaseNotes } from "../components/ReleaseNotes.js";

/** 检查失败时守护进程返回的形状 */
type Failed = { error: string };
interface ModuleUpgrade { id: string; fromVersion: string | null; toVersion: string | null; spec?: string }
interface ModuleSkip { id: string; reason: string; fromVersion: string | null; toVersion: string | null; detail?: string }
interface ModulePlan { upgrades: ModuleUpgrade[]; skipped: ModuleSkip[] }
interface BdsCheck { currentVersion: string; latestVersion: string; result: string }
/** updates.check 的结果（协议中为 unknown，这里按守护进程实现收窄） */
interface CheckResult { platform?: AttachmentPlan | Failed; modules?: ModulePlan | Failed; bds?: BdsCheck | Failed }

/** 模块跳过原因 → 中文说明（与 module-update.mjs 的 reason 对齐） */
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

/** 单个更新目标卡片 */
function UpdateCard({ icon, title, tone, status, children, action }: { icon: IconName; title: string; tone: Tone; status: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <section className="update-card surface">
      <div className="update-head">
        <IconTile icon={icon} tone={tone} size={32} />
        <div className="update-title">
          <b>{title}</b>
          <Badge tone={tone} dot>{status}</Badge>
        </div>
      </div>
      <div className="update-body">{children}</div>
      {action && <div className="update-foot">{action}</div>}
    </section>
  );
}

/** 版本迁移文案：a → b */
function VersionShift({ from, to }: { from?: string | null; to?: string | null }) {
  return (
    <span className="version-shift mono">
      <span>{from ?? "—"}</span>
      {to && to !== from && (<><Icon name="arrowRight" size={12} /><b>{to}</b></>)}
    </span>
  );
}

export function UpdatesPage() {
  const { model, editable, request, submit } = useDesktop();
  const manualBackup = model.handshake?.capabilities.includes("manual-backup") ?? false;
  const canDeleteBackup = hasCapability(model.handshake?.capabilities, "backup-delete");
  const backupRunning = model.tasks.some((task) => task.kind === "backups.create" && !isTaskDone(task.status));
  const [result, setResult] = useState<CheckResult>();
  const [checkedAt, setCheckedAt] = useState<number>();
  const [checking, setChecking] = useState(false);
  const [backups, setBackups] = useState<string[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupsError, setBackupsError] = useState("");
  const backupsPending = useRef(false);
  const backupsAgain = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [showRaw, setShowRaw] = useState(false);
  const refreshBackups = useCallback(async () => {
    if (backupsPending.current) { backupsAgain.current = true; return; }
    backupsPending.current = true;
    setBackupsLoading(true);
    try {
      do {
        backupsAgain.current = false;
        try {
          const value = await request("backups.list");
          if (mounted.current) { setBackups(value.backups); setBackupsError(""); }
        } catch (error) {
          if (mounted.current) setBackupsError(errorText(error));
        }
      } while (mounted.current && backupsAgain.current);
    } finally {
      backupsPending.current = false;
      if (mounted.current) setBackupsLoading(false);
    }
  }, [request]);

  const check = useCallback(
    (silent: boolean) => {
      setChecking(true);
      return request("updates.check")
        .then((value) => {
          setResult(value as CheckResult);
          setCheckedAt(Date.now());
        })
        .catch((error) => !silent && toast.error("检查更新失败", errorText(error)))
        .finally(() => setChecking(false));
    },
    [request]
  );
  useEffect(() => {
    void check(false);
    const timer = setInterval(() => void check(true), 15 * 60_000);
    return () => clearInterval(timer);
  }, [request]);
  // 数量不变时也识别备份完成与终态；不因日志或无关阶段刷新。
  const backupFingerprint = model.tasks.map((task) => {
    const phase = task.phases.find((row) => row.name === "backup");
    const tracked = phase || task.kind === "backups.create" || task.kind === "backups.delete";
    return tracked ? `${task.id}:${phase?.status ?? ""}:${task.status}` : "";
  }).filter(Boolean).sort().join("|");
  useEffect(() => {
    void refreshBackups();
  }, [backupFingerprint, refreshBackups]);

  const run = (kind: "platform" | "modules" | "bds", name: string) => {
    const plan = kind === "platform" && result?.platform && !failed(result.platform) ? result.platform : undefined;
    return void submit("updates.run", { kind, ...(plan ? { targetVersion: plan.targetVersion } : {}) }, `更新 ${name}`, { description: <div className="form-stack"><p>{manualBackup ? "将停服更新，完成后恢复此前运行的服务。此任务不创建全量备份；如需保留当前状态，请先点击“手动备份”。" : "当前平台仍会在维护任务前自动创建全量备份；升级平台并重新连接后，改用手动备份。"}</p>{plan && <ReleaseNotes notes={plan.releaseNotes} version={plan.targetVersion} />}</div>, okText: "开始更新" });
  };
  const runButton = (kind: "platform" | "modules" | "bds", name: string, available: boolean, label: string) => (
    <Tooltip content={editable ? undefined : "当前为只读"} wrap>
      <Button size="sm" variant={available ? "primary" : "secondary"} disabled={!editable || result === undefined} onClick={() => run(kind, name)} icon={available ? "download" : "refresh"}>
        {label}
      </Button>
    </Tooltip>
  );

  const platform = result?.platform;
  const modules = result?.modules;
  const bds = result?.bds;
  const bdsAvailable = Boolean(bds && !failed(bds) && bds.latestVersion !== "unknown" && bds.latestVersion !== bds.currentVersion && bds.result !== "uptodate");
  const skippedNotable = modules && !failed(modules) ? modules.skipped.filter((row) => row.reason !== "up-to-date") : [];
  const tasksById = new Map(model.tasks.map((row) => [row.id, row]));

  return (
    <div className="page">
      <PageHeader
        title="更新与备份"
        meta={checkedAt ? <span className="muted" title="每 15 分钟自动检查">上次检查 {relativeTime(checkedAt)}</span> : undefined}
        actions={<Button loading={checking} icon="refresh" onClick={() => void check(false)}>检查更新</Button>}
      />
      <div className="update-grid">
        {!platform ? (
          <UpdateCard icon="layers" title="SFMC 平台" tone="neutral" status={checking ? "检查中…" : "未检查"} />
        ) : failed(platform) ? (
          <UpdateCard icon="layers" title="SFMC 平台" tone="danger" status="检查失败"><p className="update-error">{errorText(platform.error)}</p></UpdateCard>
        ) : (
          <UpdateCard
            icon="layers"
            title="SFMC 平台"
            tone={platform.upgradeRequired ? "warning" : "success"}
            status={platform.upgradeRequired ? "可升级" : platform.development ? "开发版本" : "已是最新"}
            action={platform.upgradeRequired && runButton("platform", "SFMC 平台", true, `升级到 ${platform.targetVersion}`)}
          >
            <VersionShift from={platform.currentVersion} to={platform.upgradeRequired ? platform.targetVersion : undefined} />
            {!platform.development && <ReleaseNotes notes={platform.releaseNotes} version={platform.targetVersion} collapsible />}
            {platform.externalServices.length > 0 && <p className="update-note"><Icon name="warning" size={13} /> 外部进程 {platform.externalServices.join("、")} 需先通过原管理器停止</p>}
          </UpdateCard>
        )}
        {!modules ? (
          <UpdateCard icon="modules" title="模块" tone="neutral" status={checking ? "检查中…" : "未检查"} />
        ) : failed(modules) ? (
          <UpdateCard icon="modules" title="模块" tone="danger" status="检查失败"><p className="update-error">{errorText(modules.error)}</p></UpdateCard>
        ) : (
          <UpdateCard
            icon="modules"
            title="模块"
            tone={modules.upgrades.length ? "warning" : "success"}
            status={modules.upgrades.length ? `${modules.upgrades.length} 个可更新` : "全部最新"}
            action={runButton("modules", "模块", modules.upgrades.length > 0, modules.upgrades.length ? "更新全部模块" : "重新同步")}
          >
            {modules.upgrades.length > 0 && (
              <ul className="update-list">
                {modules.upgrades.map((row) => (
                  <li key={row.id}><span className="truncate">{row.id.replace(/^sfmc-module-/, "")}</span><VersionShift from={row.fromVersion} to={row.toVersion} /></li>
                ))}
              </ul>
            )}
            {skippedNotable.length > 0 && (
              <ul className="update-list muted">
                {skippedNotable.map((row) => (
                  <li key={row.id} title={row.detail || undefined}><span className="truncate">{row.id.replace(/^sfmc-module-/, "")}</span><span>{SKIP_REASONS[row.reason] ?? row.reason}</span></li>
                ))}
              </ul>
            )}
          </UpdateCard>
        )}
        {!bds ? (
          <UpdateCard icon="cube" title="BDS" tone="neutral" status={checking ? "检查中…" : "未检查"} />
        ) : failed(bds) ? (
          <UpdateCard icon="cube" title="BDS" tone="danger" status="检查失败"><p className="update-error">{errorText(bds.error)}</p></UpdateCard>
        ) : (
          <UpdateCard
            icon="cube"
            title="Bedrock 服务端"
            tone={bdsAvailable ? "warning" : "success"}
            status={bdsAvailable ? "有新版本" : "已是最新"}
            action={runButton("bds", "BDS", bdsAvailable, bdsAvailable ? `更新到 ${bds.latestVersion}` : "重新部署当前版本")}
          >
            <VersionShift from={bds.currentVersion} to={bdsAvailable ? bds.latestVersion : undefined} />
          </UpdateCard>
        )}
      </div>
      {result !== undefined && (
        <div className="raw-toggle">
          <button type="button" className="link-btn" onClick={() => setShowRaw((value) => !value)}>
            <Icon name={showRaw ? "chevronDown" : "chevronRight"} size={13} /> 原始检查结果
          </button>
          {showRaw && <pre className="code-block">{JSON.stringify(result, null, 2)}</pre>}
        </div>
      )}
      <Surface title="可恢复备份" extra={<>
        {backups.length > 0 && <Badge>{backups.length} 份</Badge>}
        <Tooltip content={!manualBackup ? "升级实例平台并重新连接后可用" : !editable ? "当前为只读" : undefined} wrap>
          <Button size="sm" icon="archive" disabled={!editable || !manualBackup || backupRunning} loading={backupRunning} onClick={() => void submit("backups.create", {}, "手动备份", {
            description: "将短暂停止服务，完整备份配置、模块、数据库和 BDS（含世界数据），完成后恢复此前运行的服务。备份会占用与这些文件相近的磁盘空间。",
            okText: "开始备份",
          })}>手动备份</Button>
        </Tooltip>
        <Button size="sm" icon="refresh" loading={backupsLoading} onClick={() => void refreshBackups()}>刷新备份</Button>
      </>} flush>
        {model.handshake && !manualBackup && <div className="surface-pad"><Callout tone="warning" title="当前平台仍使用自动备份">升级实例平台并重新连接后，维护任务将不再创建全量备份，可在此手动创建。</Callout></div>}
        {backupsError && <div className="surface-pad"><Callout tone="danger" title="读取备份失败">{backupsError}</Callout></div>}
        {backups.length ? (
          <ul className="row-list">
            {[...backups].reverse().map((id) => {
              const task = tasksById.get(id);
              return (
                <li key={id} className="row-item">
                  <IconTile icon="archive" tone="pastel-1" size={32} />
                  <div className="row-main">
                    <div className="row-title"><b>{task?.kind === "backups.create" ? "手动备份" : task ? `${taskLabel(task)}前的备份` : "备份"}</b></div>
                    <CopyText text={id} className="row-sub" />
                  </div>
                  {task && <span className="row-version" title={fullTime(task.createdAt)}>{relativeTime(task.createdAt)}</span>}
                  <div className="row-actions">
                    <Button
                      size="sm"
                      variant="danger-soft"
                      disabled={!editable}
                      icon="archiveRestore"
                      onClick={() =>
                        void submit("backups.restore", { id, confirmDataLoss: true }, "停止服务并恢复备份", {
                          danger: true,
                          okText: "恢复数据",
                          description: <>将停止全部服务并恢复备份 <span className="mono">{id.slice(0, 8)}</span>{task ? `（${relativeTime(task.createdAt)}，${taskLabel(task)}）` : ""}。</>,
                          acknowledge: "我了解此操作会丢弃备份之后的配置和玩家数据变化",
                        })
                      }
                    >
                      恢复
                    </Button>
                    {canDeleteBackup && (
                      <Button
                        size="sm"
                        variant="danger-soft"
                        disabled={!editable}
                        icon="trash"
                        onClick={() =>
                          void submit("backups.delete", { id }, "删除备份", {
                            danger: true,
                            okText: "删除备份",
                            description: <>将永久删除备份 <span className="mono">{id.slice(0, 8)}</span>{task ? `（${relativeTime(task.createdAt)}）` : ""}。此操作不停止服务，也不改动当前世界。</>,
                            acknowledge: "我了解此备份删除后无法恢复",
                          })
                        }
                      >
                        删除
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState compact icon="archive" title="暂无可恢复备份" description={manualBackup ? "需要保留当前状态时，点击“手动备份”" : "升级实例平台后可手动创建备份"} />
        )}
      </Surface>
    </div>
  );
}
