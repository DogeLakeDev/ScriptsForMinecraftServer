/* ---------------------------------------- *\
 *  defaults.ts — 领地模块默认值 / ID 生成
 *
 *  从 LandDatabase.ts 抽出，仅供 land/ 模块内部使用。
 *  客户端优先使用 server 返回值；这里只为本地构建 LandData 提供 fallback。
\* ---------------------------------------- */

import type { LandConfig, LandPermissions } from "./LandDatabase";

export const DEFAULT_CONFIG: LandConfig = {
  priceFormula: "{square}*8+{height}*20",
  maxLandsPerPlayer: 5,
  minSquare: 4,
  maxSquare: 50000,
  discount: 1,
  refundRate: 0.7,
};

export const DEFAULT_PERMISSIONS: LandPermissions = {
  allow_place: false,
  allow_destroy: false,
  attack_entity: false,
  open_container: false,
};

export function defaultConfig(): LandConfig {
  return { ...DEFAULT_CONFIG };
}

export function defaultPermissions(): LandPermissions {
  return { ...DEFAULT_PERMISSIONS };
}

/** 生成领地 ID，前缀 `L`。与 db-server id 规则保持一致。 */
export function generateLandId(): string {
  return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}
