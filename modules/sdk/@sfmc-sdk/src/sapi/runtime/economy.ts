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
 * 通过 service registry 查询玩家经济账户。
 * 调用方须已调用 `setServiceModuleContext` 并具备 `service:economy.account.get` 权限。
 *
 * 注：跨模块读写账本的权威简洁 API 位于 `@sfmc-bds/module-economy/client`；
 * 本 `Money` 工具类作为玩家侧余额本地缓存门面（提供 get / load / setCached / UNIT），底层统一调用 `economy.account.*` 服务。
 *
 * @param playerId 玩家唯一标识（XUID / UUID）。
 * @param playerName 玩家名称。
 * @returns 账户快照或在查询失败时返回 `null`。
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
 * 执行充值或扣款交易请求。
 * 底层调用对应的 `economy.account.credit` 或 `economy.account.debit` 跨模块服务。
 *
 * @param req 经济交易请求结构。
 * @returns 交易执行结果。
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

/**
 * 玩家侧余额缓存助手类。
 * 底层统一通过 service registry 访问 `economy.account.*` 跨模块服务，并在本地维持短期缓存与并发防重。
 */
export class Money {
  /** 默认货币单位显示名称（例如：“节操”）。 */
  static readonly UNIT = "节操";

  private static cache = new Map<
    string,
    { balance: number; version: number; loadedAt: number; loading: boolean }
  >();

  /**
   * 读取玩家当前余额；若尚未加载完成则返回当前缓存值或 `0`。
   *
   * @param player 目标玩家对象。
   * @returns 玩家余额数值。
   */
  static get(player: Player): number {
    const b = this.getCached(player) ?? 0;
    debug.d("MNY", `get ${player.name}=${b}`);
    return b;
  }

  /**
   * 读取本地缓存的玩家余额；若尚未加载则返回 `null`。
   *
   * @param player 目标玩家对象。
   * @returns 缓存中的余额数值，无缓存时返回 `null`。
   */
  static getCached(player: Player): number | null {
    return this.cache.get(player.id)?.balance ?? null;
  }

  /**
   * 读取本地缓存的账户版本号；若尚未加载则返回 `null`。
   *
   * @param player 目标玩家对象。
   * @returns 缓存中的乐观锁版本号，无缓存时返回 `null`。
   */
  static getVersion(player: Player): number | null {
    return this.cache.get(player.id)?.version ?? null;
  }

  /**
   * 写入本地缓存；若传入的 version 低于当前已缓存的版本号则跳过（防止过期的并发响应覆盖较新的数据）。
   *
   * @param player 目标玩家对象。
   * @param balance 最新的余额数值。
   * @param version 最新的乐观锁版本号。
   */
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

  /**
   * 从服务端拉取玩家最新账户数据并更新本地缓存；自动复用进行中的并发请求。
   *
   * @param player 目标玩家对象。
   * @returns 最新的玩家账户余额。
   */
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
   * 增减玩家余额。传入正数为充值入账，负数为扣款；交易成功后会自动刷新本地缓存。
   *
   * @param player 目标玩家对象。
   * @param money 变动金额数值（正数入账，负数扣款）。
   * @returns 交易执行成功返回 `true`，失败返回 `false`。
   */
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
}

