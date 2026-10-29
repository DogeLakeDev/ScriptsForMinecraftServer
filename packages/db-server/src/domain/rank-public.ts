/**
 * domain/rank-public.ts — 排行榜「公开计分项」名单（存在 settings.json）
 *
 * 使用场景：玩家端排行页的「计分板」分类只展示这里列出的计分项；
 * 管理端计分项详情页的「在排行中公开」开关读写同一份名单。
 * 键名 rank.publicObjectives，值为计分项 id 字符串数组。
 */
import { join } from "node:path";
import { configDir, patchJson, readJson } from "@sfmc-bds/sdk/node/config";

/** settings.json 里的键 */
export const PUBLIC_OBJECTIVES_KEY = "rank.publicObjectives";

/** 读取公开计分项 id 列表；缺省或格式不对时为空数组 */
export function readPublicObjectives(projectRoot: string): string[] {
  const settings = (readJson(join(configDir(projectRoot), "settings.json")) as Record<string, unknown> | null) ?? {};
  const raw = settings[PUBLIC_OBJECTIVES_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item).trim()).filter(Boolean);
}

/**
 * 写入公开计分项 id 列表（去重、去空）。
 * 使用场景：PUT /api/sfmc/rank/public-objectives；管理端开关。
 */
export function writePublicObjectives(projectRoot: string, ids: string[]): string[] {
  const cleaned = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  patchJson(join(configDir(projectRoot), "settings.json"), { [PUBLIC_OBJECTIVES_KEY]: cleaned });
  return cleaned;
}

/** 某个计分项是否在公开名单里 */
export function isPublicObjective(projectRoot: string, objectiveId: string): boolean {
  return readPublicObjectives(projectRoot).includes(objectiveId);
}
