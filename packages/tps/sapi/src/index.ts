/**
 * @sfmc/module-tps — v2 入口
 *
 * ModuleRegistry.register + 提供两个 service:
 *   - tps.current  → number (当前 TPS,两位小数,上限 20)
 *   - tps.status   → string (带 § 颜色码的 "[TPS] §aXX.XX §7/ 20.00")
 *
 * 与 afk/spawn-protect/chat-sounds 同型但额外暴露 service(供 monitor 等消费方用)。
 */

import { Player, system, world } from "@minecraft/server";
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-tps";

const MAX_SAMPLES = 100;
const tickTimes: number[] = [];

let recordRunId: number | undefined;

export function getTPS(): number {
  if (tickTimes.length < 10) return 20;
  const first = tickTimes[0];
  const last = tickTimes[tickTimes.length - 1];
  if (first === undefined || last === undefined) return 20;
  const elapsed = (last - first) / 1000;
  const tickCount = tickTimes.length - 1;
  const tps = tickCount / elapsed;
  return Math.round(Math.min(tps, 20) * 100) / 100;
}

export function getTPSStatus(): string {
  const tps = getTPS();
  let color: string;
  if (tps >= 19.5) color = "§a";
  else if (tps >= 15) color = "§e";
  else if (tps >= 10) color = "§6";
  else color = "§c";
  return `§7[TPS] ${color}${tps} §7/ 20.00`;
}

function startRecord(): void {
  if (recordRunId !== undefined) return;
  recordRunId = system.runInterval(() => {
    tickTimes.push(Date.now());
    if (tickTimes.length > MAX_SAMPLES) {
      tickTimes.shift();
    }
  }, 1);
}

function stopRecord(): void {
  if (recordRunId === undefined) return;
  try {
    system.clearRun(recordRunId);
  } catch {
    /* ignore */
  }
  recordRunId = undefined;
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("tps.see", Permission.Any);
    },
    async init() {
      startRecord();
      debug.i("TPS", "init");
    },
    registerCommands() {
      Command.register(
        "tps",
        "tps.see",
        (player: Player | undefined) => {
          const msg = getTPSStatus();
          if (player) {
            Msg.info(msg, player);
          } else {
            world.sendMessage(msg);
          }
        },
        "查看服务器 TPS",
        "tps"
      );
    },
    cleanup() {
      stopRecord();
      debug.i("TPS", "stop");
    },
  },
});