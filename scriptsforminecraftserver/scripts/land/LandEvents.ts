/* ---------------------------------------- *\
 *  土地插件 — 事件监听层
\* ---------------------------------------- */

import { world, Player, system, Entity } from "@minecraft/server";
import { Permission } from "../libs/Permission";
import { LandCore } from "./LandCore";
import { LandPos } from "./LandDatabase";
import { Msg } from "../libs/Tools";
import { canUseAt } from "./LandPolicy";
import { debug } from "../libs/DebugLog";

// 容器方块类型（箱子/木桶/潜影盒）
const CONTAINER_BLOCKS = new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel",
  "minecraft:ender_chest",
  "minecraft:hopper",
  "minecraft:dispenser",
  "minecraft:dropper",
  // 潜影盒用正则匹配
]);

function isContainerBlock(typeId: string): boolean {
  if (CONTAINER_BLOCKS.has(typeId)) return true;
  return /^minecraft:.*_shulker_box$/.test(typeId);
}

/**
 * 检查玩家在土地上的权限
 * @returns true = 允许继续，false = 拦截
 */
function checkLandPermission(
  player: Player,
  pos: LandPos,
  dimid: number,
  capability: Parameters<typeof canUseAt>[3]
): boolean {
  const started = Date.now();
  // 管理员/OP 跳过检查
  if (Permission.getPermission(player) >= Permission.OP) {
    recordMetric(Date.now() - started);
    return true;
  }

  const result = canUseAt(player, pos, dimid, capability);
  recordMetric(Date.now() - started);
  return result;
}

function recordMetric(durationMs: number) {
  LandEvents.recordPermissionMetric(durationMs);
}

// ===== 注册事件 =====

export class LandEvents {
  private static initialized = false;
  private static subscriptions: Array<any> = [];
  private static scanRunId: number | undefined;
  private static lastLandByPlayer = new Map<string, string | null>();
  private static metrics = { count: 0, totalMs: 0, slowestMs: 0 };

  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents() {
    debug.i("LAND", "registerEvents");
    if (this.initialized) return;
    this.initialized = true;
    this.scanRunId = system.runInterval(() => this.scanPlayerBoundaries(), 20);

    world.afterEvents.playerLeave.subscribe((event) => {
      LandCore.clearSession(event.playerId);
    });

    // 1. 放置方块拦截
    this.subscribe(world.beforeEvents.playerPlaceBlock, (ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid =
        block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;

      if (!checkLandPermission(player, pos, dimid, "place")) {
        Msg.error("你没有权限在此土地放置方块！", player);
        ev.cancel = true;
      }
    });

    // 2. 破坏方块拦截
    this.subscribe(world.beforeEvents.playerBreakBlock, (ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid =
        block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;

      if (!checkLandPermission(player, pos, dimid, "break")) {
        Msg.error("你没有权限在此土地破坏方块！", player);
        ev.cancel = true;
      }
    });

    // 3. 交互方块拦截（容器）
    this.subscribe(world.beforeEvents.playerInteractWithBlock, (ev) => {
      const { player, block } = ev;
      if (!isContainerBlock(block.typeId)) return;

      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid =
        block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;

      if (!checkLandPermission(player, pos, dimid, "container")) {
        Msg.error("你没有权限在此土地打开容器！", player);
        ev.cancel = true;
      }
    });

    this.subscribe(world.beforeEvents.playerInteractWithBlock, (ev) => {
      if (isContainerBlock(ev.block.typeId)) return;
      const type = ev.block.typeId;
      const capability = /door|trapdoor|fence_gate/.test(type)
        ? "door"
        : /button|lever|pressure_plate/.test(type)
          ? "button"
          : /redstone|repeater|comparator|piston|dispenser|dropper|hopper/.test(type)
            ? "redstone"
            : null;
      if (!capability) return;
      const pos = { x: ev.block.x, y: ev.block.y, z: ev.block.z };
      const dimid =
        ev.block.dimension.id === "minecraft:overworld" ? 0 : ev.block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(ev.player, pos, dimid, capability)) {
        Msg.error("你没有权限使用此土地设施！", ev.player);
        ev.cancel = true;
      }
    });

    this.subscribe(world.beforeEvents.playerInteractWithEntity, (ev) => {
      const pos = {
        x: Math.floor(ev.target.location.x),
        y: Math.floor(ev.target.location.y),
        z: Math.floor(ev.target.location.z),
      };
      const dimid =
        ev.target.dimension.id === "minecraft:overworld" ? 0 : ev.target.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(ev.player, pos, dimid, "interact_entity")) {
        Msg.error("你没有权限与此土地内的实体交互！", ev.player);
        ev.cancel = true;
      }
    });

    this.subscribe(world.beforeEvents.entityHurt, (ev) => {
      const source = ev.damageSource.damagingEntity;
      if (!(source instanceof Player)) return;
      const target = ev.hurtEntity;
      const pos = {
        x: Math.floor(target.location.x),
        y: Math.floor(target.location.y),
        z: Math.floor(target.location.z),
      };
      const dimid =
        target.dimension.id === "minecraft:overworld" ? 0 : target.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(source, pos, dimid, "attack_entity")) {
        ev.cancel = true;
        Msg.error("你没有权限攻击此土地内的实体！", source);
      }
    });

    this.subscribe(world.beforeEvents.entityItemPickup, (ev) => {
      if (!(ev.entity instanceof Player)) return;
      const pos = {
        x: Math.floor(ev.item.location.x),
        y: Math.floor(ev.item.location.y),
        z: Math.floor(ev.item.location.z),
      };
      const dimid =
        ev.item.dimension.id === "minecraft:overworld" ? 0 : ev.item.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(ev.entity, pos, dimid, "pickup_item")) {
        ev.cancel = true;
        Msg.error("你没有权限拾取此土地内的物品！", ev.entity);
      }
    });

    this.subscribe(world.beforeEvents.explosion, (ev) => {
      const blocks = ev.getImpactedBlocks();
      if (
        blocks.some((block) => {
          const pos = { x: block.x, y: block.y, z: block.z };
          const dimid =
            block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
          return LandCore.getLandByPos(pos, dimid) !== undefined;
        })
      )
        ev.cancel = true;
    });
  }

  private static subscribe<T>(
    signal: {
      subscribe(callback: (event: T) => void): (event: T) => void;
      unsubscribe(callback: (event: T) => void): void;
    },
    callback: (event: T) => void
  ): void {
    this.subscriptions.push({ signal, callback: signal.subscribe(callback) });
  }

  private static scanPlayerBoundaries() {
    for (const player of world.getPlayers()) {
      const pos = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z),
      };
      const dimid =
        player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
      const land = LandCore.getLandByPos(pos, dimid);
      const current = land?.id || null;
      const previous = this.lastLandByPlayer.get(player.id);
      if (current !== previous) {
        if (land) {
          Msg.tips(`进入土地：${land.nickname || land.id}（所有者：${land.ownerName}）`, player);
          this.spawnShieldParticles(player, land);
        } else if (previous) {
          Msg.tips("你已离开土地保护范围。", player);
        }
        this.lastLandByPlayer.set(player.id, current);
      }
    }
  }

  /** 在土地 8 个角点 + 顶/底中心生成彩色屏障粒子（一次性触发，进入边界时跑一次） */
  private static spawnShieldParticles(player: Player, land: any): void {
    const color = this.themeColorFor(land);
    const corners = this.computeCorners(land);
    try {
      for (const c of corners) {
        // 向上撒一条 4m 的粒子柱
        for (let h = 0; h < 4; h++) {
          player.spawnParticle(color.particle, { x: c.x + 0.5, y: c.y + 1 + h, z: c.z + 0.5 });
        }
      }
    } catch (e) {
      // particle API 在某些版本可能不可用 — 静默失败，不影响保护
    }
  }

  private static computeCorners(land: any): Array<{ x: number; y: number; z: number }> {
    const minX = Math.min(land.posA.x, land.posB.x);
    const maxX = Math.max(land.posA.x, land.posB.x);
    const minY = Math.min(land.posA.y, land.posB.y);
    const maxY = Math.max(land.posA.y, land.posB.y);
    const minZ = Math.min(land.posA.z, land.posB.z);
    const maxZ = Math.max(land.posA.z, land.posB.z);
    const midY = Math.round((minY + maxY) / 2);
    return [
      { x: minX, y: midY, z: minZ },
      { x: maxX, y: midY, z: minZ },
      { x: minX, y: midY, z: maxZ },
      { x: maxX, y: midY, z: maxZ },
    ];
  }

  /** 简单 hash → 颜色。保证每块地视觉上唯一，又不需要额外存储。 */
  private static themeColorFor(land: any): { particle: string; hex: string } {
    const ids = (land.id || "L").split("").reduce((s: number, c: string) => s + c.charCodeAt(0), 0);
    const palette = [
      "minecraft:totem_particle",
      "minecraft:villager_happy",
      "minecraft:heart_particle",
      "minecraft:end_chest",
      "minecraft:sparkler",
      "minecraft:wax_on",
      "minecraft:wax_off",
    ];
    return { particle: palette[ids % palette.length], hex: "#" + ((ids * 0x9E3779B1) >>> 0).toString(16).padStart(8, "0").slice(0, 6) };
  }

  static getMetrics() {
    return { ...this.metrics, averageMs: this.metrics.count ? this.metrics.totalMs / this.metrics.count : 0 };
  }

  static recordPermissionMetric(durationMs: number) {
    this.metrics.count++;
    this.metrics.totalMs += durationMs;
    this.metrics.slowestMs = Math.max(this.metrics.slowestMs, durationMs);
  }

  static cleanup() {
    debug.i("LAND", "cleanup");
    if (this.scanRunId !== undefined) system.clearRun(this.scanRunId);
    this.scanRunId = undefined;
    this.lastLandByPlayer.clear();
    for (const s of this.subscriptions) {
      try {
        s.signal.unsubscribe(s.callback);
      } catch {}
    }
    this.subscriptions = [];
    this.initialized = false;
  }
}
