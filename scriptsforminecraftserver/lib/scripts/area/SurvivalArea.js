/* ---------------------------------------- *\
 *  Name        :  生存区域                   *
 *  Description :  全图除创造区外强制生存（需开启创造区后才生效）       *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */
import { system, world, GameMode, } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { CreativeArea } from "./CreativeArea";
export class SurvivalArea {
    constructor() {
        this.enable = true;
    }
    /**
     * @returns {SurvivalArea}
     */
    static getInstance() {
        if (!SurvivalArea._instance) {
            SurvivalArea._instance = new SurvivalArea();
        }
        return SurvivalArea._instance;
    }
    init() {
        Permission.register('survivalarea.gamemode.bypass', Permission.OP);
        this.registerEvents();
    }
    inCreativeArea(entity) {
        for (const area of Config.creativeArea) {
            if (entity.dimension.id === area.dimension) {
                if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                    return true;
                }
            }
        }
        return false;
    }
    forceSurvival(player) {
        player.setGameMode(GameMode.Survival);
        player.sendMessage("§c已离开创造区域，强制切换为生存模式。");
    }
    registerEvents() {
        // 进服时检测
        world.afterEvents.playerSpawn.subscribe((event) => {
            if (!event.initialSpawn)
                return;
            if (!CreativeArea.enable)
                return;
            if (!this.enable)
                return;
            const player = event.player;
            const mode = player.getGameMode();
            if (mode === GameMode.Survival || mode === GameMode.Adventure)
                return;
            system.runTimeout(() => {
                if (!this.inCreativeArea(player)) {
                    this.forceSurvival(player);
                }
            }, 60);
        });
        // 阻止手动切换到创造/旁观（区外）
        world.beforeEvents.playerGameModeChange.subscribe((event) => {
            if (!CreativeArea.enable)
                return;
            if (!this.enable)
                return;
            if (event.toGameMode === GameMode.Creative || event.toGameMode === GameMode.Spectator) {
                if (Permission.check(event.player, 'survivalarea.gamemode.bypass'))
                    return;
                if (!this.inCreativeArea(event.player)) {
                    event.cancel = true;
                    event.player.sendMessage("§c你当前不在创造区域内，无法切换到该模式。");
                }
            }
        });
        // 跨维度传送后检测
        world.afterEvents.playerDimensionChange.subscribe((event) => {
            if (!CreativeArea.enable)
                return;
            if (!this.enable)
                return;
            const player = event.player;
            const mode = player.getGameMode();
            if (mode === GameMode.Survival || mode === GameMode.Adventure)
                return;
            system.runTimeout(() => {
                if (!this.inCreativeArea(player)) {
                    this.forceSurvival(player);
                }
            }, 10);
        });
    }
}
//# sourceMappingURL=SurvivalArea.js.map