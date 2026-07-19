import { type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { type ServiceId } from "./runtime.js";
export { ROOT } from "./runtime.js";
export interface LogLine {
    time: Date;
    text: string;
    stream: "stdout" | "stderr";
}
export type ServiceName = "bds" | "db" | "qq" | "llbot";
export declare const SERVICE_NAMES: ServiceName[];
interface ServiceDef {
    name: ServiceName;
    title: string;
    /** 抽象服务: npm 模式 spawn node <script>, SEA 模式自重入 exe。与 cmd 二选一。 */
    service?: ServiceId;
    /** 直接命令 (bds/llbot 外部 exe)。与 service 二选一。 */
    cmd?: string;
    args?: string[];
    cwd: string;
    env?: Record<string, string>;
    stopCommand?: string;
    stopTimeout: number;
    autoRestart: boolean;
    restartDelay: number;
    validate?: () => string | null;
}
declare class Service {
    name: ServiceName;
    title: string;
    proc: ChildProcess | null;
    running: boolean;
    pid: number;
    startTime: Date | null;
    logs: LogLine[];
    events: EventEmitter<any>;
    private def;
    private manualStop;
    constructor(def: ServiceDef);
    get uptime(): string;
    pushLog(text: string, stream: "stdout" | "stderr"): void;
    start(): Promise<void>;
    stop(): Promise<void>;
    forceStop(): void;
    restart(): Promise<void>;
    getRecentLogs(n: number): LogLine[];
    private cleanup;
}
export declare let services: Record<ServiceName, Service>;
export declare function refreshServices(): void;
export declare const START_ORDER: ServiceName[];
export declare function startAll(): Promise<void>;
export declare function stopAll(): Promise<void>;
export declare function forceStopAll(): void;
//# sourceMappingURL=services.d.ts.map