import { system, world, Player } from "@minecraft/server";

const KEYWORDS: Record<string, string> = {
  ciallo: "cs.ciallo",
  咕咕嘎嘎: "cs.gugugaga",
  汩汩咕: "cs.gugugu",
  baka: "cs.baka",
  yee: "cs.yee",
  干嘛: "mob.chicken.hurt",
  huh: "cs.huh",
};

export class ChatSoundsHelper {
  private static instance: ChatSoundsHelper;
  private cooldownTicks = 200;
  private keywords: Record<string, string>;
  private cooldownMap: Record<string, boolean> = {};

  private constructor(keywords: Record<string, string>) {
    this.keywords = keywords;
  }

  static getInstance(): ChatSoundsHelper {
    if (!ChatSoundsHelper.instance) {
      ChatSoundsHelper.instance = new ChatSoundsHelper(KEYWORDS);
    }
    return ChatSoundsHelper.instance;
  }

  private chatSub: any = undefined;

  registerEvent(): void {
    if (this.chatSub) return;
    this.chatSub = world.beforeEvents.chatSend.subscribe((event) => {
      const msg = event.message;
      for (const keyWord in this.keywords) {
        if (!msg.toLowerCase().includes(keyWord.toLowerCase())) continue;

        const sender = event.sender;

        if (sender.getGameMode() !== "Creative") {
          const id = sender.id;
          if (this.cooldownMap[id]) return;
          this.cooldownMap[id] = true;
          system.runTimeout(() => {
            delete this.cooldownMap[id];
          }, this.cooldownTicks);
        }

        const soundId = this.keywords[keyWord];
        system.run(() => {
          for (const p of world.getAllPlayers()) {
            try {
              p.playSound(soundId);
            } catch {
              /* ignore */
            }
          }
        });
        return;
      }
    });
  }

  stop(): void {
    if (this.chatSub?.unsubscribe) {
      try { this.chatSub.unsubscribe(); } catch {}
    }
    this.chatSub = undefined;
  }
}
