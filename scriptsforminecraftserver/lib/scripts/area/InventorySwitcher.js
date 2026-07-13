/* ---------------------------------------- *\
 *  Name        :  InventorySwitcher          *
 *  Description :  生存/创造模式自动切换独立背包 *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */
import { system, world, GameMode, EquipmentSlot, BlockComponentTypes, } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import * as Tool from "../libs/Tools";
export class InventorySwitcher {
    constructor() {
        this.gameModeSub = undefined;
    }
    static getInstance() {
        if (!InventorySwitcher._instance) {
            InventorySwitcher._instance = new InventorySwitcher();
        }
        return InventorySwitcher._instance;
    }
    /** 注册事件（由 entry.ts 统一调用） */
    registerEvents() {
        if (this.gameModeSub)
            return;
        this.gameModeSub = world.afterEvents.playerGameModeChange.subscribe((event) => {
            const player = event.player;
            system.run(() => {
                if (player.getGameMode() !== event.toGameMode)
                    return;
                if (event.fromGameMode === GameMode.Survival && event.toGameMode === GameMode.Creative) {
                    this.saveToChest(player, false);
                    this.restoreFromChest(player, true);
                }
                else if (event.fromGameMode === GameMode.Creative && event.toGameMode === GameMode.Survival) {
                    this.saveToChest(player, true);
                    this.restoreFromChest(player, false);
                }
            });
        });
    }
    cleanup() {
        if (this.gameModeSub?.unsubscribe) {
            try {
                this.gameModeSub.unsubscribe();
            }
            catch { }
        }
        this.gameModeSub = undefined;
    }
    init() {
        // 核心逻辑已在 registerEvents 中订阅事件
    }
    /**
     * 获取该索引对应的布局（左箱/右箱/告示牌位置），使用 Tools 工具
     */
    getLayout(index) {
        const cfg = ConfigManager.getGrid("inventory_chest");
        if (!cfg)
            return { left: { x: 0, y: 0, z: 0 }, sign: { x: 0, y: 0, z: 0 } };
        const mainAxis = Math.floor(index / cfg.size[1]);
        const yOffset = index % cfg.size[1];
        return Tool.getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
    }
    /**
     * 获取玩家的箱子索引
     * 每个玩家占 2 个连续索引：survival = base * 2, creative = base * 2 + 1
     */
    getChestIndex(playerId, forCreative) {
        const key = `invswitcher:player_${playerId}`;
        let base = InventorySwitcher.chestMap.get(key);
        if (base === undefined) {
            let nextIdx = world.getDynamicProperty("hpbe:invswitcher_next");
            if (nextIdx === undefined)
                nextIdx = 0;
            const grid = ConfigManager.getGrid("inventory_chest");
            if (!grid)
                return 0;
            const max = grid.size[0] - 2;
            if (nextIdx > max)
                nextIdx = 0;
            base = nextIdx;
            InventorySwitcher.chestMap.set(key, base);
            world.setDynamicProperty("hpbe:invswitcher_next", base + 2);
        }
        return base * 2 + (forCreative ? 1 : 0);
    }
    /**
     * 将玩家背包存入指定箱子
     */
    saveToChest(player, forCreative) {
        const cfg = ConfigManager.getGrid("inventory_chest");
        if (!cfg)
            return;
        const dim = world.getDimension("minecraft:overworld");
        const { left, sign } = this.getLayout(this.getChestIndex(player.id, forCreative));
        Tool.ensureDoubleChest(dim, left, Tool.getChestCardinal(cfg.direction, cfg.face), cfg.direction);
        const { date, time } = Tool.getShanghaiTime();
        Tool.placeSign(dim, sign, Tool.getSignFacing(cfg.direction, cfg.face), `${player.nameTag}\n${forCreative ? "Creative" : "Survival"}\n${date}\n${time}`);
        const block = dim.getBlock(left);
        if (!block)
            return;
        const invComp = block.getComponent(BlockComponentTypes.Inventory);
        if (!invComp?.container)
            return;
        const container = invComp.container;
        for (let i = 0; i < container.size; i++)
            container.setItem(i, undefined);
        const playerInv = player.getComponent("inventory");
        if (playerInv?.container) {
            for (let i = 0; i < playerInv.container.size && i < 36; i++) {
                const item = playerInv.container.getItem(i);
                if (item) {
                    playerInv.container.setItem(i, undefined);
                    container.setItem(i, item);
                }
            }
        }
        const eq = player.getComponent("equippable");
        if (eq) {
            for (const [ai, slot] of [
                EquipmentSlot.Head,
                EquipmentSlot.Chest,
                EquipmentSlot.Legs,
                EquipmentSlot.Feet,
            ].entries()) {
                const item = eq.getEquipment(slot);
                if (item) {
                    eq.setEquipment(slot, undefined);
                    container.setItem(36 + ai, item);
                }
            }
            const offhand = eq.getEquipment(EquipmentSlot.Offhand);
            if (offhand) {
                eq.setEquipment(EquipmentSlot.Offhand, undefined);
                container.setItem(40, offhand);
            }
        }
    }
    /**
     * 从指定箱子恢复玩家背包
     */
    restoreFromChest(player, forCreative) {
        const cfg = ConfigManager.getGrid("inventory_chest");
        if (!cfg)
            return;
        const dim = world.getDimension("minecraft:overworld");
        const { left } = this.getLayout(this.getChestIndex(player.id, forCreative));
        Tool.ensureDoubleChest(dim, left, Tool.getChestCardinal(cfg.direction, cfg.face), cfg.direction);
        const block = dim.getBlock(left);
        if (!block)
            return;
        const invComp = block.getComponent(BlockComponentTypes.Inventory);
        if (!invComp?.container)
            return;
        const container = invComp.container;
        const playerInv = player.getComponent("inventory");
        if (playerInv?.container) {
            for (let i = 0; i < playerInv.container.size; i++)
                playerInv.container.setItem(i, undefined);
        }
        const eq = player.getComponent("equippable");
        if (eq) {
            eq.setEquipment(EquipmentSlot.Head, undefined);
            eq.setEquipment(EquipmentSlot.Chest, undefined);
            eq.setEquipment(EquipmentSlot.Legs, undefined);
            eq.setEquipment(EquipmentSlot.Feet, undefined);
            eq.setEquipment(EquipmentSlot.Offhand, undefined);
        }
        if (playerInv?.container) {
            for (let i = 0; i < 36; i++) {
                const item = container.getItem(i);
                if (item) {
                    container.setItem(i, undefined);
                    playerInv.container.setItem(i, item);
                }
            }
        }
        if (eq) {
            for (const [ai, slot] of [
                EquipmentSlot.Head,
                EquipmentSlot.Chest,
                EquipmentSlot.Legs,
                EquipmentSlot.Feet,
            ].entries()) {
                const item = container.getItem(36 + ai);
                if (item) {
                    container.setItem(36 + ai, undefined);
                    eq.setEquipment(slot, item);
                }
            }
            const offhand = container.getItem(40);
            if (offhand) {
                container.setItem(40, undefined);
                eq.setEquipment(EquipmentSlot.Offhand, offhand);
            }
        }
    }
}
InventorySwitcher.chestMap = new Map();
//# sourceMappingURL=InventorySwitcher.js.map