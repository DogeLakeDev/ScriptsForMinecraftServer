/**
 * @sfmc/module-chat-sounds — v2 入口
 *
 * 与 afk / spawn-protect 同型:ModuleRegistry.register + 零 SDK drawer。
 * 监听 world.beforeEvents.chatSend,关键词命中后给所有玩家放音效,带 200 tick 冷却。
 */

import { system, world } from "@minecraft/server";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-chat-sounds";

const KEYWORDS: Record<string, string> = {
  ciallo: "cs.ciallo",
  咕咕嘎嘎: "cs.gugugaga",
  汩汩咕: "cs.gugugu",
  baka: "cs.baka",
  yee: "cs.yee",
  干嘛: "mob.chicken.hurt",
  huh: "cs.huh",
};

const COOLDOWN_TICKS = 200;

const cooldownMap: Record<string, boolean> = {};
let chatSub: { unsubscribe(): void } | undefined;

function playSoundForAll(soundId: string): void {
  system.run(() => {
    for (const p of world.getAllPlayers()) {
      try {
        p.playSound(soundId);
      } catch {
        /* ignore */
      }
    }
  });
}

function matchesKeyword(message: string): string | undefined {
  const lower = message.toLowerCase();
  for (const k in KEYWORDS) {
    if (lower.includes(k.toLowerCase())) return KEYWORDS[k];
  }
  return undefined;
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // 无对外命令 / 权限
    },
    async init() {
      chatSub = world.beforeEvents.chatSend.subscribe((event) => {
        const soundId = matchesKeyword(event.message);
        if (!soundId) return;

        const sender = event.sender;
        if (sender.getGameMode() !== "creative") {
          const id = sender.id;
          if (cooldownMap[id]) return;
          cooldownMap[id] = true;
          system.runTimeout(() => {
            delete cooldownMap[id];
          }, COOLDOWN_TICKS);
        }

        playSoundForAll(soundId);
      });
      debug.i("ChatSounds", `init: subscribed (${Object.keys(KEYWORDS).length} keywords)`);
    },
    cleanup() {
      try {
        chatSub?.unsubscribe();
      } catch {
        /* ignore */
      }
      chatSub = undefined;
    },
  },
});