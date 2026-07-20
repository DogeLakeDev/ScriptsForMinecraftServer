import { Player } from "@minecraft/server";
import { HttpDB } from "./httpdb.js";
import { debug } from "./debug-log.js";

export interface EconomyAccount {
  balance: number;
  version: number;
}

export interface EconomyTransactionRequest {
  actorId: string;
  sourcePlayerId?: string;
  targetPlayerId?: string;
  amount: number;
  type: "debit" | "credit";
  note?: string;
}

export interface EconomyTransactionResult {
  ok: boolean;
  balance?: number;
  version?: number;
  transactionId?: string;
  error?: string;
}

async function getEconomyAccount(playerId: string, playerName: string): Promise<EconomyAccount | null> {
  try {
    const body = await HttpDB.get(`/api/sfmc/economy/account/${encodeURIComponent(playerId)}`);
    if (!body) return null;
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed.balance !== "number") return null;
    return { balance: parsed.balance, version: parsed.version ?? 0 };
  } catch (e) {
    debug.w("MNY", `getEconomyAccount failed for ${playerName}: ${(e as Error).message}`);
    return null;
  }
}

async function applyEconomyTransaction(req: EconomyTransactionRequest): Promise<EconomyTransactionResult> {
  try {
    const res = await HttpDB.typedRequest<EconomyTransactionResult & { balance?: number }>(
      "POST" as any,
      "/api/sfmc/economy/transaction",
      {
        actorId: req.actorId,
        sourcePlayerId: req.sourcePlayerId,
        targetPlayerId: req.targetPlayerId,
        amount: req.amount,
        type: req.type,
        note: req.note,
      }
    );
    if (res.ok && res.data) return res.data;
    return { ok: false, error: res.error || "request_failed" };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export class Money {
  static readonly UNIT = "节操";

  private static cache = new Map<
    string,
    { balance: number; version: number; loadedAt: number; loading: boolean }
  >();

  static get(player: Player): number {
    const b = this.getCached(player) ?? 0;
    debug.d("MNY", `get ${player.name}=${b}`);
    return b;
  }

  static getCached(player: Player): number | null {
    return this.cache.get(player.id)?.balance ?? null;
  }

  static getVersion(player: Player): number | null {
    return this.cache.get(player.id)?.version ?? null;
  }

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

  /** @deprecated Use add() or a domain transaction. */
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

  static initScoreboard() {
    // Economy is persisted by db-server. The legacy scoreboard is no longer authoritative.
  }
}