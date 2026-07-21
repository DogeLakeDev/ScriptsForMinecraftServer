/**
 * area-types.ts — 区域配置类型定义
 *
 * 统一 schema:一个 area 通过 features.<name> 布尔开关声明它启用哪些子功能。
 * 五个子功能(peace/fly/survival/creative/clean)共享同一份 areas 列表,
 * 每个子生命周期只关心 features 里属于自己的那一位。
 */

/** 五个子功能名 */
export type FeatureName = "peace" | "fly" | "survival" | "creative" | "clean";

/** 每个区域可开启的子功能开关 */
export interface AreaFeatures {
  peace?: boolean;
  fly?: boolean;
  survival?: boolean;
  creative?: boolean;
  clean?: boolean;
}

/** 单个区域(2D 矩形,记录维度 + 起止水平坐标 + 功能开关) */
export interface Area {
  /** 区域名(全局展示用,fly 进出提示等) */
  name: string;
  /** 维度 id,如 "minecraft:overworld" */
  dimension: string;
  /** 起点 [x, z] */
  start: [number, number];
  /** 终点 [x, z] */
  end: [number, number];
  /** 子功能开关 */
  features: AreaFeatures;
}

/** clean 子功能配置(不属于区域范围语义,单独一块) */
export interface CleanConfig {
  /** 掉落物数量阈值,超过则触发清理 */
  item_max: number;
  /** 扫描周期(秒) */
  poll_interval: number;
  /** 直接清除(不入箱)的物品 typeId 列表 */
  kill_list: string[];
  /** 回收箱阵列几何信息 */
  recycle_bin: {
    start: [number, number, number];
    size: [number, number];
    direction: number;
    face: number;
  };
}

/** configs/area.json 的整体结构 */
export interface AreaConfig {
  areas: Area[];
  scan_interval_ticks: number;
  clean?: CleanConfig;
  notes?: string;
}
