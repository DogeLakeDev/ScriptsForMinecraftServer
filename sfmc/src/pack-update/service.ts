/**
 * pack-update 编排：探测绑定 / 检查 / 应用更新
 */
import { confirm, isCancel } from "@clack/prompts";
import {
  discoverPackRoots,
  enableInstalledPack,
  ensureVersionGreaterThan,
  extractArchiveToTemp,
  findInstalledPackById,
  installPackDirectory,
  listInstalledWorldPacks,
  readPackDependencyUuids,
  readPackManifestInfo,
  worldPackParentDir,
  type InstalledWorldPack,
  type PackManifestInfo,
} from "@sfmc-bds/bds-tools/world-packs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { t } from "../i18n/index.js";
import { pushLog } from "../logs.js";
import { resolveBdsContext } from "../pack-lifecycle.js";
import { c } from "../theme.js";
import { getBinding, listBindings, packSourcesPath, setBinding } from "./bindings.js";
import {
  ensurePackUpdateConfigFile,
  getPackMatchConfig,
  loadPackUpdateConfig,
  packUpdateConfigPath,
} from "./config.js";
import {
  createPackSourceProvider,
  providerShortLabel,
  resolveConfiguredPackProvider,
} from "./providers/index.js";
import type {
  PackSourceBinding,
  PackSourceProvider,
  PackUpdateConfig,
  SemVer3,
  SourceSearchHit,
} from "./types.js";
import {
  decideVersionPolicy,
  buildSearchQueries,
  buildSearchQueriesFromSources,
  packSourceScore,
} from "./version-policy.js";

function logPack(text: string, level: "info" | "warn" | "error" | "success" = "info"): void {
  pushLog(text, "pack", level);
}

function fmtVer(v: SemVer3): string {
  return v.join(".");
}

function bindingEnabledLabel(enabled: boolean): string {
  return enabled ? "on" : "off";
}

/** 未配置源时的统一文案（DRY：入口勿各自拼 needKey） */
function needKeyText(): string {
  return t("packUpdate.needKey", { path: packUpdateConfigPath() });
}

/** 多查询搜索 + 综合打分排序（probe / searchRemote 共用） */
async function searchAndRankHits(
  provider: PackSourceProvider,
  queries: string[],
  stripFolderTags: boolean
): Promise<Array<{ hit: SourceSearchHit; score: number }>> {
  const byId = new Map<number, SourceSearchHit>();
  for (const q of queries) {
    const hits = await provider.search(q);
    for (const h of hits) byId.set(h.projectId, h);
  }
  return [...byId.values()]
    .map((h) => ({
      hit: h,
      score: Math.max(...queries.map((q) => packSourceScore(q, h, stripFolderTags))),
    }))
    .sort((a, b) => b.score - a.score);
}

function makeBindingFromHit(
  hit: SourceSearchHit,
  pairedResourceUuid: string | null,
  opts?: { prev?: PackSourceBinding | null; defaultEnabled: boolean }
): PackSourceBinding {
  const prev = opts?.prev;
  return {
    /* 重绑保留原 enabled；新建走配置契约 defaultBindingEnabled（LSP） */
    enabled: prev?.enabled ?? opts?.defaultEnabled ?? false,
    provider: hit.provider,
    projectId: hit.projectId,
    slug: hit.slug,
    websiteUrl: hit.websiteUrl,
    pairedResourceUuid,
    lastFileId: prev?.lastFileId ?? null,
    lastCheckedAt: null,
    lastAppliedFileId: prev?.lastAppliedFileId ?? null,
  };
}

/** 从已安装 BP 提取配对 RP uuid */
export function pairedRpUuidFromBpDir(bpDir: string): string | null {
  const deps = readPackDependencyUuids(bpDir);
  return deps[0] ?? null;
}

export async function probeSourceAfterInstall(opts: {
  info: PackManifestInfo;
  packDir?: string;
  /** 安装后的文件夹名（优先于 basename(packDir)） */
  folderName?: string;
  interactive?: boolean;
}): Promise<void> {
  const cfg = loadPackUpdateConfig();
  if (!cfg.enabled || !cfg.probeSourceAfterInstall) return;
  if (opts.info.kind !== "behavior") return;

  ensurePackUpdateConfigFile();
  const provider = resolveConfiguredPackProvider(cfg);
  if (!provider) {
    logPack(needKeyText(), "warn");
    return;
  }

  const match = getPackMatchConfig(cfg);
  /* header 常本地化；文件夹名往往含拉丁核心 — 两源分别派生再合并，有拉丁则不搜纯中文 */
  const folderName =
    (opts.folderName && String(opts.folderName).trim()) ||
    (opts.packDir ? path.basename(opts.packDir) : "");
  const plan = buildSearchQueriesFromSources(
    [
      { id: "header", raw: opts.info.name },
      { id: "folder", raw: folderName },
    ],
    match.stripFolderTags
  );
  const queries = plan.queries;
  if (queries.length === 0) {
    logPack(t("packUpdate.probeNoName"), "warn");
    return;
  }

  logPack(
    t("packUpdate.probeQueries", {
      header: opts.info.name || "-",
      folder: folderName || "-",
      queries: queries.join(" | "),
    }),
    "info"
  );

  let scored: Array<{ hit: SourceSearchHit; score: number }>;
  try {
    scored = await searchAndRankHits(provider, queries, match.stripFolderTags);
  } catch (e) {
    logPack(t("packUpdate.probeFail", { message: (e as Error).message }), "warn");
    return;
  }

  if (scored.length === 0) {
    logPack(t("packUpdate.probeMiss", { name: queries.join(", ") }), "info");
    return;
  }

  const primary = queries.find((q) => /[A-Za-z]/.test(q)) ?? queries[0]!;
  const best = scored[0]!;
  if (best.score < match.nameMinScore) {
    logPack(
      t("packUpdate.probeLowScore", {
        name: primary,
        hit: `${best.hit.name} (${best.hit.slug})`,
        score: best.score.toFixed(2),
        url: best.hit.websiteUrl,
      }),
      "info"
    );
    return;
  }

  logPack(
    t("packUpdate.probeHit", {
      name: `${opts.info.name} / ${folderName || "-"}`,
      hit: `${best.hit.name} [${best.hit.slug}]`,
      url: best.hit.websiteUrl,
      score: best.score.toFixed(2),
    }),
    "success"
  );
  logPack(t("packUpdate.editHint", { path: packSourcesPath() }), "info");

  const interactive = opts.interactive ?? !!process.stdin.isTTY;
  let accept = false;
  if (interactive && cfg.askConfirmOnBind && process.stdin.isTTY) {
    const ans = await confirm({
      message: t("packUpdate.confirmBind", { hit: best.hit.name }),
      initialValue: true,
    });
    if (isCancel(ans)) return;
    accept = !!ans;
  } else {
    /* 非 TTY / BDS 收件箱 / askConfirmOnBind=false：命中即写入，避免探测成功却无 pack-sources.json */
    accept = true;
    logPack(
      t("packUpdate.probeAutoBind", {
        provider: providerShortLabel(best.hit.provider),
        slug: best.hit.slug,
        path: packSourcesPath(),
      }),
      "info"
    );
  }

  if (!accept) {
    logPack(t("packUpdate.bindSkipped"), "info");
    return;
  }

  const paired = (opts.packDir ? pairedRpUuidFromBpDir(opts.packDir) : null) ?? null;
  const binding = makeBindingFromHit(best.hit, paired, { defaultEnabled: cfg.defaultBindingEnabled });
  setBinding(opts.info.uuid, binding);
  logPack(
    t("packUpdate.bindOk", {
      uuid: opts.info.uuid,
      provider: providerShortLabel(best.hit.provider),
      slug: best.hit.slug,
      enabled: bindingEnabledLabel(binding.enabled),
      path: packSourcesPath(),
    }),
    "success"
  );
}

export async function searchRemote(query: string): Promise<string> {
  const cfg = loadPackUpdateConfig();
  const provider = resolveConfiguredPackProvider(cfg);
  if (!provider) {
    return c.yellow(needKeyText());
  }
  const match = getPackMatchConfig(cfg);
  const queries = buildSearchQueries(query, match.stripFolderTags);
  const ranked = await searchAndRankHits(provider, queries, match.stripFolderTags);
  if (ranked.length === 0) return c.dim(t("packUpdate.searchEmpty", { query }));
  return ranked
    .map(
      ({ hit: h, score }, i) =>
        `${c.cyan(String(i + 1).padStart(2))}. ${h.name}  ${c.dim(`id=${h.projectId} slug=${h.slug} score=${score.toFixed(2)}`)}\n    ${h.websiteUrl}`
    )
    .join("\n");
}

export async function bindPackSource(packId: string, ref: string): Promise<string> {
  const cfg = loadPackUpdateConfig();
  const provider = resolveConfiguredPackProvider(cfg);
  if (!provider) {
    return c.yellow(needKeyText());
  }
  const { bdsRoot, levelName } = resolveBdsContext();
  const packs = listInstalledWorldPacks(bdsRoot, levelName);
  const pack = findInstalledPackById(packs, packId);
  if (!pack) return c.red(t("packs.notFound", { id: packId }));
  if (pack.kind !== "behavior") return c.red(t("packUpdate.bindBpOnly"));

  const hit = await provider.resolveProject(ref);
  if (!hit) return c.red(t("packUpdate.resolveFail", { ref }));

  const paired = pairedRpUuidFromBpDir(pack.dir);
  const binding = makeBindingFromHit(hit, paired, {
    prev: getBinding(pack.uuid),
    defaultEnabled: cfg.defaultBindingEnabled,
  });
  setBinding(pack.uuid, binding);
  return c.green(
    t("packUpdate.bindOk", {
      uuid: pack.uuid,
      provider: providerShortLabel(hit.provider),
      slug: hit.slug,
      enabled: bindingEnabledLabel(binding.enabled),
      path: packSourcesPath(),
    })
  );
}

export function formatSourcesList(): string {
  ensurePackUpdateConfigFile();
  const bindings = listBindings();
  const lines = [
    t("packUpdate.sourcesHeader", {
      config: packUpdateConfigPath(),
      sources: packSourcesPath(),
    }),
  ];
  if (bindings.length === 0) {
    lines.push(c.dim(t("packUpdate.sourcesEmpty")));
    return lines.join("\n");
  }
  for (const { bpUuid, binding } of bindings) {
    const en = binding.enabled ? c.green("on") : c.red("off");
    const tag = providerShortLabel(binding.provider);
    lines.push(
      `  [${en}] ${bpUuid}  ${tag}:${binding.slug || binding.projectId}  ${c.dim(binding.websiteUrl || "")}`
    );
  }
  return lines.join("\n");
}

interface CheckResult {
  bpUuid: string;
  name: string;
  localVer: SemVer3;
  remoteVer: SemVer3 | null;
  updateAvailable: boolean;
  majorHigher: boolean;
  shouldBumpRp: boolean;
  fileId: number | null;
  message: string;
  binding: PackSourceBinding;
  localBp?: InstalledWorldPack;
  remoteBpInfo?: PackManifestInfo;
  remoteRoots?: string[];
  tempDir?: string;
  /** 下载归档所在的临时 staging 目录（非 zip 文件路径） */
  stagingDir?: string;
}

function withLocalBp(base: Omit<CheckResult, "localBp">, localBp: InstalledWorldPack | undefined): CheckResult {
  return localBp ? { ...base, localBp } : { ...base };
}

function baseCheckFields(
  bpUuid: string,
  name: string,
  localVer: SemVer3,
  binding: PackSourceBinding,
  extras: Partial<CheckResult> & { message: string }
): Omit<CheckResult, "localBp"> {
  return {
    bpUuid,
    name,
    localVer,
    remoteVer: null,
    updateAvailable: false,
    majorHigher: false,
    shouldBumpRp: false,
    fileId: null,
    binding,
    ...extras,
  };
}

async function prepareCheck(
  bpUuid: string,
  binding: PackSourceBinding,
  cfg: PackUpdateConfig,
  packs: InstalledWorldPack[],
  downloadArchive: boolean
): Promise<CheckResult> {
  const localBp = packs.find((p) => p.uuid.toLowerCase() === bpUuid.toLowerCase() && p.kind === "behavior");
  const name = localBp?.name ?? bpUuid;
  const localVer: SemVer3 = localBp?.version ?? [0, 0, 0];
  const provider = createPackSourceProvider(cfg, binding.provider);

  binding.lastCheckedAt = new Date().toISOString();
  setBinding(bpUuid, binding);

  if (!binding.enabled) {
    return withLocalBp(
      baseCheckFields(bpUuid, name, localVer, binding, { message: t("packUpdate.bindingDisabled") }),
      localBp
    );
  }

  const file = await provider.getLatestFile(binding.projectId);
  if (!file) {
    return withLocalBp(
      baseCheckFields(bpUuid, name, localVer, binding, { message: t("packUpdate.noRemoteFile") }),
      localBp
    );
  }

  if (!downloadArchive) {
    /* 仅文件 id 比较的轻量检查 */
    const updateAvailable = binding.lastAppliedFileId == null || binding.lastAppliedFileId !== file.fileId;
    return withLocalBp(
      baseCheckFields(bpUuid, name, localVer, binding, {
        updateAvailable,
        fileId: file.fileId,
        message: updateAvailable
          ? t("packUpdate.fileNewer", { file: file.fileName, id: String(file.fileId) })
          : t("packUpdate.upToDate"),
      }),
      localBp
    );
  }

  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-pack-upd-"));
  const archiveFile = path.join(stagingDir, file.fileName || "pack.zip");
  await provider.download(file, archiveFile);
  const tempDir = await extractArchiveToTemp(archiveFile);
  const roots = discoverPackRoots(tempDir, { maxDepth: 3 });
  const bpRoot = roots.find((r) => readPackManifestInfo(r)?.kind === "behavior");
  const remoteBpInfo = bpRoot ? readPackManifestInfo(bpRoot) : null;
  if (!remoteBpInfo) {
    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return withLocalBp(
      baseCheckFields(bpUuid, name, localVer, binding, {
        fileId: file.fileId,
        message: t("packUpdate.remoteNoBp"),
      }),
      localBp
    );
  }

  const decision = decideVersionPolicy(localVer, remoteBpInfo.version, cfg.versionPolicy);
  return withLocalBp(
    {
      bpUuid,
      name,
      localVer,
      remoteVer: remoteBpInfo.version,
      updateAvailable: decision.remoteNewer,
      majorHigher: decision.majorHigher,
      shouldBumpRp: decision.shouldBumpRp,
      fileId: file.fileId,
      message: decision.remoteNewer
        ? t("packUpdate.bpNewer", {
            local: fmtVer(localVer),
            remote: fmtVer(remoteBpInfo.version),
          })
        : t("packUpdate.upToDate"),
      binding,
      remoteBpInfo,
      remoteRoots: roots,
      tempDir,
      stagingDir,
    },
    localBp
  );
}

function cleanupCheck(r: CheckResult): void {
  for (const d of [r.tempDir, r.stagingDir]) {
    if (!d) continue;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

/** 尝试安装配对 RP；accept 为过滤谓词（DRY：两处循环合一） */
async function tryInstallResourcePack(opts: {
  rpRoots: string[];
  bdsRoot: string;
  levelName: string;
  folderName?: string;
  accept: (info: PackManifestInfo) => boolean;
}): Promise<{ info: PackManifestInfo; destDir: string } | null> {
  for (const root of opts.rpRoots) {
    const info = readPackManifestInfo(root);
    if (!info || !opts.accept(info)) continue;
    const rpDest = worldPackParentDir(opts.bdsRoot, opts.levelName, "resource");
    const rpInstall = await installPackDirectory({
      srcDir: root,
      destParent: rpDest,
      force: true,
      ...(opts.folderName ? { folderName: opts.folderName } : {}),
    });
    if (rpInstall.ok && rpInstall.info && rpInstall.destDir) {
      return { info: rpInstall.info, destDir: rpInstall.destDir };
    }
  }
  return null;
}

async function applyUpdate(r: CheckResult, cfg: PackUpdateConfig): Promise<string> {
  if (!r.updateAvailable || !r.remoteRoots || !r.remoteBpInfo) {
    return r.message;
  }
  const { bdsRoot, levelName } = resolveBdsContext();
  const packs = listInstalledWorldPacks(bdsRoot, levelName);

  const oldRp =
    r.binding.pairedResourceUuid != null
      ? packs.find((p) => p.kind === "resource" && p.uuid.toLowerCase() === r.binding.pairedResourceUuid!.toLowerCase())
      : undefined;
  const oldRpVer: SemVer3 = oldRp?.version ?? [0, 0, 0];

  const bpRoot = r.remoteRoots.find((x) => readPackManifestInfo(x)?.kind === "behavior");
  const rpRoots = r.remoteRoots.filter((x) => readPackManifestInfo(x)?.kind === "resource");

  if (!bpRoot) return t("packUpdate.remoteNoBp");

  /* 安装 BP */
  const bpDest = worldPackParentDir(bdsRoot, levelName, "behavior");
  const bpInstall = await installPackDirectory({
    srcDir: bpRoot,
    destParent: bpDest,
    force: true,
    ...(r.localBp?.folderName ? { folderName: r.localBp.folderName } : {}),
  });
  if (!bpInstall.ok || !bpInstall.info || !bpInstall.destDir) {
    return t("packUpdate.installFail", { reason: bpInstall.reason ?? "?" });
  }
  await enableInstalledPack({ bdsRoot, levelName, info: bpInstall.info });

  /* 安装配对 RP：先按 binding uuid，再按新 BP dependencies */
  let rpInfo: PackManifestInfo | null = null;
  let rpDir: string | null = null;
  const wantRp = r.binding.pairedResourceUuid?.toLowerCase();
  const installed = await tryInstallResourcePack({
    rpRoots,
    bdsRoot,
    levelName,
    ...(oldRp?.folderName ? { folderName: oldRp.folderName } : {}),
    accept: (info) => !wantRp || info.uuid.toLowerCase() === wantRp,
  });
  if (installed) {
    rpInfo = installed.info;
    rpDir = installed.destDir;
  }

  if (!rpInfo && rpRoots.length > 0) {
    const deps = readPackDependencyUuids(bpInstall.destDir);
    const fallback = await tryInstallResourcePack({
      rpRoots,
      bdsRoot,
      levelName,
      accept: (info) =>
        deps.length === 0 || deps.some((d) => d.toLowerCase() === info.uuid.toLowerCase()),
    });
    if (fallback) {
      rpInfo = fallback.info;
      rpDir = fallback.destDir;
      r.binding.pairedResourceUuid = fallback.info.uuid;
    }
  }

  if (rpInfo && rpDir && r.shouldBumpRp) {
    const next = ensureVersionGreaterThan(rpDir, oldRpVer, cfg.versionPolicy.rpBumpComponent);
    rpInfo = { ...rpInfo, version: next };
  }

  if (rpInfo) {
    await enableInstalledPack({ bdsRoot, levelName, info: rpInfo });
  }

  r.binding.lastAppliedFileId = r.fileId;
  r.binding.lastFileId = r.fileId;
  r.binding.lastCheckedAt = new Date().toISOString();
  setBinding(r.bpUuid, r.binding);

  return t("packUpdate.applied", {
    name: r.name,
    bp: fmtVer(bpInstall.info.version),
    rp: rpInfo ? fmtVer(rpInfo.version) : "-",
  });
}

export async function checkPackUpdates(opts?: { packId?: string; apply?: boolean }): Promise<string> {
  const cfg = loadPackUpdateConfig();
  if (!cfg.enabled) return c.dim(t("packUpdate.disabled"));
  /* 入口预检：任一已配置源即可；逐 binding 仍按 binding.provider 分派（LSP/OCP） */
  if (!resolveConfiguredPackProvider(cfg)) {
    return c.yellow(needKeyText());
  }

  const { bdsRoot, levelName } = resolveBdsContext();
  const packs = listInstalledWorldPacks(bdsRoot, levelName);
  let targets = listBindings();
  if (opts?.packId) {
    const pack = findInstalledPackById(packs, opts.packId);
    const uuid = pack?.uuid ?? opts.packId;
    targets = targets.filter((x) => x.bpUuid.toLowerCase() === uuid.toLowerCase());
    if (targets.length === 0) {
      const b = getBinding(uuid);
      if (b) targets = [{ bpUuid: uuid, binding: b }];
    }
    if (targets.length === 0) return c.red(t("packUpdate.noBinding", { id: opts.packId }));
  }

  if (targets.length === 0) return c.dim(t("packUpdate.sourcesEmpty"));

  const lines: string[] = [];
  for (const { bpUuid, binding } of targets) {
    if (cfg.startup.skipDisabledBindings && !binding.enabled && !opts?.packId) continue;
    let result: CheckResult | null = null;
    try {
      /* 始终下载归档并按 BP 版本比较 */
      result = await prepareCheck(bpUuid, binding, cfg, packs, true);
      if (opts?.apply && result.updateAvailable) {
        const msg = await applyUpdate(result, cfg);
        lines.push(c.green(msg));
      } else {
        lines.push(
          result.updateAvailable
            ? c.yellow(`${result.name}: ${result.message}`)
            : c.dim(`${result.name}: ${result.message}`)
        );
      }
    } catch (e) {
      lines.push(c.red(`${bpUuid}: ${(e as Error).message}`));
      if (cfg.startup.failMode === "abort") break;
    } finally {
      if (result) cleanupCheck(result);
    }
    if (cfg.startup.delayMsBetweenPacks > 0) {
      await new Promise((r) => setTimeout(r, cfg.startup.delayMsBetweenPacks));
    }
  }
  return lines.join("\n") || c.dim(t("packUpdate.sourcesEmpty"));
}

/** BDS 启动钩子：逐个检查并按配置应用 */
export async function runPackUpdatesOnBdsStart(): Promise<void> {
  const cfg = loadPackUpdateConfig();
  if (!cfg.enabled || !cfg.checkOnBdsStart) return;
  try {
    const out = await checkPackUpdates({ apply: cfg.applyOnBdsStart });
    if (out.trim()) logPack(out.replace(/\x1B\[[0-9;]*m/g, ""), "info");
  } catch (e) {
    logPack(t("packUpdate.startupFail", { message: (e as Error).message }), "warn");
  }
}

export function bindingLabelForUuid(uuid: string): string {
  const b = getBinding(uuid);
  if (!b) return "src=-";
  if (!b.enabled) return "src=off";
  return `src=${providerShortLabel(b.provider)}:${b.slug || b.projectId}`;
}
