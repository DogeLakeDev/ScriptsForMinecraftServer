/**
 * bridge.ts — 一条 WebSocket 与一个 `sfmc manage --stdio` 子进程之间的帧转发
 *
 * 使用场景：server.ts 鉴权通过后为每条连接创建一个 ManagementBridge。
 * 帧格式沿用管理协议（frames.ts）：客户端每条文本消息是一个请求帧，子进程 stdout 的每一行是一个响应或事件帧。
 * 网关只做三件事：方法白名单、把握手的实例目录改写为网关配置的目录、背压与生命周期管理；
 * 业务语义（维护锁、任务、权限校验）全部由 CLI 管理通道负责，网关不重复实现。
 * 连接断开只结束管理通道，与桌面端一样不会停止守护进程或服务器。
 */
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { decodeFrame, managementError, type ManagementError, type ManagementRequest, type ManagementResponse } from "@sfmc-bds/management";
import type { RawData, WebSocket } from "ws";
import { EXIT_GRACE_MS, spawnManageProcess } from "./cli-process.js";
import type { GatewayConfig } from "./config.js";
import { GATEWAY_METHODS } from "./methods.js";

/** 子进程 stdout 未成行的缓冲上限，与 ManagementClient 一致 */
const STDOUT_BUFFER_LIMIT = 8 * 1024 * 1024;
/** 客户端发送队列超过该字节数时视为接收过慢（通常是移动网络卡住），断开以免内存堆积 */
const SEND_BUFFER_LIMIT = 16 * 1024 * 1024;
/** 单条管理会话的桥接器 */
export class ManagementBridge {
  private child?: ChildProcessWithoutNullStreams;
  private buffer = "";
  private stderrTail = "";
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly config: GatewayConfig,
    private readonly log: (message: string) => void,
    /** 会话结束回调，server.ts 用它维护在线会话计数 */
    private readonly onEnd: () => void,
  ) {}

  /** 启动 CLI 管理通道并开始转发 */
  start(): void {
    const child = spawnManageProcess(this.config);
    this.child = child;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => this.onChildOutput(chunk));
    // 诊断信息只保留尾部，子进程异常退出时写进网关日志，不转发给客户端。
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-2000);
    });
    child.on("error", (error) => {
      this.log(`管理通道启动失败: ${error.message}`);
      this.shutdown(1011, "管理通道启动失败");
    });
    child.on("exit", (code, signal) => {
      if (!this.closed && code !== 0) this.log(`管理通道退出 (${code ?? signal}): ${this.stderrTail.trim().split("\n").at(-1) ?? ""}`);
      this.shutdown(1011, "管理通道已退出");
    });
    child.stdin.on("error", () => {});

    this.socket.on("message", (data, isBinary) => this.onClientMessage(data, isBinary));
    this.socket.on("close", () => this.shutdown());
    this.socket.on("error", () => this.shutdown());
  }

  /** 处理客户端请求帧：校验 → 白名单 → 改写握手 → 写入子进程 */
  private onClientMessage(data: RawData, isBinary: boolean): void {
    if (this.closed || !this.child) return;
    let request: ManagementRequest;
    try {
      if (isBinary) throw new Error("只接受文本帧");
      const parsed = JSON.parse(data.toString()) as Partial<ManagementRequest> | null;
      if (!parsed || typeof parsed.id !== "string" || parsed.id.length > 128 || typeof parsed.method !== "string" || parsed.method.length > 128) {
        throw new Error("非法管理帧");
      }
      request = { id: parsed.id, method: parsed.method, ...(parsed.params === undefined ? {} : { params: parsed.params }) };
    } catch (error) {
      this.reply("invalid", managementError("invalid_request", error instanceof Error ? error.message : String(error)));
      return;
    }
    if (!GATEWAY_METHODS.has(request.method)) {
      this.reply(request.id, managementError("unsupported", `网关未开放此方法: ${request.method}`));
      return;
    }
    // 客户端无从知道服务器上的目录，也不允许指定；握手一律连接网关配置的实例。
    if (request.method === "handshake") request.params = { root: this.config.root };
    this.child.stdin.write(JSON.stringify(request) + "\n");
  }

  /** 把子进程输出按行拆成帧，逐条发给客户端 */
  private onChildOutput(chunk: string): void {
    this.buffer += chunk;
    if (this.buffer.length > STDOUT_BUFFER_LIMIT) {
      this.log("管理通道输出过大，关闭会话");
      this.shutdown(1009, "管理帧过大");
      return;
    }
    let index: number;
    while ((index = this.buffer.indexOf("\n")) !== -1) {
      const line = this.buffer.slice(0, index).trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line || !decodeFrame(line)) continue;
      if (this.socket.bufferedAmount > SEND_BUFFER_LIMIT) {
        this.shutdown(1013, "客户端接收过慢");
        return;
      }
      this.socket.send(line);
    }
  }

  /** 由网关直接回复的错误响应（不经过子进程） */
  private reply(id: string, error: ManagementError): void {
    const response: ManagementResponse = { type: "res", id, ok: false, error };
    if (this.socket.readyState === this.socket.OPEN) this.socket.send(JSON.stringify(response));
  }

  /**
   * 结束会话。可重复调用。
   * 先关 stdin 让 CLI 正常断开守护进程订阅；超时仍未退出再强制结束子进程。
   */
  shutdown(code = 1000, reason = ""): void {
    if (this.closed) return;
    this.closed = true;
    const child = this.child;
    if (child && child.exitCode === null && child.signalCode === null) {
      child.stdin.end();
      const timer = setTimeout(() => child.kill(), EXIT_GRACE_MS);
      timer.unref();
      child.once("exit", () => clearTimeout(timer));
    }
    if (this.socket.readyState === this.socket.OPEN || this.socket.readyState === this.socket.CONNECTING) this.socket.close(code, reason);
    this.onEnd();
  }
}
