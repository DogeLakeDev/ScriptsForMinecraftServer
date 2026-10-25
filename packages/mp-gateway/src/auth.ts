/**
 * auth.ts — 访问令牌校验与失败限流
 *
 * 使用场景：server.ts 在 WebSocket 升级和世界包上传两个入口复用同一套校验（DRY），
 * 令牌只认请求头 `Authorization: Bearer <token>`，不接受查询参数，避免令牌出现在代理访问日志里。
 */
import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

/** 从 Authorization 头取出 Bearer 令牌；格式不对返回空串 */
export function bearerToken(request: IncomingMessage): string {
  const header = request.headers.authorization;
  if (typeof header !== "string") return "";
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? "";
}

/** 常量时间比较令牌。先取摘要，使长度不同的输入也走同样的比较路径。 */
export function tokenMatches(expected: string, given: string): boolean {
  if (!given) return false;
  const left = createHash("sha256").update(expected).digest();
  const right = createHash("sha256").update(given).digest();
  return timingSafeEqual(left, right);
}

/**
 * 客户端地址。
 * 使用场景：限流按地址计数。位于反向代理之后时所有连接都来自 127.0.0.1，需要开启 trustProxy 才读取 X-Forwarded-For。
 */
export function clientAddress(request: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.socket.remoteAddress ?? "unknown";
}

/**
 * 鉴权失败限流：同一地址在窗口期内失败次数达到上限后，暂时拒绝该地址的所有尝试。
 * 使用场景：server.ts 的两个鉴权入口共用一个实例，防止在线穷举令牌。
 */
export class AuthThrottle {
  private failures = new Map<string, { count: number; since: number }>();

  constructor(
    private readonly limit = 8,
    private readonly windowMs = 60_000,
  ) {}

  /** 该地址当前是否处于封禁期 */
  blocked(address: string, now = Date.now()): boolean {
    const record = this.failures.get(address);
    if (!record) return false;
    if (now - record.since > this.windowMs) {
      this.failures.delete(address);
      return false;
    }
    return record.count >= this.limit;
  }

  /** 记一次失败 */
  fail(address: string, now = Date.now()): void {
    const record = this.failures.get(address);
    if (!record || now - record.since > this.windowMs) this.failures.set(address, { count: 1, since: now });
    else record.count += 1;
    if (this.failures.size > 4096) this.prune(now);
  }

  /** 鉴权成功后清除该地址的失败记录 */
  succeed(address: string): void {
    this.failures.delete(address);
  }

  /** 清掉过期记录，避免大量来源地址撑大内存 */
  private prune(now: number): void {
    for (const [key, record] of this.failures) if (now - record.since > this.windowMs) this.failures.delete(key);
  }
}
