/**
 * qqutil.ts — QQ 通知工具 (基于 LLBot HTTP OneBot 11)
 *
 * 改进:
 *  - sendTimeout 提供总超时，避免通知发送挂死主流程
 *  - 静默模式 (失败不抛出)，保证主流程不被通知干扰
 */
/** 检查 qq-bridge 模块是否启用 */
export declare function isQqBridgeEnabled(): boolean;
export declare function sendText(text: string): Promise<void>;
export declare function sendMixed(segments: unknown[]): Promise<void>;
export declare function sendWithImage(text: string, base64Img: string): Promise<void>;
//# sourceMappingURL=qqutil.d.ts.map