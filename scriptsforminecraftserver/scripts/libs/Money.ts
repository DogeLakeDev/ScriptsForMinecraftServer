import { Player } from "@minecraft/server";
import { applyEconomyTransaction, getEconomyAccount } from "../api/EconomyApi";

export class Money {
  /** 货币单位名称 */
  static readonly UNIT = "节操";
  /**
   * 获取玩家金钱数量
   */
  private static cache = new Map<string, number>();
  static get(player: Player): number { return this.cache.get(player.id) ?? 0; }
  static async load(player: Player): Promise<number> {
    const account = await getEconomyAccount(player.id, player.name);
    const balance = account?.balance ?? 0;
    this.cache.set(player.id, balance);
    return balance;
  }

  /**
   * 设置玩家金钱数量
   */
  static async set(player: Player, money: number): Promise<boolean> {
    const current = await this.load(player);
    if (money === current) return true;
    return this.add(player, money - current);
  }

  /**
   * 给予玩家金钱
   */
  static async add(player: Player, money: number): Promise<boolean> {
    if (!Number.isSafeInteger(money) || money === 0) return money === 0;
    const result = await applyEconomyTransaction({ actorId: player.id, sourcePlayerId: money < 0 ? player.id : undefined, targetPlayerId: money > 0 ? player.id : undefined, amount: Math.abs(money), type: money < 0 ? "debit" : "credit" });
    if (result.ok) this.cache.set(player.id, result.balance ?? this.get(player) + money);
    return result.ok;
  }

  /**
   * 初始化计分板
   */
  static initScoreboard() {
    // Economy is persisted by db-server. The legacy scoreboard is no longer authoritative.
  }
}
