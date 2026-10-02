import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { Duplex } from "node:stream";
import { decodeFrame, MANAGEMENT_PROTOCOL_VERSION } from "../index.js";
import type { ManagementEvent, ManagementMethod, ManagementMethodMap } from "../index.js";

/** 每条连接独立持有请求；断线只拒绝等待，不重发写操作。 */
export class ManagementClient extends EventEmitter {
  private buffer = "";
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private closed = false;
  constructor(private stream: Duplex) {
    super();
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      this.buffer += chunk;
      if (this.buffer.length > 8 * 1024 * 1024) { this.disconnect(); return; }
      let index: number;
      while ((index = this.buffer.indexOf("\n")) !== -1) {
        const line = this.buffer.slice(0, index); this.buffer = this.buffer.slice(index + 1);
        const frame = decodeFrame(line);
        if (!frame) continue;
        if (frame.type === "event") { this.emit("event", frame as ManagementEvent); continue; }
        const request = this.pending.get(frame.id);
        if (!request) continue;
        clearTimeout(request.timer); this.pending.delete(frame.id);
        if (frame.ok) request.resolve(frame.result);
        else request.reject(Object.assign(new Error(frame.error?.message ?? "管理请求失败"), { code: frame.error?.code, details: frame.error?.details }));
      }
    });
    stream.on("error", (error: Error) => this.end(error));
    stream.on("close", () => this.end(new Error("管理连接已断开；后台任务继续运行")));
    stream.on("end", () => this.end(new Error("管理连接已结束")));
  }
  async handshake(root?: string) {
    const result = await this.call("handshake", root ? { root } : {});
    if (result.protocolVersion !== MANAGEMENT_PROTOCOL_VERSION) throw new Error("管理协议版本不兼容，请更新客户端或平台");
    return result;
  }
  call<K extends ManagementMethod>(method: K, params: unknown = {}, timeout = 30_000): Promise<ManagementMethodMap[K]> {
    if (this.closed) return Promise.reject(new Error("连接已关闭"));
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("请求超时；请查询任务记录，勿重复提交")); }, timeout);
      this.pending.set(id, { resolve: value => resolve(value as ManagementMethodMap[K]), reject, timer });
      this.stream.write(JSON.stringify({ id, method, params }) + "\n", error => {
        if (error) { clearTimeout(timer); this.pending.delete(id); reject(error); }
      });
    });
  }
  disconnect() { this.end(new Error("客户端已断开")); this.stream.destroy(); }
  private end(error: Error) {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
    this.pending.clear(); this.emit("disconnected", error.message);
  }
}

