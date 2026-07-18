/**
 * dbserver.ts — 转发 OneBot 群消息到 db-server /api/sfmc/messages
 *
 * 与旧实现保持行为一致: 仅 POST 200 视为成功,否则抛错; 失败不重试 (主流程不阻塞)。
 * 超时: 与 db-server 内部 HTTP 风格一致,使用 req.on("timeout") + req.destroy。
 */
import { request as httpRequest } from "node:http";
import { logger } from "./logger.js";
const REQUEST_TIMEOUT_MS = 5_000;
function postJSON(url, body, timeoutMs) {
    const payload = JSON.stringify(body);
    const options = {
        hostname: url.hostname,
        port: url.port || "3001",
        path: url.pathname,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
    };
    return new Promise((resolve, reject) => {
        const req = httpRequest(options, (res) => {
            let buf = "";
            res.setEncoding("utf-8");
            res.on("data", (chunk) => {
                buf += chunk;
            });
            res.on("end", () => {
                const code = res.statusCode ?? 0;
                if (code >= 200 && code < 300) {
                    try {
                        resolve(JSON.parse(buf));
                    }
                    catch {
                        // 允许返回非 JSON: 仍视为成功,作为 void 抛出
                        resolve(buf);
                    }
                }
                else {
                    reject(new Error(`db-server ${code}: ${buf.slice(0, 200)}`));
                }
            });
        });
        req.on("timeout", () => {
            req.destroy(new Error(`db-server 超时 ${timeoutMs}ms`));
        });
        req.on("error", reject);
        req.write(payload);
        req.end();
    });
}
/**
 * 构造一条 IncomingChatMessage 并 POST 到 db-server。
 * fromid 形如 `qq_<user_id>`,与旧实现保持完全一致。
 */
export async function forwardGroupMessage(cfg, fromId, fromName, content, now = Date.now()) {
    const message = {
        id: `${fromId}_${now}`,
        channelId: cfg.channelId,
        fromid: fromId,
        fromName,
        type: "text",
        content,
        showTimestamp: true,
        timestamp: now,
    };
    const body = { messages: [message] };
    const url = new URL(`http://${cfg.host}:${cfg.port}/api/sfmc/messages`);
    await postJSON(url, body, REQUEST_TIMEOUT_MS);
}
/** 包装 try/catch,失败仅 log (与旧实现一致,不抛给主循环)。 */
export async function tryForward(cfg, fromId, fromName, content) {
    try {
        await forwardGroupMessage(cfg, fromId, fromName, content);
        logger.info(`QQ → MC: ${fromName}: ${content.slice(0, 60)}`);
    }
    catch (e) {
        logger.error(`转发到 db-server 失败: ${e.message}`);
    }
}
//# sourceMappingURL=dbserver.js.map