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
