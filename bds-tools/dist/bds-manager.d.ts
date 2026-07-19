/**
 * bds-manager.ts — BDS 进程管理器
 *
 * 改进:
 *  - 优雅 stop (发送 stop 命令 → 等待退出 → SIGTERM → SIGKILL)
 *  - watchdog (崩溃自动重启)
 *  - 单例事件发射器
 *  - 完全异步 (fs/promises)
 */
import { EventEmitter } from "node:events";
export interface BdsManager {
    start(): Promise<void>;
    stop(): Promise<void>;
    status(): Promise<boolean>;
    sendCommand(cmd: string): boolean;
    watch(): Promise<void>;
    events: EventEmitter;
    isManualStop: boolean;
    getPid(): number;
}
export interface BdsManagerOptions {
    detached?: boolean;
}
export declare function createBdsManager(options?: BdsManagerOptions): BdsManager;
export declare const bdsEvents: EventEmitter;
export declare const bdsEvents_enabled: () => void;
//# sourceMappingURL=bds-manager.d.ts.map