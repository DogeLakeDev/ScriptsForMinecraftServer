/* ---------------------------------------- *\
 *  Name        :  DogeLake Cleaner         *
 *  Description :  清理垃圾 集中到固定地点       *
 *  Version     :  1.1.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { system, world, BlockComponentTypes } from "@minecraft/server";
import { ConfigManager } from "../libs/ConfigManager";
import { Command } from "../libs/Command";
import { Permission } from "../libs/Permission";
import * as Tool from "../libs/Tools";
/**
 * [重要]
 * 人工准备：放置箱子、设置常加载区域
 * 清理步骤：垃圾清理到固定地点的一排箱子内，一个箱子装满则放入下一个箱子，箱子上有牌子，记录垃圾进入箱子的时段，若所有箱子均已装满，则从头开始
 */
export class Clean {
    constructor() {
        this.startPoint = [0, 0, 0];
        this.size = [5, 5];
        this.direction = -1; // 箱子的朝向
        this.killList = [];
        this.face = -1;
        this.intervalId = undefined;
        this.itemMax = 128;
        this.timeout = 60;
    }
    static getInstance() {
        if (!Clean._instance) {
            this._instance = new Clean();
        }
        return this._instance;
    }
    init() {
        // 初始化设置
        const cleanCfg = ConfigManager.getClean();
        const recycleBin = ConfigManager.getGrid("clean_recycle_bin");
        if (recycleBin) {
            this.startPoint = [recycleBin.start[0], recycleBin.start[1], recycleBin.start[2]];
            this.size = [recycleBin.size[0], recycleBin.size[1]];
            this.direction = recycleBin.direction;
            this.face = recycleBin.face;
        }
        this.killList = JSON.parse(ConfigManager.getSetting("clean_kill_list", "[]"));
        this.itemMax = cleanCfg.itemMax;
        this.timeout = cleanCfg.pollInterval;
        this.startCleanInterval();
    }
    getCleanIndex() {
        return Clean.cleanIndex;
    }
    setCleanIndex(index) {
        Clean.cleanIndex = index;
    }
    /**
     * 将物品放入箱子
     * @param itemProvider 物品给予函数，函数会返回物品的ItemStack，当返回undefined时说明任务结束此时会退出
     * @param isFirstCall 是否是首次调用，如果是，在一次循环后物品没有放完，会重置index，再进行一次循环直到放完
     */
    placeItem(itemProvider, isFirstCall = true) {
        // 确定面的增长方向
        let base = Tool.getBase(this.direction);
        // 确定箱子朝向
        let cardinalDirection = Tool.getChestCardinal(this.direction, this.face);
        let facingDirection = Tool.getSignFacing(this.direction, this.face);
        let index = 0;
        let currentIndex = this.getCleanIndex(); // 当前箱子的索引，仅在跳过阶段使用
        const dimension = world.getDimension("overworld");
        for (let mainAxis = 0; mainAxis < this.size[0]; mainAxis++) {
            for (let y = 0; y < this.size[1]; y++) {
                // 若还未到达当前空箱子的索引，则跳过
                index++;
                if (index < currentIndex) {
                    continue;
                }
                // 获取坐标的方块
                let coordinate = {
                    x: this.startPoint[0] + mainAxis * base[0] * 2,
                    y: this.startPoint[1] + y,
                    z: this.startPoint[2] + mainAxis * base[1] * 2,
                }; // 主箱子
                let coordinate2 = {
                    x: coordinate.x + base[0],
                    y: coordinate.y,
                    z: coordinate.z + base[1],
                }; // 主箱子右边一个箱子
                // 获取方块
                let block = dimension.getBlock(coordinate);
                let block2 = dimension.getBlock(coordinate2);
                // 方块应该是箱子 不是则放置
                Tool.ensureDoubleChest(dimension, coordinate, cardinalDirection, this.direction);
                // 获取主箱子的容器（可以获取到连体的容器）
                let inventory = block.getComponent(BlockComponentTypes.Inventory);
                if (!inventory || !inventory.container) {
                    continue;
                }
                let container = inventory.container;
                if (container.emptySlotsCount === 0) {
                    container.clearAll();
                }
                // 放入物品
                while (container.emptySlotsCount > 0) {
                    let item = itemProvider();
                    if (!item) {
                        // 没有物品需要处理了，结束任务
                        return;
                    }
                    container.addItem(item);
                }
                // 当前的箱子装满了，更新索引为下一个箱子
                this.setCleanIndex(index + 1);
                // 放置告示牌
                let signCoordinate = {
                    x: coordinate2.x + (base[0] !== 0 ? 0 : this.face),
                    y: coordinate2.y,
                    z: coordinate2.z + (base[1] !== 0 ? 0 : this.face),
                };
                Tool.placeSign(dimension, signCoordinate, facingDirection, this.getTimeStr());
            }
        }
        // 一轮循环后，任务仍然没有结束，归零，进行新一轮循环
        this.setCleanIndex(0);
        if (isFirstCall) {
            this.placeItem(itemProvider, false);
        }
    }
    /**
     * 开始清理
     */
    startClean(entities) {
        // 获取所有物品实体
        let itemEntities = entities ?? this.getAllItemEntities();
        this.placeItem(() => {
            while (itemEntities.length > 0) {
                let itemEntity = itemEntities.pop();
                let stack = itemEntity.getComponent("minecraft:item").itemStack;
                if (!stack) {
                    continue;
                }
                // 在直接清除列表中的物品实体 直接清除
                if (this.killList.some((value) => value === stack.typeId)) {
                    itemEntity.kill();
                    continue;
                }
                // 清除物品实体并返回物品
                itemEntity.kill();
                return stack;
            }
            return undefined;
        });
    }
    startCleanInterval() {
        if (this.intervalId) {
            system.clearRun(this.intervalId);
            this.intervalId = undefined;
        }
        // 扫描
        this.intervalId = system.runInterval(() => {
            let entities = this.getAllItemEntities();
            if (entities.length > this.itemMax) {
                world.sendMessage({ rawtext: [{ text: "「§6読経するヤマビコ ~ 幽谷 響子§f」 距离清理掉落物还有§c 5 §fs" }] });
                system.runTimeout(() => {
                    this.startClean(undefined);
                    system.runTimeout(() => {
                        world.sendMessage({ rawtext: [{ text: "§a* 已清理掉落物 *" }] });
                    }, 5);
                }, 100);
            }
        }, this.timeout * 20);
    }
    stopCleanInterval() {
        if (this.intervalId) {
            system.clearRun(this.intervalId);
            this.intervalId = undefined;
        }
    }
    stop() {
        this.stopCleanInterval();
    }
    /**
     * 获取世界的所有物品
     */
    getAllItemEntities() {
        let itemEntities = world.getDimension("overworld").getEntities({ type: "item" });
        itemEntities.push(...world.getDimension("nether").getEntities({ type: "item" }));
        itemEntities.push(...world.getDimension("the_end").getEntities({ type: "item" }));
        return itemEntities;
    }
    getTimeStr() {
        const { date, time } = Tool.getShanghaiTime();
        return `\n${date}\n${time}`;
    }
}
Clean._instance = undefined;
Clean.cleanIndex = 0;
export function registerCommand() {
    Permission.register("clean.admin", Permission.OP);
    Command.register("clean", "clean.admin", () => {
        Clean.getInstance().startClean(undefined);
    }, "开始扫地", "clean");
}
//# sourceMappingURL=Clean.js.map