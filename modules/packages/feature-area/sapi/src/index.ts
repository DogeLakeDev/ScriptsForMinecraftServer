/**
 * @sfmc/module-feature-area — v2 入口(五合一区域模块)
 *
 * 用一个 ModuleRegistry.register 聚合五个子生命周期:
 *   peace / fly / survival / creative / clean
 * 分别合并自 v1 的 feature-area-peace / feature-area-fly / feature-area-survival /
 * feature-area-creative / feature-clean。
 *
 * 每个子功能通过统一配置 configs/area.json 的 areas[].features.<name> 布尔位
 * 独立启用/禁用(某功能在任意区域被开启即视为激活)。区域数据统一由
 * area-service 经 SDK config 抽屉读取,不再使用 ConfigManager.getAreas()。
 *
 * 对外服务(manifest services.provides):
 *   - area.byName  —— 按名字查区域
 *   - area.byPoint —— 按坐标点查区域(可按 feature 过滤)
 */

import { ModuleRegistry, type ModuleLifecycle } from "@sfmc/sdk/module-loader";

import { initAreaConfig } from "./area-service.js";
import { peaceLifecycle } from "./lifecycles/peace.js";
import { flyLifecycle } from "./lifecycles/fly.js";
import { survivalLifecycle } from "./lifecycles/survival.js";
import { creativeLifecycle } from "./lifecycles/creative.js";
import { cleanLifecycle } from "./lifecycles/clean.js";

const MODULE_ID = "feature-area";

// 子生命周期集合。顺序有意义:creative 先于 survival(survival 读取 creative 的连锁开关)。
const subLifecycles: ModuleLifecycle[] = [
  peaceLifecycle,
  flyLifecycle,
  creativeLifecycle,
  survivalLifecycle,
  cleanLifecycle,
];

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      for (const l of subLifecycles) l.registerPermissions?.();
    },

    registerCommands() {
      for (const l of subLifecycles) l.registerCommands?.();
    },

    registerEvents() {
      for (const l of subLifecycles) l.registerEvents?.();
    },

    async init() {
      // 先加载统一区域配置,子生命周期再各自 init(读缓存)
      await initAreaConfig();
      for (const l of subLifecycles) await l.init?.();
    },

    cleanup() {
      for (const l of subLifecycles) l.cleanup?.();
    },
  },
});

/* ── 重导出:同进程其它模块 / 平台服务派发用 ─────────────── */
export { areaByName, areaByPoint, allAreas, areasByFeature } from "./area-service.js";
export type { Area, AreaConfig, AreaFeatures, FeatureName } from "./area-types.js";
