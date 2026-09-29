/**
 * 模块自动更新的 CLI 入口。
 * 计划与换包在 scripts/module-install/lib/module-update.mjs；
 * 这里负责确认、文案，以及开服前调用。
 */
import { confirm, isCancel } from "@clack/prompts";
import { stdin } from "node:process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isCliTty } from "../command-surface.js";
import { t, type MessageKey } from "../i18n/index.js";
import { pushLog } from "../logs.js";
import { ROOT, resolveFetchModule } from "../runtime.js";
import { c } from "../theme.js";

/** 与 module-update.mjs 的升级候选一致。 */
interface ModuleUpgrade {
  id: string;
  fromVersion: string | null;
  toVersion: string | null;
  spec: string;
  requires: string[];
}

/** 与 module-update.mjs 的跳过记录一致。 */
interface ModuleSkip {
  id: string;
  reason: string;
  fromVersion: string | null;
  toVersion: string | null;
  detail: string;
}

/** planModuleUpdates 的返回。 */
interface ModuleUpdatePlan {
  configSkipped: "disabled" | "check-off" | null;
  applyOnStart: boolean;
  failMode: "continue" | "abort";
  upgrades: ModuleUpgrade[];
  skipped: ModuleSkip[];
}

/** applyModuleUpgrades 的返回。 */
interface ModuleUpdateApplyResult {
  applied: ModuleUpgrade[];
  skipped: ModuleSkip[];
  failed: Array<{ id: string; message: string }>;
}

/** 安装器导出的保留启停安装口。 */
interface FetchModuleApi {
  installPreservingLock: (id: string, spec: string) => Promise<void>;
}

/** module-update.mjs 导出面。当前命令与开服钩子都只依赖这一层。 */
interface ModuleUpdateApi {
  ensureModuleUpdateConfigFile: (root?: string) => string;
  planModuleUpdates: (options: {
    root?: string;
    startup?: boolean;
    allowMajor?: boolean;
    ids?: string[];
  }) => Promise<ModuleUpdatePlan>;
  applyModuleUpgrades: (
    upgrades: ModuleUpgrade[],
    deps: {
      root: string;
      failMode: "continue" | "abort";
      install: (id: string, spec: string) => Promise<void>;
      resync?: (id: string) => void;
    }
  ) => Promise<ModuleUpdateApplyResult>;
  resyncInstalledCatalog: (folder: string) => void;
  setModulePinAuto: (
    root: string,
    id: string,
    auto: boolean
  ) => { ok: true; code: "ok"; id: string; auto: boolean } | { ok: false; code: "missing" | "locked"; id?: string };
  QUIET_SKIP_REASONS: Set<string>;
}

const REASON_KEYS: Record<string, MessageKey> = {
  "auto-off": "mod.update.reason.autoOff",
  "local-source": "mod.update.reason.localSource",
  "registry-offline": "mod.update.reason.registryOffline",
  "no-target": "mod.update.reason.noTarget",
  "no-installed-version": "mod.update.reason.noInstalledVersion",
  "up-to-date": "mod.update.reason.upToDate",
  "installed-newer": "mod.update.reason.installedNewer",
  major: "mod.update.reason.major",
  sdk: "mod.update.reason.sdk",
  "dependency-failed": "mod.update.reason.dependencyFailed",
  "github-manual": "mod.update.reason.githubManual",
  "missing-module": "mod.update.reason.missingModule",
  "missing-dependency": "mod.update.reason.missingDependency",
  "bad-version": "mod.update.reason.badVersion",
};

/** 定位 fetch-module.mjs。找不到时返回 null，调用方给出安装提示。 */
function fetchModuleUrl(): URL | null {
  const script = resolveFetchModule();
  if (!script) return null;
  return pathToFileURL(script);
}

/** 与 fetch-module 同目录的更新库。使用文件系统路径拼接，避免 Windows 下 file URL 的 pathname 被 dirname 拆坏。 */
function updateLibUrl(): URL | null {
  const script = resolveFetchModule();
  if (!script) return null;
  return pathToFileURL(path.join(path.dirname(script), "lib", "module-update.mjs"));
}

async function loadUpdateApi(): Promise<ModuleUpdateApi | null> {
  const url = updateLibUrl();
  if (!url) return null;
  return (await import(url.href)) as ModuleUpdateApi;
}

async function loadFetchApi(): Promise<FetchModuleApi | null> {
  const url = fetchModuleUrl();
  if (!url) return null;
  return (await import(url.href)) as FetchModuleApi;
}

/** 缺文件时写入默认策略。失败不影响其他命令。 */
export async function ensureModuleUpdateConfigFile(): Promise<void> {
  try {
    const api = await loadUpdateApi();
    api?.ensureModuleUpdateConfigFile(ROOT);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushLog(message, "module", "warn");
  }
}

/**
 * REPL 处于 raw 模式时，先暂时关掉，让确认提示能读到整行。
 */
async function withCookedStdin<T>(fn: () => Promise<T>): Promise<T> {
  const wasRaw = stdin.isRaw === true;
  if (wasRaw) stdin.setRawMode(false);
  try {
    return await fn();
  } finally {
    if (wasRaw) stdin.setRawMode(true);
  }
}

/** 跳过原因的可读文案。未知原因保持原样。 */
function reasonText(reason: string, detail: string): string {
  const key = REASON_KEYS[reason];
  const label = key ? t(key) : reason;
  return detail ? `${label} (${detail})` : label;
}

function versionText(value: string | null): string {
  return value || "?";
}

/**
 * 把计划格式化成多行。startup 或非 --check 时隐藏“已关闭 / 已最新”这类安静跳过。
 */
function formatPlan(
  plan: ModuleUpdatePlan,
  quiet: Set<string>,
  showAll: boolean,
  quietEmpty = false
): string[] {
  if (plan.configSkipped === "disabled") return quietEmpty ? [] : [c.yellow(t("mod.update.disabled"))];
  if (plan.configSkipped === "check-off") return quietEmpty ? [] : [c.dim(t("mod.update.checkOff"))];
  const lines: string[] = [];
  for (const item of plan.skipped) {
    if (!showAll && quiet.has(item.reason)) continue;
    lines.push(c.dim(`  ${item.id}  ${reasonText(item.reason, item.detail)}`));
  }
  for (const item of plan.upgrades) {
    lines.push(
      c.green(
        `  ${t("mod.update.upgrade", {
          id: item.id,
          from: versionText(item.fromVersion),
          to: versionText(item.toVersion),
        })}`
      )
    );
  }
  if (plan.upgrades.length === 0 && lines.length === 0 && !quietEmpty) lines.push(c.dim(t("mod.update.none")));
  return lines;
}

function formatApply(result: ModuleUpdateApplyResult, hintReload: boolean): string[] {
  const lines: string[] = [];
  for (const item of result.applied) {
    lines.push(
      c.green(
        t("mod.update.applied", {
          id: item.id,
          from: versionText(item.fromVersion),
          to: versionText(item.toVersion),
        })
      )
    );
  }
  for (const item of result.skipped) {
    lines.push(c.yellow(`  ${item.id}  ${reasonText(item.reason, item.detail)}`));
  }
  for (const item of result.failed) {
    lines.push(c.red(t("mod.update.failed", { id: item.id, message: item.message })));
  }
  if (hintReload && result.applied.length > 0) lines.push(c.yellow(t("mod.update.reloadHint")));
  return lines;
}

interface UpdateFlags {
  check: boolean;
  yes: boolean;
  allowMajor: boolean;
  ids: string[];
}

/** 解析 mod update 的旗标。未知旗标返回 null。 */
function parseUpdateFlags(args: string[]): UpdateFlags | null {
  const flags: UpdateFlags = { check: false, yes: false, allowMajor: false, ids: [] };
  for (const arg of args) {
    if (arg === "--check") flags.check = true;
    else if (arg === "--yes") flags.yes = true;
    else if (arg === "--allow-major") flags.allowMajor = true;
    else if (arg.startsWith("--")) return null;
    else flags.ids.push(arg);
  }
  return flags;
}

/**
 * mod update：先出计划，交互确认后再换包。
 * --check 只报告。开服路径走 runModuleUpdatesOnBdsStart，不经过确认。
 */
export async function cmdModuleUpdate(args: string[]): Promise<string> {
  const flags = parseUpdateFlags(args);
  if (!flags) return c.yellow(t("mod.update.usage"));
  const api = await loadUpdateApi();
  if (!api) return c.red(t("mod.fetchMissing"));
  const plan = await api.planModuleUpdates({
    root: ROOT,
    allowMajor: flags.allowMajor,
    ids: flags.ids,
  });
  const lines = formatPlan(plan, api.QUIET_SKIP_REASONS, flags.check);
  if (flags.check || plan.configSkipped || plan.upgrades.length === 0) return lines.join("\n");
  if (!flags.yes) {
    if (!isCliTty()) return [...lines, c.yellow(t("mod.update.needYes"))].join("\n");
    const ans = await withCookedStdin(() =>
      confirm({
        message: t("mod.update.confirm", { count: plan.upgrades.length }),
        initialValue: true,
      })
    );
    if (isCancel(ans) || !ans) return [...lines, c.dim(t("mod.update.cancelled"))].join("\n");
  }
  const fetchApi = await loadFetchApi();
  if (!fetchApi) return c.red(t("mod.fetchMissing"));
  const result = await api.applyModuleUpgrades(plan.upgrades, {
    root: ROOT,
    failMode: plan.failMode,
    install: fetchApi.installPreservingLock,
    resync: api.resyncInstalledCatalog,
  });
  return [...lines, ...formatApply(result, true)].join("\n");
}

/**
 * BDS beforeStart：按配置检查，并在 applyOnBdsStart 时直接换包。
 * 失败只记日志，不阻止随后的行为包装配。
 */
export async function runModuleUpdatesOnBdsStart(): Promise<void> {
  try {
    const api = await loadUpdateApi();
    if (!api) return;
    const plan = await api.planModuleUpdates({ root: ROOT, startup: true, ids: [] });
    for (const line of formatPlan(plan, api.QUIET_SKIP_REASONS, false, true)) {
      pushLog(stripColor(line), "module", "info");
    }
    if (!plan.applyOnStart || plan.upgrades.length === 0) return;
    const fetchApi = await loadFetchApi();
    if (!fetchApi) return;
    const result = await api.applyModuleUpgrades(plan.upgrades, {
      root: ROOT,
      failMode: plan.failMode,
      install: fetchApi.installPreservingLock,
      resync: api.resyncInstalledCatalog,
    });
    const level = result.failed.length > 0 ? "warn" : "info";
    for (const line of formatApply(result, false)) {
      pushLog(stripColor(line), "module", level);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushLog(message, "module", "warn");
  }
}

/** 去掉主题色，避免日志文件里留下 ANSI。 */
function stripColor(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * mod pin <id> --auto on|off
 * 链接和本地目录不能打开自动更新。
 */
export async function cmdModulePin(args: string[]): Promise<string> {
  let id = "";
  let auto: boolean | null = null;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--auto") {
      const value = args[++i];
      if (value === "on") auto = true;
      else if (value === "off") auto = false;
      else return c.yellow(t("mod.pin.usage"));
    } else if (arg?.startsWith("--auto=")) {
      const value = arg.slice("--auto=".length);
      if (value === "on") auto = true;
      else if (value === "off") auto = false;
      else return c.yellow(t("mod.pin.usage"));
    } else if (arg?.startsWith("--")) {
      return c.yellow(t("mod.pin.usage"));
    } else if (arg) {
      id = arg;
    }
  }
  if (!id || auto === null) return c.yellow(t("mod.pin.usage"));
  const api = await loadUpdateApi();
  if (!api) return c.red(t("mod.fetchMissing"));
  const result = api.setModulePinAuto(ROOT, id, auto);
  if (!result.ok && result.code === "locked") return c.yellow(t("mod.pin.locked", { id: result.id || id }));
  if (!result.ok) return c.yellow(t("mod.pin.missing", { id }));
  return c.green(t("mod.pin.ok", { id: result.id, state: t(result.auto ? "mod.pin.on" : "mod.pin.off") }));
}
