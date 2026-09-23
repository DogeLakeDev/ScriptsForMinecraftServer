/** changelog.ts — 按 BDS 版本查找 Minecraft 官方更新日志。 */

import { parse as parseHtml } from "node-html-parser";
import { httpGetJson, httpRequest } from "./http.js";
import { log } from "./log.js";
import type { ChangelogPayload } from "./types.js";

const FEEDBACK_BASE = "https://feedback.minecraft.net";
const RELEASE_SECTION = "360001186971";
const PREVIEW_SECTION = "360001185332";

interface FeedbackArticle {
  title: string;
  html_url: string;
  body: string;
}

interface FeedbackPage {
  articles: FeedbackArticle[];
  next_page: string | null;
}

export function changelogSectionUrl(channel: string): string {
  const section = channel === "preview" ? PREVIEW_SECTION : RELEASE_SECTION;
  return `${FEEDBACK_BASE}/hc/en-us/sections/${section}`;
}

/** BDS 版本多一个构建号；正式版文章通常只写前三段，预览版需保留构建号。 */
function versionCandidates(version: string, channel: string): string[] {
  const parts = version.split(".");
  if (parts[0] === "1" && Number(parts[1]) >= 26) parts.shift();
  const full = parts.join(".");
  if (channel === "preview") return [full];
  return [full, parts.slice(0, 3).join("."), parts.slice(0, 2).join(".")];
}

/** 兼容 26.44/45 和 1.21.93/94 这类合并发布的官方标题。 */
function articleVersions(title: string): string[] {
  const found: string[] = [];
  for (const match of title.matchAll(/\b(?:1\.)?\d+\.\d+(?:\.\d+)?(?:\/\d+)*\b/g)) {
    const [first, ...rest] = match[0].split("/");
    found.push(first!);
    const prefix = first!.slice(0, first!.lastIndexOf(".") + 1);
    for (const suffix of rest) found.push(prefix + suffix);
  }
  return found;
}

export function findMatchingChangelogArticle(
  articles: FeedbackArticle[],
  channel: string,
  version: string
): FeedbackArticle | null {
  const candidates = versionCandidates(version, channel);
  return (
    articles.find((article) => {
      const title = article.title.toLowerCase();
      const expectedChannel =
        channel === "preview"
          ? /\b(beta|preview)\b/.test(title)
          : /\bbedrock\b/.test(title) && !/\b(beta|preview)\b/.test(title);
      return expectedChannel && articleVersions(title).some((v) => candidates.includes(v));
    }) ?? null
  );
}

/** 只返回与目标版本匹配的文章；找不到时由调用方给出对应频道的目录。 */
export async function fetchChangelog(channel: string, version: string): Promise<ChangelogPayload | null> {
  const section = channel === "preview" ? PREVIEW_SECTION : RELEASE_SECTION;
  try {
    for (let page = 1; page <= 5; page++) {
      const url = `${FEEDBACK_BASE}/api/v2/help_center/en-us/sections/${section}/articles.json?per_page=10&page=${page}`;
      const result = await httpGetJson<FeedbackPage>(url, { totalTimeoutMs: 15_000 });
      const article = findMatchingChangelogArticle(result.articles, channel, version);
      if (article) {
        const root = parseHtml(article.body);
        const paragraphs = root
          .querySelectorAll("p, h2, h3, li")
          .map((el) => el.text.trim())
          .filter(Boolean);
        const text = paragraphs.join("\n").slice(0, 2000);
        if (!text) return null;

        let imageBase64: string | null = null;
        const imgSrc = root.querySelector("img")?.getAttribute("src");
        if (imgSrc) {
          try {
            const imgUrl = new URL(imgSrc, article.html_url).href;
            const image = await httpRequest(imgUrl, { totalTimeoutMs: 15_000 });
            imageBase64 = image.body.toString("base64");
          } catch (e) {
            log.warn(`获取更新日志图片失败: ${(e as Error).message}`);
          }
        }
        return { text, imageBase64, url: article.html_url };
      }
      if (!result.next_page) break;
    }
    log.warn(`未找到 BDS ${version} (${channel}) 对应的官方更新日志`);
  } catch (e) {
    log.warn(`获取更新日志失败: ${(e as Error).message}`);
  }
  return null;
}
