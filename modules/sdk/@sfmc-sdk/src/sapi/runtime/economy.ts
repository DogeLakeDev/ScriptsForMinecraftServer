import { Player } from "@minecraft/server";
import { service, ServiceError } from "../service/client.js";
import { debug } from "./debug-log.js";

/** 玩家经济账户快照（余额 + 乐观锁版本号）。 */
export interface EconomyAccount {
  /** 当前余额。 */
  balance: number;
  /** 乐观锁版本号。 */
  version: number;
}

/** 经济交易请求（credit/debit 共用形状）。 */
export interface EconomyTransactionRequest {
  /** 操作者玩家 id。 */
  actorId: string;
  /** 扣款方玩家 id（debit 时）。 */
  sourcePlayerId?: string;
  /** 入账方玩家 id（credit 时）。 */
  targetPlayerId?: string;
  /** 交易金额（正整数）。 */
  amount: number;
  /** 交易类型：扣款或入账。 */
  type: "debit" | "credit";
  /** 可选备注。 */
  note?: string;
}

/** 经济交易结果。 */
export interface EconomyTransactionResult {
  /** 是否成功。 */
  ok: boolean;
  /** 交易后余额。 */
  balance?: number;
  /** 交易后版本号。 */
  version?: number;
  /** 交易流水 id。 */
  transactionId?: string;
  /** 失败原因。 */
  error?: string;
}

type AccountView = { balance?: number; version?: number } | null;

type MutateView = {
  balance?: number;
  version?: number;
  transactionId?: string;
};

/**
 * 经 service registry 读账户(LSP:已无 /api/sfmc/economy/* REST)。
 * 调用方须已 setServiceModuleContext,且持有 service:economy.account.get。
 *
 * 注:跨模块写账本的权威简洁 API 在 @sfmc-bds/module-economy/client;
 * 本 Money 类仅作玩家侧余额缓存助手(get/load/setCached/UNIT),底层同样调 economy.account.*。
 */
async function getEconomyAccount(playerId: string, playerName: string): Promise<EconomyAccount | null> {
  try {
    const account = await service.get<AccountView>("economy.account.get", {
      playerId,
      playerName,
    });
    if (!account || typeof account.balance !== "number") return null;
    return { balance: account.balance, version: account.version ?? 0 };
  } catch (e) {
    debug.w("MNY", `getEconomyAccount failed for ${playerName}: ${(e as Error).message}`);
    return null;
  }
}

/**
 * credit/debit 走同名 service;保留旧 EconomyTransactionRequest 形状给调用方。
 */
async function applyEconomyTransaction(req: EconomyTransactionRequest): Promise<EconomyTransactionResult> {
  const playerId =
    req.type === "debit" ? (req.sourcePlayerId ?? req.actorId) : (req.targetPlayerId ?? req.actorId);
  const name = req.type === "debit" ? "economy.account.debit" : "economy.account.credit";
  try {
    const data = await service.get<MutateView>(name, {
      playerId,
      actorId: req.actorId,
      amount: req.amount,
      reason: req.note ?? "",
    });
    const out: EconomyTransactionResult = { ok: true };
    if (typeof data?.balance === "number") out.balance = data.balance;
    if (typeof data?.version === "number") out.version = data.version;
    if (typeof data?.transactionId === "string") out.transactionId = data.transactionId;
    return out;
  } catch (e) {
    const err = e as ServiceError;
    return { ok: false, error: err.message || "request_failed" };
  }
}

/** 玩家侧余额缓存助手；底层经 service registry 调 economy.account.*。 */
export class Money {
  /** 货币单位名称。 */
  static readonly UNIT = "节操";

  private static cache = new Map<
    string,
    { balance: number; version: number; loadedAt: number; loading: boolean }
  >();

  /** 读玩家余额；未加载时返回缓存或 0。 */
  static get(player: Player): number {
    const b = this.getCached(player) ?? 0;
    debug.d("MNY", `get ${player.name}=${b}`);
    return b;
  }

  /** 读本地缓存余额；未加载返回 null。 */
  static getCached(player: Player): number | null {
    return this.cache.get(player.id)?.balance ?? null;
  }

  /** 读本地缓存版本号；未加载返回 null。 */
  static getVersion(player: Player): number | null {
    return this.cache.get(player.id)?.version ?? null;
  }

  /** 写入本地缓存；若传入 version 低于已缓存则跳过（防 stale 覆盖）。 */
  static setCached(player: Player, balance: number, version = 0): void {
    const previous = this.cache.get(player.id);
    if (previous && version > 0 && previous.version > version) {
      debug.d("MNY", `setCached SKIP ${player.name}: stale ver=${version} < cached=${previous.version}`);
      return;
    }
    this.cache.set(player.id, {
      balance,
      version,
      loadedAt: Date.now(),
      loading: false,
    });
    debug.d("MNY", `setCached ${player.name}: bal=${balance} ver=${version}`);
  }

  /** 从 db-server 拉取账户并更新缓存；并发 load 复用进行中的请求。 */
  static async load(player: Player): Promise<number> {
    const previous = this.cache.get(player.id);
    if (previous?.loading) return previous.balance;
    if (previous) previous.loading = true;
    debug.i("MNY", `load ${player.name}...`);
    const account = await getEconomyAccount(player.id, player.name);
    const balance = account?.balance ?? previous?.balance ?? 0;
    if (account) {
      this.setCached(player, balance, account.version);
      debug.i("MNY", `load ${player.name}: server bal=${balance} ver=${account.version}`);
    } else if (previous) {
      previous.loading = false;
    }
    return balance;
  }

  /**
   * 直接设置余额（仅改本地缓存，不写服务端）。
   * @deprecated 请改用 `add()` 或领域模块提供的交易 API。
   */
  static async set(player: Player, money: number): Promise<boolean> {
    console.warn(
      `[MNY] Money.set() is deprecated, called from ${new Error().stack?.split("\n")[2]?.trim() || "unknown"}`
    );
    if (!Number.isSafeInteger(money) || money < 0) {
      debug.w("MNY", `set invalid: ${player.name} ${money}`);
      return false;
    }
    this.setCached(player, money, this.getVersion(player) ?? 0);
    debug.w("MNY", `set (deprecated) ${player.name}=${money}`);
    return true;
  }

  /** 增减余额；正数入账、负数扣款，成功后刷新缓存。 */
  static async add(player: Player, money: number): Promise<boolean> {
    if (!Number.isSafeInteger(money) || money === 0) return money === 0;
    debug.i("MNY", `add ${player.name} ${money > 0 ? "+" : ""}${money}`);
    const req: EconomyTransactionRequest = {
      actorId: player.id,
      amount: Math.abs(money),
      type: money < 0 ? "debit" : "credit",
    };
    if (money < 0) req.sourcePlayerId = player.id;
    else req.targetPlayerId = player.id;
    const result = await applyEconomyTransaction(req);
    if (result.ok) {
      debug.i(
        "MNY",
        `add OK ${player.name}: bal=${result.balance} ver=${result.version} tx=${result.transactionId}`
      );
      if (result.balance !== undefined && result.version !== undefined) {
        this.setCached(player, result.balance, result.version);
      } else {
        this.cache.delete(player.id);
      }
    } else {
      debug.e("MNY", `add FAIL ${player.name} ${money}: ${result.error || "unknown"}`);
    }
    return result.ok;
  }

  /** 兼容占位：经济已改由 db-server 持久化，不再初始化计分板。 */
  static initScoreboard() {
    // Economy is persisted by db-server. The legacy scoreboard is no longer authoritative.
  }
}
