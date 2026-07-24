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
import { ensurePackUpdateConfigFile, loadPackUpdateConfig, packUpdateConfigPath } from "./config.js";
import { CurseForgeBedrockProvider } from "./providers/curseforge.js";
import type { PackSourceBinding, PackUpdateConfig, SemVer3, SourceSearchHit } from "./types.js";
import { decideVersionPolicy, buildSearchQueries, buildSearchQueriesFromSources, packSourceScore } from "./version-policy.js";

function logPack(text: string, level: "info" | "warn" | "error" | "success" = "info"): void {
  pushLog(text, "pack", level);
}

function getProvider(cfg: PackUpdateConfig): CurseForgeBedrockProvider {
  return new CurseForgeBedrockProvider(cfg.providers.curseforge);
}

function fmtVer(v: SemVer3): string {
  return v.join(".");
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
  const provider = getProvider(cfg);
  if (!provider.isConfigured()) {
    logPack(t("packUpdate.needKey", { path: packUpdateConfigPath() }), "warn");
    return;
  }

  const strip = cfg.providers.curseforge.match.stripFolderTags;
  /* header 常本地化；文件夹名往往含拉丁核心 — 两源分别派生再合并，有拉丁则不搜纯中文 */
  const folderName =
    (opts.folderName && String(opts.folderName).trim()) ||
    (opts.packDir ? path.basename(opts.packDir) : "");
  const plan = buildSearchQueriesFromSources(
    [
      { id: "header", raw: opts.info.name },
      { id: "folder", raw: folderName },
    ],
    strip
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

  const byId = new Map<number, SourceSearchHit>();
  try {
    for (const q of queries) {
      const hits = await provider.search(q);
      for (const h of hits) byId.set(h.projectId, h);
    }
  } catch (e) {
    logPack(t("packUpdate.probeFail", { message: (e as Error).message }), "warn");
    return;
  }

  const hitList = [...byId.values()];
  if (hitList.length === 0) {
    logPack(t("packUpdate.probeMiss", { name: queries.join(", ") }), "info");
    return;
  }

  const primary = queries.find((q) => /[A-Za-z]/.test(q)) ?? queries[0]!;
  const scored = hitList
    .map((h) => ({
      hit: h,
      score: Math.max(...queries.map((q) => packSourceScore(q, h, strip))),
    }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0]!;
  const minScore = cfg.providers.curseforge.match.nameMinScore;
  if (best.score < minScore) {
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
    logPack(t("packUpdate.probeAutoBind", { slug: best.hit.slug, path: packSourcesPath() }), "info");
  }

  if (!accept) {
    logPack(t("packUpdate.bindSkipped"), "info");
    return;
  }

  const paired = (opts.packDir ? pairedRpUuidFromBpDir(opts.packDir) : null) ?? null;
  const binding: PackSourceBinding = {
    enabled: true,
    provider: "curseforge",
    projectId: best.hit.projectId,
    slug: best.hit.slug,
    websiteUrl: best.hit.websiteUrl,
    pairedResourceUuid: paired,
    lastFileId: null,
    lastCheckedAt: null,
    lastAppliedFileId: null,
  };
  setBinding(opts.info.uuid, binding);
  logPack(
    t("packUpdate.bindOk", {
      uuid: opts.info.uuid,
      slug: best.hit.slug,
      path: packSourcesPath(),
    }),
    "success"
  );
}

export async function searchRemote(query: string): Promise<string> {
  const cfg = loadPackUpdateConfig();
  const provider = getProvider(cfg);
  if (!provider.isConfigured()) {
    return c.yellow(t("packUpdate.needKey", { path: packUpdateConfigPath() }));
  }
  const strip = cfg.providers.curseforge.match.stripFolderTags;
  const queries = buildSearchQueries(query, strip);
  const byId = new Map<number, SourceSearchHit>();
  for (const q of queries) {
    const hits = await provider.search(q);
    for (const h of hits) byId.set(h.projectId, h);
  }
  const hitList = [...byId.values()];
  if (hitList.length === 0) return c.dim(t("packUpdate.searchEmpty", { query }));
  const ranked = hitList
    .map((h) => ({
      h,
      score: Math.max(...queries.map((q) => packSourceScore(q, h, strip))),
    }))
    .sort((a, b) => b.score - a.score);
  return ranked
    .map(
      ({ h, score }, i) =>
        `${c.cyan(String(i + 1).padStart(2))}. ${h.name}  ${c.dim(`id=${h.projectId} slug=${h.slug} score=${score.toFixed(2)}`)}\n    ${h.websiteUrl}`
    )
    .join("\n");
}

export async function bindPackSource(packId: string, ref: string): Promise<string> {
  const cfg = loadPackUpdateConfig();
  const provider = getProvider(cfg);
  if (!provider.isConfigured()) {
    return c.yellow(t("packUpdate.needKey", { path: packUpdateConfigPath() }));
  }
  const { bdsRoot, levelName } = resolveBdsContext();
  const packs = listInstalledWorldPacks(bdsRoot, levelName);
  const pack = findInstalledPackById(packs, packId);
  if (!pack) return c.red(t("packs.notFound", { id: packId }));
  if (pack.kind !== "behavior") return c.red(t("packUpdate.bindBpOnly"));

  const hit = await provider.resolveProject(ref);
  if (!hit) return c.red(t("packUpdate.resolveFail", { ref }));

  const paired = pairedRpUuidFromBpDir(pack.dir);
  setBinding(pack.uuid, {
    enabled: true,
    provider: "curseforge",
    projectId: hit.projectId,
    slug: hit.slug,
    websiteUrl: hit.websiteUrl,
    pairedResourceUuid: paired,
    lastFileId: getBinding(pack.uuid)?.lastFileId ?? null,
    lastCheckedAt: null,
    lastAppliedFileId: getBinding(pack.uuid)?.lastAppliedFileId ?? null,
  });
  return c.green(t("packUpdate.bindOk", { uuid: pack.uuid, slug: hit.slug, path: packSourcesPath() }));
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
    lines.push(`  [${en}] ${bpUuid}  cf:${binding.slug || binding.projectId}  ${c.dim(binding.websiteUrl || "")}`);
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
  archivePath?: string;
}

function withLocalBp(base: Omit<CheckResult, "localBp">, localBp: InstalledWorldPack | undefined): CheckResult {
  return localBp ? { ...base, localBp } : { ...base };
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
  const provider = getProvider(cfg);

  binding.lastCheckedAt = new Date().toISOString();
  setBinding(bpUuid, binding);

  if (!binding.enabled) {
    return withLocalBp(
      {
        bpUuid,
        name,
        localVer,
        remoteVer: null,
        updateAvailable: false,
        majorHigher: false,
        shouldBumpRp: false,
        fileId: null,
        message: t("packUpdate.bindingDisabled"),
        binding,
      },
      localBp
    );
  }

  const file = await provider.getLatestFile(binding.projectId);
  if (!file) {
    return withLocalBp(
      {
        bpUuid,
        name,
        localVer,
        remoteVer: null,
        updateAvailable: false,
        majorHigher: false,
        shouldBumpRp: false,
        fileId: null,
        message: t("packUpdate.noRemoteFile"),
        binding,
      },
      localBp
    );
  }

  if (!downloadArchive) {
    /* 仅文件 id 比较的轻量检查 */
    const updateAvailable = binding.lastAppliedFileId == null || binding.lastAppliedFileId !== file.fileId;
    return withLocalBp(
      {
        bpUuid,
        name,
        localVer,
        remoteVer: null,
        updateAvailable,
        majorHigher: false,
        shouldBumpRp: false,
        fileId: file.fileId,
        message: updateAvailable
          ? t("packUpdate.fileNewer", { file: file.fileName, id: String(file.fileId) })
          : t("packUpdate.upToDate"),
        binding,
      },
      localBp
    );
  }

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-pack-upd-"));
  const archivePath = path.join(staging, file.fileName || "pack.zip");
  await provider.download(file, archivePath);
  const tempDir = await extractArchiveToTemp(archivePath);
  const roots = discoverPackRoots(tempDir, { maxDepth: 3 });
  const bpRoot = roots.find((r) => readPackManifestInfo(r)?.kind === "behavior");
  const remoteBpInfo = bpRoot ? readPackManifestInfo(bpRoot) : null;
  if (!remoteBpInfo) {
    try {
      fs.rmSync(staging, { recursive: true, force: true });
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    return withLocalBp(
      {
        bpUuid,
        name,
        localVer,
        remoteVer: null,
        updateAvailable: false,
        majorHigher: false,
        shouldBumpRp: false,
        fileId: file.fileId,
        message: t("packUpdate.remoteNoBp"),
        binding,
      },
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
      archivePath: staging,
    },
    localBp
  );
}

function cleanupCheck(r: CheckResult): void {
  for (const d of [r.tempDir, r.archivePath]) {
    if (!d) continue;
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
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

  /* 安装配对 RP */
  let rpInfo: PackManifestInfo | null = null;
  let rpDir: string | null = null;
  const wantRp = r.binding.pairedResourceUuid?.toLowerCase();
  for (const root of rpRoots) {
    const info = readPackManifestInfo(root);
    if (!info) continue;
    if (wantRp && info.uuid.toLowerCase() !== wantRp) continue;
    const rpDest = worldPackParentDir(bdsRoot, levelName, "resource");
    const rpInstall = await installPackDirectory({
      srcDir: root,
      destParent: rpDest,
      force: true,
      ...(oldRp?.folderName ? { folderName: oldRp.folderName } : {}),
    });
    if (rpInstall.ok && rpInstall.info && rpInstall.destDir) {
      rpInfo = rpInstall.info;
      rpDir = rpInstall.destDir;
      break;
    }
  }

  /* 若 binding 无 paired，尝试从新 BP dependency 安装 */
  if (!rpInfo && rpRoots.length > 0) {
    const deps = readPackDependencyUuids(bpInstall.destDir);
    for (const root of rpRoots) {
      const info = readPackManifestInfo(root);
      if (!info) continue;
      if (deps.length && !deps.some((d) => d.toLowerCase() === info.uuid.toLowerCase())) continue;
      const rpDest = worldPackParentDir(bdsRoot, levelName, "resource");
      const rpInstall = await installPackDirectory({
        srcDir: root,
        destParent: rpDest,
        force: true,
      });
      if (rpInstall.ok && rpInstall.info && rpInstall.destDir) {
        rpInfo = rpInstall.info;
        rpDir = rpInstall.destDir;
        r.binding.pairedResourceUuid = info.uuid;
        break;
      }
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
  const provider = getProvider(cfg);
  if (!provider.isConfigured()) {
    return c.yellow(t("packUpdate.needKey", { path: packUpdateConfigPath() }));
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
  return `src=cf:${b.slug || b.projectId}`;
}
