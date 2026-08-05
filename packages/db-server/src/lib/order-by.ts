/**
 * order-by.ts — 规范化 QueryOptions.orderBy(DRY + LSP)
 *
 * SDK 权威形态是 `{ field, dir? }`(见 @sfmc-bds/sdk/db OrderBy);
 * tx-runner 早期用过 `{ col, dir? }`。两端必须互通,否则
 * `ORDER BY "undefined"` / `orderBy bad column` 静默炸。
 */

export type NormalizedOrder = { col: string; dir: "asc" | "desc" };

/**
 * 把 SDK `field` / 遗留 `col`、单值 / 数组 统一成 `{col,dir}[]`。
 * @throws 缺列名或类型非法时
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
