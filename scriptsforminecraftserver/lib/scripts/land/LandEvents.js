/* ---------------------------------------- *\
 *  土地插件 — 事件监听层
\* ---------------------------------------- */
import { world } from "@minecraft/server";
import { LandCore } from "./LandCore";
import { Msg } from "../libs/Tools";
// 容器方块类型（箱子/木桶/潜影盒）
const CONTAINER_BLOCKS = new Set([
    "minecraft:chest",
    "minecraft:trapped_chest",
    "minecraft:barrel",
    // 潜影盒用正则匹配
]);
function isContainerBlock(typeId) {
    if (CONTAINER_BLOCKS.has(typeId))
        return true;
    return /^minecraft:.*_shulker_box$/.test(typeId);
}
/**
 * 检查玩家在土地上的权限
 * @returns true = 允许继续，false = 拦截
 */
function checkLandPermission(player, pos, dimid, permField) {
    // 管理员/OP 跳过检查
    if (player.hasTag("op") || player.hasTag("admin"))
        return true;
    const land = LandCore.getLandByPos(pos, dimid);
    if (!land)
        return true; // 不在任何土地上，允许
    // 拥有者/管理者 跳过检查
    if (LandCore.isOwnerOrManager(land, player.id))
        return true;
    // 检查访客权限
    return land.permissions[permField] === true;
}
// ===== 注册事件 =====
export class LandEvents {
    /** 注册事件（由 entry.ts 统一调用） */
    static registerEvents() {
        if (this.initialized)
            return;
        this.initialized = true;
        // 1. 放置方块拦截
        world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
            const { player, block } = ev;
            const pos = { x: block.x, y: block.y, z: block.z };
            const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
            if (!checkLandPermission(player, pos, dimid, "allow_place")) {
                Msg.error("你没有权限在此土地放置方块！", player);
                ev.cancel = true;
            }
        });
        // 2. 破坏方块拦截
        world.beforeEvents.playerBreakBlock.subscribe((ev) => {
            const { player, block } = ev;
            const pos = { x: block.x, y: block.y, z: block.z };
            const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
            if (!checkLandPermission(player, pos, dimid, "allow_destroy")) {
                Msg.error("你没有权限在此土地破坏方块！", player);
                ev.cancel = true;
            }
        });
        // 3. 交互方块拦截（容器）
        world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
            const { player, block } = ev;
            if (!isContainerBlock(block.typeId))
                return; // 只拦截容器
            const pos = { x: block.x, y: block.y, z: block.z };
            const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
            if (!checkLandPermission(player, pos, dimid, "open_container")) {
                Msg.error("你没有权限在此土地打开容器！", player);
                ev.cancel = true;
            }
        });
    }
}
LandEvents.initialized = false;
//# sourceMappingURL=LandEvents.js.map