/**
 * ActivityLog — 玩家行为日志模块
 *
 * 订阅原版游戏事件，记录玩家行为到 db-server（sfmc_activities 表）。
 * 支持：高频事件节流、可配事件类型、自动清理。
 */
import { world, system } from "@minecraft/server";
import { HttpDB } from "../libs/HttpDB";
// ============================================
//  配置
// ============================================
/** 启用的日志事件类型 */
const ENABLED_EVENTS = new Set([
    'player.join',
    'player.leave',
    'player.spawn',
    'player.dimension',
    'player.gamemode',
    'player.chat',
    'block.break',
    'block.place',
    'entity.death',
    'entity.hit',
    'entity.hurt',
    'entity.interact',
    'entity.tame',
    'entity.spawn',
    'item.drop',
    'item.pickup',
    'container.open',
    'container.close',
    'world.explosion',
]);
/** 队列 flush 间隔（毫秒） */
const FLUSH_INTERVAL = 2000;
/** 自动清理间隔（毫秒） */
const CLEANUP_INTERVAL = 6 * 3600000; // 6 小时
/** 日志保留天数 */
const KEEP_DAYS = 30;
// ============================================
//  内部队列
// ============================================
let queue = [];
let flushTimer = null;
let initialized = false;
function enqueue(entry) {
    queue.push(entry);
    if (!flushTimer) {
        flushTimer = system.runTimeout(flush, FLUSH_INTERVAL / 50);
    }
}
function flush() {
    return __awaiter(this, void 0, void 0, function* () {
        flushTimer = null;
        if (queue.length === 0)
            return;
        const batch = queue;
        queue = [];
        try {
            yield HttpDB.batchActivities(batch);
        }
        catch (_a) {
            // flush 失败不重试，避免堆积
        }
    });
}
// ============================================
//  辅助函数
// ============================================
function dimId(entityOrBlock) {
    var _a, _b;
    try {
        return ((_b = (_a = entityOrBlock.dimension) === null || _a === void 0 ? void 0 : _a.id) === null || _b === void 0 ? void 0 : _b.replace('minecraft:', '')) || '';
    }
    catch (_c) {
        return '';
    }
}
function loc(v) {
    if (!v)
        return [0, 0, 0];
    return [v.x, v.y, v.z];
}
function playerId(player) {
    try {
        return player.id || '';
    }
    catch (_a) {
        return '';
    }
}
function playerEntry(player, eventType, extra = {}) {
    var _a, _b, _c;
    const [x, y, z] = loc(player.location);
    return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(player),
        sourceType: 'player',
        sourceid: playerId(player),
        sourceName: player.name,
        sourceX: x, sourceY: y, sourceZ: z,
        eventType,
        targetType: extra.targetType || '',
        targetid: extra.targetid || '',
        targetName: extra.targetName || '',
        targetX: (_a = extra.targetX) !== null && _a !== void 0 ? _a : null,
        targetY: (_b = extra.targetY) !== null && _b !== void 0 ? _b : null,
        targetZ: (_c = extra.targetZ) !== null && _c !== void 0 ? _c : null,
        detail: extra.detail || {},
    };
}
function getTargetPlayerId(entity) {
    if (entity.typeId !== 'minecraft:player')
        return '';
    try {
        return entity.id || '';
    }
    catch (_a) {
        return '';
    }
}
function getTargetPlayerName(entity) {
    if (entity.typeId !== 'minecraft:player')
        return entity.typeId;
    try {
        return entity.name || entity.typeId;
    }
    catch (_a) {
        return entity.typeId;
    }
}
// ============================================
//  事件订阅
// ============================================
function subscribe() {
    // ---- 玩家加入 ----
    world.afterEvents.playerSpawn.subscribe((event) => {
        if (!event.initialSpawn)
            return;
        if (!ENABLED_EVENTS.has('player.join'))
            return;
        enqueue(playerEntry(event.player, 'player.join'));
    });
    // ---- 玩家离开 ----
    world.afterEvents.playerLeave.subscribe((event) => {
        if (!ENABLED_EVENTS.has('player.leave'))
            return;
        enqueue({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            dimension: '',
            sourceType: 'player',
            sourceid: '',
            sourceName: event.playerName,
            sourceX: null, sourceY: null, sourceZ: null,
            eventType: 'player.leave',
            targetType: '', targetid: '', targetName: '',
            targetX: null, targetY: null, targetZ: null,
            detail: { playerId: event.playerId },
        });
    });
    // ---- 玩家重生 ----
    world.afterEvents.playerSpawn.subscribe((event) => {
        if (event.initialSpawn)
            return;
        if (!ENABLED_EVENTS.has('player.spawn'))
            return;
        enqueue(playerEntry(event.player, 'player.spawn'));
    });
    // ---- 维度切换 ----
    world.afterEvents.playerDimensionChange.subscribe((event) => {
        if (!ENABLED_EVENTS.has('player.dimension'))
            return;
        const [fx, fy, fz] = loc(event.fromLocation);
        const [tx, ty, tz] = loc(event.toLocation);
        enqueue(playerEntry(event.player, 'player.dimension', {
            targetX: tx, targetY: ty, targetZ: tz,
            detail: {
                from: event.fromDimension.id.replace('minecraft:', ''),
                to: event.toDimension.id.replace('minecraft:', ''),
                fromLoc: { x: fx, y: fy, z: fz },
                toLoc: { x: tx, y: ty, z: tz },
            },
        }));
    });
    // ---- 游戏模式切换 ----
    world.afterEvents.playerGameModeChange.subscribe((event) => {
        if (!ENABLED_EVENTS.has('player.gamemode'))
            return;
        enqueue(playerEntry(event.player, 'player.gamemode', {
            detail: {
                from: event.fromGameMode,
                to: event.toGameMode,
            },
        }));
    });
    // ---- 聊天 ----
    world.afterEvents.chatSend.subscribe((event) => {
        var _a;
        if (!ENABLED_EVENTS.has('player.chat'))
            return;
        const targets = ((_a = event.targets) === null || _a === void 0 ? void 0 : _a.map(p => p.name)) || [];
        enqueue(playerEntry(event.sender, 'player.chat', {
            detail: {
                message: event.message,
                targets: targets.length > 0 ? targets : undefined,
            },
        }));
    });
    // ---- 破坏方块 ----
    world.afterEvents.playerBreakBlock.subscribe((event) => {
        var _a, _b, _c, _d;
        if (!ENABLED_EVENTS.has('block.break'))
            return;
        const [bx, by, bz] = loc(event.block.location);
        enqueue(playerEntry(event.player, 'block.break', {
            targetType: 'block',
            targetName: event.brokenBlockPermutation.type.id,
            targetX: bx, targetY: by, targetZ: bz,
            detail: {
                itemBefore: ((_b = (_a = event.itemStackBeforeBreak) === null || _a === void 0 ? void 0 : _a.type) === null || _b === void 0 ? void 0 : _b.id) || null,
                itemAfter: ((_d = (_c = event.itemStackAfterBreak) === null || _c === void 0 ? void 0 : _c.type) === null || _d === void 0 ? void 0 : _d.id) || null,
            },
        }));
    });
    // ---- 放置方块 ----
    world.afterEvents.playerPlaceBlock.subscribe((event) => {
        if (!ENABLED_EVENTS.has('block.place'))
            return;
        const [bx, by, bz] = loc(event.block.location);
        enqueue(playerEntry(event.player, 'block.place', {
            targetType: 'block',
            targetName: event.block.typeId,
            targetX: bx, targetY: by, targetZ: bz,
            detail: {},
        }));
    });
    // ---- 生物死亡 ----
    world.afterEvents.entityDie.subscribe((event) => {
        var _a;
        if (!ENABLED_EVENTS.has('entity.death'))
            return;
        const dead = event.deadEntity;
        const [dx, dy, dz] = loc(dead.location);
        const ds = event.damageSource;
        const cause = ds.cause;
        const killer = ds.damagingEntity;
        const targetType = dead.typeId === 'minecraft:player' ? 'player' : 'entity';
        const targetid = getTargetPlayerId(dead);
        const targetName = getTargetPlayerName(dead);
        // 如果凶手是玩家，以玩家为主体记录
        if (killer && killer.typeId === 'minecraft:player') {
            const player = killer;
            const proj = ds.damagingProjectile;
            enqueue(playerEntry(player, 'entity.death', {
                targetType,
                targetid,
                targetName,
                targetX: dx, targetY: dy, targetZ: dz,
                detail: { cause, projectile: (proj === null || proj === void 0 ? void 0 : proj.typeId) || null },
            }));
        }
        else {
            // 非玩家击杀（环境/生物击杀）
            enqueue({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                timestamp: Date.now(),
                dimension: dimId(dead),
                sourceType: killer ? 'entity' : 'world',
                sourceid: '',
                sourceName: (killer === null || killer === void 0 ? void 0 : killer.typeId) || cause,
                sourceX: killer ? loc(killer.location)[0] : null,
                sourceY: killer ? loc(killer.location)[1] : null,
                sourceZ: killer ? loc(killer.location)[2] : null,
                eventType: 'entity.death',
                targetType,
                targetid,
                targetName,
                targetX: dx, targetY: dy, targetZ: dz,
                detail: { cause, projectile: ((_a = ds.damagingProjectile) === null || _a === void 0 ? void 0 : _a.typeId) || null },
            });
        }
    });
    // ---- 实体攻击实体 (PvP / 生物互殴) ----
    world.afterEvents.entityHitEntity.subscribe((event) => {
        if (!ENABLED_EVENTS.has('entity.hit'))
            return;
        const attacker = event.damagingEntity;
        const victim = event.hitEntity;
        const [ax, ay, az] = loc(attacker.location);
        const [vx, vy, vz] = loc(victim.location);
        // 玩家攻击（PvP 或打怪）
        if (attacker.typeId === 'minecraft:player') {
            enqueue(playerEntry(attacker, 'entity.hit', {
                targetType: victim.typeId === 'minecraft:player' ? 'player' : 'entity',
                targetid: getTargetPlayerId(victim),
                targetName: getTargetPlayerName(victim),
                targetX: vx, targetY: vy, targetZ: vz,
            }));
        }
        // 生物攻击玩家也记录
        if (victim.typeId === 'minecraft:player' && attacker.typeId !== 'minecraft:player') {
            enqueue({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                timestamp: Date.now(),
                dimension: dimId(attacker),
                sourceType: 'entity',
                sourceid: '',
                sourceName: attacker.typeId,
                sourceX: ax, sourceY: ay, sourceZ: az,
                eventType: 'entity.hit',
                targetType: 'player',
                targetid: getTargetPlayerId(victim),
                targetName: getTargetPlayerName(victim),
                targetX: vx, targetY: vy, targetZ: vz,
                detail: {},
            });
        }
    });
    // ---- 实体受伤 ----
    world.afterEvents.entityHurt.subscribe((event) => {
        var _a, _b;
        if (!ENABLED_EVENTS.has('entity.hurt'))
            return;
        const hurt = event.hurtEntity;
        const ds = event.damageSource;
        // 只记录玩家受伤
        if (hurt.typeId !== 'minecraft:player')
            return;
        const player = hurt;
        enqueue(playerEntry(player, 'entity.hurt', {
            detail: {
                damage: event.damage,
                cause: ds.cause,
                damager: ((_a = ds.damagingEntity) === null || _a === void 0 ? void 0 : _a.typeId) || null,
                projectile: ((_b = ds.damagingProjectile) === null || _b === void 0 ? void 0 : _b.typeId) || null,
            },
        }));
    });
    // ---- 交互实体 ----
    world.afterEvents.playerInteractWithEntity.subscribe((event) => {
        var _a, _b, _c, _d;
        if (!ENABLED_EVENTS.has('entity.interact'))
            return;
        const target = event.target;
        const [tx, ty, tz] = loc(target.location);
        enqueue(playerEntry(event.player, 'entity.interact', {
            targetType: target.typeId === 'minecraft:player' ? 'player' : 'entity',
            targetid: getTargetPlayerId(target),
            targetName: getTargetPlayerName(target),
            targetX: tx, targetY: ty, targetZ: tz,
            detail: {
                item: ((_b = (_a = event.itemStack) === null || _a === void 0 ? void 0 : _a.type) === null || _b === void 0 ? void 0 : _b.id) || null,
                itemBefore: ((_d = (_c = event.beforeItemStack) === null || _c === void 0 ? void 0 : _c.type) === null || _d === void 0 ? void 0 : _d.id) || null,
            },
        }));
    });
    // ---- 驯服实体 ----
    world.afterEvents.entityTamed.subscribe((event) => {
        if (!ENABLED_EVENTS.has('entity.tame'))
            return;
        const tamer = event.tamingEntity;
        if (!tamer || tamer.typeId !== 'minecraft:player')
            return;
        const target = event.entity;
        const [tx, ty, tz] = loc(target.location);
        enqueue(playerEntry(tamer, 'entity.tame', {
            targetType: 'entity',
            targetName: target.typeId,
            targetX: tx, targetY: ty, targetZ: tz,
        }));
    });
    // ---- 生物生成 ----
    world.afterEvents.entitySpawn.subscribe((event) => {
        if (!ENABLED_EVENTS.has('entity.spawn'))
            return;
        const e = event.entity;
        // 忽略玩家生成（由 playerSpawn 处理）
        if (e.typeId === 'minecraft:player')
            return;
        const [ex, ey, ez] = loc(e.location);
        enqueue({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            dimension: dimId(e),
            sourceType: 'entity',
            sourceid: '',
            sourceName: e.typeId,
            sourceX: ex, sourceY: ey, sourceZ: ez,
            eventType: 'entity.spawn',
            targetType: '', targetid: '', targetName: '',
            targetX: null, targetY: null, targetZ: null,
            detail: { cause: event.cause },
        });
    });
    // ---- 掉落物品 ----
    world.afterEvents.entityItemDrop.subscribe((event) => {
        if (!ENABLED_EVENTS.has('item.drop'))
            return;
        const e = event.entity;
        const [ex, ey, ez] = loc(e.location);
        if (e.typeId === 'minecraft:player') {
            enqueue(playerEntry(e, 'item.drop', {
                detail: {
                    items: event.items.map(item => typeof item === 'string' ? item : item === null || item === void 0 ? void 0 : item.typeId).filter(Boolean),
                },
            }));
        }
        else {
            enqueue({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                timestamp: Date.now(),
                dimension: dimId(e),
                sourceType: 'entity',
                sourceid: '',
                sourceName: e.typeId,
                sourceX: ex, sourceY: ey, sourceZ: ez,
                eventType: 'item.drop',
                targetType: '', targetid: '', targetName: '',
                targetX: null, targetY: null, targetZ: null,
                detail: {
                    items: event.items.map(item => typeof item === 'string' ? item : item === null || item === void 0 ? void 0 : item.typeId).filter(Boolean),
                },
            });
        }
    });
    // ---- 拾取物品 ----
    world.afterEvents.entityItemPickup.subscribe((event) => {
        if (!ENABLED_EVENTS.has('item.pickup'))
            return;
        const e = event.entity;
        const [ex, ey, ez] = loc(e.location);
        if (e.typeId === 'minecraft:player') {
            enqueue(playerEntry(e, 'item.pickup', {
                detail: {
                    items: event.items.map(item => item.type.id),
                },
            }));
        }
    });
    // ---- 容器打开 ----
    world.afterEvents.blockContainerOpened.subscribe((event) => {
        if (!ENABLED_EVENTS.has('container.open'))
            return;
        const source = event.openSource.entity;
        if (!source || source.typeId !== 'minecraft:player')
            return;
        const [bx, by, bz] = loc(event.block.location);
        enqueue(playerEntry(source, 'container.open', {
            targetType: 'block',
            targetName: event.block.typeId,
            targetX: bx, targetY: by, targetZ: bz,
        }));
    });
    // ---- 容器关闭 ----
    world.afterEvents.blockContainerClosed.subscribe((event) => {
        if (!ENABLED_EVENTS.has('container.close'))
            return;
        const source = event.closeSource.entity;
        if (!source || source.typeId !== 'minecraft:player')
            return;
        const [bx, by, bz] = loc(event.block.location);
        enqueue(playerEntry(source, 'container.close', {
            targetType: 'block',
            targetName: event.block.typeId,
            targetX: bx, targetY: by, targetZ: bz,
        }));
    });
    // ---- 爆炸 ----
    world.afterEvents.explosion.subscribe((event) => {
        if (!ENABLED_EVENTS.has('world.explosion'))
            return;
        const source = event.source;
        const dimension = event.dimension.id.replace('minecraft:', '');
        const [sx, sy, sz] = source ? loc(source.location) : [0, 0, 0];
        enqueue({
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            timestamp: Date.now(),
            dimension,
            sourceType: source
                ? (source.typeId === 'minecraft:player' ? 'player' : 'entity')
                : 'world',
            sourceid: (source === null || source === void 0 ? void 0 : source.typeId) === 'minecraft:player' ? playerId(source) : '',
            sourceName: (source === null || source === void 0 ? void 0 : source.typeId) || 'unknown',
            sourceX: sx, sourceY: sy, sourceZ: sz,
            eventType: 'world.explosion',
            targetType: '', targetid: '', targetName: '',
            targetX: null, targetY: null, targetZ: null,
            detail: { impactedBlocks: event.getImpactedBlocks().length },
        });
    });
}
// ============================================
//  定时清理
// ============================================
function doCleanup() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield HttpDB.cleanupActivities(KEEP_DAYS, true);
        }
        catch (_a) {
            // 忽略清理失败
        }
    });
}
// ============================================
//  公开 API
// ============================================
export class ActivityLog {
    static init() {
        if (initialized)
            return;
        initialized = true;
        subscribe();
        console.info('[ActivityLog] 事件订阅完成');
        // 定时 flush 队列
        system.runInterval(flush, FLUSH_INTERVAL / 50);
        // 定时清理（首次 1 小时后，之后每 6 小时）
        system.runTimeout(() => {
            doCleanup();
            system.runInterval(doCleanup, CLEANUP_INTERVAL / 50);
        }, 72000 / 50); // 1 小时后
    }
}
//# sourceMappingURL=ActivityLog.js.map