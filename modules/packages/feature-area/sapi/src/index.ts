/**
 * @sfmc/module-feature-area — v2 入口(五合一区域模块)
 *
 * 聚合 peace / fly / survival / creative / clean 五个子生命周期。
 * 配置:configs/area.json 的 areas[].features.<name>;数据由 area-service 提供。
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
