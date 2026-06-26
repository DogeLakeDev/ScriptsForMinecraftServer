/* ---------------------------------------- *\
 *  Name        :  出生保护                   *
 *  Description :  进入服务器或重生时给予无敌     *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { world } from "@minecraft/server";
export class SpawnProtect {
    static registerEvents() {
        world.afterEvents.playerSpawn.subscribe((ev) => {
            if (ev.player.getEffect("minecraft:resistance") === undefined) {
                ev.player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
            }
        });
    }
}
//# sourceMappingURL=SpawnProtect.js.map