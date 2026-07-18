/**
 * changelog.ts — 更新日志抓取 (官方页面)
 */

import cheerio from "cheerio";
import { fetchJsonWithFallback, httpGetText } from "./http.js";
import type { ChangelogPayload } from "./types.js";
import { logger } from "./logger.js";

const CHANGELOG_BASE = "https://feedback.minecraft.net/hc/en-us/sections/360001186971";

/** 抓取当前版本的更新说明 (文本 + 首张图 base64) */
export async function fetchChangelog(channel: string): Promise<ChangelogPayload | null> {
  try {
    const url = `https://www.minecraft.net/en-us/article/${channel === "preview" ? "bedrock-beta" : "bedrock"}-update`;
    const html = await httpGetText(url);
    const $ = cheerio.load(html);
    const article = $("article").first().length
      ? $("article").first()
      : $(".article-content").first().length
      ? $(".article-content").first()
      : $('[class*="content"]').first();
    if (!article.length) return null;

    const paragraphs: string[] = [];
    article.find("p, h2, h3, li").each((_, el) => {
      const t = $(el).text().trim();
      if (t) paragraphs.push(t);
    });
    const text = paragraphs.join("\n").slice(0, 2000);

    let imageBase64: string | null = null;
    const firstImg = article.find("img").first();
    if (firstImg.length) {
      const imgSrc: string | undefined = firstImg.attr("src") ?? firstImg.attr("data-src");
      if (imgSrc) {
        try {
          const imgUrl = imgSrc.startsWith("http") ? imgSrc : `https://www.minecraft.net${imgSrc}`;
          // 复用 httpGetText: 当前实现会按 utf-8 解码; binary 图片需额外走 buffer
          const res = await fetchJsonWithFallback([], 15_000).catch(() => null);
          void res;
          // 改用更通用的方式: 通过 httpRequest 拿二进制
          const { httpRequest } = await import("./http.js");
          const img = await httpRequest(imgUrl);
          imageBase64 = img.body.toString("base64");
        } catch (e) {
          logger.warn(`获取图片失败: ${(e as Error).message}`);
        }
      }
    }

    return { text: text.slice(0, 2000), imageBase64 };
  } catch (e) {
    logger.warn(`获取更新日志失败: ${(e as Error).message}`);
    return null;
  }
}

export { CHANGELOG_BASE };
