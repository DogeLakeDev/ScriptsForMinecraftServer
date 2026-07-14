/* ---------------------------------------- *\
 *  Name        :  出生保护                   *
 *  Description :  进入服务器或重生时给予无敌     *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Player, world } from "@minecraft/server";

export class SpawnProtect {
  static setProtect(player: Player) {
    if (player.getEffect("minecraft:resistance") === undefined) {
      player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
    }
  }

  static registerEvents(): void {
    world.afterEvents.playerSpawn.subscribe((event) => {
      SpawnProtect.setProtect(event.player);
    });
  }
}
