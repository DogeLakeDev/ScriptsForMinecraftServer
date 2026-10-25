/**
 * routes.ts — 网关 HTTP 路由注册表
 *
 * 使用场景：server.ts 把各功能（健康检查、世界包上传、微信登录与玩家接口、设备登录）的路由列表拼在一起，
 * 收到请求时按方法 + 路径结尾查表分发。新增功能只需新增一个返回 Route[] 的工厂（OCP），不改 server.ts 的分发逻辑。
 * 路径按结尾匹配，反向代理无论是否去掉前缀（例如 /sfmc）都能工作，与原有 /health、/packs/inbox 的规则一致。
 */
import type { IncomingMessage, ServerResponse } from "node:http";

/** 一次 HTTP 请求的上下文 */
export interface RouteContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  /** 客户端地址（已按 trustProxy 处理），用于限流与日志 */
  address: string;
}

/** 一条 HTTP 路由 */
export interface Route {
  method: "GET" | "POST" | "PUT";
  /** 路径结尾，例如 "/player/me" */
  suffix: string;
  handle(context: RouteContext): Promise<void> | void;
}

/**
 * 查找匹配的路由：方法相同且路径以 suffix 结尾（suffix 以 "/" 开头，因此天然落在路径边界上）。
 * 多条都匹配时取 suffix 最长的一条，避免 "/devices" 抢走 "/auth/devices" 之类的更具体路由。
 */
export function findRoute(routes: readonly Route[], method: string, pathname: string): Route | undefined {
  let best: Route | undefined;
  for (const route of routes) {
    if (route.method !== method || !pathname.endsWith(route.suffix)) continue;
    if (!best || route.suffix.length > best.suffix.length) best = route;
  }
  return best;
}

/** JSON 请求体上限：玩家与设备登录接口只收很小的参数 */
const MAX_JSON_BYTES = 16 * 1024;

/** 带 HTTP 状态码的错误，路由处理函数抛出后由 server.ts 统一转成 JSON 响应 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * 读取 JSON 对象请求体；为空时返回 {}，超限或格式不对抛出 HttpError。
 * 使用场景：微信登录、玩家与设备登录接口。
 */
export async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_JSON_BYTES) throw new HttpError(413, "请求体过大");
    chunks.push(buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // 落到下面统一报错
  }
  throw new HttpError(400, "请求体必须是 JSON 对象");
}

/** 从 JSON 请求体取一个字符串字段（去首尾空白，非字符串视为空串） */
export function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  return typeof value === "string" ? value.trim() : "";
}
