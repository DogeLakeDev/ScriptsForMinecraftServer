/**
 * gateway.ts — 桌面端连接 SFMC 管理网关
 *
 * 使用场景：实例的连接方式选「管理网关」时，用和小程序相同的地址与访问令牌建立 WebSocket，
 * 再把它适配成 ManagementClient 已有的按行帧通道。地址规整规则与小程序 profiles.ts 一致。
 */
import { Duplex } from "node:stream";
import WebSocket, { type RawData } from "ws";
import { normalizeEndpoint, socketUrl } from "../shared/gateway-url.js";

/** 网关自定义关闭码，与 mp-gateway server.ts 一致 */
const CLOSE_REASONS: Record<number, string> = {
  4401: "访问令牌无效",
  4429: "鉴权失败次数过多，请稍后再试",
  4503: "管理会话已满，请关闭其他设备上的连接",
};

/** 把 WebSocket 关闭原因转成用户能看懂的句子 */
function closeText(code: number, reason: RawData): string {
  const text = reason.toString().trim();
  if (text) return text;
  return CLOSE_REASONS[code] ?? (code === 1000 ? "管理连接已结束" : `网关连接已关闭 (${code})`);
}

/** 一条已打开的网关连接：帧通道给 ManagementClient，close 只结束这条通道 */
export interface GatewayLink {
  stream: Duplex;
  close(): void;
}

/**
 * 连接网关并返回按行帧的双工流。
 * 使用场景：Session 在 kind 为 gateway 时用它代替本机子进程或 SSH exec。
 * 网关每条消息是一帧；ManagementClient 按换行切帧，所以这里补上换行。
 */
export function openGateway(endpoint: string, token: string): Promise<GatewayLink> {
  const url = socketUrl(normalizeEndpoint(endpoint));
  const ws = new WebSocket(url, { headers: { Authorization: `Bearer ${token}` }, handshakeTimeout: 15_000 });
  const stream = new Duplex({
    read() {},
    write(chunk, _encoding, callback) {
      if (ws.readyState !== WebSocket.OPEN) {
        callback(new Error("网关连接已断开"));
        return;
      }
      ws.send(String(chunk), callback);
    },
  });
  return new Promise((resolve, reject) => {
    let opened = false;
    const fail = (error: Error) => {
      if (opened) return;
      opened = true;
      ws.terminate();
      reject(error);
    };
    ws.on("message", (data) => {
      const text = data.toString();
      stream.push(text.endsWith("\n") ? text : `${text}\n`);
    });
    ws.on("error", (error) => {
      if (!opened) fail(error);
      else stream.destroy(error);
    });
    ws.on("unexpected-response", (_request, response) => {
      fail(new Error(`网关拒绝连接 (${response.statusCode ?? "?"})`));
    });
    ws.on("close", (code, reason) => {
      const message = closeText(code, reason);
      if (!opened) {
        fail(new Error(message));
        return;
      }
      stream.destroy(new Error(message));
    });
    ws.once("open", () => {
      if (opened) return;
      opened = true;
      resolve({
        stream,
        close() {
          if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) ws.close(1000, "client closed");
        },
      });
    });
  });
}
