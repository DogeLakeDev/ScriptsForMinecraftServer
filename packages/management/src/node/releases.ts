import type { ReleaseNotes } from "../protocol/methods.js";

const REPOSITORY = "DogeLakeDev/ScriptsForMinecraftServer";
const API = `https://api.github.com/repos/${REPOSITORY}/releases`;
const cache = new Map<string, { expires: number; notes: ReleaseNotes }>();
interface GithubRelease { tag_name: string; name?: string; body?: string | null; published_at?: string; draft: boolean; prerelease: boolean }
const releaseUrl = (tag: string) => `https://github.com/${REPOSITORY}/releases/tag/${encodeURIComponent(tag)}`;
function notesFor(release: GithubRelease, version: string): ReleaseNotes {
  const body = (release.body ?? "").trim().slice(0, 100_000);
  return { version, title: release.name || release.tag_name, body, url: releaseUrl(release.tag_name), status: body ? "available" : "empty", prerelease: release.prerelease, ...(release.published_at ? { publishedAt: release.published_at } : {}) };
}

/** 日志必须对应计划中的固定版本；网络故障不阻断版本检查和维护。 */
export async function platformReleaseNotes(version: string): Promise<ReleaseNotes> {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("非法平台版本");
  const tag = `@sfmc-bds/sfmc@${version}`;
  const saved = cache.get(tag);
  if (saved && saved.expires > Date.now()) return saved.notes;
  let notes: ReleaseNotes;
  try {
    const response = await fetch(`${API}/tags/${encodeURIComponent(tag)}`, { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(response.status === 404 ? "该版本尚未发布更新日志" : `更新日志读取失败 (${response.status})`);
    const release = await response.json() as GithubRelease;
    if (release.draft || release.prerelease || release.tag_name !== tag) throw new Error("未找到对应的正式平台发行记录");
    notes = notesFor(release, version);
  } catch (error) {
    notes = { version, title: `SFMC ${version}`, body: "", url: releaseUrl(tag), status: "unavailable", message: error instanceof Error ? error.message : "暂时无法读取更新日志" };
  }
  // 失败短缓存，避免轮询重复请求，同时允许稍后重试。
  cache.set(tag, { expires: Date.now() + (notes.status === "unavailable" ? 30_000 : 300_000), notes });
  return notes;
}

/** 桌面发行使用独立标签；预览客户端也能查看自己的发行日志。 */
export async function desktopReleaseNotes(includePreview: boolean): Promise<ReleaseNotes | undefined> {
  const signal = AbortSignal.timeout(15_000);
  const candidates: ReleaseNotes[] = [];
  for (let page = 1; page <= 5; page++) {
    const response = await fetch(`${API}?per_page=100&page=${page}`, { headers: { Accept: "application/vnd.github+json" }, signal });
    if (!response.ok) throw new Error(`桌面发行检查失败 (${response.status})`);
    const rows = await response.json() as GithubRelease[];
    for (const row of rows) {
      if (row.draft || (!includePreview && row.prerelease)) continue;
      const stable = /^desktop-v(\d+\.\d+\.\d+)$/.exec(row.tag_name);
      const preview = includePreview ? /^desktop-preview-v(\d+\.\d+\.\d+-preview\.\d+)$/.exec(row.tag_name) : null;
      const version = stable?.[1] ?? preview?.[1];
      if (version) candidates.push(notesFor(row, version));
    }
    if (rows.length < 100) break;
  }
  return candidates.sort((a, b) => compareReleaseVersions(b.version, a.version))[0];
}

/** 此处只比较上述正式标签与 preview.N 标签。 */
function compareReleaseVersions(a: string, b: string): number {
  const parts = (version: string) => version.split(/\.|-preview\./).map(Number);
  const left = parts(a); const right = parts(b);
  for (let index = 0; index < 3; index++) {
    const difference = left[index]! - right[index]!;
    if (difference) return difference;
  }
  if (left.length !== right.length) return left.length === 3 ? 1 : -1;
  return (left[3] ?? 0) - (right[3] ?? 0);
}
