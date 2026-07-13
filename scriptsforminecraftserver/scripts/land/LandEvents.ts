/* ---------------------------------------- *\
 *  土地插件 — 事件监听层
\* ---------------------------------------- */

import { world, Player } from "@minecraft/server";
import { LandCore } from "./LandCore";
import { LandPos } from "./LandDatabase";
import { Msg } from "../libs/Tools";
import { canUseAt } from "./LandPolicy";

// 容器方块类型（箱子/木桶/潜影盒）
const CONTAINER_BLOCKS = new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel",
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
function checkLandPermission(player: Player, pos: LandPos, dimid: number, capability: Parameters<typeof canUseAt>[3]): boolean {
  // 管理员/OP 跳过检查
  if (player.hasTag("op") || player.hasTag("admin")) return true;

  return canUseAt(player, pos, dimid, capability);
}

// ===== 注册事件 =====

export class LandEvents {
  private static initialized = false;
  private static subscriptions: Array<any> = [];

  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. 放置方块拦截
    this.subscriptions.push(world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid =
        block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;

       if (!checkLandPermission(player, pos, dimid, "place")) {
        Msg.error("你没有权限在此土地放置方块！", player);
        ev.cancel = true;
      }
    }));

    // 2. 破坏方块拦截
    this.subscriptions.push(world.beforeEvents.playerBreakBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid =
        block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;

       if (!checkLandPermission(player, pos, dimid, "break")) {
        Msg.error("你没有权限在此土地破坏方块！", player);
        ev.cancel = true;
      }
    }));

    // 3. 交互方块拦截（容器）
    this.subscriptions.push(world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      const { player, block } = ev;
      if (!isContainerBlock(block.typeId)) return;

      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid =
        block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;

       if (!checkLandPermission(player, pos, dimid, "container")) {
        Msg.error("你没有权限在此土地打开容器！", player);
        ev.cancel = true;
      }
    }));

    this.subscriptions.push(world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      if (isContainerBlock(ev.block.typeId)) return;
      const type = ev.block.typeId;
      const capability = /door|trapdoor|fence_gate/.test(type) ? "door" : /button|lever|pressure_plate/.test(type) ? "button" : /redstone|repeater|comparator|piston|dispenser|dropper|hopper/.test(type) ? "redstone" : null;
      if (!capability) return;
      const pos = { x: ev.block.x, y: ev.block.y, z: ev.block.z };
      const dimid = ev.block.dimension.id === "minecraft:overworld" ? 0 : ev.block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(ev.player, pos, dimid, capability)) { Msg.error("你没有权限使用此土地设施！", ev.player); ev.cancel = true; }
    }));

    this.subscriptions.push(world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
      const pos = { x: Math.floor(ev.target.location.x), y: Math.floor(ev.target.location.y), z: Math.floor(ev.target.location.z) };
      const dimid = ev.target.dimension.id === "minecraft:overworld" ? 0 : ev.target.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(ev.player, pos, dimid, "interact_entity")) { Msg.error("你没有权限与此土地内的实体交互！", ev.player); ev.cancel = true; }
    }));

    this.subscriptions.push(world.beforeEvents.explosion.subscribe((ev) => {
      const blocks = ev.getImpactedBlocks();
      if (blocks.some((block) => {
        const pos = { x: block.x, y: block.y, z: block.z };
        const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
        return LandCore.getLandByPos(pos, dimid) !== undefined;
      })) ev.cancel = true;
    }));
  }

  static cleanup() {
    for (const s of this.subscriptions) {
      try { s.unsubscribe(); } catch {}
    }
    this.subscriptions = [];
    this.initialized = false;
  }
}
