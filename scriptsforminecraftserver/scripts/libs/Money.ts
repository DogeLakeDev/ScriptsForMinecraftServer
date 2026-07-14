import { Player } from "@minecraft/server";
import { applyEconomyTransaction, getEconomyAccount } from "../api/EconomyApi";

export class Money {
  /** 货币单位名称 */
  static readonly UNIT = "节操";
  /**
   * 获取玩家金钱数量
   */
  private static cache = new Map<string, { balance: number; version: number; loadedAt: number; loading: boolean }>();
  static get(player: Player): number { return this.getCached(player) ?? 0; }
  static getCached(player: Player): number | null { return this.cache.get(player.id)?.balance ?? null; }
  static getVersion(player: Player): number | null { return this.cache.get(player.id)?.version ?? null; }
  static setCached(player: Player, balance: number, version = 0): void {
    const previous = this.cache.get(player.id);
    if (previous && version > 0 && previous.version > version) return;
    this.cache.set(player.id, { balance, version, loadedAt: Date.now(), loading: false });
  }
  static async load(player: Player): Promise<number> {
    const previous = this.cache.get(player.id);
    if (previous?.loading) return previous.balance;
    if (previous) previous.loading = true;
    const account = await getEconomyAccount(player.id, player.name);
    const balance = account?.balance ?? previous?.balance ?? 0;
    if (account) this.setCached(player, balance, account.version);
    else if (previous) previous.loading = false;
    return balance;
  }

  /**
   * 设置玩家金钱数量
   */
  /** @deprecated Use add() or a domain transaction. This no longer performs read-modify-write. */
  static async set(player: Player, money: number): Promise<boolean> {
    if (!Number.isSafeInteger(money) || money < 0) return false;
    this.setCached(player, money, this.getVersion(player) ?? 0);
    return true;
  }

  /**
   * 给予玩家金钱
   */
  static async add(player: Player, money: number): Promise<boolean> {
    if (!Number.isSafeInteger(money) || money === 0) return money === 0;
    const result = await applyEconomyTransaction({ actorId: player.id, sourcePlayerId: money < 0 ? player.id : undefined, targetPlayerId: money > 0 ? player.id : undefined, amount: Math.abs(money), type: money < 0 ? "debit" : "credit" });
     if (result.ok) this.setCached(player, result.balance ?? this.get(player) + money, result.version);
    return result.ok;
  }

  /**
   * 初始化计分板
   */
  static initScoreboard() {
    // Economy is persisted by db-server. The legacy scoreboard is no longer authoritative.
  }
}
