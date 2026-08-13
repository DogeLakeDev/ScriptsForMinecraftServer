/**
 * llbot-ws-api.ts — 经 LLBot reverse-WS 调用 OneBot API
 *
 * 多数 LLBot 部署只开 reverse-ws、不开正向 HTTP(3004)。
 * 指令回复应走已连接的 WebSocket，而不是假定 3004 可达。
 */

import { randomBytes } from "node:crypto";
import type { WebSocket } from "ws";
import { log } from "./log.js";

export type LlbotApiResult = {
  status?: string;
  retcode?: number;
  data?: unknown;
  message?: string;
  wording?: string;
  echo?: string;
};

type Pending = {
  resolve: (v: LlbotApiResult) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const DEFAULT_TIMEOUT_MS = 8000;

export class LlbotWsApi {
  private sock: WebSocket | null = null;
  private readonly pending = new Map<string, Pending>();

  /** 当前是否有可用的 LLBot reverse-ws 连接 */
  get connected(): boolean {
    return !!this.sock && this.sock.readyState === 1; // OPEN
  }

  attach(sock: WebSocket): void {
    if (this.sock && this.sock !== sock) {
      this.rejectAll(new Error("LLBot WebSocket 被新连接替换"));
    }
    this.sock = sock;
    log.info("LLBot WS API 已挂接（可用 reverse-ws 发消息）");
  }

  detach(sock: WebSocket): void {
    if (this.sock !== sock) return;
    this.sock = null;
    this.rejectAll(new Error("LLBot WebSocket 已断开"));
    log.info("LLBot WS API 已卸载");
  }

  /**
   * 若帧是 API 回包（有 echo、无 post_type），消费并返回 true。
   * 事件帧返回 false，交给 dispatcher。
   */
  tryHandleResponse(raw: unknown): boolean {
    if (!raw || typeof raw !== "object") return false;
    const obj = raw as Record<string, unknown>;
    if (obj.post_type != null) return false;
    const echo = obj.echo;
    if (echo == null || echo === "") return false;
    const key = String(echo);
    const p = this.pending.get(key);
    if (!p) return false;
    this.pending.delete(key);
    clearTimeout(p.timer);
    p.resolve(obj as LlbotApiResult);
    return true;
  }

  async call(action: string, params: Record<string, unknown>, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<LlbotApiResult> {
    if (!this.connected || !this.sock) {
      throw new Error("LLBot reverse-ws 未连接，无法调用 API");
    }
    const echo = `sfmc_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
    const payload = JSON.stringify({ action, params, echo });

    return new Promise<LlbotApiResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(echo);
        reject(new Error(`LLBot WS API 超时 (${action})`));
      }, timeoutMs);
      this.pending.set(echo, { resolve, reject, timer });
      try {
        this.sock!.send(payload);
      } catch (e) {
        this.pending.delete(echo);
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  async sendGroupMsg(groupId: string | number, text: string): Promise<void> {
    const gid = typeof groupId === "number" ? groupId : parseInt(String(groupId), 10);
    if (!Number.isFinite(gid)) throw new Error(`无效 group_id: ${groupId}`);
    const result = await this.call("send_group_msg", {
      group_id: gid,
      message: [{ type: "text", data: { text } }],
    });
    const ret = result.retcode ?? (result.status === "ok" ? 0 : -1);
    if (ret !== 0) {
      throw new Error(
        `LLBot send_group_msg retcode=${ret}: ${result.message || result.wording || result.status || "fail"}`
      );
    }
  }

  private rejectAll(err: Error): void {
    for (const [k, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
      this.pending.delete(k);
    }
  }
}

/** 进程内单例：ws-server 挂接，reply-llbot / 其它出口复用 */
export const llbotWsApi = new LlbotWsApi();
