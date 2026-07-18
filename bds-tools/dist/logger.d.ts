/**
 * logger.ts — 单例流式日志 (避免断行 / 文件描述符泄漏)
 *
 * appendFileSync 在长消息或高频调用下可能撞到 buffer 边界，导致行被截断。
 * 这里使用 createWriteStream + 缓冲行，单例保持一个 FD。
 */
import type { Logger } from "./types.js";
export declare const logger: Logger;
export declare function closeLogger(): void;
//# sourceMappingURL=logger.d.ts.map