/**
 * onebot.ts — OneBot 11 事件分发
 *
 * 职责:
 *   1. 维护 botSelfId (从 lifecycle 元事件捕获)
 *   2. 5s 短期 message_id 去重 (防 LLBot 偶发重发)
 *   3. 群消息段 → 纯文本 (text / at / image / face / reply / forward / record / video / file)
 *   4. 命中规则后调用 tryForward 投递
 *
 * 行为与旧 index.js 完全一致; 类型上把 sender/message 都收紧为 narrow 类型。
 */
import { type DBServerConfig } from "./dbserver.js";
import type { OneBotGroupMessageEvent } from "./types.js";
/**
 * OneBot 11 消息段数组 (或纯字符串) → 纯文本。
 * 行为与旧实现完全一致:
 *   - text:   原样拼接
 *   - at:     "@昵称 " 或 "@qq " (有 name 优先 name)
 *   - 其它:   [图片]/[表情]/[回复]/[转发]/[语音]/[视频]/[文件]
 *   - 未知段: 跳过
 */
export declare function extractText(message: OneBotGroupMessageEvent["message"]): string;
export declare class RecentMessageDedup {
    private readonly map;
    private lastCleanup;
    seen(messageId: string | number | undefined): boolean;
}
export interface DispatcherOptions {
    /** 群 ID 字符串,空 = 接收所有群(旧行为:空时不匹配任何群,不会触发) */
    qqGroupId: string;
    /** db-server 配置 + 目标 channelId */
    db: DBServerConfig;
}
export declare class OneBotDispatcher {
    private botSelfId;
    private readonly opts;
    private readonly dedup;
    constructor(opts: DispatcherOptions);
    /** 测试/调试用 */
    get selfId(): string | null;
    /** 收到一条原始 JSON 字符串(已 parse) */
    handle(rawEvent: unknown): Promise<void>;
}
//# sourceMappingURL=onebot.d.ts.map