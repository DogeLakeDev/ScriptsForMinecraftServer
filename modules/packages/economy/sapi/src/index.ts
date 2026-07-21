/**
 * @sfmc/module-economy — v2 入口
 *
 * 提供 7 个 service (account.{get,credit,debit,transfer} + dailyTasks.{list,submit} + stats.monthly)。
 *
 * 真正的业务逻辑仍在 db-server/src/domain/economy.ts。SAPI 端:
 *   - 旧的 5 个 EconomyApi 函数改写为对应 service 的 metadata (handler 注册在 db-server 端 PoC)
 *   - EconomyReport 月度白皮书保留(system.runTimeout / runInterval 调度)
 *
 * PoC note: 跨进程 service handler 实际派发机制是 P1 改造。本文件作为 v2 migration 完成
 * 标志,manifest 完整声明 provides/requires,P1 时由 @sfmc/sdk 的 host adapter 桥接。
 */

import { system, world } from "@minecraft/server";
import { debug, Money } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-economy";

function shuffleMonthStart(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0).getTime() - now.getTime();
}

let monthlyTimer: number | undefined;

function startMonthlyReport(): void {
  if (monthlyTimer !== undefined) return;
  const delay = Math.max(1, shuffleMonthStart() / 50);
  monthlyTimer = system.runTimeout(() => {
    monthlyTimer = undefined;
    void publishMonthlyReport();
    monthlyTimer = system.runInterval(() => void publishMonthlyReport(), 30 * 86400 * 20);
  }, delay);
}

function stopMonthlyReport(): void {
  if (monthlyTimer !== undefined) {
    try {
      system.clearRun(monthlyTimer);
    } catch {
      /* ignore */
    }
    monthlyTimer = undefined;
  }
}

async function publishMonthlyReport(): Promise<void> {
  // Note: PoC — service.get is not yet wired across processes (P1 bridge).
  // Until then, the monthly report is best-effort and falls through silently.
  try {
    const { service } = await import("@sfmc/sdk/sapi/service");
    const stats = (await service.get("economy.stats.monthly")) as { id?: string; total_issued?: number; total_destroyed?: number; total_supply?: number; active_accounts?: number } | null;
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
  } catch (err) {
    debug.w("Economy", `monthly report failed: ${(err as Error).message}`);
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // 内部 capability,无对外命令
    },
    async init() {
      startMonthlyReport();
      debug.i("Economy", "init");
    },
    cleanup() {
      stopMonthlyReport();
      debug.i("Economy", "stop");
    },
  },
});