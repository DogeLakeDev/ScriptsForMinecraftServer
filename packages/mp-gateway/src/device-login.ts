/**
 * device-login.ts — 桌面端“用小程序登录”的设备授权流程
 *
 * 使用场景（device-routes.ts 暴露为 HTTP）：
 *   1. 桌面端 start：拿到 deviceId（放进二维码）、6 位 userCode（手动输入用）与只有桌面端知道的 pollSecret；
 *   2. 管理员在小程序扫码或输入短码 → approve（由路由层先确认其为 Admin）；
 *   3. 桌面端 poll 拿到设备凭证 `sfmcd1.<grantId>.<secret>`，之后作为 Bearer 连接 /manage。
 * 授权记录持久化（只存凭证摘要），每次连接由鉴权链现查授权人是否仍为管理员；可在小程序查看与撤销。
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { HttpError } from "./routes.js";

/** 设备凭证前缀 */
export const DEVICE_TOKEN_PREFIX = "sfmcd1.";
/** 待授权请求有效期（与绑定短码一致） */
export const DEVICE_PENDING_TTL_MS = 5 * 60 * 1000;
/** 授权后桌面端领取凭证的宽限时间 */
const CLAIM_GRACE_MS = 2 * 60 * 1000;
/** 设备凭证有效期：30 天，到期后需重新扫码 */
export const DEVICE_GRANT_TTL_MS = 30 * 24 * 3600 * 1000;
/** 建议桌面端轮询间隔 */
export const DEVICE_POLL_INTERVAL_MS = 2000;
/** 同时存在的待授权请求上限，防止被刷满内存 */
const MAX_PENDING = 64;
/** 设备名称长度上限 */
const MAX_NAME_LENGTH = 48;

/** 一条已授权设备记录（持久化） */
export interface DeviceGrant {
  id: string;
  /** 桌面端提交的设备名称（例如主机名） */
  name: string;
  /** 授权人微信 openid，连接时据此复查管理员身份 */
  approvedBy: string;
  /** 授权人游戏名（展示用） */
  approvedByName: string;
  createdAt: number;
  expiresAt: number;
  lastUsedAt: number;
  /** 凭证 secret 的 SHA-256 摘要 */
  secretHash: string;
}

/** 对小程序展示的设备记录（不含摘要与 openid） */
export type DeviceGrantView = Omit<DeviceGrant, "secretHash" | "approvedBy">;

/** 授权记录存储（DIP：默认文件实现，单测可用内存实现） */
export interface DeviceGrantStore {
  load(): DeviceGrant[];
  save(grants: DeviceGrant[]): void;
}

/** 定位一个待授权请求：二维码带 deviceId，手动输入带 userCode */
export interface PendingRef {
  deviceId?: string;
  userCode?: string;
}

/** 待授权请求对外视图（小程序确认框展示） */
export interface PendingView {
  deviceId: string;
  name: string;
  expiresAt: number;
}

/** 桌面端轮询结果 */
export type PollResult =
  | { status: "pending" }
  | { status: "approved"; credential: string; grantId: string; approvedByName: string; expiresAt: number }
  | { status: "denied" }
  | { status: "expired" };

interface Pending {
  deviceId: string;
  userCode: string;
  pollSecretHash: Buffer;
  name: string;
  expiresAt: number;
  status: "pending" | "approved" | "denied";
  approved?: { credential: string; grantId: string; approvedByName: string; expiresAt: number };
}

function sha256(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

/**
 * 基于 JSON 文件的授权记录存储（0600 权限，先写临时文件再改名）。
 * 使用场景：server.ts 用 config.devicesFile 创建。
 */
export function createFileGrantStore(file: string): DeviceGrantStore {
  return {
    load() {
      try {
        const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { grants?: unknown };
        return Array.isArray(parsed.grants) ? (parsed.grants as DeviceGrant[]) : [];
      } catch {
        return [];
      }
    },
    save(grants) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.${randomBytes(4).toString("hex")}.tmp`;
      fs.writeFileSync(temp, JSON.stringify({ grants }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temp, file);
    },
  };
}

/** 设备授权服务 */
export class DeviceLogin {
  private pending = new Map<string, Pending>();

  constructor(
    private readonly store: DeviceGrantStore,
    private readonly now: () => number = Date.now,
  ) {}

  /** 桌面端发起登录 */
  start(name: string): { deviceId: string; userCode: string; pollSecret: string; expiresAt: number; intervalMs: number } {
    this.prune();
    if (this.pending.size >= MAX_PENDING) throw new HttpError(503, "登录请求过多，请稍后再试");
    const deviceId = randomBytes(16).toString("base64url");
    const pollSecret = randomBytes(24).toString("base64url");
    let userCode = "";
    for (let attempt = 0; attempt < 16 && !userCode; attempt++) {
      const candidate = String(randomInt(0, 1_000_000)).padStart(6, "0");
      if (![...this.pending.values()].some((row) => row.userCode === candidate)) userCode = candidate;
    }
    if (!userCode) throw new HttpError(503, "登录请求过多，请稍后再试");
    const expiresAt = this.now() + DEVICE_PENDING_TTL_MS;
    const cleanName = name.replace(/[\r\n\t\0]/g, " ").trim().slice(0, MAX_NAME_LENGTH) || "桌面端";
    this.pending.set(deviceId, { deviceId, userCode, pollSecretHash: sha256(pollSecret), name: cleanName, expiresAt, status: "pending" });
    return { deviceId, userCode, pollSecret, expiresAt, intervalMs: DEVICE_POLL_INTERVAL_MS };
  }

  /** 查找仍在等待授权的请求（小程序确认前展示设备名）；找不到抛 404 */
  describe(ref: PendingRef): PendingView {
    const row = this.findWaiting(ref);
    return { deviceId: row.deviceId, name: row.name, expiresAt: row.expiresAt };
  }

  /** 管理员批准：生成设备凭证并持久化授权记录。调用方须已确认 approver 为 Admin。 */
  approve(ref: PendingRef, approver: { openid: string; name: string }): PendingView {
    const row = this.findWaiting(ref);
    const now = this.now();
    const grantId = randomBytes(9).toString("base64url");
    const secret = randomBytes(32).toString("base64url");
    const grant: DeviceGrant = {
      id: grantId,
      name: row.name,
      approvedBy: approver.openid,
      approvedByName: approver.name,
      createdAt: now,
      expiresAt: now + DEVICE_GRANT_TTL_MS,
      lastUsedAt: 0,
      secretHash: sha256(secret).toString("hex"),
    };
    this.store.save([...this.activeGrants(), grant]);
    row.status = "approved";
    row.approved = { credential: `${DEVICE_TOKEN_PREFIX}${grantId}.${secret}`, grantId, approvedByName: approver.name, expiresAt: grant.expiresAt };
    row.expiresAt = Math.max(row.expiresAt, now + CLAIM_GRACE_MS);
    return { deviceId: row.deviceId, name: row.name, expiresAt: row.expiresAt };
  }

  /** 管理员拒绝 */
  deny(ref: PendingRef): void {
    this.findWaiting(ref).status = "denied";
  }

  /** 桌面端轮询；pollSecret 不符按“已过期”处理，不泄露请求是否存在 */
  poll(deviceId: string, pollSecret: string): PollResult {
    this.prune();
    const row = this.pending.get(deviceId);
    if (!row) return { status: "expired" };
    const given = sha256(pollSecret);
    if (!timingSafeEqual(given, row.pollSecretHash)) return { status: "expired" };
    if (row.status === "pending") return { status: "pending" };
    this.pending.delete(deviceId);
    if (row.status === "denied" || !row.approved) return { status: "denied" };
    return { status: "approved", ...row.approved };
  }

  /** 校验设备凭证，返回授权记录；无效、过期或已撤销返回 null。成功时记录最近使用时间。 */
  verify(credential: string): DeviceGrant | null {
    if (!credential.startsWith(DEVICE_TOKEN_PREFIX)) return null;
    const [grantId, secret] = credential.slice(DEVICE_TOKEN_PREFIX.length).split(".");
    if (!grantId || !secret) return null;
    const grants = this.activeGrants();
    const grant = grants.find((row) => row.id === grantId);
    if (!grant) return null;
    const expected = Buffer.from(grant.secretHash, "hex");
    const given = sha256(secret);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    grant.lastUsedAt = this.now();
    this.store.save(grants);
    return grant;
  }

  /** 列出有效的授权设备 */
  list(): DeviceGrantView[] {
    return this.activeGrants().map(({ secretHash: _hash, approvedBy: _openid, ...view }) => view);
  }

  /** 撤销一台设备，返回是否存在 */
  revoke(grantId: string): boolean {
    const grants = this.activeGrants();
    const next = grants.filter((row) => row.id !== grantId);
    if (next.length === grants.length) return false;
    this.store.save(next);
    return true;
  }

  /** 未过期的授权记录 */
  private activeGrants(): DeviceGrant[] {
    const now = this.now();
    return this.store.load().filter((row) => row && typeof row.id === "string" && row.expiresAt > now);
  }

  /** 找到仍在等待授权的请求 */
  private findWaiting(ref: PendingRef): Pending {
    this.prune();
    const row = ref.deviceId
      ? this.pending.get(ref.deviceId)
      : ref.userCode
        ? [...this.pending.values()].find((item) => item.userCode === ref.userCode)
        : undefined;
    if (!row || row.status !== "pending") throw new HttpError(404, "登录请求不存在或已过期，请在桌面端重新发起");
    return row;
  }

  /** 清理过期的待授权请求 */
  private prune(): void {
    const now = this.now();
    for (const [id, row] of this.pending) if (row.expiresAt <= now) this.pending.delete(id);
  }
}
