/**
 * CurseForge Bedrock SourceProvider
 *
 * - 官方 api.curseforge.com：getMod / files / download（需 Studios x-api-key）
 * - 搜索：优先官方；若 403 则回退 api.curse.tools（部分 key 对 /v1/mods/search 被拒）
 * - Bedrock gameId = 78022，Addons classId = 4984
 * - 下载走 bds-tools httpDownload（流式落盘，与 BDS 更新同一权威 — DRY/DIP）
 */
import { httpDownload } from "@sfmc-bds/bds-tools/http";
import { bindByteProgressToBar, createTerminalProgress } from "@sfmc-bds/sdk/logs";
import type {
  CurseForgeProviderConfig,
  PackReleaseType,
  PackSourceProvider,
  SourceFileRef,
  SourceSearchHit,
} from "../types.js";

interface CfMod {
  id: number;
  name: string;
  slug: string;
  summary?: string;
  downloadCount?: number;
  links?: { websiteUrl?: string };
  classId?: number;
  /** 作者是否允许第三方/API 分发；false 时 files[].downloadUrl 恒为 null */
  allowModDistribution?: boolean;
}

interface CfFile {
  id: number;
  displayName: string;
  fileName: string;
  downloadUrl?: string | null;
  fileDate?: string;
  releaseType?: number;
  fileStatus?: number;
}

const RELEASE_MAP: Record<number, PackReleaseType> = {
  1: "release",
  2: "beta",
  3: "alpha",
};

/** 历史错误默认值 → 纠正为 Bedrock */
const LEGACY_BAD_GAME_IDS = new Set([459]);
const BEDROCK_GAME_ID = 78022;
const BEDROCK_ADDONS_CLASS_ID = 4984;
const DEFAULT_SEARCH_BASE = "https://api.curse.tools/v1/cf";

function releaseRank(t: PackReleaseType | undefined, preferred: PackReleaseType[]): number {
  if (!t) return 999;
  const i = preferred.indexOf(t);
  return i >= 0 ? i : 100 + (t === "release" ? 0 : t === "beta" ? 1 : 2);
}

function mapHits(mods: CfMod[]): SourceSearchHit[] {
  return (mods ?? []).map((m) => {
    const hit: SourceSearchHit = {
      provider: "curseforge",
      projectId: m.id,
      slug: m.slug,
      name: m.name,
      summary: m.summary ?? "",
      websiteUrl: m.links?.websiteUrl ?? `https://www.curseforge.com/minecraft-bedrock/addons/${m.slug}`,
    };
    if (typeof m.downloadCount === "number") hit.downloadCount = m.downloadCount;
    return hit;
  });
}

export class CurseForgeBedrockProvider implements PackSourceProvider {
  readonly id = "curseforge" as const;
  private classIdCache: number | null = null;

  constructor(private readonly cfg: CurseForgeProviderConfig) {}

  isConfigured(): boolean {
    return !!(this.cfg.enabled && this.cfg.apiKey?.trim());
  }

  private gameId(): number {
    const id = this.cfg.gameId;
    if (!id || LEGACY_BAD_GAME_IDS.has(id)) return BEDROCK_GAME_ID;
    return id;
  }

  private searchBase(): string {
    return (this.cfg.searchBaseUrl || DEFAULT_SEARCH_BASE).replace(/\/$/, "");
  }

  private officialBase(): string {
    return this.cfg.baseUrl.replace(/\/$/, "");
  }

  private headers(includeKey = true): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    if (includeKey && this.cfg.apiKey?.trim()) {
      h["x-api-key"] = this.cfg.apiKey.trim();
    }
    return h;
  }

  private looksLikeLegacyUploadToken(key: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key.trim());
  }

  private buildUrl(
    base: string,
    pathname: string,
    query: Record<string, string | number | undefined>
  ): URL {
    const url = new URL(`${base}${pathname.startsWith("/") ? pathname : `/${pathname}`}`);
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === "") continue;
      url.searchParams.set(k, String(v));
    }
    return url;
  }

  private async fetchJson<T>(
    base: string,
    pathname: string,
    query: Record<string, string | number | undefined>,
    opts?: { requireKey?: boolean; label?: string }
  ): Promise<T> {
    const requireKey = opts?.requireKey !== false;
    if (requireKey && !this.isConfigured()) {
      throw new Error("CurseForge API key 未配置（configs/pack-update.json 或 CURSEFORGE_API_KEY）");
    }
    const key = this.cfg.apiKey.trim();
    const url = this.buildUrl(base, pathname, query);
    const res = await fetch(url, { headers: this.headers(requireKey || !!key) });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (res.status === 403 && requireKey) {
        const hint = this.looksLikeLegacyUploadToken(key)
          ? "当前 key 像 legacy Upload UUID Token。请到 https://console.curseforge.com/ 申请 Studios Key。"
          : "若仅搜索失败：官方 /mods/search 可能对你的 key 返回 403（将自动改用 curse.tools）。其它接口仍需有效 Studios Key。";
        throw new Error(
          `CurseForge HTTP 403 (${opts?.label ?? pathname}): ${body.slice(0, 80).trim() || "Forbidden"} — ${hint}`
        );
      }
      throw new Error(`CurseForge HTTP ${res.status} (${opts?.label ?? pathname}): ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  /** 官方 Core API GET */
  private apiGet<T>(
    pathname: string,
    query: Record<string, string | number | undefined>
  ): Promise<T> {
    return this.fetchJson<T>(this.officialBase(), pathname, query, {
      requireKey: true,
      label: `official${pathname}`,
    });
  }

  async resolveClassId(): Promise<number | null> {
    if (this.cfg.classId != null) return this.cfg.classId;
    if (this.classIdCache != null) return this.classIdCache;
    try {
      const data = await this.apiGet<{ data: Array<{ id: number; name: string; isClass?: boolean }> }>(
        "/v1/categories",
        { gameId: this.gameId(), classesOnly: "true" }
      );
      const hit =
        data.data?.find((c) => /^addons?$/i.test(c.name)) ??
        data.data?.find((c) => /addon/i.test(c.name));
      this.classIdCache = hit?.id ?? BEDROCK_ADDONS_CLASS_ID;
      return this.classIdCache;
    } catch {
      this.classIdCache = BEDROCK_ADDONS_CLASS_ID;
      return this.classIdCache;
    }
  }

  async search(query: string): Promise<SourceSearchHit[]> {
    const classId = (await this.resolveClassId()) ?? BEDROCK_ADDONS_CLASS_ID;
    const q = {
      gameId: this.gameId(),
      classId,
      searchFilter: query,
      pageSize: this.cfg.pageSize,
      sortField: 2,
      sortOrder: "desc",
    };

    /* 1) 官方搜索（部分 Studios key 会对 /mods/search 恒 403） */
    try {
      const data = await this.apiGet<{ data: CfMod[] }>("/v1/mods/search", q);
      return mapHits(data.data ?? []);
    } catch (e) {
      const msg = (e as Error).message || "";
      if (!/HTTP 403/.test(msg)) throw e;
    }

    /* 2) curse.tools 镜像（与官方同路径约定） */
    const data = await this.fetchJson<{ data: CfMod[] }>(this.searchBase(), "/mods/search", q, {
      requireKey: false,
      label: "search-mirror",
    });
    return mapHits(data.data ?? []);
  }

  async resolveProject(ref: string | number): Promise<SourceSearchHit | null> {
    if (typeof ref === "number" || /^\d+$/.test(String(ref))) {
      const id = Number(ref);
      const data = await this.apiGet<{ data: CfMod }>(`/v1/mods/${id}`, {});
      const m = data.data;
      if (!m) return null;
      return mapHits([m])[0] ?? null;
    }
    const s = String(ref).trim();
    const urlMatch = s.match(/curseforge\.com\/minecraft-bedrock\/[^/]+\/([^/?#]+)/i);
    const slug = urlMatch?.[1] ?? s;
    const hits = await this.search(slug);
    return hits.find((h) => h.slug === slug) ?? hits[0] ?? null;
  }

  async getLatestFile(projectId: number): Promise<SourceFileRef | null> {
    const data = await this.apiGet<{ data: CfFile[] }>(`/v1/mods/${projectId}/files`, {
      pageSize: 50,
    });
    const files = [...(data.data ?? [])];
    files.sort((a, b) => {
      const ra = releaseRank(RELEASE_MAP[a.releaseType ?? 1], this.cfg.preferredReleaseTypes);
      const rb = releaseRank(RELEASE_MAP[b.releaseType ?? 1], this.cfg.preferredReleaseTypes);
      if (ra !== rb) return ra - rb;
      const da = a.fileDate ? Date.parse(a.fileDate) : 0;
      const db = b.fileDate ? Date.parse(b.fileDate) : 0;
      return db - da;
    });
    const best = files[0];
    if (!best) return null;
    let downloadUrl = best.downloadUrl ?? "";
    if (!downloadUrl) {
      try {
        const dl = await this.apiGet<{ data: string }>(
          `/v1/mods/${projectId}/files/${best.id}/download-url`,
          {}
        );
        downloadUrl = dl.data ?? "";
      } catch {
        /* 下方统一诊断 allowModDistribution */
      }
    }
    if (!downloadUrl) {
      /* 作者关闭第三方分发时 downloadUrl 为空且 download-url 恒 403 — 与 API key 无关 */
      let allowDist: boolean | undefined;
      let slug = String(projectId);
      try {
        const mod = await this.apiGet<{ data: CfMod }>(`/v1/mods/${projectId}`, {});
        allowDist = mod.data?.allowModDistribution;
        if (mod.data?.slug) slug = mod.data.slug;
      } catch {
        /* ignore */
      }
      if (allowDist === false) {
        throw new Error(
          `CurseForge「${slug}」作者关闭了第三方分发（allowModDistribution=false），API 无法下载。` +
            `请手动从 https://www.curseforge.com/minecraft-bedrock/addons/${slug} 下载后放入 packs/inbox，或联系作者开启分发。`
        );
      }
      throw new Error(
        `CurseForge 无法解析下载地址（project=${projectId} file=${best.id}）。` +
          `若官方页可下而此处失败，多半是作者限制了 API 分发。`
      );
    }
    const out: SourceFileRef = {
      provider: "curseforge",
      projectId,
      fileId: best.id,
      fileName: best.fileName,
      displayName: best.displayName,
      downloadUrl,
    };
    if (best.fileDate) out.fileDate = best.fileDate;
    const rt = RELEASE_MAP[best.releaseType ?? 1];
    if (rt) out.releaseType = rt;
    return out;
  }

  async download(
    file: SourceFileRef,
    destPath: string,
    onProgress?: (dl: number, total: number) => void
  ): Promise<void> {
    const bar = createTerminalProgress({
      stream: process.stderr,
      format: `下载 ${file.fileName} | {bar} | {percentage}% | {value}/{total} MB | {speed}`,
    });
    const onByteProgress = bindByteProgressToBar(bar, {
      speedSampleMs: 250,
      ...(onProgress ? { onProgress } : {}),
    });
    try {
      await httpDownload(file.downloadUrl, destPath, {
        headers: this.headers(true),
        onProgress: onByteProgress,
      });
    } finally {
      if (bar.active) bar.stop();
    }
  }
}
