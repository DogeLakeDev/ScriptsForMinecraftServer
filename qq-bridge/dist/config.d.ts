/**
 * config.ts — 加载 configs/qq_config.json
 *
 * 行为与旧 index.js 保持完全一致:
 *   - 文件不存在或解析失败: 进程退出 (旧版 process.exit(1))
 *   - 字段缺失: 走默认值
 *   - reload 时仅覆盖原对象 (mutate), 保留运行时引用的同一份对象
 */
import type { QQBridgeConfig } from "./types.js";
/** npm 模式从源码位置回退，supervisor/SEA 模式统一由 SFMC_ROOT 指定。 */
export declare const ROOT_DIR: string;
export declare const CFG_PATH: string;
/** 进程启动时加载一次。失败直接退出,与旧实现一致。 */
export declare function loadInitialConfig(): QQBridgeConfig;
/**
 * 重新读取配置文件,合并到传入对象上 (mutate)。
 * 旧实现是 Object.assign(cfg, newCfg),保留运行时对原 cfg 对象的引用 — 同样行为。
 */
export declare function reloadInto(cfg: QQBridgeConfig): void;
//# sourceMappingURL=config.d.ts.map