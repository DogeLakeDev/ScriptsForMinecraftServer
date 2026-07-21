/**
 * sfmc module-commands — runtime CLI for inspecting and managing modules
 * already on disk under `modules/packages/<id>/`.
 *
 * Subcommands:
 *   list                    List every installed module (reads each
 *                           modules/packages/<id>/sapi/manifest.json).
 *                           Marks registry-known modules with `●` and
 *                           modules from an unknown publisher with `?`.
 *   info <id>               Show one module's manifest + on-disk fingerprint
 *   verify [id]             Recompute the SHA-256 fingerprint of installed
 *                           modules (id = one; no id = all)
 *   install <id>            Wrapper around `tools/fetch-module.mjs install`.
 *                           If `--from` is omitted, the first-party registry
 *                           is consulted (Tanya7z/sfmc-modules).
 *   uninstall <id>          Remove modules/packages/<id>/
 *   enable <id>             POST /api/sfmc/modules/:id/enable on db-server
 *   disable <id>            POST /api/sfmc/modules/:id/disable on db-server
 *
 * The runtime SEA process never connects to the network. `install` simply
 * delegates to the build-time helper `tools/fetch-module.mjs`, which handles
 * GitHub / local sources. enable/disable go through db-server's existing
 * REST endpoints so module-lock.json stays the single source of truth.
 */

import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { c } from "./theme.js";
import { ROOT } from "./runtime.js";
import { findUnknownModules } from "./registry.js";

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

/** Compute the canonical SHA-256 of a module directory (POSIX `find ... | sha256sum` compatible). */
async function dirFingerprint(rootDir: string): Promise<string> {
  const hash = createHash("sha256");
  const entries: string[] = [];
  async function walk(rel: string): Promise<void> {
    const full = path.join(rootDir, rel);
    const items = await fs.readdir(full, { withFileTypes: true });
    const sorted = items.sort((a, b) => a.name.localeCompare(b.name));
    for (const it of sorted) {
      const child = rel ? `${rel}/${it.name}` : it.name;
      if (it.isDirectory()) await walk(child);
      else if (it.isFile()) entries.push(child);
    }
  }
  await walk("");
  entries.sort();
  for (const rel of entries) {
    const data = await fs.readFile(path.join(rootDir, rel));
    hash.update(rel.replaceAll("\\", "/"));
    hash.update("\n");
    hash.update(data);
    hash.update("\n");
  }
  return hash.digest("hex");
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
  walk(dir);
  return { totalBytes, fileCount };
}

/* ─────────────────────────────────────────────────────────────────
 *  list
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleList(_args: string[]): Promise<string> {
  const installed = await scanInstalled();
  if (installed.length === 0) {
    return c.dim(`\nNo modules installed. Drop a module folder under ${modulesDir()} or run \`sfmc module install <id>\`.\n`);
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
 *  info
 * ──────────────────────────────────────────────────────────────── */
export async function cmdModuleInfo(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow("Usage: sfmc module info <id>");
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
function configsPath(): string {
  return path.join(ROOT, "configs", "db_config.json");
}

interface DbConfig {
  db_port?: number;
  http_auth?: string;
}

function readDbConfig(): DbConfig {
  const p = configsPath();
  if (!existsSync(p)) return {};
  try {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    return JSON.parse(readFileSync(p, "utf8")) as DbConfig;
  } catch {
    return {};
  }
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
  if (!id) return c.yellow("Usage: sfmc module enable <id>");
  return postModuleToggle(id, "enable");
}

export async function cmdModuleDisable(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow("Usage: sfmc module disable <id>");
  return postModuleToggle(id, "disable");
}

/* ───────────────────────────────────────────────────────────────
 *  install  — shells out to tools/fetch-module.mjs
 * ─────────────────────────────────────────────────────────────── */
export async function cmdModuleInstall(args: string[]): Promise<string> {
  const id = args[0];
  if (!id) return c.yellow("Usage: sfmc module install <id> [--from <source>]");
  const flags = parseFlags(args.slice(1));
  const fetchScript = path.join(ROOT, "tools", "fetch-module.mjs");
  if (!existsSync(fetchScript)) {
    return c.red(`tools/fetch-module.mjs not found at ${fetchScript}`);
  }
  const sub = ["install", id];
  if (flags.from) sub.push("--from", flags.from);
  if (flags.sha256) sub.push("--sha256", flags.sha256);
  return new Promise<string>((resolve) => {
    const proc = spawn(process.execPath, [fetchScript, ...sub], { stdio: ["ignore", "pipe", "pipe"] });
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
  if (!id) return c.yellow("Usage: sfmc module uninstall <id>");
  const target = path.join(modulesDir(), id);
  if (!existsSync(target)) return c.yellow(`Module ${id} not installed (no folder at ${target})`);
  await fs.rm(target, { recursive: true, force: true });
  return c.green(`Removed ${id} from ${target}\n`);
}

/* ─────────────────────────────────────────────────────────────────
 *  CLI flag parsing
 * ──────────────────────────────────────────────────────────────── */
interface InstallFlags {
  from: string | null;
  sha256: string | null;
}

function parseFlags(args: string[]): InstallFlags {
  const flags: InstallFlags = { from: null, sha256: null };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--from") flags.from = args[++i] ?? null;
    else if (args[i]?.startsWith("--from=")) flags.from = args[i]!.slice("--from=".length);
    else if (args[i] === "--sha256") flags.sha256 = args[++i] ?? null;
  }
  return flags;
}