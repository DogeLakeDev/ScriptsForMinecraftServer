/**
 * 其他设置
 */
export const Config = {
  // 外部数据库（WebSocketDB）
  dbHost: "127.0.0.1",
  dbPort: 3001,

  // 生存飞行区
  flyArea: [
    {
      name: "f1",
      dimension: "minecraft:overworld",
      start: [-16, 16] as [number, number],
      end: [-12, 12] as [number, number],
    },
    {
      name: "f2",
      dimension: "minecraft:overworld",
      start: [951, -2715] as [number, number],
      end: [4604, 5628] as [number, number],
    },
  ] as { name: string; dimension: string; start: [number, number]; end: [number, number] }[],
  // 创造区域
  creativeArea: [
    {
      name: "建筑区",
      dimension: "minecraft:overworld",
      start: [-16, 16] as [number, number],
      end: [-12, 12] as [number, number],
    },
  ] as { name: string; dimension: string; start: [number, number]; end: [number, number] }[],
  // 和平区域
  peaceArea: [
    {
      dimension: "minecraft:overworld",
      start: [-16, 16] as [number, number],
      end: [-12, 12] as [number, number],
    },
    {
      dimension: "minecraft:overworld",
      start: [951, -2715] as [number, number],
      end: [4604, 5628] as [number, number],
    },
  ] as { dimension: string; start: [number, number]; end: [number, number] }[],
  peaceAreaEntityQO: { families: ["monster"], excludeFamilies: ["zombie_villager", "wither", "illager"] },
  // AFK判定时间 秒
  AFKTime: 120,
  // 答题设置
  QAInterval: [600, 720] as [number, number], // 从一题结束到下一题开始的时间区间（秒）
  QATimeout: 60, // 答题限时
  // 掉落物清理设置
  clean: {
    itemMax: 192, // 掉落物清理阈值
    timeout: 60, // 扫描间隔时间(秒)
    recycleBin: {
      start: [-89, -59, -72] as [number, number, number], // 起点
      size: [5, 5] as [number, number], // 单元个数，因为是一面箱子，所以必须有一个方向为 1 或 -1，正负代指箱子的朝向。
      direction: -1, // 增长方向，1/-1为x轴正/负方向，2/-2为z轴正/负方向
      face: -1, // 箱子面朝的方向，direction为x/z时，[箱子面前的方块的x/z轴坐标] 等于 [箱子的x/z轴坐标]+[face的值]
      // 直接清除的物品种类
      killList: ["shitcraft:shit"] as string[],
    },
  },
  // 背包切换箱子区域（每名玩家占用 2 个双箱子：survival + creative）
  inventoryChest: {
    start: [14, -63, -14] as [number, number, number], // 起点
    size: [5, 5] as [number, number], // 单元个数，direction 方向上的数量和垂直方向上的数量
    direction: -1, // 增长方向，1/-1为x轴正/负方向，2/-2为z轴正/负方向
    face: -1, // 箱子面朝方向
  },
  // 商店箱子区域
  shopChest: {
    start: [0, -63, 0] as [number, number, number], // 起点坐标
    size: [5, 5] as [number, number], // 商店数量网格
    direction: -1, // 增长方向
    face: -1, // 箱子面朝方向
  },
  // 创造区内禁止放置的方块列表（对所有人生效，包括管理员）
  creativeBannedItems: [
    // ===== 红石元件 =====
    "minecraft:redstone_wire", // 红石粉
    "minecraft:redstone_block", // 红石块
    "minecraft:redstone_torch", // 红石火把
    "minecraft:repeater", // 中继器
    "minecraft:comparator", // 比较器
    "minecraft:piston", // 活塞
    "minecraft:sticky_piston", // 粘性活塞
    "minecraft:observer", // 侦测器
    "minecraft:dispenser", // 发射器
    "minecraft:dropper", // 投掷器
    "minecraft:hopper", // 漏斗
    "minecraft:rail", // 铁轨
    "minecraft:powered_rail", // 动力铁轨
    "minecraft:detector_rail", // 探测铁轨
    "minecraft:activator_rail", // 激活铁轨
    "minecraft:target", // 靶子
    "minecraft:crafter", // 合成器
    "minecraft:tripwire_hook", // 绊线钩
    "minecraft:sculk_sensor", // 幽匿感测体
    "minecraft:calibrated_sculk_sensor", // 校频幽匿感测体
    "minecraft:bell", // 钟

    // ===== 功能方块 =====
    "minecraft:crafting_table", // 工作台
    "minecraft:furnace", // 熔炉
    "minecraft:blast_furnace", // 高炉
    "minecraft:smoker", // 烟熏炉
    "minecraft:enchanting_table", // 附魔台
    "minecraft:anvil", // 铁砧
    "minecraft:chipped_anvil", // 开裂的铁砧
    "minecraft:damaged_anvil", // 损坏的铁砧
    "minecraft:grindstone", // 砂轮
    "minecraft:stonecutter_block", // 切石机
    "minecraft:loom", // 织布机
    "minecraft:cartography_table", // 制图台
    "minecraft:brewing_stand", // 酿造台
    "minecraft:cauldron", // 炼药锅
    "minecraft:composter", // 堆肥桶
    "minecraft:smithing_table", // 锻造台
    "minecraft:fletching_table", // 制箭台
    "minecraft:trapped_chest", // 陷阱箱
    "minecraft:ender_chest", // 末影箱
    "minecraft:shulker_box", // 潜影盒
    "minecraft:undyed_shulker_box", // 白色潜影盒
    "minecraft:beacon", // 信标
    "minecraft:conduit", // 潮涌核心
    "minecraft:respawn_anchor", // 重生锚
    "minecraft:bed", // 白色床
    "minecraft:orange_bed", // 橙色床
    "minecraft:magenta_bed", // 品红色床
    "minecraft:light_blue_bed", // 淡蓝色床
    "minecraft:yellow_bed", // 黄色床
    "minecraft:lime_bed", // 黄绿色床
    "minecraft:pink_bed", // 粉红色床
    "minecraft:gray_bed", // 灰色床
    "minecraft:light_gray_bed", // 淡灰色床
    "minecraft:cyan_bed", // 青色床
    "minecraft:purple_bed", // 紫色床
    "minecraft:blue_bed", // 蓝色床
    "minecraft:brown_bed", // 棕色床
    "minecraft:green_bed", // 绿色床
    "minecraft:red_bed", // 红色床
    "minecraft:black_bed", // 黑色床
    "minecraft:campfire", // 营火
    "minecraft:soul_campfire", // 灵魂营火
    "minecraft:jukebox", // 唱片机
    "minecraft:decorated_pot", // 饰纹陶罐

    // ===== 生成/结构方块 =====
    "minecraft:mob_spawner", // 刷怪笼
    "minecraft:trial_spawner", // 试炼刷怪笼
    "minecraft:vault", // 宝库
    "minecraft:command_block", // 命令方块
    "minecraft:repeating_command_block", // 循环命令方块
    "minecraft:chain_command_block", // 连锁命令方块
    "minecraft:structure_block", // 结构方块
    "minecraft:structure_void", // 结构空位
    "minecraft:jigsaw", // 拼图方块
    "minecraft:barrier", // 屏障
    "minecraft:light_block", // 光源方块
    "minecraft:end_portal_frame", // 末地传送门框架
    "minecraft:end_gateway", // 末地折跃门
    "minecraft:dragon_egg", // 龙蛋
    "minecraft:bedrock", //基岩
  ] as string[],
};
