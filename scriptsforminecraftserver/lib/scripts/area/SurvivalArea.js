/* ---------------------------------------- *\
 *  Name        :  生存区域                   *
 *  Description :  全图除创造区外强制生存（需开启创造区后才生效）       *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */
import { system, world, GameMode, } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import * as Tool from "../libs/Tools";
import { Permission } from "../libs/Permission";
import { CreativeArea } from "./CreativeArea";
import { Msg } from "../libs/Tools";
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
    /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
    registerCommandsAndPermissions() {
        Permission.register("survivalarea.gamemode.bypass", Permission.OP);
    }
    /** 注册事件（由 entry.ts 统一调用） */
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
                if (Permission.check(event.player, "survivalarea.gamemode.bypass"))
                    return;
                if (!this.inCreativeArea(event.player)) {
                    event.cancel = true;
                    Msg.error(`你当前不在创造区域内，无法切换到该模式。`, event.player);
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
    init() {
        // 核心逻辑已在 registerEvents 中订阅事件
    }
    inCreativeArea(entity) {
        for (const area of ConfigManager.getAreas("creative")) {
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
        Msg.info(`已离开创造区域，强制切换为生存模式。`, player);
    }
}
//# sourceMappingURL=SurvivalArea.js.map