/**
 * client.ts — 小程序端的管理连接
 *
 * 使用场景：会话层（session.ts）为当前实例创建一个 GatewayClient；一条 WebSocket 对应网关上的一条
 * `sfmc manage --stdio` 会话。语义与桌面端 ManagementClient 一致：请求按 id 配对，
 * 断线只拒绝等待中的请求，不自动重发写操作（避免重复执行维护任务）。
 */
import { decodeFrame } from "../vendor/management";
import type { ManagementEvent, ManagementMethod, ManagementMethodMap, ManagementResponse } from "./types";

/** 网关自定义关闭码 → 用户可读原因（网关通常也会带上 reason，这里作为兜底） */
const CLOSE_REASONS: Record<number, string> = {
  4401: "访问令牌无效",
  4403: "没有管理权限（需要游戏内 3 级权限）",
  4429: "鉴权失败次数过多，请稍后再试",
  4503: "管理会话已满，请关闭其他设备上的连接",
  1011: "管理通道已退出",
  1013: "网络接收过慢，连接已断开",
};

/** 带结构化错误码的请求异常 */
export interface RequestError extends Error {
  code?: string;
  details?: unknown;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: number;
}

export class GatewayClient {
  private task: WechatMiniprogram.SocketTask | null = null;
  private pending = new Map<string, Pending>();
  private sequence = 0;
  private closed = false;
  /** 事件推送回调（events.subscribe 之后） */
  onEvent: ((event: ManagementEvent) => void) | null = null;
  /** 连接结束回调，参数为可读原因；主动 close() 时不触发 */
  onClose: ((reason: string) => void) | null = null;
  /**
   * 网关关闭连接时给出的关闭码（未关闭或网络层失败时为 null）。
   * 使用场景：会话层以微信身份连接被 4401 拒绝时，据此丢弃本机缓存的玩家会话，下次连接重新登录。
   */
  closeCode: number | null = null;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  /** 建立连接。握手失败、超时或被网关以错误码关闭时抛出可读原因。 */
  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      let opened = false;
      const fail = (reason: string) => {
        if (opened) return;
        opened = true;
        this.closed = true;
        reject(new Error(reason));
      };
      const task = wx.connectSocket({
        url: this.url,
        header: { Authorization: `Bearer ${this.token}` },
        timeout: 15_000,
        fail: (error) => fail(this.describeFailure(error.errMsg)),
      });
      this.task = task;
      task.onOpen(() => {
        // 网关在完成升级后才校验令牌，令牌错误时会紧接着以 4401 关闭（微信登录但权限不足为 4403）；
        // 此时紧随其后的 handshake 请求会带着关闭原因被拒绝，由调用方展示。
        opened = true;
        resolve();
      });
      task.onMessage(({ data }) => {
        if (typeof data === "string") this.onFrame(data);
      });
      task.onError((error) => fail(this.describeFailure(error.errMsg)));
      task.onClose(({ code, reason }) => {
        this.closeCode = code;
        const text = reason || CLOSE_REASONS[code] || `连接已关闭 (${code})`;
        if (!opened) {
          fail(text);
          return;
        }
        this.end(text, true);
      });
    });
  }

  /** 发送管理请求，超时默认 30 秒（与桌面端一致） */
  call<K extends ManagementMethod>(method: K, params: unknown = {}, timeout = 30_000): Promise<ManagementMethodMap[K]> {
    if (this.closed || !this.task) return Promise.reject(new Error("连接已关闭"));
    const id = `m${Date.now().toString(36)}-${++this.sequence}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("请求超时"));
      }, timeout) as unknown as number;
      this.pending.set(id, { resolve: (value) => resolve(value as ManagementMethodMap[K]), reject, timer });
      this.task!.send({
        data: JSON.stringify({ id, method, params }),
        fail: (error) => {
          clearTimeout(timer);
          this.pending.delete(id);
          reject(new Error(error.errMsg));
        },
      });
    });
  }

  /** 主动断开。不会触发 onClose，服务器与后台任务继续运行。 */
  close(): void {
    const task = this.task;
    this.end("客户端已断开", false);
    task?.close({ code: 1000, reason: "client closed" });
  }

  /** 处理一帧 */
  private onFrame(line: string): void {
    const frame = decodeFrame(line);
    if (!frame) return;
    if (frame.type === "event") {
      this.onEvent?.(frame as ManagementEvent);
      return;
    }
    const response = frame as ManagementResponse;
    const request = this.pending.get(response.id);
    if (!request) return;
    clearTimeout(request.timer);
    this.pending.delete(response.id);
    if (response.ok) request.resolve(response.result);
    else {
      const error: RequestError = new Error(response.error?.message ?? "管理请求失败");
      error.code = response.error?.code;
      error.details = response.error?.details;
      request.reject(error);
    }
  }

  /** 结束连接：拒绝全部等待中的请求 */
  private end(reason: string, notify: boolean): void {
    if (this.closed) return;
    this.closed = true;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error(reason));
    }
    this.pending.clear();
    this.task = null;
    if (notify) this.onClose?.(reason);
  }

  /** 把 wx 的连接错误翻译成可操作的提示 */
  private describeFailure(message: string): string {
    if (/url not in domain list|合法域名/i.test(message)) return "网关域名未加入小程序 socket 合法域名；开发阶段可在开发者工具中勾选“不校验合法域名”";
    if (/timeout|超时/i.test(message)) return "连接网关超时，请检查地址与网络";
    return message || "无法连接网关";
  }
}
