/**
 * area-service.ts — 区域配置加载 + 内存缓存
 *
 * 配置走 SDK config.get("areas" / "scan_interval_ticks" / "clean")。
 * init 时读入缓存,子生命周期 tick 同步读;config.onChange 热更新。
 */

import { config } from "@sfmc/sdk/sapi/config";
import { pointInArea_2D } from "@sfmc/sdk/sapi/runtime";
import type { Area, AreaConfig, CleanConfig, FeatureName } from "./area-types.js";

let _areas: Area[] = [];
let _scanIntervalTicks = 40;
let _clean: CleanConfig | undefined = undefined;
let _loaded = false;

/**
 * 读取 configs/area.json 并填充内存缓存。init 阶段调一次。
 * 返回组装好的 AreaConfig(等价于 config.get<AreaConfig>("area") 的语义)。
 */
export async function initAreaConfig(): Promise<AreaConfig> {
  const areas = await config.get<Area[]>("areas");
  const scan = await config.get<number>("scan_interval_ticks");
  const clean = await config.get<CleanConfig>("clean");

  _areas = Array.isArray(areas) ? areas : [];
  _scanIntervalTicks = typeof scan === "number" && scan > 0 ? scan : 40;
  _clean = clean ?? undefined;
  _loaded = true;

  // 热更新:任意子键变更时刷新缓存
  config.onChange((key, value) => {
    if (key === "areas" && Array.isArray(value)) _areas = value as Area[];
    else if (key === "scan_interval_ticks" && typeof value === "number" && value > 0) _scanIntervalTicks = value;
    else if (key === "clean" && value && typeof value === "object") _clean = value as CleanConfig;
  });

  return { areas: _areas, scan_interval_ticks: _scanIntervalTicks, ...(_clean ? { clean: _clean } : {}) };
}

/** 是否已加载配置 */
export function isAreaConfigLoaded(): boolean {
  return _loaded;
}

/** 扫描周期(tick) */
export function getScanIntervalTicks(): number {
  return _scanIntervalTicks;
}

/** clean 子功能配置(可能未配置) */
export function getCleanConfig(): CleanConfig | undefined {
  return _clean;
}

/** 全部区域(缓存快照) */
export function allAreas(): Area[] {
  return _areas;
}

/** 返回开启了指定子功能的所有区域 */
export function areasByFeature(feature: FeatureName): Area[] {
  return _areas.filter((a) => a.features?.[feature] === true);
}

/** 指定子功能是否在任何区域启用(子生命周期用它判断自己是否"激活") */
export function isFeatureActive(feature: FeatureName): boolean {
  return _areas.some((a) => a.features?.[feature] === true);
}

/* ── 对外服务实现 ─────────────────────────────────────────────── */

/**
 * service: area.byName —— 按名字查区域。
 */
export function areaByName(name: string): Area | null {
  return _areas.find((a) => a.name === name) ?? null;
}

/**
 * service: area.byPoint —— 查覆盖某水平坐标点的区域。
 * 可选 feature:只在开启该子功能的区域中匹配。
 */
export function areaByPoint(input: {
  dimension: string;
  x: number;
  z: number;
  feature?: FeatureName;
}): Area | null {
  for (const a of _areas) {
    if (a.dimension !== input.dimension) continue;
    if (input.feature && a.features?.[input.feature] !== true) continue;
    if (pointInArea_2D(input.x, input.z, a.start[0], a.start[1], a.end[0], a.end[1])) {
      return a;
    }
  }
  return null;
}

/**
 * 子生命周期用:某坐标点是否落在"开启指定子功能"的区域内,命中返回该区域。
 */
export function pointInFeatureArea(
  feature: FeatureName,
  dimension: string,
  x: number,
  z: number
): Area | null {
  return areaByPoint({ dimension, x, z, feature });
}
