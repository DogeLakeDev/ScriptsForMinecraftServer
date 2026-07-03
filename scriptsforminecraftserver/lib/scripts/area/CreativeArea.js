/* ---------------------------------------- *\
 *  Name        :  区域创造                   *
 *  Description :  进出指定区域切换创造/生存模式     *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */
import { system, world, GameMode, EntityInitializationCause, } from "@minecraft/server";
import { Config } from "../data/Config";
import * as Tool from "../libs/Tools";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import { SurvivalArea } from "./SurvivalArea";
import { Msg } from "../libs/Tools";
import { Storage } from "../libs/Storage";
export class CreativeArea {
    constructor() {
        this.BORDER_THRESHOLD = 10;
        this.BORDER_WARNING_DISTANCE = 5;
        this.BUFFER_ZONE = 3;
    }
    static getInstance() {
        if (!CreativeArea._instance) {
            CreativeArea._instance = new CreativeArea();
        }
        return CreativeArea._instance;
    }
    init() {
        this.registerEvents();
        this.startTick();
        this.startBorderFastCheck();
        this.startBorderWarning();
        this.registerCommands();
    }
    // ==========================================
    //  区域判定
    // ==========================================
    inArea(entity) {
        for (const area of Config.creativeArea) {
            if (entity.dimension.id === area.dimension) {
                if (Tool.pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                    return area.name;
                }
            }
        }
        return undefined;
    }
    inAreaByPos(x, z, dimensionId) {
        for (const area of Config.creativeArea) {
            if (dimensionId === area.dimension) {
                if (Tool.pointInArea_2D(x, z, area.start[0], area.start[1], area.end[0], area.end[1])) {
                    return true;
                }
            }
        }
        return false;
    }
    isNearBorder(entity, threshold = this.BORDER_THRESHOLD) {
        for (const area of Config.creativeArea) {
            if (entity.dimension.id !== area.dimension)
                continue;
            const minX = Math.min(area.start[0], area.end[0]) - threshold;
            const maxX = Math.max(area.start[0], area.end[0]) + threshold;
            const minZ = Math.min(area.start[1], area.end[1]) - threshold;
            const maxZ = Math.max(area.start[1], area.end[1]) + threshold;
            if (entity.location.x >= minX && entity.location.x <= maxX &&
                entity.location.z >= minZ && entity.location.z <= maxZ)
                return true;
        }
        return false;
    }
    inBufferZone(entity) {
        for (const area of Config.creativeArea) {
            if (entity.dimension.id !== area.dimension)
                continue;
            const minX = Math.min(area.start[0], area.end[0]);
            const maxX = Math.max(area.start[0], area.end[0]);
            const minZ = Math.min(area.start[1], area.end[1]);
            const maxZ = Math.max(area.start[1], area.end[1]);
            const x = entity.location.x, z = entity.location.z;
            const inExpanded = x >= minX - this.BUFFER_ZONE && x <= maxX + this.BUFFER_ZONE &&
                z >= minZ - this.BUFFER_ZONE && z <= maxZ + this.BUFFER_ZONE;
            if (!inExpanded)
                continue;
            if (x >= minX && x <= maxX && z >= minZ && z <= maxZ)
                continue;
            return true;
        }
        return false;
    }
    get creativeDims() {
        const dims = new Set();
        for (const area of Config.creativeArea)
            dims.add(area.dimension);
        return dims;
    }
    // ==========================================
    //  进入 / 离开 处理（背包由 InventorySwitcher 接管）
    // ==========================================
    enterArea(player, areaName) {
        this.saveScores(player);
        player.setGameMode(GameMode.Creative);
        Storage.playerSet(player, "creative:area_name", areaName);
        Msg.info(`进入 §a${areaName}创造区域§r ，切换为创造模式。`, player);
    }
    leaveArea(player, areaName) {
        this.restoreScores(player);
        player.setGameMode(GameMode.Survival);
        Storage.playerDelete(player, "creative:area_name");
        Msg.info(`离开 §a${areaName}创造区域§r ，恢复生存模式。`, player);
    }
    // ==========================================
    //  计分项保存 / 恢复
    // ==========================================
    saveScores(player) {
        const identity = player.scoreboardIdentity;
        if (!identity)
            return;
        const scores = {};
        for (const obj of world.scoreboard.getObjectives()) {
            try {
                const score = obj.getScore(identity);
                if (score !== undefined)
                    scores[obj.id] = score;
            }
            catch (_a) { }
        }
        if (Object.keys(scores).length > 0) {
            Storage.playerSet(player, "creative:scores", scores);
        }
    }
    restoreScores(player) {
        const scores = Storage.playerGet(player, "creative:scores", undefined);
        if (!scores)
            return;
        const identity = player.scoreboardIdentity;
        if (!identity)
            return;
        for (const obj of world.scoreboard.getObjectives()) {
            if (scores[obj.id] !== undefined) {
                try {
                    obj.setScore(identity, scores[obj.id]);
                }
                catch (_a) { }
            }
        }
        Storage.playerDelete(player, "creative:scores");
    }
    // ==========================================
    //  事件注册
    // ==========================================
    registerEvents() {
        world.afterEvents.playerSpawn.subscribe((event) => {
            if (!event.initialSpawn)
                return;
            system.runTimeout(() => {
                const areaName = this.inArea(event.player);
                if (areaName !== undefined) {
                    this.enterArea(event.player, areaName);
                }
                else if (event.player.getGameMode() === GameMode.Creative || event.player.getGameMode() === GameMode.Spectator) {
                    event.player.setGameMode(GameMode.Survival);
                }
            }, 60);
        });
        world.afterEvents.playerDimensionChange.subscribe((event) => {
            if (!CreativeArea.enable)
                return;
            system.runTimeout(() => {
                const areaName = this.inArea(event.player);
                const currentArea = Storage.playerGet(event.player, "creative:area_name", undefined);
                if (currentArea === undefined && areaName !== undefined) {
                    this.enterArea(event.player, areaName);
                }
                else if (currentArea !== undefined && areaName === undefined) {
                    this.leaveArea(event.player, currentArea);
                }
            }, 10);
        });
        world.afterEvents.entitySpawn.subscribe((event) => {
            if (!CreativeArea.enable)
                return;
            if (!event.entity)
                return;
            if (event.entity.typeId === "minecraft:player")
                return;
            if (!this.creativeDims.has(event.entity.dimension.id))
                return;
            try {
                if (event.cause === EntityInitializationCause.Spawned) {
                    if (this.inArea(event.entity) !== undefined || this.inBufferZone(event.entity)) {
                        event.entity.remove();
                    }
                }
            }
            catch (_a) { }
        });
        world.beforeEvents.playerPlaceBlock.subscribe((event) => {
            if (!CreativeArea.enable)
                return;
            const player = event.player;
            if (player.getGameMode() !== GameMode.Creative)
                return;
            // 阻止在区外放置（所有人生效）
            if (!this.inAreaByPos(event.block.location.x, event.block.location.z, player.dimension.id)) {
                event.cancel = true;
                Msg.error(`你只能在创造区域内放置方块。`, player);
                return;
            }
            // 阻止放置禁止方块（拥有 creativearea.place_banned 可绕过）
            if (Config.creativeBannedItems.indexOf(event.permutationToPlace.type.id) !== -1) {
                if (!Permission.check(player, 'creativearea.place_banned')) {
                    event.cancel = true;
                    Msg.error(`创造区域内禁止放置 ${event.permutationToPlace.type.id}。`, player);
                }
            }
        });
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (!CreativeArea.enable)
                return;
            if (event.player.getGameMode() !== GameMode.Creative)
                return;
            if (!this.inAreaByPos(event.block.location.x, event.block.location.z, event.player.dimension.id)) {
                event.cancel = true;
                Msg.error(`你只能破坏创造区域内的方块。`, event.player);
            }
        });
    }
    // ==========================================
    //  定时扫描（进出检测）
    // ==========================================
    startTick() {
        system.runInterval(() => {
            if (!CreativeArea.enable)
                return;
            for (const player of world.getPlayers()) {
                if (player.getGameMode() === GameMode.Spectator)
                    continue;
                const currentArea = Storage.playerGet(player, "creative:area_name", undefined);
                if (currentArea === undefined) {
                    const areaName = this.inArea(player);
                    if (areaName !== undefined)
                        this.enterArea(player, areaName);
                }
                else {
                    if (this.inArea(player) === undefined)
                        this.leaveArea(player, currentArea);
                }
            }
        }, 10);
    }
    // ==========================================
    //  边界快速检测
    // ==========================================
    startBorderFastCheck() {
        system.runInterval(() => {
            if (!CreativeArea.enable)
                return;
            for (const player of world.getPlayers()) {
                if (player.getGameMode() !== GameMode.Creative)
                    continue;
                if (!this.isNearBorder(player))
                    continue;
                const currentArea = Storage.playerGet(player, "creative:area_name", undefined);
                if (currentArea !== undefined && this.inArea(player) === undefined) {
                    this.leaveArea(player, currentArea);
                }
            }
        }, 2);
    }
    // ==========================================
    //  边界视觉警告
    // ==========================================
    startBorderWarning() {
        system.runInterval(() => {
            if (!CreativeArea.enable)
                return;
            for (const player of world.getPlayers()) {
                for (const area of Config.creativeArea) {
                    if (player.dimension.id !== area.dimension)
                        continue;
                    const pos = player.location;
                    const minX = Math.min(area.start[0], area.end[0]);
                    const maxX = Math.max(area.start[0], area.end[0]);
                    const minZ = Math.min(area.start[1], area.end[1]);
                    const maxZ = Math.max(area.start[1], area.end[1]);
                    const d = this.BORDER_WARNING_DISTANCE;
                    if (pos.x < minX - d || pos.x > maxX + d || pos.z < minZ - d || pos.z > maxZ + d)
                        continue;
                    const cx = Math.max(minX, Math.min(maxX, pos.x));
                    const cz = Math.max(minZ, Math.min(maxZ, pos.z));
                    let bx = cx, bz = cz;
                    if (cx === pos.x && cz === pos.z) {
                        const dx = Math.min(pos.x - minX, maxX - pos.x);
                        const dz = Math.min(pos.z - minZ, maxZ - pos.z);
                        if (dx < dz)
                            bx = (pos.x - minX < maxX - pos.x) ? minX : maxX;
                        else
                            bz = (pos.z - minZ < maxZ - pos.z) ? minZ : maxZ;
                    }
                    const y = Math.floor(pos.y);
                    try {
                        for (let dy = -1; dy <= 2; dy++) {
                            player.dimension.spawnParticle("minecraft:colored_flame_particle", { x: bx, y: y + dy, z: bz });
                        }
                    }
                    catch (_a) { }
                    break;
                }
            }
        }, 20);
    }
    // ==========================================
    //  指令
    // ==========================================
    registerCommands() {
        Permission.register('creativearea.toggle', Permission.OP);
        Permission.register('creativearea.place_banned', Permission.Admin);
        Command.register("creativearea", 'creativearea.toggle', () => {
            CreativeArea.enable = !CreativeArea.enable;
            SurvivalArea.getInstance().enable = CreativeArea.enable;
            return CreativeArea.enable
                ? "区域系统已开启"
                : "区域系统已关闭";
        }, "开关区域系统");
    }
}
/** 连锁开关（同时控制 CreativeArea + SurvivalArea） */
CreativeArea.enable = true;
//# sourceMappingURL=CreativeArea.js.map