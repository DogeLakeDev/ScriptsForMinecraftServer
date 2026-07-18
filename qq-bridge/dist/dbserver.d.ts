/**
 * dbserver.ts — 转发 OneBot 群消息到 db-server /api/sfmc/messages
 *
 * 与旧实现保持行为一致: 仅 POST 200 视为成功,否则抛错; 失败不重试 (主流程不阻塞)。
 * 超时: 与 db-server 内部 HTTP 风格一致,使用 req.on("timeout") + req.destroy。
 */
export interface DBServerConfig {
    host: string;
    port: number;
    channelId: string;
}
/**
 * 构造一条 IncomingChatMessage 并 POST 到 db-server。
 * fromid 形如 `qq_<user_id>`,与旧实现保持完全一致。
 */
export declare function forwardGroupMessage(cfg: DBServerConfig, fromId: string, fromName: string, content: string, now?: number): Promise<void>;
/** 包装 try/catch,失败仅 log (与旧实现一致,不抛给主循环)。 */
export declare function tryForward(cfg: DBServerConfig, fromId: string, fromName: string, content: string): Promise<void>;
//# sourceMappingURL=dbserver.d.ts.map