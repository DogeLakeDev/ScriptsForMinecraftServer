/**
 * changelog.ts — 更新日志抓取 (官方页面)
 */

import { parse as parseHtml, HTMLElement } from "node-html-parser";
import { fetchJsonWithFallback, httpGetText } from "./http.js";
import type { ChangelogPayload } from "./types.js";
import { log } from "./log.js";

const CHANGELOG_BASE = "https://feedback.minecraft.net/hc/en-us/sections/360001186971";

/**
 * node-html-parser 的 API 与 cheerio 略不同:它没有 first/length 链式判断,
 * 而是用 querySelector + 节点属性。这里包一层小工具让选择子语义集中。
 */
function firstElement(root: HTMLElement, selector: string): HTMLElement | null {
  return root.querySelector(selector);
}

/** 抓取当前版本的更新说明 (文本 + 首张图 base64) */
export async function fetchChangelog(channel: string): Promise<ChangelogPayload | null> {
  try {
    const url = `https://www.minecraft.net/en-us/article/${channel === "preview" ? "bedrock-beta" : "bedrock"}-update`;
    const html = await httpGetText(url);
    const root = parseHtml(html);
    const article = firstElement(root, "article")
      ?? firstElement(root, ".article-content")
      ?? firstElement(root, '[class*="content"]');
    if (!article) return null;

    const paragraphs: string[] = [];
    for (const el of article.querySelectorAll("p, h2, h3, li")) {
      const t = el.text.trim();
      if (t) paragraphs.push(t);
    }
    const text = paragraphs.join("\n").slice(0, 2000);

    let imageBase64: string | null = null;
    const firstImg = article.querySelector("img");
    if (firstImg) {
      const imgSrc: string | undefined = firstImg.getAttribute("src") ?? firstImg.getAttribute("data-src") ?? undefined;
      if (imgSrc) {
        try {
          const imgUrl = imgSrc.startsWith("http") ? imgSrc : `https://www.minecraft.net${imgSrc}`;
          const res = await fetchJsonWithFallback([], 15_000).catch(() => null);
          void res;
          const { httpRequest } = await import("./http.js");
          const img = await httpRequest(imgUrl);
          imageBase64 = img.body.toString("base64");
        } catch (e) {
          log.warn(`获取图片失败: ${(e as Error).message}`);
        }
      }
    }

    return { text: text.slice(0, 2000), imageBase64 };
  } catch (e) {
    log.warn(`获取更新日志失败: ${(e as Error).message}`);
    return null;
  }
}

export { CHANGELOG_BASE };
