/**
 * @sfmc/module-spawn-protect — v2 入口
 *
 * 与 afk v2 同型:ModuleRegistry.register + 零 db / 零 service。
 * 玩家重生事件订阅 → 加 resistance 效果 (3 秒, amplifier 5)。
 */

import { Player, world } from "@minecraft/server";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-spawn-protect";

function setProtect(player: Player): void {
  if (player.getEffect("minecraft:resistance") === undefined) {
    player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
  }
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // 无对外命令 / 权限
    },
    async init() {
      world.afterEvents.playerSpawn.subscribe((event) => {
        setProtect(event.player);
      });
      debug.i("SpawnProtect", "init: subscribed to playerSpawn");
    },
    cleanup() {
      // playerSpawn 订阅随 world 生命周期自动清理;此处留空
    },
  },
});