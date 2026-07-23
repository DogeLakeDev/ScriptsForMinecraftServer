/**
 * sfmc module-commands — runtime CLI for inspecting and managing modules
 * already on disk under `modules/packages/<id>/`.
 *
 * 顶层命令别名:`module` / `mod`(由 main.ts / repl.ts 共同识别)。
 *
 * Subcommands:
 *   list                    List every installed module (reads each
 *                           modules/packages/<id>/sapi/manifest.json).
 *                           Marks registry-known modules with `●` and
 *                           modules from an unknown publisher with `?`.
 *   search [id]             拉取 first-party registry 列表;带 id 则查该模块 registry info
 *   info <id>               Show one module's manifest + on-disk fingerprint
 *   verify [id]             Recompute the SHA-256 fingerprint of installed
 *                           modules (id = one; no id = all)
 *   install <id>            Wrapper around `tools/fetch-module.mjs install`.
 *                           If `--from` is omitted, the first-party registry
 *                           is consulted (Tanya7z/sfmc-modules).
 *                           `--link` 透传：dir 源用 junction/symlink（开发期）。
 *   uninstall <id>          Remove packages/<id>/ + catalog/lock via fetch-module
 *   enable <id>             POST /api/sfmc/modules/:id/enable on db-server
 *   disable <id>            POST /api/sfmc/modules/:id/disable on db-server
 *   create                  交互式脚手架（sfmc-modules/packages + 可选 link）
 *   link [id]               无 id：交互选择；有 id：install --link（自动探测旁路 sfmc-modules）
 *   dev                     link + enable + build + deploy 一键本地联调
 *
 * The runtime SEA process never connects to the network for local ops.
 * `search`/`install`/`uninstall` 需要网络(或本地 cache / --from)。
 * enable/disable go through db-server REST so module-lock.json stays consistent.
 */

/** 顶层命令名(主名 + 短别名),供 HELP / 补全 / 分发共用。 */
export const MODULE_CMD_NAMES = ["module", "mod"] as const;

export type ModuleCmdName = (typeof MODULE_CMD_NAMES)[number];

/** 判断是否为 module 顶层命令(含别名);避免 main/repl 再硬编码 case。 */
export function isModuleCommand(cmd: string | undefined): cmd is ModuleCmdName {
  return !!cmd && (MODULE_CMD_NAMES as readonly string[]).includes(cmd);
}

/** 染色后的 HELP 前缀,避免 HELP 硬编码 module/mod。 */
export function paintModuleCmdAlias(paint: (name: string) => string): string {
  /* 不可写成 .map(paint):chalk 会吃到 (value,index,array) 并拼出乱文案 */
  return MODULE_CMD_NAMES.map((name) => paint(name)).join("/");
}

/** 对外展示与 Tab 补全用的子命令列表(不含 remove 等同义别名)。 */
export const MODULE_SUBCOMMANDS = [
  "list",
  "search",
  "install",
  "uninstall",
  "verify",
  "info",
  "enable",
  "disable",
  "build",
  "create",
  "link",
  "dev",
] as const;

/** Usage 行主名|别名(与 MODULE_CMD_NAMES 同源,避免与 HELP 漂移)。 */
export const MODULE_USAGE =
  `Usage: sfmc ${MODULE_CMD_NAMES.join("|")} <${MODULE_SUBCOMMANDS.join("|")}> [args]`;

import fs from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { configPath, readJson, type DBConfig } from "@sfmc-bds/sdk/node/config";
import { c } from "./theme.js";
import { ROOT, resolveFetchModule } from "./runtime.js";
import { dirFingerprint } from "./module-fingerprint.js";
import {
  DEFAULT_REGISTRY_REPO,
  DEFAULT_REGISTRY_TAG,
  findUnknownModules,
  resolveRegistryIndex,
} from "./registry.js";

/** Where modules live on disk. SEA reads this same path at runtime. */
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
    return c.dim(`\nNo modules installed. Drop a module folder under ${modulesDir()} or run \`sfmc mod install <id>\`.\n`);
  }
  const ids = installed.map((m) => m.id);
  const unknown = new Set(await findUnknownModules(ids));
  const lines: string[] = [c.bold("\nInstalled modules"), c.dim(`  ${modulesDir()}`)];
  const header = `    ${"id".padEnd(28)}${"files".padEnd(8)}${"size".padEnd(10)}${"routes".padEnd(8)}${"fingerprint"}`;
  lines.push(c.dim(header));
  for (const m of installed) {
    const routeCount = m.manifest?.routes?.length ?? 0;
    let mark: string;
    if (!m.manifest) {
      mark = c.yellow("○");
    } else if (unknown.has(m.id)) {
      mark = c.yellow("?");
    } else {
      mark = c.green("●");
    }
    lines.push(`  ${mark} ${m.id.padEnd(26)}${String(m.fileCount).padEnd(8)}${fmtBytes(m.totalBytes).padEnd(10)}${String(routeCount).padEnd(8)}${shortHash(m.fingerprint)}`);
  }
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
        `Check network, or install with an explicit source: sfmc mod install <id> --from github:owner/repo@tag\n`
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
    return c.red(`Module "${query}" not found in first-party registry.`) + hintBlock + "\n";
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
  if (!id) return c.yellow("Usage: sfmc module|mod info <id>");
  const all = await scanInstalled();
  const m = all.find((x) => x.id === id);
  if (!m) return c.red(`Module ${id} not installed at ${path.join(modulesDir(), id)}`);
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
    if (!m) return c.red(`Module ${id} not installed`);
    return c.green(`${id} ok\n  fingerprint: ${m.fingerprint}\n`) ;
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

async function postModuleToggle(id: string, action: "enable" | "disable"): Promise<string> {
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
    return c.red(`Cannot reach db-server at ${url}: ${(err as Error).message}. Is db-service running? (sfmc> start db)`);
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
    return c.red(`${action} ${id} failed: ${err}`);
  }
  const ok = (body as { success?: boolean })?.success !== false;
  return ok ? c.green(`${action}d ${id}`) : c.red(`${action} ${id} returned: ${text}`);
}

export async function cmdModuleEnable(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow("Usage: sfmc module|mod enable <id>");
  return postModuleToggle(id, "enable");
}

export async function cmdModuleDisable(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow("Usage: sfmc module|mod disable <id>");
  return postModuleToggle(id, "disable");
}

/* ───────────────────────────────────────────────────────────────
 *  install  — shells out to tools/fetch-module.mjs
 * ─────────────────────────────────────────────────────────────── */
export async function cmdModuleInstall(args: string[]): Promise<string> {
  // 支持: install <id> [id2 ...] [--from ...] [--link]
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
    return c.yellow("Usage: sfmc module|mod install <id> [id2 ...] [--from <source>] [--link]");
  }

  /* --link 无 --from 时：自动探测旁路 sfmc-modules（与 mod link 一致） */
  if (flags.link && !flags.from) {
    const { resolveSfmcModulesRoot, packageDirForId } = await import("./sfmc-modules-root.js");
    const modulesRoot = resolveSfmcModulesRoot();
    if (!modulesRoot) {
      return c.red(
        `--link 需要 --from dir:<path>，或设置 SFMC_MODULES_ROOT / 旁路 ../sfmc-modules。\n` +
          `示例: sfmc mod install land --from dir:../sfmc-modules/packages/land --link`
      );
    }
    flags.from =
      positional.length === 1
        ? `dir:${packageDirForId(modulesRoot, positional[0]!)}`
        : `dir:${path.join(modulesRoot, "packages")}`;
  }

  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    return c.red(`fetch-module not found. Install @sfmc-bds/sfmc or run inside the monorepo.`);
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

/**
 * `mod link [id] [--from dir:…]`
 * - 有 id：等价 `install <id> --link`，缺省 --from 时自动拼旁路 packages/<id>
 * - 无 id：进入交互选择（@clack/prompts）
 */
export async function cmdModuleLink(args: string[]): Promise<string> {
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
    const { runModuleLinkWizard } = await import("./module-wizard.js");
    return runModuleLinkWizard();
  }

  const id = positional[0]!;
  const installArgs = [id, "--link"];
  if (flags.from) installArgs.push("--from", flags.from);
  return cmdModuleInstall(installArgs);
}

/* ─────────────────────────────────────────────────────────────────
 *  uninstall
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleUninstall(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow("Usage: sfmc module|mod uninstall <id>");
  const fetchScript = resolveFetchModule();
  if (!fetchScript) {
    // 回退:仅删目录(旧行为)
    const target = path.join(modulesDir(), id);
    if (!existsSync(target)) return c.yellow(`Module ${id} not installed (no folder at ${target})`);
    await fs.rm(target, { recursive: true, force: true });
    return c.green(`Removed ${id} from ${target}\n`);
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
 * 统一分发 module/mod 子命令 —— CLI(`main.ts`)与 REPL(`repl.ts`)共用,
 * 避免两处 switch 漂移(例如原先 REPL 缺 enable/disable)。
 *
 * `remove` 作为 uninstall 的同义别名保留。
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
      return cmdModuleEnable(args);
    case "disable":
      return cmdModuleDisable(args);
    case "build": {
      const { cmdPackBuild } = await import("./pack-lifecycle.js");
      return cmdPackBuild(args);
    }
    case "create": {
      const { runModuleCreateWizard } = await import("./module-wizard.js");
      return runModuleCreateWizard();
    }
    case "link":
      return cmdModuleLink(args);
    case "dev": {
      const { runModuleDevWizard } = await import("./module-wizard.js");
      return runModuleDevWizard();
    }
    default:
      return c.yellow(MODULE_USAGE);
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