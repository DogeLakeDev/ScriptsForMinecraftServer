/**
 * world-packs.ts — 通用世界 BP/RP 编排（收件箱安装 + packs CLI）
 * 与 pack-lifecycle（模块聚合 BP/RP）职责分离。
 */
import { confirm, isCancel, multiselect } from "@clack/prompts";
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
  listWorldEnableListResult,
  readPackDependencyUuids,
  readPackManifestInfo,
  uninstallInstalledPack,
  worldPackParentDir,
  type InstalledWorldPack,
  type PackManifestInfo,
} from "@sfmc-bds/bds-tools/world-packs";
import { t } from "./i18n/index.js";
import { BP_NAME, RP_NAME, resolveBdsContext } from "./pack-lifecycle.js";
import {
  bindPackSource,
  bindingLabelForUuid,
  checkPackUpdates,
  formatSourcesList,
  probeSourceAfterInstall,
  searchRemote,
} from "./pack-update/service.js";
import { getBinding, removeBinding, packSourcesPath } from "./pack-update/bindings.js";
import {
  resolvePackTrashDir,
  resolveUninstallTrashDir,
} from "./pack-update/config.js";
import { ROOT } from "./runtime.js";
import { c } from "./theme.js";

export const PACKS_CMD_NAMES = ["packs", "addon"] as const;
export const PACKS_SUBCOMMANDS = [
  "list",
  "search",
  "enable",
  "disable",
  "uninstall",
  "bump",
  "install",
  "scan",
  "doctor",
  "path",
  "bind",
  "unbind",
  "sources",
  "check",
  "update",
] as const;

function restartHint(): string {
  return t("packs.restartHint");
}
function rejoinHint(): string {
  return t("packs.rejoinHint");
}

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
  for (const d of [packsInboxDir(), doneDir(), failedDir(), resolvePackTrashDir()]) {
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

function pruneInboxStateByUuid(uuid: string): void {
  const state = readState();
  let changed = false;
  for (const [fp, meta] of Object.entries(state.installed)) {
    if (meta.uuid.toLowerCase() === uuid.toLowerCase()) {
      delete state.installed[fp];
      changed = true;
    }
  }
  if (changed) writeState(state);
}

/** 平台聚合包不可经 packs uninstall 卸出（策略集中，CLI 只消费） */
export function isProtectedSfmcPack(pack: Pick<InstalledWorldPack, "folderName">): boolean {
  const folder = pack.folderName.toLowerCase();
  return folder === BP_NAME.toLowerCase() || folder === RP_NAME.toLowerCase();
}

type UninstallOneOutcome =
  | { status: "protected"; folder: string }
  | { status: "trashed"; folder: string; dest: string }
  | { status: "deleted"; folder: string }
  | { status: "missing"; folder: string };

function formatUninstallOutcome(r: UninstallOneOutcome): string {
  if (r.status === "protected") {
    return c.red(t("packs.uninstall.protected", { folder: r.folder }));
  }
  if (r.status === "trashed") {
    return c.green(t("packs.uninstall.trashed", { folder: r.folder, dest: r.dest }));
  }
  if (r.status === "missing") {
    return c.yellow(t("packs.uninstall.dirMissing", { folder: r.folder }));
  }
  return c.green(t("packs.uninstall.deleted", { folder: r.folder }));
}

/**
 * 卸载单个已装世界包（disable + 移回收站/删除）。
 * 不负责配对 RP / 绑定 —— 由上层编排。返回结构化结果（DIP：展示与策略分离）。
 */
async function uninstallOneInstalledPack(
  pack: InstalledWorldPack,
  opts: { bdsRoot: string; levelName: string; purge: boolean }
): Promise<UninstallOneOutcome> {
  if (isProtectedSfmcPack(pack)) {
    return { status: "protected", folder: pack.folderName };
  }
  const trash = resolveUninstallTrashDir({ purge: opts.purge });
  const r = await uninstallInstalledPack({
    bdsRoot: opts.bdsRoot,
    levelName: opts.levelName,
    pack,
    trashDir: trash,
  });
  pruneInboxStateByUuid(pack.uuid);
  if (r.action === "trashed") {
    return { status: "trashed", folder: pack.folderName, dest: r.dest };
  }
  if (r.action === "missing") {
    return { status: "missing", folder: pack.folderName };
  }
  return { status: "deleted", folder: pack.folderName };
}

/** 解析 BP 的配对 RP（--no-paired 时跳过） */
function resolvePairedResource(
  pack: InstalledWorldPack,
  packs: InstalledWorldPack[],
  noPaired: boolean
): InstalledWorldPack | null {
  if (pack.kind !== "behavior" || noPaired) return null;
  const binding = getBinding(pack.uuid);
  const pairedUuid =
    binding?.pairedResourceUuid ??
    (fs.existsSync(pack.dir) ? readPackDependencyUuids(pack.dir)[0] : undefined) ??
    null;
  if (!pairedUuid) return null;
  return (
    packs.find((p) => p.kind === "resource" && p.uuid.toLowerCase() === pairedUuid.toLowerCase()) ??
    null
  );
}

function formatUninstallPickLabel(pack: InstalledWorldPack): string {
  const kind = pack.kind === "behavior" ? "BP" : "RP";
  const en = pack.enabled ? t("packs.list.on") : t("packs.list.off");
  return `[${kind}] ${pack.name}  ${pack.folderName}  ${en.trim()}  ${pack.uuid.slice(0, 8)}`;
}

/** TTY 多选待卸载包；取消返回 null；无可卸项返回 [] */
async function pickPacksForUninstall(packs: InstalledWorldPack[]): Promise<InstalledWorldPack[] | null> {
  const candidates = packs.filter((p) => !isProtectedSfmcPack(p));
  if (candidates.length === 0) return [];
  const bp = candidates.filter((p) => p.kind === "behavior");
  const rp = candidates.filter((p) => p.kind === "resource");
  const options = [
    ...bp.map((p) => ({ value: p.uuid, label: formatUninstallPickLabel(p) })),
    ...rp.map((p) => ({ value: p.uuid, label: formatUninstallPickLabel(p) })),
  ];
  const selected = await multiselect({
    message: t("packs.uninstall.pick"),
    options,
    required: true,
  });
  if (isCancel(selected)) return null;
  const set = new Set(selected as string[]);
  return candidates.filter((p) => set.has(p.uuid));
}

/**
 * 展开配对 RP 后批量卸载；可选交互确认。
 * 同一 uuid 只卸一次（用户同时勾选 BP+配对 RP 时不重复）。
 */
async function uninstallPacksBatch(
  selected: InstalledWorldPack[],
  allPacks: InstalledWorldPack[],
  opts: {
    bdsRoot: string;
    levelName: string;
    purge: boolean;
    noPaired: boolean;
    askConfirm: boolean;
  }
): Promise<string> {
  if (selected.length === 0) return c.yellow(t("packs.uninstall.none"));

  type QueueItem = { pack: InstalledWorldPack; pairedOf?: string };
  const queue: QueueItem[] = [];
  const seen = new Set<string>();
  for (const pack of selected) {
    const key = pack.uuid.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push({ pack });
    /* LSP：受保护主包不展开配对 RP */
    if (isProtectedSfmcPack(pack)) continue;
    const paired = resolvePairedResource(pack, allPacks, opts.noPaired);
    if (paired) {
      const pk = paired.uuid.toLowerCase();
      if (!seen.has(pk)) {
        seen.add(pk);
        queue.push({ pack: paired, pairedOf: pack.folderName });
      }
    }
  }

  if (opts.askConfirm && process.stdin.isTTY) {
    const preview = queue
      .map((q) => {
        const kind = q.pack.kind === "behavior" ? "BP" : "RP";
        const extra = q.pairedOf ? ` ${c.dim(t("packs.uninstall.pairedOf", { folder: q.pairedOf }))}` : "";
        return `  [${kind}] ${q.pack.folderName}${extra}`;
      })
      .join("\n");
    console.log(t("packs.uninstall.summary", { count: queue.length }));
    console.log(preview);
    const ans = await confirm({
      message: t("packs.uninstall.confirm", { count: String(queue.length) }),
      initialValue: false,
    });
    if (isCancel(ans) || !ans) return c.dim(t("packs.uninstall.cancelled"));
  }

  const lines: string[] = [];
  for (const item of queue) {
    const outcome = await uninstallOneInstalledPack(item.pack, opts);
    lines.push(formatUninstallOutcome(outcome));
    /* 仅主包实际卸载后清绑定（受保护包 status=protected，不碰 binding） */
    if (item.pack.kind === "behavior" && outcome.status !== "protected") {
      const removed = removeBinding(item.pack.uuid);
      if (removed) {
        lines.push(c.dim(t("packs.uninstall.bindingRemoved", { uuid: item.pack.uuid })));
      }
    }
  }
  lines.push(c.yellow(restartHint()));
  return lines.join("\n");
}

function printConflict(
  existing: PackManifestInfo & { dir: string },
  incoming: PackManifestInfo
): void {
  console.log(c.yellow(t("packs.conflict")));
  console.log(
    t("packs.conflict.existing", {
      name: existing.name,
      version: fmtVer(existing.version),
      uuid: existing.uuid,
      dir: existing.dir,
    })
  );
  console.log(
    t("packs.conflict.incoming", {
      name: incoming.name,
      version: fmtVer(incoming.version),
      uuid: incoming.uuid,
    })
  );
}

async function askOverwrite(): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const ans = await confirm({
    message: t("packs.overwriteAsk"),
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
    return { ok: false, reason: t("packs.badManifest") };
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
        console.log(c.dim(t("packs.skippedNoOverwrite")));
        return { ok: false, skipped: true, reason: "conflict:skipped", info };
      }
    } else {
      console.log(c.yellow(t("packs.conflictSkip", { name: info.name })));
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

  /* 安装成功后探测 CF 更新源（仅 BP） */
  try {
    await probeSourceAfterInstall({
      info: result.info,
      packDir: result.destDir,
      ...(result.folderName ? { folderName: result.folderName } : {}),
      ...(opts.interactive !== undefined ? { interactive: opts.interactive } : {}),
    });
  } catch (e) {
    console.log(c.yellow(`[packs] probe: ${(e as Error).message}`));
  }

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
    console.log(c.yellow(t("packs.inboxSkip", { message: (e as Error).message })));
    return { installed: 0, skipped: 0, failed: candidates.length };
  }

  const interactive = opts?.interactive ?? !!process.stdin.isTTY;
  const force = !!opts?.force;
  const dryRun = !!opts?.dryRun;
  const state = readState();
  let installed = 0;
  let skipped = 0;
  let failed = 0;

  console.log(c.dim(t("packs.inboxFound", { count: candidates.length, level: levelName })));

  for (const src of candidates) {
    const base = path.basename(src);
    const fp = sourceFingerprint(src);
    if (state.installed[fp] && !force) {
      console.log(c.dim(t("packs.alreadyDone", { name: base })));
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
          console.log(c.dim(t("packs.dryRunExtract", { name: base })));
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
        console.log(c.red(t("packs.noPackRoot", { name: base })));
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
              t("packs.installedEnabled", {
                kind: r.info.kind === "resource" ? "RP" : "BP",
                name: r.info.name,
                version: fmtVer(r.info.version),
              })
            )
          );
        } else if (r.skipped) {
          skipCount++;
        } else {
          failCount++;
          console.log(
            c.red(t("packs.installFailed", { name: path.basename(root), reason: r.reason ?? "?" }))
          );
        }
      }

      installed += okCount > 0 ? 1 : 0;
      skipped += skipCount;
      failed += failCount;

      if (okCount > 0) {
        state.installed[fp] = { uuid: lastUuid, at: new Date().toISOString(), folderName: base };
        writeState(state);
        moveTo(src, doneDir(), base);
        console.log(c.yellow(`[packs] ${restartHint()}`));
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
  if (packs.length === 0) return c.dim(t("packs.listEmpty"));
  const lines: string[] = [];
  const bp = packs.filter((p) => p.kind === "behavior");
  const rp = packs.filter((p) => p.kind === "resource");
  if (bp.length) {
    lines.push(c.bold(t("packs.list.bpHeader")));
    for (const p of bp) {
      const en = p.enabled ? c.green(t("packs.list.on")) : c.dim(t("packs.list.off"));
      const src = bindingLabelForUuid(p.uuid);
      lines.push(
        `  [${en}] ${p.folderName}  ${p.name}  v${fmtVer(p.version)}  ${c.dim(p.uuid)}  ${c.dim(src)}`
      );
    }
  }
  if (rp.length) {
    lines.push(c.bold(t("packs.list.rpHeader")));
    for (const p of rp) {
      const en = p.enabled ? c.green(t("packs.list.on")) : c.dim(t("packs.list.off"));
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
    // 经 listWorldEnableListResult → pack-manager（DRY/Demeter；保留 parseFail 信号 — LSP）
    const snap = listWorldEnableListResult(bdsRoot, levelName, kind);
    if (snap.parseFailedFile) {
      issues.push(t("packs.doctor.parseFail", { file: path.basename(snap.parseFailedFile) }));
    }
    const byUuid = new Map(packs.filter((p) => p.kind === kind).map((p) => [p.uuid, p]));
    for (const e of snap.entries) {
      const p = byUuid.get(e.pack_id);
      if (!p) {
        issues.push(t("packs.doctor.missingDir", { kind, uuid: e.pack_id }));
        continue;
      }
      const ev = e.version;
      if (
        Array.isArray(ev) &&
        ev.length >= 3 &&
        (ev[0] !== p.version[0] || ev[1] !== p.version[1] || ev[2] !== p.version[2])
      ) {
        issues.push(
          t("packs.doctor.versionMismatch", {
            kind,
            folder: p.folderName,
            listVer: ev.join("."),
            diskVer: fmtVer(p.version),
          })
        );
      }
    }
  }

  for (const p of packs) {
    if (!p.enabled) {
      issues.push(
        t("packs.doctor.notEnabled", {
          kind: p.kind === "resource" ? "RP" : "BP",
          folder: p.folderName,
          uuid: p.uuid,
        })
      );
    }
  }

  if (issues.length === 0) return c.green(t("packs.doctor.ok"));
  return t("packs.doctor.found", {
    count: issues.length,
    list: issues.map((x) => `  - ${x}`).join("\n"),
  });
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
        if (!q) return c.yellow(t("packs.search.usage"));
        return await searchRemote(q);
      }
      case "bind": {
        const packId = args[0];
        const ref = args[1];
        if (!packId || !ref) return c.yellow(t("packs.bind.usage"));
        return await bindPackSource(packId, ref);
      }
      case "unbind": {
        const packId = args[0];
        if (!packId) return c.yellow(t("packs.unbind.usage"));
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = listInstalledWorldPacks(bdsRoot, levelName);
        const pack = findInstalledPackById(packs, packId);
        const uuid = pack?.uuid ?? packId;
        const ok = removeBinding(uuid);
        return ok
          ? c.green(t("packs.unbindOk", { uuid, path: packSourcesPath() }))
          : c.yellow(t("packs.unbindMiss", { id: packId }));
      }
      case "sources":
        return formatSourcesList();
      case "check": {
        const id = args.find((a) => !a.startsWith("-"));
        return await checkPackUpdates({ ...(id ? { packId: id } : {}), apply: false });
      }
      case "update": {
        const all = hasFlag(args, "--all");
        const id = args.find((a) => !a.startsWith("-") && a !== "--all");
        if (!all && !id) return c.yellow(t("packs.update.usage"));
        return await checkPackUpdates({
          ...(id ? { packId: id } : {}),
          apply: true,
        });
      }
      case "enable":
      case "disable": {
        const id = args[0];
        if (!id) return c.yellow(t("packs.toggle.usage", { verb }));
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = listInstalledWorldPacks(bdsRoot, levelName);
        const pack = findInstalledPackById(packs, id);
        if (!pack) return c.red(t("packs.notFound", { id }));
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
        return c.green(t("packs.toggleDone", { verb, folder: pack.folderName, hint: restartHint() }));
      }
      case "uninstall": {
        const ids = args.filter((a) => !a.startsWith("-"));
        const purge = hasFlag(args, "--purge");
        const noPaired = hasFlag(args, "--no-paired");
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = listInstalledWorldPacks(bdsRoot, levelName);

        let selected: InstalledWorldPack[] = [];
        if (ids.length === 0) {
          if (!process.stdin.isTTY) return c.yellow(t("packs.uninstall.usage"));
          const picked = await pickPacksForUninstall(packs);
          if (picked === null) return c.dim(t("packs.uninstall.cancelled"));
          if (picked.length === 0) return c.yellow(t("packs.uninstall.none"));
          selected = picked;
        } else if (ids.length === 1) {
          /* 单 id：受保护主包直接中止（与 #72 LSP 一致，不进批量确认） */
          const pack = findInstalledPackById(packs, ids[0]!);
          if (!pack) return c.red(t("packs.notFound", { id: ids[0]! }));
          if (isProtectedSfmcPack(pack)) {
            return c.red(t("packs.uninstall.protected", { folder: pack.folderName }));
          }
          selected = [pack];
        } else {
          const missing: string[] = [];
          const byUuid = new Map<string, InstalledWorldPack>();
          for (const id of ids) {
            const pack = findInstalledPackById(packs, id);
            if (!pack) {
              missing.push(id);
              continue;
            }
            byUuid.set(pack.uuid.toLowerCase(), pack);
          }
          if (missing.length) {
            return c.red(t("packs.notFound", { id: missing.join(", ") }));
          }
          selected = [...byUuid.values()];
        }

        return await uninstallPacksBatch(selected, packs, {
          bdsRoot,
          levelName,
          purge,
          noPaired,
          /* 多选或一次卸多个时确认；单 id 保持原「直接卸」手感 */
          askConfirm: ids.length !== 1,
        });
      }
      case "bump": {
        const id = args[0];
        if (!id) return c.yellow(t("packs.bump.usage"));
        const { bdsRoot, levelName } = resolveBdsContext();
        const packs = listInstalledWorldPacks(bdsRoot, levelName);
        const pack = findInstalledPackById(packs, id);
        if (!pack) return c.red(t("packs.notFound", { id }));
        if (pack.kind !== "resource") {
          return c.red(t("packs.bump.rpOnly"));
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
          t("packs.bumped", {
            folder: pack.folderName,
            version: fmtVer(next),
            restart: restartHint(),
            rejoin: rejoinHint(),
          })
        );
      }
      case "install": {
        const force = hasFlag(args, "--force");
        const inbox = hasFlag(args, "--inbox") || args.length === 0 || args.every((a) => a.startsWith("-"));
        if (inbox) {
          const r = await scanAndInstallInbox({ force, interactive: true });
          return c.dim(
            t("packs.installInbox", {
              installed: r.installed,
              skipped: r.skipped,
              failed: r.failed,
            })
          );
        }
        const target = args.find((a) => !a.startsWith("-"));
        if (!target) return c.yellow(t("packs.install.usage"));
        const abs = path.resolve(target);
        if (!fs.existsSync(abs)) return c.red(t("packs.pathMissing", { path: abs }));
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
            return c.red(t("packs.notArchive"));
          }
          if (roots.length === 0) return c.red(t("packs.noManifestRoot"));
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
                c.green(
                  t("packs.installedLine", {
                    name: r.info.name,
                    version: fmtVer(r.info.version),
                    kind: r.info.kind,
                  })
                )
              );
            } else {
              lines.push(
                c.yellow(
                  t("packs.skipFailLine", {
                    name: path.basename(root),
                    reason: r.reason ?? "?",
                  })
                )
              );
            }
          }
          lines.push(c.yellow(restartHint()));
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
          return c.dim(t("packs.inboxEmpty"));
        }
        return c.dim(
          t("packs.scanResult", {
            installed: r.installed,
            skipped: r.skipped,
            failed: r.failed,
          })
        );
      }
      case "doctor":
        return await cmdDoctor();
      case "path": {
        ensureInboxLayout();
        const { bdsRoot, levelName } = resolveBdsContext();
        return [
          `bdsRoot:     ${bdsRoot}`,
          `level:       ${levelName}`,
          `behavior:    ${worldPackParentDir(bdsRoot, levelName, "behavior")}`,
          `resource:    ${worldPackParentDir(bdsRoot, levelName, "resource")}`,
          `inbox:       ${packsInboxDir()}`,
          `trash:       ${resolvePackTrashDir()}`,
          `build:       ${path.join(packsInboxDir(), "_build")}`,
          `sources:     ${packSourcesPath()}`,
        ].join("\n");
      }
      default:
        return c.red(t("packs.unknownSub", { verb })) + packsUsage();
    }
  } catch (e) {
    return c.red((e as Error).message);
  }
}

export function packsUsage(): string {
  return `${t("packs.usage.title", { cmd: c.bold("sfmc packs"), alias: c.green("addon") })}

  ${c.green("packs list")} [--kind bp|rp|all] [--search q]
  ${c.green("packs search")} <q>           ${t("packs.usage.cfSearch")}
  ${c.green("packs bind")} <id> <project|slug|url>
  ${c.green("packs unbind")} <id>
  ${c.green("packs sources")}
  ${c.green("packs check")} [id]
  ${c.green("packs update")} <id|--all>
  ${c.green("packs enable|disable")} <uuid|folder>
  ${c.green("packs uninstall")} [id...] [--purge] [--no-paired]
  ${c.green("packs bump")} <id>          ${t("packs.usage.bump")}
  ${c.green("packs install")} [path|--inbox] [--force]
  ${c.green("packs scan")} [--force] [--dry-run]
  ${c.green("packs doctor")}
  ${c.green("packs path")}

${t("packs.usage.inbox", { path: packsInboxDir() })}
${t("packs.usage.trash", { path: resolvePackTrashDir() })}
${t("packs.usage.sources", { path: packSourcesPath() })}
${t("packs.usage.enableNote", { hint: restartHint() })}
${t("packs.usage.moduleNote", { cmd: c.green("sfmc mod") })}`;
}
