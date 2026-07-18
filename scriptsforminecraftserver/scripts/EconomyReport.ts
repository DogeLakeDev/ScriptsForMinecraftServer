import { system, world } from "@minecraft/server";
import { HttpRequestMethod } from "@minecraft/server-net";
import { Money } from "./libs/Economy.js";
import { HttpDB } from "./libs/HttpDB.js";

export class EconomyReport {
  private static runId: number | null = null;

  static start(): void {
    const now = new Date();
    const msUntilNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0).getTime() - now.getTime();
    const delay = msUntilNextMonth > 0 ? msUntilNextMonth : 86400000;
    this.runId = system.runTimeout(
      () => {
        this.publish();
        this.runId = system.runInterval(() => this.publish(), 30 * 86400 * 20);
      },
      Math.ceil(delay / 50)
    );
  }

  static stop(): void {
    if (this.runId !== null) {
      system.clearRun(this.runId);
      this.runId = null;
    }
  }

  private static async publish(): Promise<void> {
    const result = await HttpDB.typedRequest(HttpRequestMethod.GET, "/api/sfmc/economy/stats/monthly");
    if (!result.ok) return;
    const stats = (result.data as any)?.stats;
    if (!stats) return;
    const msg = [
      `§e===== 经济白皮书 (${stats.id}) =====`,
      `§7总发行量: §f${stats.total_issued} ${Money.UNIT}`,
      `§7总销毁量: §f${stats.total_destroyed} ${Money.UNIT}`,
      `§7总流通量: §f${stats.total_supply} ${Money.UNIT}`,
      `§7活跃账户: §f${stats.active_accounts}`,
      `§e==============================`,
    ].join("\n");
    world.sendMessage(msg);
  }
}
