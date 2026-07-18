/**
 * console.ts — 交互式控制台 (readline)
 *
 * 命令:
 *   help    显示帮助
 *   reload  重新读取 configs/qq_config.json
 *   status  显示当前状态
 *   stop    退出进程
 *
 * 行为与旧实现完全一致。
 */
import type { QQBridgeConfig } from "./types.js";
export interface ConsoleOptions {
    config: QQBridgeConfig;
    initialEnabled: boolean;
    wsPort: number;
    botSelfIdRef: {
        value: string | null;
    };
}
export declare function startConsole(opts: ConsoleOptions): void;
//# sourceMappingURL=console.d.ts.map