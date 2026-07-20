/* ---------------------------------------- *\
 *  defaults.ts — 领地模块默认值 / ID 生成
 *
 *  从 LandDatabase.ts 抽出，仅供 land/ 模块内部使用。
 *  客户端优先使用 server 返回值；这里只为本地构建 LandData 提供 fallback。
\* ---------------------------------------- */

import type { LandConfig, LandPermissions, LandTaxConfig } from "./LandDatabase.js";

// 以下默认值仅为 server 配置（configs/land.json）缺失时的本地兜底；
// 运行时优先使用 server 返回值，保持与 land.json 一致。
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
  use_door: false,
  use_button: false,
  use_redstone: false,
  interact_entity: false,
  pickup_item: false,
};

export const DEFAULT_TAX: LandTaxConfig = {
  enabled: false,
  defaultRate: 50,
  periodDays: 7,
  freezeOnInsufficient: true,
  fallbackPurchasePrice: 100,
};

export function defaultConfig(): LandConfig {
  return { ...DEFAULT_CONFIG };
}

export function defaultPermissions(): LandPermissions {
  return { ...DEFAULT_PERMISSIONS };
}

/** 生成领地 ID，前缀 `L`。与 db-server id 规则保持一致。 */
export function generateLandId(): string {
  return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 10).toUpperCase();
}
