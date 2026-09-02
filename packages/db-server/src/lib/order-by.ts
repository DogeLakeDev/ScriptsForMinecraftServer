/**
 * order-by.ts — 数据库查询排序项（QueryOptions.orderBy）规范化工具
 *
 * 兼容处理 SDK 的标准形态 `{ field, dir? }` 与服务端的 `{ col, dir? }` 格式，
 * 统一转化为标准化的 `{ col, dir }[]` 结构，防止由于字段名不匹配导致 SQL 拼出 `ORDER BY "undefined"` 错误。
 */

export type NormalizedOrder = { col: string; dir: "asc" | "desc" };

/**
 * 将多形态的 orderBy 配置（单项或数组、`field` 或 `col`）统一规范化为 `{ col, dir }[]`。
 *
 * @param orderBy 原始排序配置项。
 * @returns 规范化的排序描述数组。
 * @throws 当排序项类型非法或缺少列名时抛出异常。
 */
export function normalizeOrderBy(orderBy: unknown): NormalizedOrder[] {

  if (orderBy == null) return [];
  const list = Array.isArray(orderBy) ? orderBy : [orderBy];
  const out: NormalizedOrder[] = [];
  for (const item of list) {
    if (item == null || typeof item !== "object") {
      throw new Error("[tx] orderBy 项必须是对象");
    }
    const rec = item as Record<string, unknown>;
    const col = rec.col ?? rec.field;
    if (typeof col !== "string" || !col) {
      throw new Error("[tx] orderBy 缺少 field/col");
    }
    out.push({
      col,
      dir: rec.dir === "desc" ? "desc" : "asc",
    });
  }
  return out;
}
