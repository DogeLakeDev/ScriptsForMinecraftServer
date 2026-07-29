/**
 * sfmc module-commands — runtime CLI for inspecting and managing modules
 * already on disk under `modules/packages/<id>/`.
 *
 * 顶层命令别名:`module` / `mod`(由 main.ts / repl.ts 共同识别)。
 * 子命令通道门禁见 command-surface.ts（dispatch 前由 main/repl 判定）。
 */

import fs from "node:fs/promises";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { configPath, modulePath, readJson, type DBConfig, type ModuleLock } from "@sfmc-bds/sdk/node/config";
import {
  isDevAccentModuleSub,
  listVisibleModuleSubs,
  type CommandMode,
} from "./command-surface.js";
import { failResult, okResult, type CliResult } from "./cli-result.js";
import { t } from "./i18n/index.js";
import { c } from "./theme.js";
import { ROOT, resolveFetchModule } from "./runtime.js";
import { dirFingerprint } from "./module-fingerprint.js";
import {
  DEFAULT_REGISTRY_REPO,
  DEFAULT_REGISTRY_TAG,
  findUnknownModules,
  resolveRegistryIndex,
} from "./registry.js";

/** 顶层命令名(主名 + 短别名),供 HELP / 补全 / 分发共用。 */
export const MODULE_CMD_NAMES = ["module", "mod"] as const;

export type ModuleCmdName = (typeof MODULE_CMD_NAMES)[number];

/** 判断是否为 module 顶层命令(含别名);避免 main/repl 再硬编码 case。 */
export function isModuleCommand(cmd: string | undefined): cmd is ModuleCmdName {
  return !!cmd && (MODULE_CMD_NAMES as readonly string[]).includes(cmd);
}

/** 染色后的 HELP 前缀,避免 HELP 硬编码 module/mod。 */
export function paintModuleCmdAlias(paint: (name: string) => string): string {
  return MODULE_CMD_NAMES.map((name) => paint(name)).join("/");
}

/** @deprecated 使用 listVisibleModuleSubs(mode)；保留全集供调试。 */
export const ALL_MODULE_SUBCOMMANDS = [
  "list",
  "search",
  "install",
  "uninstall",
  "verify",
  "info",
  "enable",
  "disable",
  "build",
  "reload",
] as const;

/** 开发者样式子命令（蓝标，非门禁）。 */
export const DEV_ACCENT_MODULE_SUBCOMMANDS = ["build", "reload"] as const;

/** @deprecated 使用 ALL_MODULE_SUBCOMMANDS 或 listVisibleModuleSubs。 */
export const MODULE_SUBCOMMANDS = ALL_MODULE_SUBCOMMANDS;

/** @deprecated 使用 DEV_ACCENT_MODULE_SUBCOMMANDS / isDevAccentModuleSub。 */
export const DEV_MODULE_SUBCOMMANDS = DEV_ACCENT_MODULE_SUBCOMMANDS;

export type ModuleSubcommand = (typeof ALL_MODULE_SUBCOMMANDS)[number];

/** 当前通道下可见的 module 子命令（自动补全 / usage）。 */
export function getVisibleModuleSubcommands(mode: CommandMode): readonly string[] {
  return listVisibleModuleSubs(mode);
}

/** sub 是否为开发者蓝标（help 着色）。 */
export function isDeveloperSubcommand(sub: string | undefined): boolean {
  return isDevAccentModuleSub(sub);
}

/** Usage 行主名|别名(与 MODULE_CMD_NAMES 同源,避免与 HELP 漂移)。 */
export function moduleUsage(mode: CommandMode = "argv"): string {
  return t("mod.usage", {
    cmds: MODULE_CMD_NAMES.join("|"),
    subs: getVisibleModuleSubcommands(mode).join("|"),
  });
}

/** Where modules live on disk. */
function modulesDir(): string {
  return path.join(ROOT, "modules", "packages");
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function shortHash(h: string): string {
  return h.slice(0, 8) + "…" + h.slice(-8);
}

interface ModuleManifest {
  schemaVersion?: number;
  id?: string;
  handlers?: string[];
  routes?: Array<{ method: string; path: string; handler: string }>;
  migrations?: Array<{ name: string; version: number }>;
  notes?: string;
}

interface InstalledModule {
  id: string;
  path: string;
  manifest: ModuleManifest | null;
  totalBytes: number;
  fileCount: number;
  fingerprint: string;
}

/** Enumerate every installed module by scanning `modules/packages/<id>/`. */
async function scanInstalled(): Promise<InstalledModule[]> {
  const dir = modulesDir();
  if (!existsSync(dir)) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out: InstalledModule[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const id = e.name;
    const modPath = path.join(dir, id);
    const manifestPath = path.join(modPath, "sapi", "manifest.json");
    let manifest: ModuleManifest | null = null;
    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as ModuleManifest;
      } catch {
        /* corrupt manifest is not fatal — just skip its fields */
      }
    }
    const { totalBytes, fileCount } = await dirSize(modPath);
    const fingerprint = await dirFingerprint(modPath);
    out.push({ id, path: modPath, manifest, totalBytes, fileCount, fingerprint });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

async function dirSize(dir: string): Promise<{ totalBytes: number; fileCount: number }> {
  let totalBytes = 0;
  let fileCount = 0;
  async function walk(p: string): Promise<void> {
    for (const e of await fs.readdir(p, { withFileTypes: true })) {
      const child = path.join(p, e.name);
      if (e.isDirectory()) await walk(child);
      else if (e.isFile()) {
        const s = await fs.stat(child);
        totalBytes += s.size;
        fileCount++;
      }
    }
  }
  await walk(dir);
  return { totalBytes, fileCount };
}

/* ─────────────────────────────────────────────────────────────────
 *  list
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleList(_args: string[]): Promise<string> {
  const installed = await scanInstalled();
  if (installed.length === 0) {
    return c.dim(t("mod.noneInstalled", { dir: modulesDir() }));
  }
  const lock =
    (readJson<ModuleLock>(modulePath(path.join(ROOT, "modules"), "module-lock.json")) ?? {
      version: 1,
      modules: {},
    }) as ModuleLock;
  const ids = installed.map((m) => m.id);
  const unknown = new Set(await findUnknownModules(ids));
  const lines: string[] = [c.bold(`\n${t("mod.list.title")}`), c.dim(`  ${modulesDir()}`)];
  const header = `    ${"id".padEnd(24)}${"state".padEnd(8)}${"files".padEnd(8)}${"size".padEnd(10)}${"fingerprint"}`;
  lines.push(c.dim(header));
  for (const m of installed) {
    const logicalId = typeof m.manifest?.id === "string" && m.manifest.id ? m.manifest.id : m.id;
    const enabled = lock.modules?.[logicalId]?.enabled === true;
    const stateCol = (enabled ? c.green("on") : c.dim("off")).padEnd(8);
    let mark: string;
    if (!m.manifest) {
      mark = c.yellow("○");
    } else if (unknown.has(m.id)) {
      mark = c.yellow("?");
    } else {
      mark = enabled ? c.green("●") : c.dim("○");
    }
    const idLabel = logicalId !== m.id ? `${m.id}(${logicalId})` : m.id;
    lines.push(
      `  ${mark} ${idLabel.padEnd(22)}${stateCol}${String(m.fileCount).padEnd(8)}${fmtBytes(m.totalBytes).padEnd(10)}${shortHash(m.fingerprint)}`
    );
  }
  lines.push(c.dim(`\n  tip: ${MODULE_CMD_NAMES[1] ?? "mod"} enable|disable <logicalId>`));
  return lines.join("\n") + "\n";
}

/**
 * Walk `modules/packages/<id>/` and print a one-line yellow warning for each
 * id that isn't in the first-party registry. Intended for the REPL startup
 * hook so users immediately see modules they installed from somewhere else.
 *
 * Best-effort: registry unreachable → no warning (no false positives).
 */
export async function scanAndWarnUnknown(): Promise<string> {
  const installed = await scanInstalled();
  if (installed.length === 0) return "";
  const unknown = await findUnknownModules(installed.map((m) => m.id));
  if (unknown.length === 0) return "";
  const list = unknown.map((id) => `  ${c.yellow("?")} ${id}`).join("\n");
  return `${c.yellow("[sfmc] modules installed from unknown publisher — verify before use:")}\n${list}\n`;
}

/* ─────────────────────────────────────────────────────────────────
 *  search — 拉取 first-party registry;带 id 查单条 registry info
 * ──────────────────────────────────────────────────────────────── */
/**
 * 拉取 first-party registry 模块列表;带 id 时展示该条目的 registry info。
 * 与本地 `info`(已安装磁盘详情)区分:`search` 看 registry,`info` 看本机 packages。
 */
export async function cmdModuleSearch(args: string[]): Promise<string> {
  const query = args[0];
  const { index, stale } = await resolveRegistryIndex({ force: true });
  const ids = Object.keys(index).sort((a, b) => a.localeCompare(b));

  if (ids.length === 0) {
    return c.red(
      `\nRegistry empty or unreachable (${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}).\n` +
        `Check network, or: mod install <id> --from github:owner/repo@tag\n`
    );
  }

  const staleNote = stale ? c.yellow("  (offline — showing cached index)\n") : "";

  /* 无参数:列出全部 */
  if (!query) {
    const installed = new Set(listInstalledModuleIdsSync());
    const lines: string[] = [
      c.bold(`\nFirst-party registry (${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}) — ${ids.length} modules`),
    ];
    if (staleNote) lines.push(staleNote.trimEnd());
    lines.push(c.dim(`    ${"id".padEnd(28)}${"source".padEnd(40)}local`));
    for (const id of ids) {
      const e = index[id]!;
      const src = `${e.repo}@${e.tag}`;
      const local = installed.has(id) ? c.green("●") : c.dim("○");
      lines.push(`  ${local} ${id.padEnd(26)}${src.padEnd(40)}${installed.has(id) ? "installed" : ""}`);
    }
    lines.push(c.dim(`\n  tip: sfmc mod search <id>  → registry info`));
    lines.push(c.dim(`       sfmc mod install <id> → download + catalog sync`));
    return lines.join("\n") + "\n";
  }

  /* 带 id:查单条 registry info */
  const entry = index[query];
  if (!entry) {
    const hints = ids.filter((id) => id.includes(query) || query.includes(id)).slice(0, 8);
    const hintBlock =
      hints.length > 0
        ? c.dim(`\n  Did you mean:\n`) + hints.map((h) => `    ${h}`).join("\n")
        : c.dim(`\n  Known ids: ${ids.slice(0, 12).join(", ")}${ids.length > 12 ? ", …" : ""}`);
    return c.red(t("mod.notInRegistry", { query })) + hintBlock + "\n";
  }

  const installedPath = path.join(modulesDir(), query);
  const isInstalled = existsSync(installedPath);
  const lines: string[] = [c.bold(`\n${query}`)];
  if (staleNote) lines.push(staleNote.trimEnd());
  lines.push(`  registry   : ${DEFAULT_REGISTRY_REPO}@${DEFAULT_REGISTRY_TAG}`);
  lines.push(`  repo       : ${entry.repo}`);
  lines.push(`  tag        : ${entry.tag}`);
  lines.push(`  source     : github:${entry.repo}@${entry.tag}`);
  lines.push(`  github     : https://github.com/${entry.repo}/tree/${entry.tag}`);
  lines.push(
    `  local      : ${isInstalled ? c.green(`installed @ ${installedPath}`) : c.dim("not installed")}`
  );

  if (!isInstalled) {
    lines.push(c.dim(`\n  install: sfmc mod install ${query}`));
  } else {
    lines.push(c.dim(`\n  details: sfmc mod info ${query}`));
  }
  return lines.join("\n") + "\n";
}

/* ─────────────────────────────────────────────────────────────────
 *  info
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleInfo(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow(t("mod.info.usage"));
  const all = await scanInstalled();
  const m = all.find((x) => x.id === id);
  if (!m) return c.red(t("mod.notInstalledAt", { id, path: path.join(modulesDir(), id) }));
  const lines: string[] = [c.bold(`\n${id}`)];
  lines.push(`  path        : ${m.path}`);
  lines.push(`  files       : ${m.fileCount}`);
  lines.push(`  size        : ${fmtBytes(m.totalBytes)}`);
  lines.push(`  fingerprint : ${m.fingerprint}`);
  if (m.manifest) {
    lines.push(`  schemaVer   : ${m.manifest.schemaVersion ?? "(none)"}`);
    lines.push(`  routes      : ${m.manifest.routes?.length ?? 0}`);
    if (m.manifest.routes?.length) {
      for (const r of m.manifest.routes) lines.push(c.dim(`    ${r.method.padEnd(7)} ${r.path.padEnd(36)} ${r.handler}`));
    }
    lines.push(`  migrations  : ${m.manifest.migrations?.length ?? 0}`);
    if (m.manifest.migrations?.length) {
      for (const mg of m.manifest.migrations) lines.push(c.dim(`    v${mg.version} ${mg.name}`));
    }
    if (m.manifest.notes) lines.push(`  notes       : ${c.dim(m.manifest.notes)}`);
  } else {
    lines.push(c.yellow(`  manifest    : (missing or unreadable)`));
  }
  return lines.join("\n") + "\n";
}

/* ─────────────────────────────────────────────────────────────────
 *  verify
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleVerify(args: string[]): Promise<string> {
  const id = args[0];
  if (id) {
    const all = await scanInstalled();
    const m = all.find((x) => x.id === id);
    if (!m) return c.red(t("mod.notInstalled", { id }));
    return c.green(t("mod.verifyOk", { id, fp: m.fingerprint }));
  }
  const all = await scanInstalled();
  const lines = [c.bold("\nVerifying installed modules")];
  for (const m of all) {
    lines.push(`  ${m.id.padEnd(28)} ${shortHash(m.fingerprint)}`);
  }
  if (all.length === 0) lines.push(c.dim("  (none)"));
  return lines.join("\n") + "\n";
}

/* ─────────────────────────────────────────────────────────────────
 *  install  — shells out to tools/fetch-module.mjs
 * ──────────────────────────────────────────────────────────────── */
/* ───────────────────────────────────────────────────────────────
 *  enable / disable  — talk to db-server over loopback HTTP
 * ─────────────────────────────────────────────────────────────── */
function readDbConfig(): DBConfig {
  return (readJson<DBConfig>(configPath(ROOT, "db_config.json")) ?? {}) as DBConfig;
}

async function postModuleToggle(id: string, action: "enable" | "disable"): Promise<CliResult> {
  const cfg = readDbConfig();
  const port = cfg.db_port ?? 3001;
  const token = cfg.http_auth || "";
  const url = `http://127.0.0.1:${port}/api/sfmc/modules/${encodeURIComponent(id)}/${action}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (err) {
    return failResult(
      c.red(t("mod.dbUnreachable", { url, message: (err as Error).message }))
    );
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    return failResult(c.red(t("mod.toggleFailed", { action, id, err })));
  }
  const ok = (body as { success?: boolean })?.success !== false;
  if (ok) {
    const label = action === "enable" ? t("mod.action.enabled") : t("mod.action.disabled");
    return okResult(c.green(t("mod.toggleOk", { label, id })));
  }
  return failResult(c.red(t("mod.toggleBadBody", { action, id, text })));
}

export async function cmdModuleEnable(args: string[]): Promise<CliResult> {
  const id = args[0];
  if (!id) return failResult(c.yellow(t("mod.enable.usage")));
  return postModuleToggle(id, "enable");
}

export async function cmdModuleDisable(args: string[]): Promise<CliResult> {
  const id = args[0];
  if (!id) return failResult(c.yellow(t("mod.disable.usage")));
  return postModuleToggle(id, "disable");
}

/* ───────────────────────────────────────────────────────────────
 *  install  — shells out to tools/fetch-module.mjs
 * ─────────────────────────────────────────────────────────────── */

/**
 * 预检 --from 取值是否是合法 scheme：
 *   - npm:@scope/name / npm:<name>
 *   - local[:<path>] / local
 *   - tgz:<path>
 *   - zip:<path>
 *   - dir:<abs path>
 *   - github:<owner>/<repo>[@tag]
 *   - 裸路径：必须存在且为目录（裸文件应转 tgz:/zip:）
 * 返回 null 表示合法；否则返回用户可读的错误文案。
 */
function validateFromScheme(from: string): string | null {
  if (
    from === "local" ||
    from.startsWith("local:") ||
    from.startsWith("dir:") ||
    from.startsWith("npm:") ||
    from.startsWith("tgz:") ||
    from.startsWith("zip:") ||
    from.startsWith("github:")
  ) {
    return null;
  }
  if (existsSync(from)) {
    const st = lstatSync(from);
    if (st.isDirectory()) return null;
    return `--from 裸路径须为目录（文件请用 --from local:<tgz|zip>）: ${from}`;
  }
  return t("mod.fromUnknown", { value: from });
}

export async function cmdModuleInstall(args: string[]): Promise<string> {
  // 支持: install <id> [id2 ...] [--from ...] [--link] [--sha256 ...]
  const flags = parseFlags(args);
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from" || args[i] === "--sha256") {
      i++;
      continue;
    }
    if (args[i]?.startsWith("--from=") || args[i]?.startsWith("--sha256=")) continue;
    if (args[i]?.startsWith("--")) continue;
    positional.push(args[i]!);
  }
  if (positional.length === 0) {
    return c.yellow(t("mod.install.usage"));
  }

  /* scheme 预检：避免拼写错误延迟到子进程报错 */
  if (flags.from) {
    const err = validateFromScheme(flags.from);
    if (err) return c.red(err);
  }

  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    return c.red(t("mod.fetchMissing"));
  }
  const sub = ["install", ...positional];
  if (flags.from) sub.push("--from", flags.from);
  if (flags.sha256) sub.push("--sha256", flags.sha256);
  if (flags.link) sub.push("--link");
  return new Promise<string>((resolve) => {
    const proc = spawn(process.execPath, [fetchScript, ...sub], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SFMC_ROOT: ROOT },
    });
    let out = "";
    proc.stdout?.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.on("exit", (code) => {
      resolve(out + (code === 0 ? "" : `\n[exit ${code}]`));
    });
    proc.on("error", (e) => resolve(c.red(`spawn failed: ${e.message}`)));
  });
}

/* ─────────────────────────────────────────────────────────────────
 *  uninstall
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleUninstall(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow(t("mod.uninstall.usage"));
  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    // 回退:仅删目录(旧行为)
    const target = path.join(modulesDir(), id);
    if (!existsSync(target)) return c.yellow(t("mod.notInstalledFolder", { id, path: target }));
    await fs.rm(target, { recursive: true, force: true });
    return c.green(t("mod.removed", { id, path: target }));
  }
  return new Promise<string>((resolve) => {
    const proc = spawn(process.execPath, [fetchScript, "uninstall", id], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, SFMC_ROOT: ROOT },
    });
    let out = "";
    proc.stdout?.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.stderr?.on("data", (d: Buffer) => {
      out += d.toString();
    });
    proc.on("exit", (code) => {
      resolve(out + (code === 0 ? "" : `\n[exit ${code}]`));
    });
    proc.on("error", (e) => resolve(c.red(`spawn failed: ${e.message}`)));
  });
}

/* ─────────────────────────────────────────────────────────────────
 *  CLI flag parsing
 * ──────────────────────────────────────────────────────────────── */
interface InstallFlags {
  from: string | null;
  sha256: string | null;
  link: boolean;
}

function parseFlags(args: string[]): InstallFlags {
  const flags: InstallFlags = { from: null, sha256: null, link: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from") flags.from = args[++i] ?? null;
    else if (args[i]?.startsWith("--from=")) flags.from = args[i]!.slice("--from=".length);
    else if (args[i] === "--sha256") flags.sha256 = args[++i] ?? null;
    else if (args[i]?.startsWith("--sha256=")) flags.sha256 = args[i]!.slice("--sha256=".length);
    else if (args[i] === "--link") flags.link = true;
  }
  return flags;
}

/**
 * `sfmc mod test` — 委托模块仓的 test runner（node --test + @sfmc-bds/sdk/testing）。
 * 解析 --from local[:path] 规则与 watch 一致；缺省 cwd。
 * 透传 npm test：让模块仓的 `scripts.test` 自己决定怎么跑（node --test / tsx / vitest 等）。
 */
export async function cmdModuleTest(args: string[]): Promise<string> {
  let fromRaw: string | null = null;
  const passthrough: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--from") {
      fromRaw = args[++i] ?? null;
    } else if (a?.startsWith("--from=")) {
      fromRaw = a.slice("--from=".length);
    } else if (a === "--help" || a === "-h") {
      return c.dim("用法: mod test [--from local[:<path>]] [-- <args>]\n  透传给模块仓的 npm test。");
    } else {
      passthrough.push(a!);
    }
  }

  /* 解析 cwd（与 watch 共用 resolveLocalModuleRoot 规则）。 */
  const { resolveLocalModuleRoot } = await import("./module-watch.js");
  const cwd = resolveLocalModuleRoot({ from: fromRaw, cwd: process.cwd() });

  if (!existsSync(cwd)) {
    return c.red(`[mod test] 路径不存在: ${cwd}`);
  }
  if (!existsSync(path.join(cwd, "package.json"))) {
    return c.yellow(`[mod test] 未找到 package.json: ${cwd}\n  提示：进入模块仓根目录，或用 --from local:<path> 指向。`);
  }

  /* Windows 用 cmd /c npm 透传 npm.cmd（避免 shell:true 的 DEP0190 安全警告）。 */
  const isWin = process.platform === "win32";
  const cmd = isWin ? "cmd.exe" : "npm";
  const subArgs = isWin ? ["/c", "npm", "test", "--", ...passthrough] : ["test", "--", ...passthrough];

  return new Promise<string>((resolve) => {
    const proc = spawn(cmd, subArgs, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    proc.on("exit", (code) => {
      resolve(code === 0 ? "" : `\n[mod test] exit ${code}`);
    });
    proc.on("error", (e) => resolve(c.red(`[mod test] spawn failed: ${e.message}`)));
  });
}

/**
 * 统一分发 module/mod 子命令 —— CLI(`main.ts`)与 REPL(`repl.ts`)共用,
 * 避免两处 switch 漂移。
 *
 * 通道门禁（external/repl）由调用方在 dispatch 前经 command-surface 判定；
 * 本函数只负责子命令路由。`remove` 作为 uninstall 的同义别名保留。
 */
export async function dispatchModuleCommand(sub: string | undefined, args: string[]): Promise<string> {
  switch (sub) {
    case "list":
      return cmdModuleList(args);
    case "search":
      return cmdModuleSearch(args);
    case "install":
      return cmdModuleInstall(args);
    case "uninstall":
    case "remove":
      return cmdModuleUninstall(args);
    case "verify":
      return cmdModuleVerify(args);
    case "info":
      return cmdModuleInfo(args);
    case "enable":
      return (await cmdModuleEnable(args)).message;
    case "disable":
      return (await cmdModuleDisable(args)).message;
    case "build": {
      const { cmdModuleBuild } = await import("./module-pack-build.js");
      return cmdModuleBuild(args);
    }
    case "reload": {
      const { cmdModuleReload } = await import("./module-pack-build.js");
      return cmdModuleReload(args);
    }
    case "watch": {
      const { cmdModuleWatch } = await import("./module-watch.js");
      return cmdModuleWatch(args);
    }
    case "test": {
      return cmdModuleTest(args);
    }
    case "publish": {
      const { cmdModulePublish } = await import("./module-publish.js");
      return cmdModulePublish(args);
    }
    default:
      return c.yellow(moduleUsage());
  }
}

/** 同步枚举已安装模块 id,供 REPL Tab 补全(不读 fingerprint,尽量轻量)。 */
export function listInstalledModuleIdsSync(): string[] {
  const dir = modulesDir();
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}