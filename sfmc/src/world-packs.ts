/**
 * world-packs.ts — 通用世界 BP/RP 编排（收件箱安装 + packs CLI）
 * 与 pack-lifecycle（模块聚合 BP/RP）职责分离。
 */
import { confirm, isCancel } from "@clack/prompts";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  bumpPackPatchVersion,
  discoverPackRoots,
  disableInstalledPack,
  enableInstalledPack,
  extractArchiveToTemp,
  findInstalledPackById,
  installPackDirectory,
  isPackArchive,
  listInstalledWorldPacks,
  listWorldEnableEntries,
  readPackManifestInfo,
  worldPackParentDir,
  type InstalledWorldPack,
  type PackManifestInfo,
} from "@sfmc-bds/bds-tools/world-packs";
import { resolveBdsContext } from "./pack-lifecycle.js";
import { ROOT } from "./runtime.js";
import { c } from "./theme.js";

export const PACKS_CMD_NAMES = ["packs", "addon"] as const;
export const PACKS_SUBCOMMANDS = [
  "list",
  "search",
  "enable",
  "disable",
  "bump",
  "install",
  "scan",
  "doctor",
  "path",
] as const;

const RESTART_HINT = "需重启 BDS 后生效";
const REJOIN_HINT = "客户端需重进服以下载资源包";

export function isPacksCommand(cmd: string | undefined): cmd is string {
  return !!cmd && (PACKS_CMD_NAMES as readonly string[]).includes(cmd);
}

export function packsInboxDir(): string {
  return path.join(ROOT, "packs");
}

function doneDir(): string {
  return path.join(packsInboxDir(), "_done");
}

function failedDir(): string {
  return path.join(packsInboxDir(), "_failed");
}

function statePath(): string {
  return path.join(packsInboxDir(), "inbox-state.json");
}

interface InboxState {
  installed: Record<string, { uuid: string; at: string; folderName?: string }>;
}

function ensureInboxLayout(): void {
  for (const d of [packsInboxDir(), doneDir(), failedDir()]) {
    fs.mkdirSync(d, { recursive: true });
  }
}

function readState(): InboxState {
  const file = statePath();
  if (!fs.existsSync(file)) return { installed: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as InboxState;
    return { installed: raw.installed ?? {} };
  } catch {
    return { installed: {} };
  }
}

function writeState(state: InboxState): void {
  ensureInboxLayout();
  fs.writeFileSync(statePath(), `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

/** 源指纹：路径 + size + mtime */
function sourceFingerprint(absPath: string): string {
  const st = fs.statSync(absPath);
  const payload = `${absPath}|${st.size}|${st.mtimeMs}`;
  return crypto.createHash("sha1").update(payload).digest("hex");
}

function stampName(name: string): string {
  const safe = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 80);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${ts}-${safe || "pack"}`;
}

function moveTo(src: string, destParent: string, label: string): string {
  fs.mkdirSync(destParent, { recursive: true });
  const dest = path.join(destParent, stampName(label));
  fs.renameSync(src, dest);
  return dest;
}

function fmtVer(v: [number, number, number]): string {
  return v.join(".");
}

function printConflict(
  existing: PackManifestInfo & { dir: string },
  incoming: PackManifestInfo
): void {
  console.log(c.yellow("检测到冲突："));
  console.log(
    `  已有: ${existing.name}  v${fmtVer(existing.version)}  ${existing.uuid}\n         ${existing.dir}`
  );
  console.log(
    `  新来: ${incoming.name}  v${fmtVer(incoming.version)}  ${incoming.uuid}`
  );
}

async function askOverwrite(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const ans = await confirm({
    message: "是否覆盖已有包？",
    initialValue: false,
  });
  if (isCancel(ans)) return false;
  return !!ans;
}

async function installOnePackRoot(opts: {
  srcDir: string;
  bdsRoot: string;
  levelName: string;
  folderHint?: string;
  force?: boolean;
  interactive?: boolean;
}): Promise<{ ok: boolean; skipped?: boolean; reason?: string; info?: PackManifestInfo }> {
  const info = readPackManifestInfo(opts.srcDir);
  if (!info) {
    return { ok: false, reason: "无法识别 manifest（缺少 resources/data/script）" };
  }
  const destParent = worldPackParentDir(opts.bdsRoot, opts.levelName, info.kind);
  let force = !!opts.force;

  let result = await installPackDirectory({
    srcDir: opts.srcDir,
    destParent,
    force: false,
    ...(opts.folderHint ? { folderName: opts.folderHint } : {}),
  });

  if (result.conflict) {
    printConflict(result.conflict.existing, result.conflict.incoming);
    if (force) {
      /* 显式 --force */
    } else if (opts.interactive && process.stdin.isTTY) {
      force = await askOverwrite();
      if (!force) {
        console.log(c.dim("已跳过（未覆盖）"));
        return { ok: false, skipped: true, reason: "conflict:skipped", info };
      }
    } else {
      console.log(c.yellow(`[packs] 冲突跳过（非交互，可用 --force）: ${info.name}`));
      return { ok: false, skipped: true, reason: "conflict:noninteractive", info };
    }
    result = await installPackDirectory({
      srcDir: opts.srcDir,
      destParent,
      force: true,
      ...(opts.folderHint ? { folderName: opts.folderHint } : {}),
    });
  }

  if (!result.ok || !result.info || !result.destDir) {
    return { ok: false, reason: result.reason ?? "install failed", info };
  }

  await enableInstalledPack({
    bdsRoot: opts.bdsRoot,
    levelName: opts.levelName,
    info: result.info,
  });
  return { ok: true, info: result.info };
}

/** 收集收件箱候选（跳过 _done / _failed / 状态文件） */
function listInboxCandidates(): string[] {
  const inbox = packsInboxDir();
  if (!fs.existsSync(inbox)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(inbox, { withFileTypes: true })) {
    if (e.name.startsWith("_") || e.name === "inbox-state.json") continue;
    const full = path.join(inbox, e.name);
    if (e.isDirectory()) out.push(full);
    else if (e.isFile() && isPackArchive(full)) out.push(full);
  }
  return out;
}

/**
 * 扫描收件箱并安装。空收件箱时不打日志（启动钩子友好）。
 */
export async function scanAndInstallInbox(opts?: {
  dryRun?: boolean;
  force?: boolean;
  interactive?: boolean;
}): Promise<{ installed: number; skipped: number; failed: number }> {
  ensureInboxLayout();
  const candidates = listInboxCandidates();
  if (candidates.length === 0) {
    return { installed: 0, skipped: 0, failed: 0 };
  }

  let bdsRoot: string;
  let levelName: string;
  try {
    ({ bdsRoot, levelName } = resolveBdsContext());
  } catch (e) {
    console.log(c.yellow(`[packs] 跳过收件箱：${(e as Error).message}`));
    return { installed: 0, skipped: 0, failed: candidates.length };
  }

  const interactive = opts?.interactive ?? !!process.stdin.isTTY;
  const force = !!opts?.force;
  const dryRun = !!opts?.dryRun;
  const state = readState();
  let installed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(c.dim(`[packs] 收件箱发现 ${candidates.length} 项 → ${levelName}`));

  for (const src of candidates) {
    const base = path.basename(src);
    const fp = sourceFingerprint(src);
    if (state.installed[fp] && !force) {
      console.log(c.dim(`[packs] 已处理过，跳过: ${base}`));
      skipped++;
      if (!dryRun) {
        try {
          moveTo(src, doneDir(), base);
        } catch {
          /* 可能仍被占用 */
        }
      }
      continue;
    }

    let tempDir: string | null = null;
    try {
      let roots: string[] = [];
      if (fs.statSync(src).isDirectory()) {
        roots = discoverPackRoots(src, { maxDepth: 2 });
      } else if (isPackArchive(src)) {
        if (dryRun) {
          console.log(c.dim(`[packs] dry-run 解压: ${base}`));
          skipped++;
          continue;
        }
        tempDir = await extractArchiveToTemp(src);
        roots = discoverPackRoots(tempDir, { maxDepth: 2 });
      } else {
        failed++;
        if (!dryRun) moveTo(src, failedDir(), base);
        continue;
      }

      if (roots.length === 0) {
        console.log(c.red(`[packs] 未找到包根: ${base}`));
        failed++;
        if (!dryRun && !tempDir) moveTo(src, failedDir(), `${base}-no-root`);
        continue;
      }

      if (dryRun) {
        for (const r of roots) {
          const info = readPackManifestInfo(r);
          console.log(
            c.dim(
              `[packs] dry-run: ${base} → ${info?.kind ?? "?"} ${info?.name ?? path.basename(r)}`
            )
          );
        }
        skipped++;
        continue;
      }

      let okCount = 0;
      let skipCount = 0;
      let failCount = 0;
      let lastUuid = "";
      for (const root of roots) {
        const folderHint =
          roots.length === 1 && fs.statSync(src).isFile()
            ? path.basename(src, path.extname(src))
            : path.basename(root);
        const r = await installOnePackRoot({
          srcDir: root,
          bdsRoot,
          levelName,
          folderHint,
          force,
          interactive,
        });
        if (r.ok && r.info) {
          okCount++;
          lastUuid = r.info.uuid;
          console.log(
            c.green(
              `[packs] 已安装并启用 ${r.info.kind === "resource" ? "RP" : "BP"}: ${r.info.name} v${fmtVer(r.info.version)}`
            )
          );
        } else if (r.skipped) {
          skipCount++;
        } else {
          failCount++;
          console.log(c.red(`[packs] 安装失败 ${path.basename(root)}: ${r.reason ?? "?"}`));
        }
      }

      installed += okCount > 0 ? 1 : 0;
      skipped += skipCount;
      failed += failCount;

      if (okCount > 0) {
        state.installed[fp] = { uuid: lastUuid, at: new Date().toISOString(), folderName: base };
        writeState(state);
        moveTo(src, doneDir(), base);
        console.log(c.yellow(`[packs] ${RESTART_HINT}`));
      } else if (failCount > 0 && skipCount === 0) {
        moveTo(src, failedDir(), base);
      }
      /* 仅冲突跳过：保留在收件箱，便于交互时再处理 */
    } catch (e) {
      console.log(c.red(`[packs] ${base}: ${(e as Error).message}`));
      failed++;
      if (!dryRun && fs.existsSync(src)) {
        try {
          moveTo(src, failedDir(), base);
        } catch {
          /* ignore */
        }
      }
    } finally {
      if (tempDir) {
        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  }

  return { installed, skipped, failed };
}

function filterPacks(
  packs: InstalledWorldPack[],
  kind: "bp" | "rp" | "all",
  search?: string
): InstalledWorldPack[] {
  let list = packs;
  if (kind === "bp") list = list.filter((p) => p.kind === "behavior");
  if (kind === "rp") list = list.filter((p) => p.kind === "resource");
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.folderName.toLowerCase().includes(q) ||
        p.uuid.toLowerCase().includes(q)
    );
  }
  return list;
}

function formatPackList(packs: InstalledWorldPack[]): string {
  if (packs.length === 0) return c.dim("（无）");
  const lines: string[] = [];
  const bp = packs.filter((p) => p.kind === "behavior");
  const rp = packs.filter((p) => p.kind === "resource");
  if (bp.length) {
    lines.push(c.bold("Behavior packs:"));
    for (const p of bp) {
      const en = p.enabled ? c.green("on ") : c.dim("off");
      lines.push(`  [${en}] ${p.folderName}  ${p.name}  v${fmtVer(p.version)}  ${c.dim(p.uuid)}`);
    }
  }
  if (rp.length) {
    lines.push(c.bold("Resource packs:"));
    for (const p of rp) {
      const en = p.enabled ? c.green("on ") : c.dim("off");
      lines.push(`  [${en}] ${p.folderName}  ${p.name}  v${fmtVer(p.version)}  ${c.dim(p.uuid)}`);
    }
  }
  return lines.join("\n");
}

function parseListFlags(args: string[]): { kind: "bp" | "rp" | "all"; search?: string } {
  let kind: "bp" | "rp" | "all" = "all";
  let search: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--kind" && args[i + 1]) {
      const k = args[++i]!.toLowerCase();
      if (k === "bp" || k === "behavior") kind = "bp";
      else if (k === "rp" || k === "resource") kind = "rp";
      else kind = "all";
    } else if (a === "--search" && args[i + 1]) {
      search = args[++i];
    } else if (a && !a.startsWith("-")) {
      search = a;
    }
  }
  return { kind, ...(search ? { search } : {}) };
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

async function cmdDoctor(): Promise<string> {
  const { bdsRoot, levelName } = resolveBdsContext();
  const packs = listInstalledWorldPacks(bdsRoot, levelName);
  const issues: string[] = [];

  for (const kind of ["behavior", "resource"] as const) {
    // 经 listWorldEnableEntries → pack-manager.readWorldPackList（DRY/Demeter，不硬编码 JSON 文件名）
    const entries = listWorldEnableEntries(bdsRoot, levelName, kind);
    const byUuid = new Map(packs.filter((p) => p.kind === kind).map((p) => [p.uuid, p]));
    for (const e of entries) {
      const p = byUuid.get(e.pack_id);
      if (!p) {
        issues.push(`清单有 uuid 但目录缺失 (${kind}): ${e.pack_id}`);
        continue;
      }
      const ev = e.version;
      if (
        Array.isArray(ev) &&
        ev.length >= 3 &&
        (ev[0] !== p.version[0] || ev[1] !== p.version[1] || ev[2] !== p.version[2])
      ) {
        issues.push(
          `版本不一致 (${kind}): ${p.folderName} 清单 ${ev.join(".")} vs 磁盘 ${fmtVer(p.version)}`
        );
      }
    }
  }

  for (const p of packs) {
    if (!p.enabled) {
      issues.push(`已安装未启用: [${p.kind === "resource" ? "RP" : "BP"}] ${p.folderName} (${p.uuid})`);
    }
  }

  if (issues.length === 0) return c.green("doctor: 未发现问题");
  return `doctor 发现 ${issues.length} 项:\n${issues.map((x) => `  - ${x}`).join("\n")}`;
}

export async function dispatchPacksCommand(sub: string | undefined, args: string[]): Promise<string> {
  const verb = (sub ?? "").toLowerCase();
  if (!verb || verb === "help" || verb === "-h" || verb === "--help") {
    return packsUsage();
  }

  try {
    switch (verb) {
      case "list": {
        const { bdsRoot, levelName } = resolveBdsContext();
        const flags = parseListFlags(args);
        const packs = filterPacks(listInstalledWorldPacks(bdsRoot, levelName), flags.kind, flags.search);
        return formatPackList(packs);
      }
      case "search": {
        const q = args[0];
        if (!q) return c.yellow("Usage: packs search <query>");
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = filterPacks(listInstalledWorldPacks(bdsRoot, levelName), "all", q);
        return formatPackList(packs);
      }
      case "enable":
      case "disable": {
        const id = args[0];
        if (!id) return c.yellow(`Usage: packs ${verb} <uuid|folder>`);
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = listInstalledWorldPacks(bdsRoot, levelName);
        const pack = findInstalledPackById(packs, id);
        if (!pack) return c.red(`未找到包: ${id}`);
        if (verb === "enable") {
          await enableInstalledPack({
            bdsRoot,
            levelName,
            info: {
              name: pack.name,
              uuid: pack.uuid,
              version: pack.version,
              kind: pack.kind,
            },
          });
        } else {
          await disableInstalledPack({
            bdsRoot,
            levelName,
            kind: pack.kind,
            packUuid: pack.uuid,
            version: pack.version,
          });
        }
        return c.green(`${verb} ${pack.folderName} 完成。${RESTART_HINT}`);
      }
      case "bump": {
        const id = args[0];
        if (!id) return c.yellow("Usage: packs bump <uuid|folder>  （仅 RP）");
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = listInstalledWorldPacks(bdsRoot, levelName);
        const pack = findInstalledPackById(packs, id);
        if (!pack) return c.red(`未找到包: ${id}`);
        if (pack.kind !== "resource") {
          return c.red("packs bump 仅支持资源包 (RP)");
        }
        const next = bumpPackPatchVersion(pack.dir);
        if (pack.enabled) {
          await enableInstalledPack({
            bdsRoot,
            levelName,
            info: {
              name: pack.name,
              uuid: pack.uuid,
              version: next,
              kind: "resource",
            },
          });
        }
        return c.green(
          `已 bump ${pack.folderName} → v${fmtVer(next)}。${RESTART_HINT}；${REJOIN_HINT}`
        );
      }
      case "install": {
        const force = hasFlag(args, "--force");
        const inbox = hasFlag(args, "--inbox") || args.length === 0 || args.every((a) => a.startsWith("-"));
        if (inbox) {
          const r = await scanAndInstallInbox({ force, interactive: true });
          return c.dim(`install inbox: installed=${r.installed} skipped=${r.skipped} failed=${r.failed}`);
        }
        const target = args.find((a) => !a.startsWith("-"));
        if (!target) return c.yellow("Usage: packs install [path|--inbox] [--force]");
        const abs = path.resolve(target);
        if (!fs.existsSync(abs)) return c.red(`路径不存在: ${abs}`);
        const { bdsRoot, levelName } = resolveBdsContext();
        let tempDir: string | null = null;
        try {
          let roots: string[];
          if (fs.statSync(abs).isDirectory()) {
            roots = discoverPackRoots(abs, { maxDepth: 2 });
          } else if (isPackArchive(abs)) {
            tempDir = await extractArchiveToTemp(abs);
            roots = discoverPackRoots(tempDir, { maxDepth: 2 });
          } else {
            return c.red("不是包目录或 .zip/.mcpack/.mcaddon");
          }
          if (roots.length === 0) return c.red("未发现含 manifest.json 的包根");
          const lines: string[] = [];
          for (const root of roots) {
            const r = await installOnePackRoot({
              srcDir: root,
              bdsRoot,
              levelName,
              folderHint: path.basename(root),
              force,
              interactive: true,
            });
            if (r.ok && r.info) {
              lines.push(
                c.green(`已安装并启用: ${r.info.name} v${fmtVer(r.info.version)} (${r.info.kind})`)
              );
            } else {
              lines.push(c.yellow(`跳过/失败: ${path.basename(root)} (${r.reason ?? "?"})`));
            }
          }
          lines.push(c.yellow(RESTART_HINT));
          return lines.join("\n");
        } finally {
          if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }
      case "scan": {
        const force = hasFlag(args, "--force");
        const dryRun = hasFlag(args, "--dry-run");
        const r = await scanAndInstallInbox({
          force,
          dryRun,
          interactive: !!process.stdin.isTTY,
        });
        if (r.installed === 0 && r.skipped === 0 && r.failed === 0) {
          return c.dim("收件箱为空");
        }
        return c.dim(`scan: installed=${r.installed} skipped=${r.skipped} failed=${r.failed}`);
      }
      case "doctor":
        return await cmdDoctor();
      case "path": {
        ensureInboxLayout();
        const { bdsRoot, levelName } = resolveBdsContext();
        const world = path.join(bdsRoot, "worlds", levelName);
        return [
          `bdsRoot:     ${bdsRoot}`,
          `level:       ${levelName}`,
          `behavior:    ${path.join(world, "behavior_packs")}`,
          `resource:    ${path.join(world, "resource_packs")}`,
          `inbox:       ${packsInboxDir()}`,
        ].join("\n");
      }
      default:
        return c.red(`Unknown packs subcommand: ${verb}\n`) + packsUsage();
    }
  } catch (e) {
    return c.red((e as Error).message);
  }
}

export function packsUsage(): string {
  return `${c.bold("sfmc packs")}（别名 ${c.green("addon")}）— 世界侧任意 BP/RP

  ${c.green("packs list")} [--kind bp|rp|all] [--search q]
  ${c.green("packs search")} <q>
  ${c.green("packs enable|disable")} <uuid|folder>
  ${c.green("packs bump")} <id>          仅 RP，patch 版本 +1
  ${c.green("packs install")} [path|--inbox] [--force]
  ${c.green("packs scan")} [--force] [--dry-run]
  ${c.green("packs doctor")}
  ${c.green("packs path")}

收件箱: ${packsInboxDir()}
安装默认写入 world_*_packs.json 启用；${RESTART_HINT}。
模块聚合请用 ${c.green("sfmc pack")}（非本命令）。`;
}
