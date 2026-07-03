// scripts/entry.ts
import { system as system17, world as world24 } from "@minecraft/server";

// scripts/libs/Money.ts
import { world } from "@minecraft/server";
var MONEY_NAME = "money";
var Money = class {
  static {
    /** 货币单位名称 */
    this.UNIT = "\u8282\u64CD";
  }
  /**
   * 获取玩家金钱数量
   */
  static get(player) {
    let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
    if (!scoreboard) return 0;
    try {
      let score = scoreboard.getScore(player);
      if (score !== void 0) {
        return score;
      }
    } catch (_) {
    }
    if (scoreboard) {
      scoreboard.setScore(player, 0);
    }
    return 0;
  }
  /**
   * 设置玩家金钱数量
   */
  static set(player, money) {
    let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
    if (!scoreboard) {
      world.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
      scoreboard = world.scoreboard.getObjective(MONEY_NAME);
    }
    return scoreboard.setScore(player, money);
  }
  /**
   * 给予玩家金钱
   */
  static add(player, money) {
    return this.set(player, this.get(player) + money);
  }
  /**
   * 初始化计分板
   */
  static initScoreboard() {
    if (!world.scoreboard.getObjective(MONEY_NAME)) {
      world.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
    }
  }
};

// scripts/libs/Command.ts
import { system } from "@minecraft/server";

// scripts/libs/Permission.ts
import { PlayerPermissionLevel } from "@minecraft/server";

// scripts/data/Permission.ts
var data = {
  "CommetWind": 2,
  "Shiroha7z": 3
};

// scripts/libs/Tools.ts
import { world as world2, BlockPermutation, BlockComponentTypes } from "@minecraft/server";
function pointInArea_2D(x, z, areaStart_x, areaStart_z, areaEnd_x, areaEnd_z) {
  if (areaStart_x < areaEnd_x) {
    if (x < areaStart_x || areaEnd_x < x) {
      return false;
    }
  } else {
    if (x < areaEnd_x || areaStart_x < x) {
      return false;
    }
  }
  if (areaStart_z < areaEnd_z) {
    if (z < areaStart_z || areaEnd_z < z) {
      return false;
    }
  } else {
    if (z < areaEnd_z || areaStart_z < z) {
      return false;
    }
  }
  return true;
}
function getRandomInteger(min = 0, max = 1) {
  return min + Math.floor(Math.random() * (max + 1));
}
function getBase(direction) {
  switch (direction) {
    case 1:
      return [1, 0];
    case -1:
      return [-1, 0];
    case 2:
      return [0, 1];
    case -2:
      return [0, -1];
    default:
      return [1, 0];
  }
}
function getChestCardinal(direction, face) {
  if (direction === -1 || direction === 1) {
    return face > 0 ? "south" : "north";
  }
  return face > 0 ? "east" : "west";
}
function getSignFacing(direction, face) {
  if (direction === -1 || direction === 1) {
    return face > 0 ? 3 : 2;
  }
  return face > 0 ? 5 : 4;
}
function getLayout(start, direction, mainAxis, yOffset, face) {
  const base = getBase(direction);
  const left = {
    x: start[0] + mainAxis * base[0] * 2,
    y: start[1] + yOffset,
    z: start[2] + mainAxis * base[1] * 2
  };
  const right = {
    x: left.x + base[0],
    y: left.y,
    z: left.z + base[1]
  };
  const sign = {
    x: right.x + (base[0] !== 0 ? 0 : face),
    y: right.y,
    z: right.z + (base[1] !== 0 ? 0 : face)
  };
  return { left, right, sign };
}
function ensureDoubleChest(dimension, pos, cardinal, direction) {
  const base = getBase(direction);
  for (const d of [0, 1]) {
    const p = {
      x: pos.x + (base[0] !== 0 ? d * base[0] : 0),
      y: pos.y,
      z: pos.z + (base[1] !== 0 ? d * base[1] : 0)
    };
    const block = dimension.getBlock(p);
    if (!block || block.typeId !== "minecraft:chest") {
      dimension.setBlockPermutation(p, BlockPermutation.resolve("chest", { "minecraft:cardinal_direction": cardinal }));
    }
  }
}
function placeSign(dimension, pos, facing, text) {
  dimension.setBlockPermutation(
    pos,
    BlockPermutation.resolve("pale_oak_wall_sign", { "facing_direction": facing })
  );
  try {
    const block = dimension.getBlock(pos);
    const sign = block?.getComponent(BlockComponentTypes.Sign);
    if (sign) sign.setText(text);
  } catch {
  }
}
function getShanghaiTime() {
  const now = /* @__PURE__ */ new Date();
  const offset = 8 * 60;
  const local = new Date(now.getTime() + offset * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
  };
}
var _systemMsgHandler = null;
function registerSystemMsgHandler(handler) {
  _systemMsgHandler = handler;
}
var Msg = {
  info: (msg, player) => {
    player.sendMessage(`\xA7f[*] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  error: (msg, player) => {
    player.sendMessage(`\xA7c[x] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  success: (msg, player) => {
    player.sendMessage(`\xA7a[\u221A] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  warning: (msg, player) => {
    player.sendMessage(`\xA7e[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  },
  tips: (msg, player) => {
    player.sendMessage(`\xA77[!] ${msg}`);
    _systemMsgHandler?.(player, msg);
  }
};
function ListFormInfo(str) {
  if (str.length === 0) return "\xA77\u8BF7\u9009\u62E9\u64CD\u4F5C\uFF1A";
  let lines = [];
  lines.push(`[*] ${str[0]}`);
  if (str.length > 1) {
    str.shift();
    for (let line of str) {
      lines.push(`${line}`);
    }
  }
  lines.push("");
  lines.push(`\xA77\u8BF7\u9009\u62E9\u64CD\u4F5C\uFF1A`);
  return lines.join("\n");
}

// scripts/libs/Permission.ts
var Permission = class _Permission {
  static {
    this.Guest = -1;
  }
  static {
    // 脚本指定的无权限访客
    this.Any = 0;
  }
  static {
    // 等同于原生 Visitor
    this.Member = 1;
  }
  static {
    // 等同于原生 Member
    this.OP = 2;
  }
  static {
    // 等同于原生 Operator
    this.Admin = 3;
  }
  static {
    // 等同于原生 Custom
    /** 权限注册表：权限名 → 所需最低等级 */
    this.registry = /* @__PURE__ */ new Map();
  }
  /**
   * 注册一个权限项
   * @param name 权限名（如 "creativearea.toggle"）
   * @param level 所需最低权限等级
   */
  static register(name, level) {
    this.registry.set(name, level);
  }
  /**
   * 检查玩家是否拥有指定权限
   * @param player 玩家对象或玩家名
   * @param permissionName 权限名
   * @returns 是否满足权限要求
   */
  static check(player, permissionName) {
    const required = this.registry.get(permissionName);
    if (required === void 0) return true;
    const playerLevel = typeof player === "string" ? data[player] ?? this.Member : this.getPermission(player);
    return playerLevel >= required;
  }
  static getPermission(player) {
    if (data[player.name] !== void 0) {
      return data[player.name];
    }
    switch (player.playerPermissionLevel) {
      case PlayerPermissionLevel.Visitor:
        return this.Any;
      case PlayerPermissionLevel.Member:
        return this.Member;
      case PlayerPermissionLevel.Operator:
        return this.OP;
      case PlayerPermissionLevel.Custom:
        return this.Admin;
      default:
        return this.Member;
    }
  }
  /** 注册 permlist 命令 */
  static registerPermlistCommand() {
    _Permission.register("permlist.see", _Permission.Any);
    Command.register(
      "permlist",
      "permlist.see",
      (player) => {
        if (!player) return;
        const lines = [];
        lines.push(`\u83B7\u53D6\u5230\u5982\u4E0B\u6743\u9650\u9879\uFF1A\xA7r`);
        const byLevel = [
          [this.Any, []],
          [this.Member, []],
          [this.OP, []],
          [this.Admin, []],
          [-1, []]
        ];
        const levelMap = new Map(byLevel);
        for (const [name, level] of this.registry) {
          const bucket = levelMap.get(level);
          if (bucket) bucket.push(name);
          else (levelMap.get(-1) ?? []).push(name);
        }
        const label = {
          [-1]: "\u672A\u77E5",
          [this.Any]: "\xA7a\u8BBF\u5BA2",
          [this.Member]: "\xA7e\u6210\u5458",
          [this.OP]: "\xA76\u7BA1\u7406",
          [this.Admin]: "\xA7c\u81EA\u5B9A\u4E49"
        };
        for (const [level, perms] of byLevel) {
          if (perms.length === 0) continue;
          lines.push(`
${label[level] ?? "\xA77\u5176\u4ED6"} (${level}+):`);
          for (const p of perms) {
            lines.push(`  \xA7f${p}`);
          }
        }
        Msg.success(lines.join("\n"), player);
      },
      "\u67E5\u770B\u6240\u6709\u6743\u9650\u5217\u8868"
    );
  }
};

// scripts/libs/Command.ts
var Command = class {
  static {
    this.list = {};
  }
  /**
   * 注册指令
   * @param name 指令名称
   * @param permission 权限等级(数字) 或 权限名(字符串)
   * @param callback 回调
   * @param description 指令描述
   */
  static register(name, permission, callback, description) {
    if (this.list[name] === void 0) {
      this.list[name] = {
        "callback": callback,
        "permission": permission,
        "description": description === void 0 ? name : description
      };
    }
    return false;
  }
  /**
   * 检查玩家是否有权限执行该命令
   */
  static canExecute(player, permission) {
    if (player === void 0) return true;
    if (typeof permission === "string") {
      return Permission.check(player, permission);
    }
    return Permission.getPermission(player) >= permission;
  }
  /**
   * 触发指令
   * @param player 触发指令的玩家，不指定时使用最高权限执行
   * @param message
   */
  static trigger(player, message) {
    let commandInfo = this.list[message];
    if (commandInfo !== void 0) {
      if (this.canExecute(player, commandInfo.permission)) {
        system.run(() => {
          let result = commandInfo.callback(player);
          if (result !== void 0) {
            if (player) Msg.success(`${result}`, player);
          }
        });
        return;
      }
      if (player) Msg.error(`\u4F60\u6CA1\u6709\u6267\u884C\u6B64\u6761\u6307\u4EE4\u7684\u6743\u9650\u3002`, player);
      return;
    }
    if (player) Msg.error(`\u672A\u77E5\u7684\u547D\u4EE4! \u53D1\u9001'!help'\u67E5\u8BE2\u6240\u6709\u6307\u4EE4\u3002`, player);
    return;
  }
  /**
   * 注册帮助指令，在初始化时调用
   */
  static registerHelpCommand() {
    Permission.register("help.see", Permission.Any);
    this.register(
      "help",
      "help.see",
      (player) => {
        let result = "\u5F53\u524D\u53EF\u7528\u6307\u4EE4\u5217\u8868\u5982\u4E0B\uFF1A\xA7r\n";
        for (let command in this.list) {
          if (this.canExecute(player, this.list[command].permission)) {
            result += `  ${command} - ${this.list[command].description}
`;
          }
        }
        return result;
      },
      "\u83B7\u53D6\u6240\u6709\u6307\u4EE4"
    );
  }
  /**
   * 注册脚本事件，在初始化时调用
   */
  static registerScriptEvent() {
    system.afterEvents.scriptEventReceive.subscribe((event) => {
      this.trigger(event.sourceEntity, event.id.substring(5));
    }, { "namespaces": ["doge"] });
  }
};
Command.registerScriptEvent();

// scripts/doge/QA.ts
import { system as system2, world as world3 } from "@minecraft/server";

// scripts/data/Questions.ts
var Questions = [
  {
    "weight": 1,
    // 出现的权重，权重越大越可能出现
    "q": "\u5728\u300A\u4E1C\u65B9\u9B3C\u5F62\u517D\u300B\u4E2D, \u516D\u9762BOSS\u662F? (\u4E94\u4E2A\u5B57)",
    "a": ["\u57F4\u5B89\u795E\u88BF\u59EC"],
    "bonus": [{
      "seq": [1, 5],
      // 1~5名答对者可以获得此奖励，留空则所有排名均可获得
      "type": "money",
      // 奖励种类: 节操
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u6253\u4E00\u8F66\u4E07\u4EBA\u7269: \u5149\u660E\u725B\u5976\uFF08\u4E94\u4E2A\u5B57\uFF09",
    "a": ["\u6851\u5C3C\u7C73\u5C14\u514B"],
    "bonus": [{
      "type": "item",
      // 奖励种类: 物品，仅支持give能给予的物品，特殊物品请使用指令给予（dogelake gift）
      "itemType": "milk_bucket",
      "amount": 1,
      "data": 0
    }]
  },
  {
    "weight": 1,
    "q": "\u8C01\u662F BBA ?",
    "a": ["\u516B\u4E91\u7D2B", "\u7D2B", "\u7D2BBBA"],
    "msg_right": "8\u8981\u547D\u5566\uFF1F",
    // 回答正确的提示
    "bonus": [{
      "type": "cmd",
      "cmd": "damage @s 10"
    }]
  },
  {
    "weight": 1,
    "q": "\u6253\u4E00\u8F66\u4E07\u4EBA\u7269: \u9752\u91D1\u77F3",
    "a": ["\u8D6B\u5361\u63D0\u4E9A", "\u8D6B\u5361\u63D0\u4E9A\xB7\u62C9\u78A7\u65AF\u62C9\u7956\u5229", "\u8D6B\u5361\u63D0\u4E9A\u62C9\u78A7\u65AF\u62C9\u7956\u5229", "\u8D6B\u5361\u63D0\u4E9A \u62C9\u78A7\u65AF\u62C9\u7956\u5229"],
    "d": "\u8D6B\u5361\u63D0\u4E9A \xB7 \u62C9\u78A7\u65AF\u62C9\u7956\u5229\u7684\u201C\u62C9\u78A7\u65AF\u62C9\u7956\u5229\u201D\uFF08Lapislazuli\uFF09\u5373\u4E3A\u201C\u9752\u91D1\u77F3\u201D",
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u5728\u5C11\u6797\u5BFA\u5341\u516B\u94DC\u4EBA\u9635\u4E2D, \u542C\u58F0\u8FA8\u4F4D\u7684\u8003\u5B98\u662F\u4EC0\u4E48\u505A\u7684\uFF1F",
    "a": ["\u8089", "\u4EBA\u8089", "\u8840\u8089"],
    "msg_right": "\u4F60\u8FC7\u5173!",
    "msg_wrong": "\u8BE5\u7F5A!",
    "bonus": [{
      "type": "money",
      "amount": 500
    }],
    "punish": [{
      "type": "cmd",
      "cmd": "damage @s 10"
    }]
  },
  {
    "weight": 1,
    "q": "\u9053\u5BB6\u5B66\u6D3E\u7684\u521B\u59CB\u4EBA\u662F",
    "a": ["\u8001\u5B50"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u4E2D\u534E\u4E09\u7956\u662F \u9EC4\u5E1D\u3001\u708E\u5E1D\u548C____",
    "a": ["\u86A9\u5C24"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  }
  //7
];

// scripts/data/Config.ts
var Config = {
  // 外部数据库（WebSocketDB）
  dbHost: "127.0.0.1",
  dbPort: 3001,
  // 生存飞行区
  flyArea: [
    {
      "name": "f1",
      "dimension": "minecraft:overworld",
      "start": [-16, 16],
      "end": [-12, 12]
    },
    {
      "name": "f2",
      "dimension": "minecraft:overworld",
      "start": [951, -2715],
      "end": [4604, 5628]
    }
  ],
  // 创造区域
  creativeArea: [
    {
      "name": "\u5EFA\u7B51\u533A",
      "dimension": "minecraft:overworld",
      "start": [-16, 16],
      "end": [-12, 12]
    }
  ],
  // 和平区域
  peaceArea: [
    {
      "dimension": "minecraft:overworld",
      "start": [-16, 16],
      "end": [-12, 12]
    },
    {
      "dimension": "minecraft:overworld",
      "start": [951, -2715],
      "end": [4604, 5628]
    }
  ],
  peaceAreaEntityQO: { families: ["monster"], excludeFamilies: ["zombie_villager", "wither", "illager"] },
  // AFK判定时间 秒
  AFKTime: 120,
  // 答题设置
  QAInterval: [600, 720],
  // 从一题结束到下一题开始的时间区间（秒）
  QATimeout: 60,
  // 答题限时
  // 掉落物清理设置
  clean: {
    itemMax: 192,
    // 掉落物清理阈值
    timeout: 60,
    // 扫描间隔时间(秒)
    recycleBin: {
      start: [-89, -59, -72],
      // 起点
      size: [5, 5],
      // 单元个数，因为是一面箱子，所以必须有一个方向为 1 或 -1，正负代指箱子的朝向。
      direction: -1,
      // 增长方向，1/-1为x轴正/负方向，2/-2为z轴正/负方向
      face: -1,
      // 箱子面朝的方向，direction为x/z时，[箱子面前的方块的x/z轴坐标] 等于 [箱子的x/z轴坐标]+[face的值]
      // 直接清除的物品种类
      killList: [
        "shitcraft:shit"
      ]
    }
  },
  // 背包切换箱子区域（每名玩家占用 2 个双箱子：survival + creative）
  inventoryChest: {
    start: [14, -63, -14],
    // 起点
    size: [5, 5],
    // 单元个数，direction 方向上的数量和垂直方向上的数量
    direction: -1,
    // 增长方向，1/-1为x轴正/负方向，2/-2为z轴正/负方向
    face: -1
    // 箱子面朝方向
  },
  // 商店箱子区域
  shopChest: {
    start: [0, -63, 0],
    // 起点坐标
    size: [5, 5],
    // 商店数量网格
    direction: -1,
    // 增长方向
    face: -1
    // 箱子面朝方向
  },
  // 创造区内禁止放置的方块列表（对所有人生效，包括管理员）
  creativeBannedItems: [
    // ===== 红石元件 =====
    "minecraft:redstone_wire",
    // 红石粉
    "minecraft:redstone_block",
    // 红石块
    "minecraft:redstone_torch",
    // 红石火把
    "minecraft:repeater",
    // 中继器
    "minecraft:comparator",
    // 比较器
    "minecraft:piston",
    // 活塞
    "minecraft:sticky_piston",
    // 粘性活塞
    "minecraft:observer",
    // 侦测器
    "minecraft:dispenser",
    // 发射器
    "minecraft:dropper",
    // 投掷器
    "minecraft:hopper",
    // 漏斗
    "minecraft:rail",
    // 铁轨
    "minecraft:powered_rail",
    // 动力铁轨
    "minecraft:detector_rail",
    // 探测铁轨
    "minecraft:activator_rail",
    // 激活铁轨
    "minecraft:target",
    // 靶子
    "minecraft:crafter",
    // 合成器
    "minecraft:tripwire_hook",
    // 绊线钩
    "minecraft:sculk_sensor",
    // 幽匿感测体
    "minecraft:calibrated_sculk_sensor",
    // 校频幽匿感测体
    "minecraft:bell",
    // 钟
    // ===== 功能方块 =====
    "minecraft:crafting_table",
    // 工作台
    "minecraft:furnace",
    // 熔炉
    "minecraft:blast_furnace",
    // 高炉
    "minecraft:smoker",
    // 烟熏炉
    "minecraft:enchanting_table",
    // 附魔台
    "minecraft:anvil",
    // 铁砧
    "minecraft:chipped_anvil",
    // 开裂的铁砧
    "minecraft:damaged_anvil",
    // 损坏的铁砧
    "minecraft:grindstone",
    // 砂轮
    "minecraft:stonecutter_block",
    // 切石机
    "minecraft:loom",
    // 织布机
    "minecraft:cartography_table",
    // 制图台
    "minecraft:brewing_stand",
    // 酿造台
    "minecraft:cauldron",
    // 炼药锅
    "minecraft:composter",
    // 堆肥桶
    "minecraft:smithing_table",
    // 锻造台
    "minecraft:fletching_table",
    // 制箭台
    "minecraft:trapped_chest",
    // 陷阱箱
    "minecraft:ender_chest",
    // 末影箱
    "minecraft:shulker_box",
    // 潜影盒
    "minecraft:undyed_shulker_box",
    // 白色潜影盒
    "minecraft:beacon",
    // 信标
    "minecraft:conduit",
    // 潮涌核心
    "minecraft:respawn_anchor",
    // 重生锚
    "minecraft:bed",
    // 白色床
    "minecraft:orange_bed",
    // 橙色床
    "minecraft:magenta_bed",
    // 品红色床
    "minecraft:light_blue_bed",
    // 淡蓝色床
    "minecraft:yellow_bed",
    // 黄色床
    "minecraft:lime_bed",
    // 黄绿色床
    "minecraft:pink_bed",
    // 粉红色床
    "minecraft:gray_bed",
    // 灰色床
    "minecraft:light_gray_bed",
    // 淡灰色床
    "minecraft:cyan_bed",
    // 青色床
    "minecraft:purple_bed",
    // 紫色床
    "minecraft:blue_bed",
    // 蓝色床
    "minecraft:brown_bed",
    // 棕色床
    "minecraft:green_bed",
    // 绿色床
    "minecraft:red_bed",
    // 红色床
    "minecraft:black_bed",
    // 黑色床
    "minecraft:campfire",
    // 营火
    "minecraft:soul_campfire",
    // 灵魂营火
    "minecraft:jukebox",
    // 唱片机
    "minecraft:decorated_pot",
    // 饰纹陶罐
    // ===== 生成/结构方块 =====
    "minecraft:mob_spawner",
    // 刷怪笼
    "minecraft:trial_spawner",
    // 试炼刷怪笼
    "minecraft:vault",
    // 宝库
    "minecraft:command_block",
    // 命令方块
    "minecraft:repeating_command_block",
    // 循环命令方块
    "minecraft:chain_command_block",
    // 连锁命令方块
    "minecraft:structure_block",
    // 结构方块
    "minecraft:structure_void",
    // 结构空位
    "minecraft:jigsaw",
    // 拼图方块
    "minecraft:barrier",
    // 屏障
    "minecraft:light_block",
    // 光源方块
    "minecraft:end_portal_frame",
    // 末地传送门框架
    "minecraft:end_gateway",
    // 末地折跃门
    "minecraft:dragon_egg",
    // 龙蛋
    "minecraft:bedrock,"
    //基岩
  ]
};

// scripts/doge/QA.ts
var QAManager = class _QAManager {
  constructor() {
    // 记录玩家答题信息
    this.nowQuestion = void 0;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;
    this.timeoutId = void 0;
    // 出题记录，避免短时间重复出题
    this.record = [];
    // 最近出的几个题
    this.recordPtr = 0;
    // 下一个记录写入的位置
    this.recordLimit = Math.floor(Questions.length - 2);
  }
  /**
   * @returns {QAManager}
   */
  static getInstance() {
    if (_QAManager._instance === void 0) {
      _QAManager._instance = new _QAManager();
    }
    return _QAManager._instance;
  }
  /**
   * 开始答题循环
   */
  start() {
    world3.beforeEvents.chatSend.subscribe((event) => {
      if (event.message.substring(0, 1) === "!" || event.message.substring(0, 1) === "\uFF01") {
        let answer = event.message.substring(1);
        answer = answer.replaceAll(" ");
        if (this.nowQuestion !== void 0) {
          this.answer(event.sender, answer);
          event.cancel = true;
          return;
        }
      }
    });
    system2.runTimeout(() => {
      this.nextQuestion();
    }, _QAManager.getNextTimeout());
  }
  // 下一个问题
  nextQuestion() {
    let questionList = [];
    let totalWeight = 0;
    let startPoints = [];
    for (let i = 0; i < Questions.length; i++) {
      if (!this.record.includes(i)) {
        questionList.push(i);
        totalWeight += Questions[i].weight;
        startPoints.push(totalWeight);
      }
    }
    let randomNum = getRandomInteger(0, totalWeight - 1);
    for (let i = 0; i < startPoints.length; i++) {
      if (randomNum < startPoints[i]) {
        this.nowQuestion = questionList[i];
        this.pushRecord(i);
        break;
      }
    }
    world3.sendMessage(`\xA7b[Baka Cirno]\xA7r \xA7g${Questions[this.nowQuestion].q}\xA7r
  \xA7h\u53D1\u9001 \xA7e!\u7B54\u6848\xA7r \xA7h\u6765\u7B54\u9898`);
    system2.runTimeout(() => {
      this.finish();
    }, Config.QATimeout * 20);
  }
  // 结束答题，揭晓答案
  finish() {
    let question = Questions[this.nowQuestion];
    world3.sendMessage(`\xA7b[Baka Cirno]\xA7r \u6B63\u786E\u7B54\u6848\u662F \xA7e${question.a[0]}\xA7r ! ${question.d !== void 0 ? "\n  " + question.d : ""}`);
    this.nowQuestion = void 0;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;
    this.timeoutId = system2.runTimeout(() => {
      this.nextQuestion();
    }, _QAManager.getNextTimeout());
  }
  /**
   * 玩家答题
   * @returns -2答题未在进行 -1玩家已答过题 0错误 1正确
   */
  answer(pl, str) {
    if (this.nowQuestion !== void 0) {
      if (this.playerList[pl.nameTag] === void 0) {
        let question = Questions[this.nowQuestion];
        for (let a of question.a) {
          if (str === a) {
            this.rightAmount++;
            this.playerList[pl.nameTag] = true;
            _QAManager.giveBonus(pl, this.rightAmount, question.bonus);
            if (question["msg_right"] !== void 0) {
              pl.sendMessage(question["msg_right"]);
            } else {
              pl.sendMessage("\xA7a\u56DE\u7B54\u6B63\u786E\uFF01\xA7r");
            }
            return 1;
          }
        }
        if (question["msg_wrong"] !== void 0) {
          pl.sendMessage(question["msg_wrong"]);
        } else {
          pl.sendMessage("\xA7c\u56DE\u7B54\u9519\u8BEF\uFF01\xA7r");
        }
        this.wrongAmount++;
        if (question.punish !== void 0) {
          _QAManager.giveBonus(pl, this.wrongAmount, question.punish);
        }
        this.playerList[pl.nameTag] = false;
        return 0;
      }
      pl.sendMessage("\xA7h\u5DF2\u7ECF\u7B54\u8FC7\u8FD9\u9898\u4E86^ ^\xA7r");
      return -1;
    }
    pl.sendMessage("\xA7h\u5F53\u524D\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u7B54\u9898^ ^\xA7r");
    return -2;
  }
  // 最大记录数量
  pushRecord(index) {
    this.record[this.recordPtr] = index;
    this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
  }
  // 距离下一个问题的时间(秒)
  static getNextTimeout() {
    let min = Config.QAInterval[0] * 20;
    let max = Config.QAInterval[1] * 20;
    return min + Math.floor(Math.random() * max);
  }
  /**
   * 给予玩家奖励 也可以是惩罚，格式是一样的
   * @param pl 答题者
   * @param seq 顺序(从1开始)
   * @param bonus 奖励列表
   */
  static giveBonus(pl, seq, bonus) {
    if (!bonus) return;
    for (let b of bonus) {
      if (b["seq"] === void 0 || b["seq"][0] <= seq && seq <= b["seq"][1]) {
        system2.run(() => {
          switch (b["type"]) {
            case "money":
              Money.add(pl, b["amount"]);
              break;
            case "item":
              pl.runCommand(`give @s ${b["itemType"]} ${b["amount"]} ${b["data"] === void 0 ? "" : b["data"]}`);
              break;
            case "cmd":
              pl.runCommand(b["cmd"]);
              break;
            default:
              pl.sendMessage(`Unknown bonus type: ${b["type"]}`);
              break;
          }
        });
      }
    }
  }
};

// scripts/area/Fly.ts
import { system as system3, world as world4, GameMode } from "@minecraft/server";

// scripts/libs/HttpDB.ts
import { http, HttpRequest } from "@minecraft/server-net";
var BASE_URL = `http://${Config.dbHost}:${Config.dbPort}`;
var TIMEOUT = 3;
var HttpDB = class {
  static {
    this.available = true;
  }
  static isAvailable() {
    return this.available;
  }
  static async checkHealth() {
    try {
      const res = await http.get(`${BASE_URL}/api/health`);
      this.available = res.status === 200;
      if (this.available) {
        console.info(`[HttpDB] \u6570\u636E\u5E93\u670D\u52A1\u8FDE\u63A5\u6210\u529F (${BASE_URL}/api/health)`);
      } else {
        console.error(`[HttpDB] \u6570\u636E\u5E93\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\u72B6\u6001 ${res.status}`);
      }
    } catch (err) {
      this.available = false;
      console.error(`[HttpDB] \u8FDE\u63A5\u5931\u8D25 (${BASE_URL}): ${err}`);
    }
    return this.available;
  }
  // ---- 通用 HTTP 方法 ----
  static async get(path) {
    try {
      const res = await http.get(`${BASE_URL}${path}`);
      return res.status === 200 ? res.body : null;
    } catch {
      this.available = false;
      return null;
    }
  }
  static async post(path, bodyData) {
    try {
      const req = new HttpRequest(`${BASE_URL}${path}`);
      req.timeout = TIMEOUT;
      req.method = "Post";
      req.body = JSON.stringify(bodyData);
      req.addHeader("Content-Type", "application/json");
      const res = await http.request(req);
      if (res.status !== 200) {
        console.warn(`[HttpDB] POST ${path} \u8FD4\u56DE ${res.status}: ${res.body}`);
      }
      return res.status === 200;
    } catch (err) {
      this.available = false;
      console.warn(`[HttpDB] POST ${path} \u5931\u8D25: ${err}`);
      return false;
    }
  }
  static async del(path) {
    try {
      const req = new HttpRequest(`${BASE_URL}${path}`);
      req.timeout = TIMEOUT;
      req.method = "Delete";
      const res = await http.request(req);
      return res.status === 200;
    } catch {
      return false;
    }
  }
  // ---- 消息历史 ----
  static async saveMessage(channelId, message) {
    return this.post("/api/messages/save", { channelId, message });
  }
  static async loadHistory(channelId, cutoff) {
    const body = await this.get(`/api/messages/${encodeURIComponent(channelId)}?cutoff=${cutoff}`);
    if (!body) return null;
    try {
      return JSON.parse(body).messages;
    } catch {
      return null;
    }
  }
  static async deleteChannelMessages(channelId) {
    return this.del(`/api/messages/${encodeURIComponent(channelId)}`);
  }
  static async cleanupExpired(channels) {
    return this.post("/api/messages/cleanup", { channels });
  }
  // ---- 红包 ----
  static async saveRedPacket(redpacket) {
    return this.post("/api/redpackets/save", { redpacket });
  }
  static async updateRedPacket(redpacket) {
    return this.post("/api/redpackets/update", { redpacket });
  }
  static async getRedPackets() {
    const body = await this.get("/api/redpackets");
    if (!body) return null;
    try {
      return JSON.parse(body).redpackets;
    } catch {
      return null;
    }
  }
  static async getRedPacket(packetId) {
    const body = await this.get(`/api/redpackets/${encodeURIComponent(packetId)}`);
    if (!body) return null;
    try {
      return JSON.parse(body).redpacket ?? null;
    } catch {
      return null;
    }
  }
  static async cleanupExpiredRedPackets() {
    return this.post("/api/cleanup-expired-rp", {});
  }
  // ---- 计分板同步 ----
  static async syncScoreboards(entries) {
    return this.post("/api/sfmc/scoreboards/sync", { entries });
  }
  static async loadScoreboards(filter) {
    const params = new URLSearchParams();
    if (filter?.objective) params.set("objective", filter.objective);
    if (filter?.name) params.set("name", filter.name);
    if (filter?.id) params.set("id", filter.id);
    const qs = params.toString();
    const body = await this.get(`/api/sfmc/scoreboards${qs ? "?" + qs : ""}`);
    if (!body) return null;
    try {
      return JSON.parse(body).entries;
    } catch {
      return null;
    }
  }
  static async getScoreboardObjectives() {
    const body = await this.get("/api/sfmc/scoreboards/objectives");
    if (!body) return null;
    try {
      return JSON.parse(body).objectives;
    } catch {
      return null;
    }
  }
  static async clearScoreboards() {
    return this.del("/api/sfmc/scoreboards");
  }
  // ---- 行为日志 ----
  static async batchActivities(entries) {
    return this.post("/api/sfmc/activities/batch", { entries });
  }
  static async queryActivities(filter) {
    const params = new URLSearchParams();
    if (filter?.id) params.set("id", filter.id);
    if (filter?.event) params.set("event", filter.event);
    if (filter?.from) params.set("from", String(filter.from));
    if (filter?.to) params.set("to", String(filter.to));
    if (filter?.name) params.set("name", filter.name);
    if (filter?.limit) params.set("limit", String(filter.limit));
    if (filter?.offset) params.set("offset", String(filter.offset));
    const qs = params.toString();
    const body = await this.get(`/api/sfmc/activities${qs ? "?" + qs : ""}`);
    if (!body) return null;
    try {
      return JSON.parse(body).entries;
    } catch {
      return null;
    }
  }
  static async getActivityStats(filter) {
    const params = new URLSearchParams();
    if (filter?.id) params.set("id", filter.id);
    if (filter?.from) params.set("from", String(filter.from));
    if (filter?.to) params.set("to", String(filter.to));
    const qs = params.toString();
    const body = await this.get(`/api/sfmc/activities/stats${qs ? "?" + qs : ""}`);
    if (!body) return null;
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  static async cleanupActivities(keepDays = 30, keepAdmin = true) {
    return this.post("/api/sfmc/activities/cleanup", { keepDays, keepAdmin });
  }
  // ---- 通用 KV 存储 ----
  /** 获取全部 KV 键值对（启动加载用） */
  static async getAllKV() {
    const body = await this.get("/api/kv");
    if (!body) return null;
    try {
      return JSON.parse(body).kv;
    } catch {
      return null;
    }
  }
  static async getKV(key) {
    const body = await this.get(`/api/kv/${encodeURIComponent(key)}`);
    if (!body) return null;
    try {
      return JSON.parse(body).value;
    } catch {
      return null;
    }
  }
  static async setKV(key, value) {
    return this.post("/api/kv/save", { key, value });
  }
  static async deleteKV(key) {
    return this.del(`/api/kv/${encodeURIComponent(key)}`);
  }
};

// scripts/libs/Storage.ts
var cache = /* @__PURE__ */ new Map();
var dirtyKeys = /* @__PURE__ */ new Set();
var flushScheduled = false;
var FLUSH_INTERVAL = 3e4;
function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  import("@minecraft/server").then(({ system: system19 }) => {
    system19.runTimeout(() => {
      flushScheduled = false;
      flushDirty();
    }, FLUSH_INTERVAL / 50);
  }).catch(() => {
  });
}
async function flushDirty() {
  if (dirtyKeys.size === 0) return;
  const keys = [...dirtyKeys];
  dirtyKeys = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const val = cache.get(key);
    if (val !== void 0) {
      await HttpDB.setKV(key, val).catch(() => {
      });
    }
  }
}
var Storage = class {
  static {
    this.initialized = false;
  }
  /** 初始化：从 HttpDB 加载全部 KV 到缓存 */
  static async init() {
    if (this.initialized) return;
    try {
      const all = await HttpDB.getAllKV();
      if (all && all.length > 0) {
        for (const { key, value } of all) {
          cache.set(key, value);
        }
        console.info(`[Storage] \u4ECE HttpDB \u52A0\u8F7D\u4E86 ${all.length} \u6761\u6570\u636E`);
      } else {
        console.info("[Storage] HttpDB \u65E0\u6570\u636E\uFF0C\u4F7F\u7528\u7A7A\u7F13\u5B58");
      }
    } catch {
      console.info("[Storage] HttpDB \u4E0D\u53EF\u7528\uFF0C\u4F7F\u7528\u7A7A\u7F13\u5B58");
    }
    this.initialized = true;
  }
  // ---- 同步读写 ----
  /** 读取缓存 */
  static get(key, fallback) {
    const raw = cache.get(key);
    if (raw !== void 0) {
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    }
    return fallback;
  }
  /** 写入缓存 + HttpDB（立即写入） */
  static set(key, value) {
    const json = JSON.stringify(value);
    cache.set(key, json);
    HttpDB.setKV(key, json).catch(() => {
    });
  }
  /** 删除缓存 + HttpDB */
  static delete(key) {
    cache.delete(key);
    HttpDB.deleteKV(key).catch(() => {
    });
  }
  // ---- 节流写入（高频场景用，30 秒批量 flush） ----
  /** 写入缓存 + 延迟写入 HttpDB（30 秒内合并） */
  static setThrottled(key, value) {
    const json = JSON.stringify(value);
    cache.set(key, json);
    dirtyKeys.add(key);
    scheduleFlush();
  }
  // ---- Player 快捷方法 ----
  static playerGet(player, key, fallback) {
    return this.get(`player:${player.id}:${key}`, fallback);
  }
  static playerSet(player, key, value) {
    this.set(`player:${player.id}:${key}`, value);
  }
  static playerDelete(player, key) {
    this.delete(`player:${player.id}:${key}`);
  }
  static playerSetThrottled(player, key, value) {
    this.setThrottled(`player:${player.id}:${key}`, value);
  }
};

// scripts/area/Fly.ts
Permission.register("fly.use", Permission.Any);
function playerJoinEvent(player) {
  system3.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      enableFly(player);
      player.sendMessage(`[Doge] \u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`);
      Storage.playerSet(player, "dogefly", areaName);
    }
  }, 60);
}
system3.runInterval(() => {
  for (let player of world4.getPlayers({ "gameMode": GameMode.Survival })) {
    let nowArea = Storage.playerGet(player, "dogefly", void 0);
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      if (nowArea === void 0) {
        enableFly(player);
        player.sendMessage(`[Doge] \u8FDB\u5165\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`);
        Storage.playerSet(player, "dogefly", areaName);
      } else if (nowArea !== areaName) {
        Storage.playerSet(player, "dogefly", areaName);
      }
    } else {
      if (nowArea !== void 0) {
        disableFly(player);
        player.sendMessage(`[Doge] \u79BB\u5F00\u98DE\u884C\u533A ${nowArea}, \u5DF2\u5173\u95ED\u98DE\u884C\u6A21\u5F0F\u3002`);
        Storage.playerDelete(player, "dogefly");
      }
    }
  }
}, 40);
function inFlyArea(entity) {
  for (let area of Config.flyArea) {
    if (entity.dimension.id === area.dimension) {
      if (pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
        return area.name;
      }
    }
  }
  return void 0;
}
function enableFly(player) {
  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly true");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch (_) {
    console.warn("\xA7c\u7531\u4E8E\u65B0\u7248\u79FB\u9664\u4E86\u76F8\u5173\u6307\u4EE4\uFF0C\u8BF7\u5728\u4E16\u754C\u4E2D\u5F00\u542F\u6559\u80B2\u6A21\u5F0F\u3002");
  }
}
function disableFly(player) {
  let res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { "includeLiquidBlocks": true, "includePassableBlocks": false });
  if (res !== void 0) {
    player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
  }
  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly false");
    player.runCommand("gamemode adventure");
    player.runCommand("gamemode survival");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch (_) {
  }
}

// scripts/doge/AFK.ts
import { system as system4, world as world5 } from "@minecraft/server";
function init() {
  for (let player of world5.getAllPlayers()) {
    reset(player);
  }
}
function reset(player) {
  Storage.playerDelete(player, "afk:last_location");
  Storage.playerDelete(player, "afk:step");
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
function setAFK(player) {
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world5.sendMessage(`\xA77* ${player.nameTag} is now AFK. *`);
  Storage.playerSet(player, "afk:step", 0);
  player.addTag("AFK");
}
function locationMoved(lastLocation, nowLocation) {
  let deltaX = lastLocation.x - nowLocation.x;
  if (-1 < deltaX && deltaX < 1) {
    let deltaY = lastLocation.y - nowLocation.y;
    if (-1 < deltaY && deltaY < 1) {
      let deltaZ = lastLocation.z - nowLocation.z;
      if (-1 < deltaZ && deltaZ < 1) {
        return false;
      }
    }
  }
  return true;
}
var STEP_TIME = 15;
system4.runInterval(() => {
  for (let player of world5.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
    let lastLoaction = Storage.playerGet(player, "afk:last_location", void 0);
    let nowLocation = player.location;
    if (lastLoaction !== void 0) {
      let nowStep = Storage.playerGet(player, "afk:step", void 0);
      if (!locationMoved(lastLoaction, nowLocation)) {
        if (nowStep === void 0) {
          nowStep = 1;
        } else {
          nowStep++;
        }
        if (nowStep * STEP_TIME >= Config.AFKTime) {
          setAFK(player);
        } else {
          Storage.playerSet(player, "afk:step", nowStep);
        }
      } else {
        Storage.playerSet(player, "afk:step", 0);
      }
    }
    Storage.playerSet(player, "afk:last_location", nowLocation);
  }
}, STEP_TIME * 20);
var intervalId = void 0;
var playerList = {};
function startAFKScan() {
  if (intervalId !== void 0) {
    return;
  }
  intervalId = system4.runInterval(() => {
    let count = 0;
    for (let id in playerList) {
      let player = world5.getEntity(id);
      if (player === void 0) {
        delete playerList.id;
      } else {
        if (locationMoved(playerList[id], player.location)) {
          world5.sendMessage(`\xA77* ${player.nameTag} is no longer AFK. *`);
          player.removeTag("AFK");
          Storage.playerSet(player, "afk:last_location", player.location);
          Storage.playerSet(player, "afk:step", 0);
          delete playerList[id];
        } else {
          count++;
        }
      }
    }
    if (count === 0) {
      stopAFKScan();
    }
  }, 100);
}
function stopAFKScan() {
  system4.clearRun(intervalId);
  intervalId = void 0;
}
function registerCommand() {
  Permission.register("afk.use", Permission.Any);
  Permission.register("afk.clear.other", Permission.OP);
  Command.register("afk", "afk.use", setAFK, "\u8FDB\u5165AFK\u72B6\u6001");
  Command.register("noafk", "afk.clear.other", (pl) => {
    if (pl) pl.addTag("NOAFK");
  }, "\u4EE4\u73A9\u5BB6\u4E0D\u4F1A\u8FDB\u5165AFK\u72B6\u6001");
}
registerCommand();

// scripts/doge/SpawnProtect.ts
import { world as world6 } from "@minecraft/server";
var SpawnProtect = class {
  static registerEvents() {
    world6.afterEvents.playerSpawn.subscribe((ev) => {
      if (ev.player.getEffect("minecraft:resistance") === void 0) {
        ev.player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
      }
    });
  }
};

// scripts/doge/Clean.ts
import {
  system as system5,
  world as world7,
  BlockComponentTypes as BlockComponentTypes2
} from "@minecraft/server";
var STORAGE_KEY = "DOGE_CLEAN_INDEX";
var Clean = class _Clean {
  constructor() {
    this.startPoint = [0, 0, 0];
    this.size = [5, 5];
    this.direction = -1;
    // 箱子的朝向
    this.killList = [];
    this.face = -1;
    this.intervalId = void 0;
    this.itemMax = 128;
    this.timeout = 60;
  }
  static {
    this._instance = void 0;
  }
  static getInstance() {
    if (!_Clean._instance) {
      this._instance = new _Clean();
    }
    return this._instance;
  }
  init() {
    this.startPoint = Config.clean.recycleBin.start;
    this.size = Config.clean.recycleBin.size;
    this.direction = Config.clean.recycleBin.direction;
    this.face = Config.clean.recycleBin.face;
    this.killList = Config.clean.recycleBin.killList;
    this.itemMax = Config.clean.itemMax;
    this.timeout = Config.clean.timeout;
    this.startCleanInterval();
  }
  getCleanIndex() {
    return Storage.get(STORAGE_KEY, 0);
  }
  setCleanIndex(index) {
    Storage.set(STORAGE_KEY, index);
  }
  /**
   * 将物品放入箱子
   * @param itemProvider 物品给予函数，函数会返回物品的ItemStack，当返回undefined时说明任务结束此时会退出
   * @param isFirstCall 是否是首次调用，如果是，在一次循环后物品没有放完，会重置index，再进行一次循环直到放完
   */
  placeItem(itemProvider, isFirstCall = true) {
    let base = getBase(this.direction);
    let cardinalDirection = getChestCardinal(this.direction, this.face);
    let facingDirection = getSignFacing(this.direction, this.face);
    let index = 0;
    let currentIndex = this.getCleanIndex();
    const dimension = world7.getDimension("overworld");
    for (let mainAxis = 0; mainAxis < this.size[0]; mainAxis++) {
      for (let y = 0; y < this.size[1]; y++) {
        index++;
        if (index < currentIndex) {
          continue;
        }
        let coordinate = {
          x: this.startPoint[0] + mainAxis * base[0] * 2,
          y: this.startPoint[1] + y,
          z: this.startPoint[2] + mainAxis * base[1] * 2
        };
        let coordinate2 = {
          x: coordinate.x + base[0],
          y: coordinate.y,
          z: coordinate.z + base[1]
        };
        let block = dimension.getBlock(coordinate);
        let block2 = dimension.getBlock(coordinate2);
        ensureDoubleChest(dimension, coordinate, cardinalDirection, this.direction);
        let inventory = block.getComponent(BlockComponentTypes2.Inventory);
        if (!inventory || !inventory.container) {
          continue;
        }
        let container = inventory.container;
        if (container.emptySlotsCount === 0) {
          container.clearAll();
        }
        while (container.emptySlotsCount > 0) {
          let item = itemProvider();
          if (!item) {
            return;
          }
          container.addItem(item);
        }
        this.setCleanIndex(index + 1);
        let signCoordinate = {
          x: coordinate2.x + (base[0] !== 0 ? 0 : this.face),
          y: coordinate2.y,
          z: coordinate2.z + (base[1] !== 0 ? 0 : this.face)
        };
        placeSign(dimension, signCoordinate, facingDirection, this.getTimeStr());
      }
    }
    this.setCleanIndex(0);
    if (isFirstCall) {
      this.placeItem(itemProvider, false);
    }
  }
  /**
   * 开始清理
   */
  startClean(entities) {
    let itemEntities = entities ?? this.getAllItemEntities();
    this.placeItem(() => {
      while (itemEntities.length > 0) {
        let itemEntity = itemEntities.pop();
        let stack = itemEntity.getComponent("minecraft:item").itemStack;
        if (!stack) {
          continue;
        }
        if (this.killList.some((value) => value === stack.typeId)) {
          itemEntity.kill();
          continue;
        }
        itemEntity.kill();
        return stack;
      }
      return void 0;
    });
  }
  startCleanInterval() {
    if (this.intervalId) {
      system5.clearRun(this.intervalId);
      this.intervalId = void 0;
    }
    this.intervalId = system5.runInterval(() => {
      let entities = this.getAllItemEntities();
      if (entities.length > this.itemMax) {
        world7.sendMessage({ "rawtext": [{ "text": "\u300C\xA76\u8AAD\u7D4C\u3059\u308B\u30E4\u30DE\u30D3\u30B3 ~ \u5E7D\u8C37 \u97FF\u5B50\xA7f\u300D \u8DDD\u79BB\u6E05\u7406\u6389\u843D\u7269\u8FD8\u6709\xA7c 5 \xA7fs" }] });
        system5.runTimeout(() => {
          this.startClean(void 0);
          system5.runTimeout(() => {
            world7.sendMessage({ "rawtext": [{ "text": "\xA7a* \u5DF2\u6E05\u7406\u6389\u843D\u7269 *" }] });
          }, 5);
        }, 100);
      }
    }, this.timeout * 20);
  }
  stopCleanInterval() {
    if (this.intervalId) {
      system5.clearRun(this.intervalId);
      this.intervalId = void 0;
    }
  }
  /**
   * 获取世界的所有物品
   */
  getAllItemEntities() {
    let itemEntities = world7.getDimension("overworld").getEntities({ type: "item" });
    itemEntities.push(...world7.getDimension("nether").getEntities({ type: "item" }));
    itemEntities.push(...world7.getDimension("the_end").getEntities({ type: "item" }));
    return itemEntities;
  }
  getTimeStr() {
    const { date, time } = getShanghaiTime();
    return `
${date}
${time}`;
  }
};
function registerCommand2() {
  Permission.register("clean.admin", Permission.OP);
  Command.register("clean", "clean.admin", () => {
    Clean.getInstance().startClean(void 0);
  }, "\u5F00\u59CB\u626B\u5730");
}
registerCommand2();

// scripts/area/Peace.ts
import { world as world8, EntityInitializationCause } from "@minecraft/server";
var Peace = class _Peace {
  constructor() {
    this.enable = true;
  }
  /**
   * @returns {Peace}
   */
  static getInstance() {
    if (!_Peace._instance) {
      _Peace._instance = new _Peace();
    }
    return _Peace._instance;
  }
  init() {
    this.registerEvents();
    this.registerCommands();
  }
  registerEvents() {
    world8.afterEvents.entitySpawn.subscribe((event) => {
      if (!this.enable) return;
      try {
        if (event.cause === EntityInitializationCause.Spawned) {
          let entity = event.entity;
          if (this.inPeaceArea(entity) && entity.matches(Config.peaceAreaEntityQO)) {
            event.entity.remove();
          }
        }
      } catch {
      }
    });
  }
  /**
   * 实体是否在和平区域内
   */
  inPeaceArea(entity) {
    for (let area of Config.peaceArea) {
      if (entity.dimension.id === area.dimension) {
        if (pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
          return true;
        }
      }
    }
    return false;
  }
  switchPeace() {
    return this.enable = !this.enable;
  }
  registerCommands() {
    Permission.register("peace.toggle", Permission.OP);
    Command.register("peace", "peace.toggle", () => {
      return _Peace.getInstance().switchPeace() ? "\u5F00\u542F\u533A\u57DF\u548C\u5E73" : "\u5173\u95ED\u533A\u57DF\u548C\u5E73";
    }, "\u5207\u6362\u533A\u57DF\u548C\u5E73");
  }
};

// scripts/coop/Database.ts
var Database = class {
  static {
    // ==========================================
    //  内部工具
    // ==========================================
    this.KEY_COOP_DATA = "coop:data";
  }
  static {
    this.KEY_COOP_CONFIG = "coop:config";
  }
  static {
    this.KEY_SHOP_GOODS = "coop:shopgoods";
  }
  static {
    this.KEY_SHOP_GROUPS = "coop:shopgroups";
  }
  static {
    this._config = null;
  }
  static readJSON(key, fallback) {
    return Storage.get(key, fallback);
  }
  static writeJSON(key, value) {
    Storage.set(key, value);
  }
  // ==========================================
  //  配置
  // ==========================================
  static getConfig() {
    if (this._config) return this._config;
    this._config = this.readJSON(this.KEY_COOP_CONFIG, {
      main: { language: "zh_CN", compare_language: "zh" },
      shop_setting: {
        monetary_unit: "\xA5",
        nbtgoods_condition: {
          type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
          mode_enum: ["it.isEnchanted"],
          type_reg_enum: ["[a-z].+_shulker_box"]
        }
      }
    });
    return this._config;
  }
  static saveConfig(cfg) {
    this._config = cfg;
    this.writeJSON(this.KEY_COOP_CONFIG, cfg);
  }
  // ==========================================
  //  合作社数据
  // ==========================================
  static getAllCoop() {
    return this.readJSON(this.KEY_COOP_DATA, []);
  }
  static getCoopByCid(cid) {
    return this.getAllCoop().find((e) => e.cid === cid);
  }
  static getPlayerCid(playerName) {
    for (const coop of this.getAllCoop()) {
      if (coop.members.some((m) => m.name === playerName)) return coop.cid;
    }
    return null;
  }
  static saveCoop(data2) {
    const all = this.getAllCoop();
    const idx = all.findIndex((e) => e.cid === data2.cid);
    if (idx !== -1) all[idx] = data2;
    else all.push(data2);
    this.writeJSON(this.KEY_COOP_DATA, all);
  }
  static deleteCoop(cid) {
    this.writeJSON(this.KEY_COOP_DATA, this.getAllCoop().filter((e) => e.cid !== cid));
  }
  // ==========================================
  //  商店商品
  // ==========================================
  static getAllGoods() {
    return this.readJSON(this.KEY_SHOP_GOODS, []);
  }
  static getGoodById(id) {
    return this.getAllGoods().find((e) => e.id === id);
  }
  static saveGood(good) {
    const all = this.getAllGoods();
    const idx = all.findIndex((e) => e.id === good.id);
    if (idx !== -1) all[idx] = good;
    else {
      good.id = good.id || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      all.push(good);
    }
    this.writeJSON(this.KEY_SHOP_GOODS, all);
  }
  static deleteGood(id) {
    this.writeJSON(this.KEY_SHOP_GOODS, this.getAllGoods().filter((e) => e.id !== id));
  }
  static deleteGoodsByCid(cid) {
    this.writeJSON(this.KEY_SHOP_GOODS, this.getAllGoods().filter((e) => e.cid !== cid));
  }
  // ==========================================
  //  商店分组
  // ==========================================
  static getAllGroups() {
    return this.readJSON(this.KEY_SHOP_GROUPS, []);
  }
  static getGroupById(groupid) {
    return this.getAllGroups().find((e) => e.groupid === groupid);
  }
  static saveGroup(group) {
    const all = this.getAllGroups();
    const idx = all.findIndex((e) => e.groupid === group.groupid);
    if (idx !== -1) all[idx] = group;
    else all.push(group);
    this.writeJSON(this.KEY_SHOP_GROUPS, all);
  }
  // ==========================================
  //  初始化
  // ==========================================
  static initDefaultGroups() {
    if (this.getAllGroups().length > 0) return;
    const defaults = [
      { groupid: "default_block", displayname: "\u9ED8\u8BA4\u65B9\u5757", displaydescribe: "\u65B9\u5757\u7C7B\u7269\u54C1", icon: "/textures/ui/icon_recipe_construction", type_function: { mode_enum: ["default_block"] } },
      { groupid: "default_item", displayname: "\u9ED8\u8BA4\u7269\u54C1", displaydescribe: "\u7269\u54C1\u7C7B", icon: "/textures/ui/icon_recipe_item", type_function: { mode_enum: ["default_item"] } },
      { groupid: "default_equip", displayname: "\u9ED8\u8BA4\u88C5\u5907", displaydescribe: "\u88C5\u5907\u6B66\u5668\u7C7B", icon: "/textures/ui/icon_recipe_equipment", type_function: { type_enum: ["minecraft:bow", "minecraft:arrow", "minecraft:crossbow", "minecraft:trident", "minecraft:shield", "minecraft:mace", "minecraft:elytra", "minecraft:wolf_armor", "minecraft:saddle"], type_reg_enum: ["[a-z].+_shovel", "[a-z].+_axe", "[a-z].+_sword", "[a-z].+_hoe", "[a-z].+_pickaxe", "[a-z].+_horse_armor"] } },
      { groupid: "default_book", displayname: "\u4E66\u7C4D", displaydescribe: "\u4E0E\u4E66\u76F8\u5173", icon: "/textures/items/book_enchanted", type_function: { type_enum: ["minecraft:book", "minecraft:bookshelf", "minecraft:writable_book", "minecraft:enchanted_book", "minecraft:chiseled_bookshelf"] } },
      { groupid: "default_shulker_box", displayname: "\u6F5C\u5F71\u76D2", displaydescribe: "\u5404\u79CD\u6F5C\u5F71\u76D2", icon: "/textures/items/shulker_shell", type_function: { type_reg_enum: ["[a-z].+_shulker_box"] } },
      { groupid: "default_potion", displayname: "\u836F\u6C34", displaydescribe: "\u836F\u6C34\u7C7B", icon: "/textures/items/potion_bottle_heal", type_function: { type_enum: ["minecraft:splash_potion", "minecraft:potion", "minecraft:lingering_potion"] } }
    ];
    for (const g of defaults) this.saveGroup(g);
  }
};

// scripts/libs/Gui.ts
import { system as system6 } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
var Gui = class {
  // ── 统一重试逻辑 ──
  /**
   * 显示表单并在 UserBusy 时自动轮询重试
   * @param player 目标玩家
   * @param form 表单实例
   * @param title 表单标题（重试提示用）
   * @param retryInterval 重试间隔（tick）
   * @param timeoutTicks 超时时间（tick），默认 160 = 8 秒
   * @returns Promise<ActionFormResponse | ModalFormResponse>
   */
  static showForm(player, form, title, retryInterval = 10, timeoutTicks = 160) {
    const startTick = system6.currentTick;
    return new Promise((resolve) => {
      let notified = false;
      const attempt = () => {
        if (system6.currentTick - startTick >= timeoutTicks) {
          Msg.warning(`\u83DC\u5355 [${title}] \u7B49\u5F85\u8D85\u65F6\uFF088\u79D2\uFF09\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u3002`, player);
          resolve({ canceled: true });
          return;
        }
        form.show(player).then((res) => {
          if (res.canceled && res.cancelationReason === "UserBusy") {
            if (!notified) {
              notified = true;
              Msg.info(`\u60A8\u6709\u4E00\u5219\u83DC\u5355\u5904\u7406\uFF1A [${title}] \u8BF7\u5173\u95ED\u5F53\u524D\u754C\u9762\u540E\u663E\u793A\u3002\xA77\uFF08\u8D85\u65F68\u79D2\uFF09`, player);
            }
            system6.waitTicks(retryInterval).then(attempt);
          } else {
            resolve(res);
          }
        }).catch(() => resolve({ canceled: true }));
      };
      attempt();
    });
  }
  // ── confirm ──
  static async confirm(player, title, body, onConfirm, onCancel) {
    const form = new ActionFormData().title(title).body(body).button("\u786E\u8BA4").button("\u53D6\u6D88");
    const res = await this.showForm(player, form, title);
    if (res.canceled) {
      onCancel?.();
      return;
    }
    if (res.selection === 0) onConfirm();
    else onCancel?.();
  }
  // ── simpleForm / modalForm ──
  static simpleForm(title, body) {
    const form = new ActionFormData();
    if (title !== void 0) form.title(title);
    if (body !== void 0) form.body(body);
    return form;
  }
  static modalForm(title) {
    const form = new ModalFormData();
    if (title !== void 0) form.title(title);
    return form;
  }
};

// scripts/coop/CoopCore.ts
import { world as world9 } from "@minecraft/server";
var CoopCore = class {
  static {
    // ==========================================
    //  内部工具
    // ==========================================
    this._guidCounter = 0;
  }
  static generateId() {
    return `${Date.now().toString(36)}_${(++this._guidCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  static _countItemInInventory(player, typeId) {
    const inv = player.getComponent("inventory");
    if (!inv?.container) return 0;
    let total = 0;
    for (let i = 0; i < inv.container.size; i++) {
      const item = inv.container.getItem(i);
      if (item?.typeId === typeId && item.amount) total += item.amount;
    }
    return total;
  }
  static isNbtItem(item) {
    const cfg = Database.getConfig().shop_setting.nbtgoods_condition;
    if (cfg.type_enum.indexOf(item.typeId) !== -1) return true;
    if (item.getComponent("minecraft:enchantments")) return true;
    for (const reg of cfg.type_reg_enum) {
      if (new RegExp(reg).test(item.typeId)) return true;
    }
    return false;
  }
  static _isBlockType(typeId) {
    const nonBlock = [
      "_sword",
      "_axe",
      "_shovel",
      "_hoe",
      "_pickaxe",
      "bow",
      "arrow",
      "helmet",
      "chestplate",
      "leggings",
      "boots",
      "potion",
      "splash_potion",
      "lingering_potion",
      "spawn_egg",
      "writable_book",
      "enchanted_book",
      "shield",
      "trident",
      "mace",
      "elytra",
      "saddle",
      "horse_armor"
    ];
    for (const suffix of nonBlock) {
      if (typeId.endsWith(suffix)) return false;
    }
    return true;
  }
  static typeGood(item) {
    const rtv = [];
    const groups = Database.getAllGroups().filter((g) => g.type_function);
    for (const g of groups) {
      const tf = g.type_function;
      if (tf.type_enum && tf.type_enum.indexOf(item.typeId) !== -1) {
        rtv.push(g.groupid);
        continue;
      }
      if (tf.mode_enum) {
        for (const mode of tf.mode_enum) {
          if (mode === "default_block" && this._isBlockType(item.typeId)) rtv.push(g.groupid);
          if (mode === "default_item" && !this._isBlockType(item.typeId)) rtv.push(g.groupid);
        }
      }
      if (tf.type_reg_enum) {
        for (const reg of tf.type_reg_enum) {
          if (new RegExp(reg).test(item.typeId)) rtv.push(g.groupid);
        }
      }
    }
    return rtv;
  }
  // ==========================================
  //  合作社操作
  // ==========================================
  static registerCoop(name, cid, player) {
    if (Database.getAllCoop().some((e) => e.cid === cid)) return false;
    if (Money.get(player) < 1e3) return false;
    const coop = {
      cid,
      name,
      members: [{ name: player.name, isop: true }],
      notice: "\u793E\u957F\u5F88\u61D2\uFF0C\u6CA1\u6709\u5199\u516C\u544A\uFF5E",
      money: 0,
      moneylist: ""
    };
    Money.set(player, Money.get(player) - 1e3);
    Database.saveCoop(coop);
    return true;
  }
  static releaseCoop(cid) {
    Database.deleteCoop(cid);
    Database.deleteGoodsByCid(cid);
  }
  static joinCoop(player, cid) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2 || data2.members.some((m) => m.name === player.name)) return;
    data2.members.push({ name: player.name, isop: false });
    Database.saveCoop(data2);
    this.sendToMembers(cid, `\u6B22\u8FCE ${player.name} \u52A0\u5165\u5408\u4F5C\u793E\uFF01`);
  }
  static exitCoop(playerName, cid) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return;
    data2.members = data2.members.filter((m) => m.name !== playerName);
    Database.saveCoop(data2);
  }
  static sendToMembers(cid, text) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return;
    for (const member of data2.members) {
      for (const p of world9.getPlayers({ name: member.name })) {
        Msg.info(`[${data2.name}] ${text}`, p);
      }
    }
  }
  static getInfo(cid) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return "\u5408\u4F5C\u793E\u4E0D\u5B58\u5728";
    const ops = data2.members.filter((m) => m.isop).map((m) => m.name).join(", ");
    return `\u516C\u544A\uFF1A
${data2.notice}

\u5408\u4F5C\u793E\u540D\u79F0: ${data2.name}
\u793E\u957F&\u7BA1\u7406: ${ops}
\u4EBA\u6570: ${data2.members.length}
\u94F6\u884C\u7ECF\u6D4E: ${data2.money}`;
  }
  static getMemberList(cid) {
    const data2 = Database.getCoopByCid(cid);
    return data2 ? data2.members.map((m) => m.name) : [];
  }
  static isOp(playerName, cid) {
    const data2 = Database.getCoopByCid(cid);
    return data2?.members.find((m) => m.name === playerName)?.isop ?? false;
  }
  static setOp(cid, index) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2 || index >= data2.members.length) return;
    data2.members[index].isop = true;
    Database.saveCoop(data2);
  }
  static setNotice(cid, text) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return;
    data2.notice = text;
    Database.saveCoop(data2);
  }
  // ==========================================
  //  银行操作
  // ==========================================
  static bankControl(cid, player, val, note, type) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return false;
    if (type === 1) {
      const plMoney = Money.get(player);
      if (plMoney < val) return false;
      Money.set(player, plMoney - val);
      data2.money += val;
      data2.moneylist = `\u3010+\u3011${val} ${player.name} ${note}
${data2.moneylist}`;
    } else if (type === 2) {
      if (data2.money < val) return false;
      Money.set(player, Money.get(player) + val);
      data2.money -= val;
      data2.moneylist = `\u3010-\u3011${val} ${player.name} ${note}
${data2.moneylist}`;
    } else return false;
    Database.saveCoop(data2);
    return true;
  }
  // ==========================================
  //  排行榜
  // ==========================================
  static getRankInfo(type) {
    const all = Database.getAllCoop();
    if (type === 1) {
      return all.map((e) => ({ m: e.money, n: e.name })).sort((a, b) => b.m - a.m).map((e, i) => `
#${i + 1} ${e.n} > ${e.m} ${Money.UNIT}`).join("");
    }
    if (type === 2) {
      return all.map((e) => ({ m: e.members.length, n: e.name })).sort((a, b) => b.m - a.m).map((e, i) => `
#${i + 1} ${e.n} > ${e.m} \u4EBA`).join("");
    }
    return "";
  }
  // ==========================================
  //  商店系统
  // ==========================================
  static getGoods(list, reverse, type, cid, groupid, onlyTrue = true) {
    let data2 = Database.getAllGoods();
    if (onlyTrue) data2 = data2.filter((e) => e.isTrue);
    data2 = data2.filter((e) => e.type === type);
    if (cid) data2 = data2.filter((e) => e.cid === cid);
    if (groupid) data2 = data2.filter((e) => e.groups.indexOf(groupid) !== -1);
    switch (list) {
      case 1:
        data2.sort((a, b) => a.time - b.time);
        break;
      case 2:
        data2.sort((a, b) => a.name.localeCompare(b.name, Database.getConfig().main.compare_language));
        break;
      case 3:
        data2.sort((a, b) => a.sv - b.sv);
        break;
      case 4:
        data2.sort((a, b) => a.money - b.money);
        break;
    }
    if (reverse) data2.reverse();
    return data2;
  }
  static getGroups(customOnly = false) {
    const groups = Database.getAllGroups();
    return customOnly ? groups.filter((g) => g.groupid.indexOf("default") === -1) : groups;
  }
  static buy(gid, num, player) {
    const good = Database.getGoodById(gid);
    if (!good || good.num < num) return false;
    const total = good.money * num;
    if (!this.bankControl(good.cid, player, total, `\u8D2D\u4E70 ${good.name}*${num}`, 1)) return false;
    player.runCommand(`give "${player.name}" ${good.item.type} ${num} ${good.item.aux}`);
    good.sv += num;
    good.num -= num;
    Database.saveGood(good);
    return true;
  }
  static sell(gid, num, player) {
    const good = Database.getGoodById(gid);
    if (!good || good.num - good.sv < num) return false;
    const has = this._countItemInInventory(player, good.item.type);
    if (has < num) return false;
    const total = good.money * num;
    if (!this.bankControl(good.cid, player, total, `\u51FA\u552E ${good.name}*${num}`, 2)) return false;
    player.runCommand(`clear "${player.name}" ${good.item.type} ${good.item.aux} ${num}`);
    good.sv += num;
    Database.saveGood(good);
    return true;
  }
};

// scripts/gui/CoopGUI.ts
function countItemInInventory(player) {
  const inv = player.getComponent("inventory");
  if (!inv?.container) return 0;
  let total = 0;
  for (let i = 0; i < inv.container.size; i++) {
    const item = inv.container.getItem(i);
    if (item?.amount) total += item.amount;
  }
  return total;
}
function _genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function _fmtGoodBt(name, unit, price, sv, num, isBuy) {
  if (isBuy) {
    return `${name} ${unit}${price}
\u5DF2\u552E\uFF1A${sv} \u5E93\u5B58\uFF1A${num}`;
  }
  return `${name} ${unit}${price}
\u53EF\u56DE\u6536\uFF1A${sv}/${num}`;
}
var CoopGUI = class {
  constructor(player) {
    this.player = player;
  }
  errorPop(text) {
    Msg.error(text, this.player);
  }
  tipsPop(text) {
    Msg.tips(text, this.player);
  }
  infoPop(text) {
    Msg.info(text, this.player);
  }
  confirmPop(title, text, onConfirm) {
    Gui.confirm(this.player, title, text, onConfirm);
  }
  // ==========================================
  //  主面板
  // ==========================================
  mainPanel() {
    const cid = Database.getPlayerCid(this.player.name);
    if (!cid) return this.noCoopPanel();
    this.coopInfoPanel(cid, "menu");
  }
  noCoopPanel() {
    Gui.simpleForm().title("\u5408\u4F5C\u793E").body(ListFormInfo(["\u4F60\u6CA1\u6709\u52A0\u5165\u4EFB\u4F55\u4E00\u4E2A\u5408\u4F5C\u793E\uFF0C\u8BF7\u9009\u62E9\u64CD\u4F5C\u3002\n\nCiallo\uFF5E(\u2220\u30FB\u03C9\uFF1C)\u2322\u2606"])).button("\u901A\u8FC7 CID \u52A0\u5165\u5408\u4F5C\u793E").button("\u67E5\u770B\u6240\u6709\u5408\u4F5C\u793E").button("\u521B\u5EFA\u5408\u4F5C\u793E").button("\u5408\u4F5C\u793E\u6392\u884C\u699C").button("\u63D2\u4EF6\u66F4\u65B0\u65E5\u5FD7").show(this.player).then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          this.joinByCid();
          break;
        case 1:
          this.coopList();
          break;
        case 2:
          this.createCoop();
          break;
        case 3:
          this.rank(1);
          break;
        case 4:
          this.log();
          break;
      }
    }).catch(() => {
    });
  }
  // ==========================================
  //  加入 / 列表 / 创建
  // ==========================================
  joinByCid() {
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u52A0\u5165\u5408\u4F5C\u793E").textField("CID", "\u4EC5\u652F\u6301\u82F1\u6587/\u6570\u5B57").show(this.player).then((res) => {
      if (res.canceled) {
        this.mainPanel();
        return;
      }
      const cid = res.formValues[0]?.trim();
      if (!cid) {
        this.errorPop("\u8BF7\u586B\u5199CID");
        return;
      }
      const data2 = Database.getCoopByCid(cid);
      if (!data2) {
        this.errorPop("\u8BF7\u68C0\u67E5CID\u662F\u5426\u6B63\u786E");
        return;
      }
      this.coopInfoPanel(cid, "join");
    }).catch(() => {
    });
  }
  coopList() {
    const all = Database.getAllCoop();
    if (all.length === 0) {
      this.errorPop("\u8FD8\u6CA1\u6709\u4EFB\u4F55\u5408\u4F5C\u793E");
      return;
    }
    const form = Gui.simpleForm().title("\u5408\u4F5C\u793E\u5217\u8868");
    for (const c of all) form.button(c.name);
    form.button("\xA7l\u8FD4\u56DE");
    form.show(this.player).then((res) => {
      if (res.canceled) {
        this.mainPanel();
        return;
      }
      if (res.selection === all.length) {
        this.mainPanel();
        return;
      }
      this.coopInfoPanel(all[res.selection].cid, "info");
    }).catch(() => {
    });
  }
  createCoop() {
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u521B\u5EFA\u5408\u4F5C\u793E").textField("\u5408\u4F5C\u793E\u540D\u79F0", "").textField("CID", "\u4EC5\u652F\u6301\u82F1\u6587/\u6570\u5B57\uFF0C\u7528\u4F5C\u9080\u8BF7\u7801").show(this.player).then((res) => {
      if (res.canceled) {
        this.mainPanel();
        return;
      }
      const vals = res.formValues;
      const name = vals[0];
      const cid = vals[1];
      if (!name || !cid) {
        this.errorPop("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F");
        return;
      }
      if (CoopCore.registerCoop(name, cid, this.player)) {
        this.infoPop("\u5408\u4F5C\u793E\u521B\u5EFA\u6210\u529F\uFF01");
      } else {
        this.errorPop(`\u4F60\u7684${Money.UNIT}\u4F3C\u4E4E\u4E0D\u591F\u6216CID\u5DF2\u88AB\u5360\u7528\uFF01`);
      }
    }).catch(() => {
    });
  }
  // ==========================================
  //  合作社信息面板
  // ==========================================
  coopInfoPanel(cid, returnMode) {
    const text = CoopCore.getInfo(cid);
    if (returnMode === "info") {
      this.infoPop(text);
      return;
    }
    if (returnMode === "join") {
      Gui.simpleForm().title("\u5408\u4F5C\u793E - \u52A0\u5165\u786E\u8BA4").body(ListFormInfo([text])).button("\u52A0\u5165").button("\xA7l\u8FD4\u56DE").show(this.player).then((res) => {
        if (!res.canceled && res.selection === 0) CoopCore.joinCoop(this.player, cid);
      }).catch(() => {
      });
      return;
    }
    const isOp = CoopCore.isOp(this.player.name, cid);
    const form = Gui.simpleForm().title("\u5408\u4F5C\u793E").body(ListFormInfo([text])).button("\u96C6\u4F53\u5546\u5E97\u540E\u53F0").button("\u516C\u6709\u94F6\u884C").button("\u6210\u5458\u5217\u8868").button("\u67E5\u770B\u6240\u6709\u5408\u4F5C\u793E").button("\u5408\u4F5C\u793E\u6392\u884C\u699C").button(isOp ? "\u89E3\u6563\u6B64\u5408\u4F5C\u793E" : "\u9000\u51FA\u6B64\u5408\u4F5C\u793E").button("\u63D2\u4EF6\u66F4\u65B0\u65E5\u5FD7");
    if (isOp) form.button("\u7BA1\u7406\u9762\u677F");
    form.show(this.player).then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          this.shopMgr(cid, 1);
          break;
        case 1:
          this.bankPanel(cid);
          break;
        case 2:
          this.infoPop(CoopCore.getMemberList(cid).join(", "));
          break;
        case 3:
          this.coopList();
          break;
        case 4:
          this.rank(1);
          break;
        case 5:
          this.exitConfirm(cid);
          break;
        case 6:
          this.log();
          break;
        case 7:
          this.adminPanel(cid);
          break;
      }
    }).catch(() => {
    });
  }
  exitConfirm(cid) {
    const isOp = CoopCore.isOp(this.player.name, cid);
    this.confirmPop(
      "\u5408\u4F5C\u793E - \u786E\u8BA4",
      isOp ? "\u786E\u8BA4\u89E3\u6563\u5408\u4F5C\u793E\uFF1F\u6240\u6709\u6210\u5458\u4E5F\u4F1A\u88AB\u8E22\u51FA\u3002\n\u8BF7\u5148\u6E05\u7A7A\u94F6\u884C\u7ECF\u6D4E\u3001\u4E0B\u67B6\u5546\u54C1\u3002" : "\u4F60\u786E\u8BA4\u9000\u51FA\u5408\u4F5C\u793E\u5417\uFF1F",
      () => {
        if (isOp) {
          CoopCore.releaseCoop(cid);
          this.infoPop("\u89E3\u6563\u6210\u529F\u3002");
        } else {
          CoopCore.exitCoop(this.player.name, cid);
          this.infoPop("\u5DF2\u9000\u51FA\u5408\u4F5C\u793E\u3002");
          CoopCore.sendToMembers(cid, this.player.name + " \u9000\u51FA\u4E86\u5408\u4F5C\u793E\u3002\u62DC\u62DC\uFF5E");
        }
      }
    );
  }
  // ==========================================
  //  管理面板
  // ==========================================
  adminPanel(cid) {
    Gui.simpleForm().title("\u5408\u4F5C\u793E - \u7BA1\u7406\u9762\u677F").body(ListFormInfo(["\xA76CID:\xA7r " + cid])).button("\u7F16\u8F91\u516C\u544A").button("\u5411\u6240\u6709\u6210\u5458\u558A\u8BDD").button("\u6DFB\u52A0\u7BA1\u7406\u6210\u5458").button("\xA7l\u8FD4\u56DE").show(this.player).then((res) => {
      if (res.canceled) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      if (res.selection === 3) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      switch (res.selection) {
        case 0:
          this.editNotice(cid);
          break;
        case 1:
          this.talkToMembers(cid);
          break;
        case 2:
          this.addAdmin(cid);
          break;
      }
    }).catch(() => {
    });
  }
  editNotice(cid) {
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u7F16\u8F91\u516C\u544A").textField("\u516C\u544A\u5185\u5BB9", "").show(this.player).then((res) => {
      if (res.canceled) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      CoopCore.setNotice(cid, res.formValues[0] || "");
      this.infoPop("\u8BBE\u7F6E\u6210\u529F\u3002");
    }).catch(() => {
    });
  }
  talkToMembers(cid) {
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u5411\u6240\u6709\u6210\u5458\u558A\u8BDD").textField("\u558A\u8BDD\u5185\u5BB9", "( \u1D5C \u02F0 \u1D5C )").show(this.player).then((res) => {
      if (res.canceled) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      CoopCore.sendToMembers(cid, this.player.name + ": " + res.formValues[0]);
      this.infoPop("\u558A\u8BDD\u6210\u529F\u3002");
    }).catch(() => {
    });
  }
  addAdmin(cid) {
    const members = CoopCore.getMemberList(cid);
    if (members.length === 0) return;
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u6DFB\u52A0\u7BA1\u7406").dropdown("\u5C06\u5408\u4F5C\u793E\u4E2D\u7684\u6210\u5458\u6743\u9650\u63D0\u5347\u81F3\u7BA1\u7406\u5458...", members).show(this.player).then((res) => {
      if (res.canceled) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      const idx = res.formValues[0];
      this.confirmPop("\u5408\u4F5C\u793E - \u786E\u8BA4", "\u76EE\u6807\u73A9\u5BB6\u4F1A\u83B7\u5F97\u7BA1\u7406\u9762\u677F\u7684\u4F7F\u7528\u6743\uFF0C\u786E\u8BA4\u64CD\u4F5C\u5417\uFF1F", () => {
        CoopCore.setOp(cid, idx);
        this.tipsPop("\u64CD\u4F5C\u6210\u529F\u3002");
      });
    }).catch(() => {
    });
  }
  // ==========================================
  //  银行
  // ==========================================
  bankPanel(cid) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return;
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u94F6\u884C").dropdown("\u8BF7\u9009\u62E9\u64CD\u4F5C", ["\u5B58\u5165", "\u53D6\u51FA"]).textField("\xA76\u5408\u4F5C\u793E\u94F6\u884C\u7ECF\u6D4E\uFF1A\xA7r" + data2.money + "\n\xA76\u8D26\u5355\uFF1A\xA7r\n" + data2.moneylist, "").show(this.player).then((res) => {
      if (res.canceled) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      this.bankControl(cid, res.formValues[0] + 1);
    }).catch(() => {
    });
  }
  bankControl(cid, type) {
    const title = type === 1 ? "\u5B58\u5165" + Money.UNIT : "\u53D6\u51FA" + Money.UNIT;
    const form = Gui.modalForm().title("\u5408\u4F5C\u793E - " + title).textField("\u91D1\u989D", "").textField("\u5907\u6CE8(\u53EF\u9009)", "\u65E0");
    form.show(this.player).then((res) => {
      if (res.canceled) {
        this.coopInfoPanel(cid, "menu");
        return;
      }
      const val = parseInt(res.formValues[0]);
      if (isNaN(val) || val <= 0) {
        this.errorPop("\u91D1\u989D\u586B\u5199\u4E0D\u6B63\u786E");
        return;
      }
      if (CoopCore.bankControl(cid, this.player, val, res.formValues[1] || "", type === 1 ? 1 : 2)) {
        if (type === 1) Msg.success("\u5B58\u5165\u6210\u529F\uFF01" + Money.UNIT + "\uFF1A" + val, this.player);
        else Msg.success("\u53D6\u51FA\u6210\u529F\uFF01" + Money.UNIT + "\uFF1A" + val, this.player);
      } else {
        this.errorPop("\u91D1\u989D\u586B\u5199\u4E0D\u6B63\u786E");
      }
    }).catch(() => {
    });
  }
  // ==========================================
  //  排行榜
  // ==========================================
  rank(type) {
    Gui.modalForm().title("\u5408\u4F5C\u793E - \u6392\u884C\u699C").textField(CoopCore.getRankInfo(type), "").dropdown("\u5207\u6362\u6392\u884C\u699C", ["\u94F6\u884C\u7ECF\u6D4E", "\u4EBA\u6570"], { defaultValueIndex: type - 1 }).show(this.player).then((res) => {
      if (!res.canceled) this.rank(res.formValues[1] + 1);
    }).catch(() => {
    });
  }
  // ==========================================
  //  更新日志
  // ==========================================
  log() {
    Gui.simpleForm().title("\u5408\u4F5C\u793E - \u66F4\u65B0\u65E5\u5FD7").body(ListFormInfo(["\u6682\u65E0\u66F4\u65B0\u65E5\u5FD7\u3002"])).button("\xA7l\u8FD4\u56DE").show(this.player).catch(() => {
    });
  }
  // ==========================================
  //  商店管理
  // ==========================================
  shopMgr(cid, step, gid) {
    const isOp = CoopCore.isOp(this.player.name, cid);
    const good = gid ? Database.getGoodById(gid) : void 0;
    const unit = Database.getConfig().shop_setting.monetary_unit;
    switch (step) {
      // ---- step 1: 商店管理后台主菜单 ----
      case 1: {
        const goods = CoopCore.getGoods(1, true, 1, cid);
        const form = Gui.simpleForm().title("\u5546\u5E97\u7BA1\u7406\u540E\u53F0").body(ListFormInfo(["\u9009\u62E9\u64CD\u4F5C"])).button("\u4E0A\u67B6\u7269\u54C1").button("\u56DE\u6536\u7269\u54C1\u7BA1\u7406").button("\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4");
        if (isOp) form.button("\u56DE\u6536\u62DB\u52DF\u5BA1\u6838");
        for (const g of goods) form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, true));
        const goodsCount = goods.length;
        form.button("\xA7l\u8FD4\u56DE");
        form.show(this.player).then((res) => {
          if (res.canceled) return;
          const idx = res.selection;
          const offset = isOp ? 4 : 3;
          const backIdx = offset + goodsCount;
          if (idx === backIdx) {
            this.coopInfoPanel(cid, "menu");
            return;
          }
          if (idx === 0) this.shopAdd(cid, 1);
          else if (idx === 1) this.shopMgr(cid, 6);
          else if (idx === 2) this.shopAdd(cid, 4);
          else if (isOp && idx === 3) {
            if (!this.shopMgr(cid, 8)) this.tipsPop("\u6CA1\u6709\u5F85\u5BA1\u6838\u7684\u56DE\u6536\u62DB\u52DF");
          } else {
            this.shopMgr(cid, 2, goods[idx - offset].id);
          }
        }).catch(() => {
        });
        break;
      }
      // ---- step 2: 选择操作（补货/下架/编辑） ----
      case 2: {
        if (!good) return;
        Gui.modalForm().title("\u5546\u5E97\u7BA1\u7406\u540E\u53F0").textField("gid:" + gid, "").dropdown("\u64CD\u4F5C", ["\u8865\u8D27", "\u4E0B\u67B6", "\u7F16\u8F91"]).show(this.player).then((res) => {
          if (!res.canceled) this.shopMgr(cid, res.formValues[1] + 3, gid);
        }).catch(() => {
        });
        break;
      }
      // ---- step 3: 补货 ----
      case 3: {
        if (!good || good.item.nbt) {
          if (good?.item.nbt) this.errorPop("NBT\u7269\u54C1\u65E0\u6CD5\u8865\u8D27\uFF0C\u56E0\u4E3A\u4E0D\u80FD\u4F7F\u7528\u624B\u6301\u7269\u54C1\u8865\u5145\u3002");
          return;
        }
        const inv = this.player.getComponent("inventory");
        const firstItem = inv?.container?.getItem(0);
        if (!firstItem || firstItem.typeId !== good.item.type) {
          this.errorPop("\u8BF7\u5C06\u8BE5\u5546\u54C1\u653E\u5728\u7269\u54C1\u680F\u7B2C\u4E00\u683C\u3002");
          return;
        }
        const total = countItemInInventory(this.player);
        Gui.modalForm().title("\u8865\u8D27").textField("\u5F53\u524D\u5E93\u5B58\uFF1A" + good.num, "").slider("\u8865\u8D27\u6570\u91CF", 1, Math.max(total, 1), { valueStep: 1, defaultValue: 1 }).show(this.player).then((res) => {
          if (res.canceled) {
            this.shopMgr(cid, 1);
            return;
          }
          const num = res.formValues[1];
          if (num <= 0) {
            this.errorPop("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F\uFF01");
            return;
          }
          good.num += num;
          Database.saveGood(good);
          this.player.runCommand('clear "' + this.player.name + '" ' + good.item.type + " " + good.item.aux + " " + num);
          Msg.success("\u8865\u8D27\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        }).catch(() => {
        });
        break;
      }
      // ---- step 4: 下架确认 ----
      case 4: {
        if (!good) return;
        this.confirmPop("\u4E0B\u67B6\u786E\u8BA4", "\u786E\u8BA4\u4E0B\u67B6 " + good.name + " \uFF1F\n\u4E0B\u67B6\u540E\u5E93\u5B58\u5C06\u8FD4\u8FD8\u7ED9\u4F60\u3002", () => {
          Database.deleteGood(gid);
          this.player.runCommand('give "' + this.player.name + '" ' + good.item.type + " " + good.num + " " + good.item.aux);
          Msg.success("\u4E0B\u67B6\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        });
        break;
      }
      // ---- step 5: 编辑商品信息 ----
      case 5: {
        if (!good) return;
        const customGroups = CoopCore.getGroups(true);
        const cgNames = ["\u65E0", ...customGroups.map((g) => g.displayname)];
        Gui.modalForm().title("\u7F16\u8F91\u5546\u54C1\u4FE1\u606F").textField("\u5546\u54C1\u540D\u79F0", good.name, { defaultValue: good.name }).textField("\u5546\u54C1\u63CF\u8FF0", good.des, { defaultValue: good.des }).textField("\u4EF7\u683C", String(good.money), { defaultValue: String(good.money) }).dropdown("\u81EA\u5B9A\u4E49\u5206\u7EC4", cgNames).show(this.player).then((res) => {
          if (res.canceled) {
            this.shopMgr(cid, 1);
            return;
          }
          const vals = res.formValues;
          good.name = vals[0];
          good.des = vals[1];
          good.money = parseInt(vals[2]) || 0;
          const cgIdx = vals[3];
          if (cgIdx > 0) {
            const idx = good.groups.findIndex((g) => customGroups.some((cg) => cg.groupid === g));
            if (idx !== -1) good.groups.splice(idx, 1);
            good.groups.push(customGroups[cgIdx - 1].groupid);
          }
          Database.saveGood(good);
          Msg.success("\u4FEE\u6539\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        }).catch(() => {
        });
        break;
      }
      // ---- step 6: 回收物品管理列表 ----
      case 6: {
        const goods2 = CoopCore.getGoods(1, true, 2, cid);
        const form = Gui.simpleForm().title("\u5546\u5E97\u7BA1\u7406\u540E\u53F0").body(ListFormInfo(["\u56DE\u6536\u7269\u54C1\u7BA1\u7406"]));
        for (const g of goods2) form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, false));
        form.button("\xA7l\u8FD4\u56DE");
        form.show(this.player).then((res) => {
          if (res.canceled) {
            this.shopMgr(cid, 1);
            return;
          }
          if (res.selection === goods2.length) {
            this.shopMgr(cid, 1);
            return;
          }
          this.shopMgr(cid, 7, goods2[res.selection].id);
        }).catch(() => {
        });
        break;
      }
      // ---- step 7: 取出回收库存 ----
      case 7: {
        if (!good || good.sv <= 0) {
          this.errorPop("\u6682\u65F6\u6CA1\u6709\u9700\u8981\u53D6\u51FA\u7684\u5E93\u5B58\u3002");
          break;
        }
        Gui.modalForm().title("\u53D6\u51FA\u56DE\u6536\u5E93\u5B58").slider("\u53D6\u51FA\u6570\u91CF", 1, good.sv, { valueStep: 1, defaultValue: 1 }).show(this.player).then((res) => {
          if (res.canceled) {
            this.shopMgr(cid, 1);
            return;
          }
          const num = res.formValues[0];
          good.sv -= num;
          Database.saveGood(good);
          this.player.runCommand('give "' + this.player.name + '" ' + good.item.type + " " + num + " " + good.item.aux);
          Msg.success("\u53D6\u51FA\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        }).catch(() => {
        });
        break;
      }
      // ---- step 8: 回收招募审核 ----
      case 8: {
        const goods1 = CoopCore.getGoods(1, true, 2, cid, void 0, false);
        if (goods1.length === 0) return false;
        const form = Gui.simpleForm().title("\u56DE\u6536\u62DB\u52DF\u5BA1\u6838\u5217\u8868");
        for (const g of goods1) {
          form.button(g.name + " " + unit + g.money + "\n\u5F85\u5BA1\u6838");
        }
        form.show(this.player).then((res) => {
          if (res.canceled) return;
          const g = goods1[res.selection];
          this.confirmPop(
            "\u56DE\u6536\u62DB\u52DF\u5BA1\u6838\u5217\u8868",
            "\u540D\u79F0: " + g.name + "\n\u63CF\u8FF0: " + (g.des || "") + "\n\u4EF7\u683C: " + g.money + "\n\u5E93\u5B58: " + g.num + "\n\n\u786E\u5B9A\u901A\u8FC7\u5BA1\u6838\uFF1F",
            () => {
              g.isTrue = true;
              Database.saveGood(g);
              Msg.success("\u64CD\u4F5C\u6210\u529F\u3002", this.player);
            }
          );
        }).catch(() => {
        });
        return true;
      }
    }
  }
  // ==========================================
  //  上架商品
  // ==========================================
  shopAdd(cid, step, index) {
    switch (step) {
      // ---- step 1: 选择物品栏和操作类型 ----
      case 1: {
        Gui.modalForm().title("\u4E0A\u67B6\u7269\u54C1").dropdown("\u8BF7\u9009\u62E9\u7269\u54C1\u680F", ["1", "2", "3", "4", "5", "6", "7", "8", "9"]).dropdown("\u8BF7\u9009\u62E9\u64CD\u4F5C\u7C7B\u578B", ["\u6C42\u8D2D", "\u56DE\u6536"]).show(this.player).then((res) => {
          if (!res.canceled) this.shopAdd(cid, res.formValues[1] + 2, res.formValues[0]);
        }).catch(() => {
        });
        break;
      }
      // ---- step 2: 求购上架 ----
      case 2: {
        const inv = this.player.getComponent("inventory");
        const item = inv?.container?.getItem(index ?? 0);
        if (!item) {
          this.errorPop("\u8BF7\u786E\u8BA4\u7269\u54C1\u680F\u6709\u7269\u54C1");
          return;
        }
        const customGroups = CoopCore.getGroups(true);
        const cgNames = ["\u65E0", ...customGroups.map((g) => g.displayname)];
        Gui.modalForm().title("\u5546\u54C1\u4FE1\u606F").textField("type: " + item.typeId, item.typeId, { defaultValue: item.typeId }).textField("\u5546\u54C1\u540D\u79F0", item.typeId, { defaultValue: item.typeId }).textField("\u5546\u54C1\u63CF\u8FF0", "").textField("\u4EF7\u683C", "0").dropdown("\u81EA\u5B9A\u4E49\u5206\u7EC4", cgNames).show(this.player).then((res) => {
          if (res.canceled) return;
          const vals = res.formValues;
          const money = parseInt(vals[3]) || 0;
          const cgIdx = vals[4];
          const gt = [];
          if (cgIdx > 0) gt.push(customGroups[cgIdx - 1].groupid);
          gt.push(...CoopCore.typeGood(item));
          const newGood = {
            name: vals[1],
            id: CoopCore.generateId(),
            time: Date.now(),
            type: 1,
            groups: gt,
            des: vals[2],
            num: 1,
            sv: 0,
            money,
            cid,
            isTrue: true,
            item: { nbt: "", type: item.typeId, aux: 0 }
          };
          Database.saveGood(newGood);
          Msg.success("\u4E0A\u67B6\u6210\u529F\uFF01", this.player);
        }).catch(() => {
        });
        break;
      }
      // ---- step 3: 回收功能（暂未实现） ----
      case 3: {
        this.errorPop("\u56DE\u6536\u529F\u80FD\u6682\u672A\u5B8C\u5168\u5B9E\u73B0");
        break;
      }
      // ---- step 4: 添加自定义分组 ----
      case 4: {
        Gui.modalForm().title("\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4").textField("\u5206\u7EC4\u540D\u79F0", "").show(this.player).then((res) => {
          if (res.canceled) return;
          const name = res.formValues[0]?.trim();
          if (!name) {
            this.errorPop("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F\uFF01");
            return;
          }
          Database.saveGroup({ groupid: "custom_" + _genId(), displayname: name });
          Msg.success("\u64CD\u4F5C\u6210\u529F\u3002", this.player);
        }).catch(() => {
        });
        break;
      }
    }
  }
};

// scripts/coop/CoopSystem.ts
var CoopSystem = class {
  static init() {
    Database.initDefaultGroups();
    this.registerPermissions();
    this.registerCommands();
    this.registerEvents();
  }
  static registerPermissions() {
    Permission.register("coop.use", Permission.Any);
    Permission.register("coop.admin", Permission.OP);
    Permission.register("coopshop.use", Permission.Any);
  }
  static registerCommands() {
    Command.register("coop", "coop.use", (player) => {
      if (player) new CoopGUI(player).mainPanel();
    }, "\u5408\u4F5C\u793E");
    Command.register("coopshop", "coopshop.use", (player) => {
      if (!player) return;
      new CoopGUI(player).shopMgr(Database.getPlayerCid(player.name) ?? "", 1);
    }, "\u5408\u4F5C\u793E\u5546\u5E97");
  }
  static registerEvents() {
  }
};

// scripts/chat/ChatSystem.ts
import { world as world12, system as system8 } from "@minecraft/server";

// scripts/chat/DogeChat.ts
import { world as world10 } from "@minecraft/server";
function getData(key, fallback) {
  return Storage.get(key, fallback);
}
function setData(key, value) {
  Storage.set(key, value);
}
function formatTimestamp(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
var DogeChat = class {
  static {
    this.KEY_CHANNELS = "chat:channels";
  }
  static {
    this.KEY_PLAYER_SETTINGS = "chat:player_settings";
  }
  static {
    this.KEY_CHANNEL_HISTORY = "chat:channel_history";
  }
  static {
    this.KEY_REDPACKETS = "chat:redpackets";
  }
  static {
    this.slowModeTracker = /* @__PURE__ */ new Map();
  }
  static {
    this.DEFAULT_CHANNEL_CONFIG = {
      allowChat: true,
      slowMode: 0,
      isBroadcast: false
    };
  }
  /** 生成唯一ID */
  static generateId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  // ---------- 保留期 ----------
  /** 获取频道消息保留期（毫秒） */
  static getRetention(channel) {
    if (channel.config.isBroadcast) return Infinity;
    switch (channel.type) {
      case "private":
        return 30 * 24 * 60 * 60 * 1e3;
      // 30 天
      case "system":
        return 24 * 60 * 60 * 1e3;
      // 1 天
      case "public":
      case "custom":
      default:
        return 7 * 24 * 60 * 60 * 1e3;
    }
  }
  // ============================================
  //  频道管理
  // ============================================
  /** 初始化默认频道 */
  static initChannels() {
    const channels = getData(this.KEY_CHANNELS, []);
    if (channels.length > 0) return;
    channels.push({
      id: this.generateId(),
      name: "\u516C\u5171\u9891\u9053",
      type: "public",
      prefix: "PB",
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG }
    });
    channels.push({
      id: this.generateId(),
      name: "\u516C\u544A",
      type: "custom",
      prefix: "BC",
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG, isBroadcast: true }
    });
    setData(this.KEY_CHANNELS, channels);
  }
  /** 获取所有频道 */
  static getChannels() {
    return getData(this.KEY_CHANNELS, []);
  }
  /** 获取指定频道 */
  static getChannel(id) {
    return this.getChannels().find((c) => c.id === id);
  }
  /** 获取公共频道 */
  static getPublicChannel() {
    const channels = this.getChannels();
    let pub = channels.find((c) => c.type === "public");
    if (!pub) {
      this.initChannels();
      pub = this.getChannels().find((c) => c.type === "public");
    }
    return pub;
  }
  /** 创建新频道 
   @param name 频道名称 
   @param prefix 频道前缀 
   @param type 频道类型 
   @param config 频道配置 
   @param owner 频道所有者
   @returns 频道ID */
  static createChannel(name, prefix, type, config, owner) {
    const channels = this.getChannels();
    if (channels.some((c) => c.name === name)) return "";
    const channel = {
      id: this.generateId(),
      name,
      prefix,
      type,
      ownerid: owner?.id,
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG, ...config }
    };
    channels.push(channel);
    setData(this.KEY_CHANNELS, channels);
    return channel.id;
  }
  /** 删除指定频道 
   @param channelId 频道ID 
   @returns 是否删除成功 */
  static deleteChannel(channelId) {
    const channels = this.getChannels();
    const idx = channels.findIndex((c) => c.id === channelId);
    if (idx === -1) return false;
    if (channels[idx].type === "public") return false;
    channels.splice(idx, 1);
    setData(this.KEY_CHANNELS, channels);
    const history = getData(this.KEY_CHANNEL_HISTORY, {});
    delete history[channelId];
    setData(this.KEY_CHANNEL_HISTORY, history);
    HttpDB.deleteChannelMessages(channelId).catch(() => {
    });
    return true;
  }
  /** 更新指定频道配置 
   @param channelId 频道ID 
   @param config 频道配置 
   @returns 是否更新成功 */
  static updateChannelConfig(channelId, config) {
    const channels = this.getChannels();
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return false;
    channel.config = { ...channel.config, ...config };
    setData(this.KEY_CHANNELS, channels);
    return true;
  }
  /** 更新指定频道名称 
   @param channelId 频道ID 
   @param newName 新名称 
   @param newPrefix 新前缀 
   @returns 是否更新成功 */
  static updateChannelName(channelId, newName, newPrefix) {
    const channels = this.getChannels();
    const channel = channels.find((c) => c.id === channelId);
    if (!channel) return false;
    channel.name = newName;
    channel.prefix = newPrefix;
    setData(this.KEY_CHANNELS, channels);
    return true;
  }
  // ============================================
  //  玩家活跃频道
  // ============================================
  /** 获取所有玩家的活跃频道设置 
  @param player 玩家 
  @returns 所有玩家的活跃频道设置 */
  static getPlayerSettings(player) {
    const all = getData(this.KEY_PLAYER_SETTINGS, {});
    if (!all[player.id]) {
      const pub = this.getPublicChannel();
      all[player.id] = { id: player.id, activeChannel: pub.id };
      setData(this.KEY_PLAYER_SETTINGS, all);
    }
    return all[player.id];
  }
  /** 获取玩家的活跃频道 
  @param player 玩家 
  @returns 玩家的活跃频道 */
  static getActiveChannel(player) {
    const settings = this.getPlayerSettings(player);
    const channel = this.getChannel(settings.activeChannel);
    if (channel) return channel;
    const pub = this.getPublicChannel();
    settings.activeChannel = pub.id;
    const all = getData(this.KEY_PLAYER_SETTINGS, {});
    all[player.id] = settings;
    setData(this.KEY_PLAYER_SETTINGS, all);
    return pub;
  }
  /** 设置玩家的活跃频道 
  @param player 玩家 
  @param channelId 频道ID 
  @returns 是否设置成功 */
  static setActiveChannel(player, channelId) {
    const all = getData(this.KEY_PLAYER_SETTINGS, {});
    const settings = all[player.id];
    if (!settings) return false;
    settings.activeChannel = channelId;
    setData(this.KEY_PLAYER_SETTINGS, all);
    return true;
  }
  /** 频道在线人数（活跃频道为该频道的在线玩家数） 
   * @param channelId 频道ID 
   * @returns 频道在线人数 */
  static getOnlineCount(channelId) {
    const all = getData(this.KEY_PLAYER_SETTINGS, {});
    let count = 0;
    for (const p of world10.getPlayers()) {
      if (all[p.id]?.activeChannel === channelId) count++;
    }
    return count;
  }
  /** 获取玩家的私聊频道 
  @param player 玩家 
  @returns 玩家的私聊频道列表 */
  static getPrivateChannels(player) {
    return this.getChannels().filter(
      (c) => c.type === "private" && c.id.includes(player.id)
    );
  }
  // ============================================
  //  系统消息频道
  // ============================================
  /** 获取玩家的系统消息频道ID 每个玩家单独分配
  @param player 玩家 
  @returns 玩家的系统消息频道ID */
  static getSystemChannelId(player) {
    return `sys_${player.id}`;
  }
  /** 确保玩家的系统消息频道存在 
  @param player 玩家 
  @returns 玩家的系统消息频道 */
  static ensureSystemChannel(player) {
    const channelId = this.getSystemChannelId(player);
    const existing = this.getChannel(channelId);
    if (existing) return existing;
    const channels = getData(this.KEY_CHANNELS, []);
    const channel = {
      id: channelId,
      name: "\u7CFB\u7EDF\u6D88\u606F",
      type: "system",
      prefix: "SYS",
      ownerid: player.id,
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG, allowChat: false }
    };
    channels.push(channel);
    setData(this.KEY_CHANNELS, channels);
    return channel;
  }
  /** 发送系统消息到玩家的系统频道 
  @param player 玩家 
  @param content 系统消息内容 */
  static sendSystemMessage(player, content) {
    const channel = this.ensureSystemChannel(player);
    const msg = {
      id: this.generateId(),
      fromid: "system",
      fromName: "SYS",
      channelId: channel.id,
      type: "text",
      content,
      timestamp: Date.now(),
      showTimestamp: true
    };
    this.addToHistory(channel.id, msg);
  }
  /** 判断是否为私聊频道的参与者 
  @param channelId 频道ID 
  @param playerId 玩家ID 
  @returns 是否为私聊频道的参与者 */
  static isPrivateParticipant(channelId, playerId2) {
    if (!channelId.startsWith("priv_")) return false;
    return channelId.includes(playerId2);
  }
  /** 获取私聊频道中的另一方 id 
  @param channelId 频道ID 
  @param myId 玩家ID 
  @returns 另一方 id 如果是私聊频道的参与者 */
  static getPrivateOther(channelId, myId) {
    if (!channelId.startsWith("priv_")) return void 0;
    const parts = channelId.split("_");
    return parts[1] === myId ? parts[2] : parts[1];
  }
  /** 循环切换频道（跳过私聊） 
  @param player 玩家 
  @returns 切换后的频道 */
  static cycleChannel(player) {
    const all = this.getChannels();
    const switchable = all.filter((c) => c.type !== "private");
    if (switchable.length === 0) {
      const pub = this.getPublicChannel();
      this.setActiveChannel(player, pub.id);
      return pub;
    }
    const current = this.getActiveChannel(player);
    const idx = switchable.findIndex((c) => c.id === current.id);
    const next = switchable[(idx + 1) % switchable.length];
    this.setActiveChannel(player, next.id);
    return next;
  }
  // ============================================
  //  消息同步
  // ============================================
  /** 获取频道的历史消息（优先 HttpDB，回退到 Dynamic Property） */
  static async getChannelHistory(channelId) {
    const channel = this.getChannel(channelId);
    if (!channel) return [];
    const cutoff = Date.now() - this.getRetention(channel);
    const rows = await HttpDB.loadHistory(channelId, cutoff);
    if (rows !== null) return rows;
    const history = getData(this.KEY_CHANNEL_HISTORY, {});
    const msgs = history[channelId] || [];
    return msgs.filter((m) => m.timestamp >= cutoff);
  }
  /** 添加至频道历史消息记录 */
  static addToHistory(channelId, msg) {
    const channel = this.getChannel(channelId);
    if (!channel) return;
    const history = getData(this.KEY_CHANNEL_HISTORY, {});
    if (!history[channelId]) history[channelId] = [];
    history[channelId].push(msg);
    const cutoff = Date.now() - this.getRetention(channel);
    history[channelId] = history[channelId].filter((m) => m.timestamp >= cutoff);
    setData(this.KEY_CHANNEL_HISTORY, history);
    HttpDB.saveMessage(channelId, {
      id: msg.id,
      fromid: msg.fromid,
      fromName: msg.fromName,
      type: msg.type,
      content: msg.content,
      attachment: msg.attachment,
      showTimestamp: !!msg.showTimestamp,
      timestamp: msg.timestamp
    }).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
  }
  /** 切换频道时加载历史消息 */
  static async loadChannelHistory(player, channelId) {
    const channel = this.getChannel(channelId);
    if (!channel) return;
    const history = await this.getChannelHistory(channelId);
    if (history.length === 0) {
      player.sendMessage(`\xA77--- \xA7f${channel.prefix} \xA77\u9891\u9053\u6682\u65E0\u5386\u53F2\u6D88\u606F ---`);
      return;
    }
    player.sendMessage(`\xA77--- \xA7f${channel.prefix} \xA77\u9891\u9053\u5386\u53F2\u6D88\u606F ---`);
    for (const msg of history) {
      if (msg.showTimestamp) {
        player.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
      }
      let display = msg.content;
      switch (msg.type) {
        case "location":
          display = `\xA7a[\u5B9A\u4F4D] ${display}`;
          break;
        case "teleport_invite":
          display = `\xA7e[\u4F20\u9001\u9080\u8BF7] ${display}`;
          break;
        case "redpacket":
          display = `\xA76[\u7EA2\u5305] ${display}`;
          break;
      }
      player.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${msg.fromName}: ${display}` }] });
    }
    player.sendMessage(`\xA77--- \u4EE5\u4E0A\u4E3A\u5386\u53F2\u6D88\u606F\uFF0C\u5171 ${history.length} \u6761 ---`);
    player.sendMessage("\xA77!lo \xA78\u53D1\u9001\u5B9A\u4F4D \xA77| !tp \xA78\u4F20\u9001\u9080\u8BF7 \xA77| !hb \xA78\u53D1\u9001\u7EA2\u5305");
  }
  // ============================================
  //  发送消息
  // ============================================
  static async sendChannelMessage(from, channelId, content, type = "text", attachment) {
    const channel = this.getChannel(channelId);
    if (!channel) return false;
    if (!channel.config.allowChat) {
      if (channel.type === "system") Msg.warning("\u8BE5\u9891\u9053\u53EA\u8BFB\u3002", from);
      return false;
    }
    if (channel.config.isBroadcast) {
      if (!this.isChannelOwner(from, channelId)) {
        Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u6A21\u5F0F\uFF0C\u53EA\u6709\u7BA1\u7406\u5458\u624D\u80FD\u53D1\u8A00\u3002", from);
        return false;
      }
      const msg2 = {
        id: this.generateId(),
        fromid: from.id,
        fromName: from.name,
        channelId,
        type,
        content,
        attachment,
        timestamp: Date.now(),
        showTimestamp: true
        // 公告板每条消息都显示时间
      };
      this.addToHistory(channelId, msg2);
      const prefix = `\xA7a[${channel.prefix}\u516C\u544A]`;
      for (const p of world10.getPlayers()) {
        if (p.id === from.id) continue;
        p.sendMessage(`\xA77${formatTimestamp(msg2.timestamp)}`);
        p.sendMessage({ rawtext: [{ text: `${prefix} ${from.name}: ${content}` }] });
      }
      return true;
    }
    if (channel.config.slowMode > 0) {
      const playerMap = this.slowModeTracker.get(from.id);
      const lastTs = playerMap?.get(channelId) ?? 0;
      const elapsed = (Date.now() - lastTs) / 1e3;
      if (elapsed < channel.config.slowMode) {
        Msg.warning(`\u9891\u9053 ${channel.prefix} \u6162\u901F\u6A21\u5F0F\u4E2D\uFF0C\u8BF7\u7B49\u5F85 ${Math.ceil(channel.config.slowMode - elapsed)} \u79D2\u3002`, from);
        return false;
      }
    }
    const history = await this.getChannelHistory(channelId);
    const lastMsg = history.length > 0 ? history[history.length - 1] : void 0;
    const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1e3;
    const msg = {
      id: this.generateId(),
      fromid: from.id,
      fromName: from.name,
      channelId,
      type,
      content,
      attachment,
      timestamp: Date.now(),
      showTimestamp
    };
    this.addToHistory(channelId, msg);
    if (showTimestamp) from.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
    from.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${from.name}: ${content}` }] });
    const all = getData(this.KEY_PLAYER_SETTINGS, {});
    for (const p of world10.getPlayers()) {
      if (p.id === from.id) continue;
      if (all[p.id]?.activeChannel !== channelId) continue;
      let display = content;
      switch (type) {
        case "location":
          display = `\xA7a[\u5B9A\u4F4D] ${display}`;
          break;
        case "teleport_invite":
          display = `\xA7e[\u4F20\u9001\u9080\u8BF7] ${display}`;
          break;
        case "redpacket":
          display = `\xA76[\u7EA2\u5305] ${display}`;
          break;
      }
      if (showTimestamp) p.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
      p.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${from.name}: ${display}` }] });
    }
    if (channel.config.slowMode > 0) {
      if (!this.slowModeTracker.has(from.id)) this.slowModeTracker.set(from.id, /* @__PURE__ */ new Map());
      this.slowModeTracker.get(from.id).set(channelId, Date.now());
    }
    return true;
  }
  /** 发送私聊 */
  static async sendPrivateMessage(from, toPlayer, content, type = "text") {
    const channel = this.ensurePrivateChannel(from.id, toPlayer.id);
    const history = await this.getChannelHistory(channel.id);
    const lastMsg = history.length > 0 ? history[history.length - 1] : void 0;
    const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1e3;
    const msg = {
      id: this.generateId(),
      fromid: from.id,
      fromName: from.name,
      channelId: channel.id,
      type,
      content,
      timestamp: Date.now(),
      showTimestamp
    };
    this.addToHistory(channel.id, msg);
    const all = getData(this.KEY_PLAYER_SETTINGS, {});
    for (const p of [from, toPlayer]) {
      if (all[p.id]?.activeChannel === channel.id) {
        let display = content;
        switch (type) {
          case "location":
            display = `\xA7a[\u5B9A\u4F4D] ${display}`;
            break;
          case "teleport_invite":
            display = `\xA7e[\u4F20\u9001\u9080\u8BF7] ${display}`;
            break;
          case "redpacket":
            display = `\xA76[\u7EA2\u5305] ${display}`;
            break;
        }
        if (showTimestamp) p.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
        const sender = p.id === from.id ? toPlayer.name : from.name;
        p.sendMessage({ rawtext: [{ text: `\xA7d[\u79C1\u4FE1] \xA7f${sender}: ${display}` }] });
      } else if (p.id !== from.id) {
        Msg.info(`\xA7b${from.name} \u53D1\u6765\u4E00\u6761\u79C1\u4FE1\u3002\u4F7F\u7528 !channel \u5207\u6362\u5230\u79C1\u804A\u9891\u9053\u67E5\u770B\u3002`, p);
      }
    }
    return true;
  }
  /** 创建或获取私聊频道 */
  static ensurePrivateChannel(idA, idB) {
    const ids = [idA, idB].sort();
    const channelId = `priv_${ids[0]}_${ids[1]}`;
    let channel = this.getChannel(channelId);
    if (channel) return channel;
    const nameB = world10.getPlayers().find((p) => p.id === idB)?.name ?? idB;
    const channels = getData(this.KEY_CHANNELS, []);
    channel = {
      id: channelId,
      name: `\u4E0E ${nameB} \u7684\u79C1\u804A`,
      type: "private",
      prefix: `\u79C1\u804A-${nameB}`,
      ownerid: idA,
      createdAt: Date.now(),
      config: { ...this.DEFAULT_CHANNEL_CONFIG }
    };
    channels.push(channel);
    setData(this.KEY_CHANNELS, channels);
    return channel;
  }
  // ============================================
  //  定位 & 传送
  // ============================================
  static createLocationMessage(player) {
    const loc2 = player.location;
    return `${player.dimension.id}:${Math.floor(loc2.x)},${Math.floor(loc2.y)},${Math.floor(loc2.z)}`;
  }
  static sendTeleportInvite(from, toPlayer) {
    const loc2 = from.location;
    const locStr = `${from.dimension.id}:${Math.floor(loc2.x)},${Math.floor(loc2.y)},${Math.floor(loc2.z)}`;
    return this.sendPrivateMessage(from, toPlayer, `${from.name} \u9080\u8BF7\u4F60\u4F20\u9001\u5230\u4ED6\u7684\u4F4D\u7F6E\uFF01(${locStr})`, "teleport_invite");
  }
  // ============================================
  //  红包
  // ============================================
  static sendRedPacket(sender, amount, count, targetType, targetId) {
    if (amount <= 0 || count <= 0 || count > amount) {
      Msg.error("\u7EA2\u5305\u53C2\u6570\u65E0\u6548\u3002", sender);
      return false;
    }
    const balance = Money.get(sender);
    if (balance < amount) {
      Msg.error(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${amount}\uFF0C\u5F53\u524D ${balance}\u3002`, sender);
      return false;
    }
    Money.set(sender, balance - amount);
    const packet = {
      id: this.generateId(),
      senderid: sender.id,
      senderName: sender.name,
      totalAmount: amount,
      remainingAmount: amount,
      totalCount: count,
      remainingCount: count,
      receivers: [],
      targetType,
      targetId,
      createdAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1e3
    };
    const packets = getData(this.KEY_REDPACKETS, []);
    packets.push(packet);
    setData(this.KEY_REDPACKETS, packets);
    Msg.success(`${sender.name} \u53D1\u9001\u4E86\u7EA2\u5305\uFF1A${amount} ${Money.UNIT}\uFF08\u5171 ${count} \u4EFD\uFF09\u3002`, sender);
    if (targetType === "group" && this.getChannel(targetId)) {
      this.addToHistory(targetId, {
        id: this.generateId(),
        fromid: sender.id,
        fromName: sender.name,
        channelId: targetId,
        type: "redpacket",
        content: `\u53D1\u9001\u4E86 ${amount} ${Money.UNIT} \u7684\u7EA2\u5305\uFF08\u5171 ${count} \u4EFD\uFF09`,
        timestamp: Date.now()
      });
    }
    return true;
  }
  static claimRedPacket(player, packetId) {
    const packets = getData(this.KEY_REDPACKETS, []);
    const packet = packets.find((p) => p.id === packetId);
    if (!packet) {
      Msg.error("\u7EA2\u5305\u4E0D\u5B58\u5728\u3002", player);
      return 0;
    }
    if (packet.remainingCount <= 0) {
      Msg.error("\u7EA2\u5305\u5DF2\u88AB\u9886\u5B8C\u3002", player);
      return 0;
    }
    if (packet.receivers.includes(player.id)) {
      Msg.warning("\u4F60\u5DF2\u7ECF\u9886\u53D6\u8FC7\u8FD9\u4E2A\u7EA2\u5305\u4E86\u3002", player);
      return 0;
    }
    if (Date.now() > packet.expiresAt) {
      Msg.error("\u7EA2\u5305\u5DF2\u8FC7\u671F\u3002", player);
      return 0;
    }
    let amount;
    if (packet.remainingCount === 1) {
      amount = packet.remainingAmount;
    } else {
      const max = Math.floor(packet.remainingAmount / packet.remainingCount * 2);
      amount = Math.max(1, Math.floor(Math.random() * (max + 1)));
      amount = Math.min(amount, packet.remainingAmount - (packet.remainingCount - 1));
    }
    packet.remainingAmount -= amount;
    packet.remainingCount--;
    packet.receivers.push(player.id);
    setData(this.KEY_REDPACKETS, packets);
    Money.add(player, amount);
    Msg.success(`\u4F60\u9886\u53D6\u4E86 ${packet.senderName} \u7684\u7EA2\u5305\uFF0C\u83B7\u5F97 ${amount} ${Money.UNIT}\uFF01`, player);
    return amount;
  }
  static getAvailableRedPackets(player) {
    const packets = getData(this.KEY_REDPACKETS, []);
    const now = Date.now();
    return packets.filter((p) => {
      if (p.remainingCount <= 0 || now > p.expiresAt) return false;
      if (p.receivers.includes(player.id)) return false;
      if (p.targetType === "player") return p.targetId === player.id;
      return true;
    });
  }
  static cleanupExpiredRedPackets() {
    const packets = getData(this.KEY_REDPACKETS, []);
    const valid = packets.filter((p) => Date.now() <= p.expiresAt);
    if (valid.length < packets.length) setData(this.KEY_REDPACKETS, valid);
  }
  // ============================================
  //  权限判断
  // ============================================
  static isChannelOwner(player, channelId) {
    return this.getChannel(channelId)?.ownerid === player.id;
  }
};

// scripts/gui/ChatGUI.ts
import { world as world11 } from "@minecraft/server";
var ChatGUI = class {
  // ============== Level 1: 主面板 ==============
  /** 主面板 — 所有频道列表 */
  static async openChannelPanel(player) {
    const active = DogeChat.getActiveChannel(player);
    const allChannels = DogeChat.getChannels();
    const displayChannels = allChannels.filter((c) => {
      if (c.type === "private") return false;
      if (c.type === "system") return c.ownerid === player.id;
      return true;
    });
    const isAdmin = Permission.check(player, "chat.admin");
    const form = Gui.simpleForm("DogeChat", ListFormInfo([
      `\u5F53\u524D\u9891\u9053: ${active.prefix} - ${active.name}`
    ]));
    form.button("\u9891\u9053\u7BA1\u7406");
    form.button("\u79C1\u804A\u9891\u9053");
    for (const c of displayChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      const mark = c.id === active.id ? "\u25C0 " : "";
      let tag = "";
      if (c.config.isBroadcast) tag = "\xA77[\u516C\u544A]";
      else if (c.type === "system") tag = "\xA79[\u7CFB\u7EDF]";
      form.button(`${mark}${c.prefix} - ${c.name} ${tag}
\xA7a${online} \u4EBA\u5728\u7EBF`);
    }
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "DogeChat");
    if (res.canceled) return;
    const sel = res.selection;
    if (sel === 0) {
      await this.openChannelManager(player);
      return;
    }
    if (sel === 1) {
      await this.openPrivateChatPanel(player);
      return;
    }
    const channelIdx = sel - 2;
    if (channelIdx >= 0 && channelIdx < displayChannels.length) {
      const target = displayChannels[channelIdx];
      if (target.config.isBroadcast && !isAdmin && !DogeChat.isChannelOwner(player, target.id)) {
        Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002\u7BA1\u7406\u5458\u53EF\u5207\u6362\u5230\u8BE5\u9891\u9053\u3002", player);
        await this.openChannelPanel(player);
        return;
      }
      if (target.id !== active.id) {
        DogeChat.setActiveChannel(player, target.id);
        Msg.success(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${target.prefix}`, player);
        await DogeChat.loadChannelHistory(player, target.id);
      }
      await this.openChannelPanel(player);
      return;
    }
  }
  // ============== Level 2a: 频道管理 ==============
  /** 频道管理 — 显示所有频道 */
  static async openChannelManager(player) {
    const allChannels = DogeChat.getChannels();
    const isAdmin = Permission.check(player, "chat.admin");
    const form = Gui.simpleForm("\u9891\u9053\u7BA1\u7406", ListFormInfo([
      `\u5171\u6709 ${allChannels.length} \u4E2A\u9891\u9053`
    ]));
    form.button("\u521B\u5EFA\u9891\u9053");
    for (const c of allChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      form.button(`${c.prefix} - \xA7f${c.name}
\xA77${online} \u4EBA\u5728\u7EBF`);
    }
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u9891\u9053\u7BA1\u7406");
    if (res.canceled) {
      await this.openChannelPanel(player);
      return;
    }
    const sel = res.selection;
    if (sel === 0) {
      await this.createChannelDialog(player);
      return;
    }
    const channelIdx = sel - 1;
    if (channelIdx >= 0 && channelIdx < allChannels.length) {
      const channel = allChannels[channelIdx];
      if (channel.config.isBroadcast && !isAdmin && !DogeChat.isChannelOwner(player, channel.id)) {
        Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u5207\u6362\u3002\u7BA1\u7406\u5458\u53EF\u5728\u9891\u9053\u8BBE\u7F6E\u4E2D\u64CD\u4F5C\u3002", player);
        await this.openChannelManager(player);
        return;
      }
      if (isAdmin || DogeChat.isChannelOwner(player, channel.id)) {
        await this.openChannelSettings(player, channel);
      } else {
        DogeChat.setActiveChannel(player, channel.id);
        Msg.success(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${channel.prefix}`, player);
        DogeChat.loadChannelHistory(player, channel.id);
        await this.openChannelPanel(player);
      }
      return;
    }
    await this.openChannelPanel(player);
  }
  // ============== Level 3: 频道设置 ==============
  /** 频道设置 — 仅管理员/所有者可操作 */
  static async openChannelSettings(player, channel) {
    const isOwner = DogeChat.isChannelOwner(player, channel.id);
    const lines = [
      `${channel.prefix} - ${channel.name}`,
      `\u7C7B\u578B: ${channel.type}`,
      `\u5728\u7EBF: ${DogeChat.getOnlineCount(channel.id)} \u4EBA`,
      `\u516C\u544A\u677F: ${channel.config.isBroadcast ? "\xA7a\u5F00\u542F" : "\xA7c\u5173\u95ED"}`
    ];
    const form = Gui.simpleForm("\u9891\u9053\u8BBE\u7F6E", ListFormInfo(lines));
    form.button("\u7F16\u8F91\u9891\u9053\u540D");
    form.button(`\u516C\u544A\u677F\u6A21\u5F0F (${channel.config.isBroadcast ? "\u5F00" : "\u5173"})`);
    if (isOwner && channel.type !== "public") {
      form.button("\u5220\u9664\u9891\u9053");
    }
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u9891\u9053\u8BBE\u7F6E");
    if (res.canceled) {
      await this.openChannelManager(player);
      return;
    }
    const sel = res.selection;
    let idx = 0;
    if (sel === idx) {
      await this.renameChannelDialog(player, channel);
      return;
    }
    idx++;
    if (sel === idx) {
      DogeChat.updateChannelConfig(channel.id, { isBroadcast: !channel.config.isBroadcast });
      Msg.success(`\u516C\u544A\u677F\u6A21\u5F0F\u5DF2${channel.config.isBroadcast ? "\u5173\u95ED" : "\u5F00\u542F"}\u3002`, player);
      const updated = DogeChat.getChannel(channel.id);
      if (updated) await this.openChannelSettings(player, updated);
      else await this.openChannelManager(player);
      return;
    }
    idx++;
    if (isOwner && channel.type !== "public") {
      if (sel === idx) {
        Gui.confirm(player, "\u5220\u9664\u9891\u9053", `\u786E\u8BA4\u5220\u9664\u9891\u9053 "${channel.name}" \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`, () => {
          DogeChat.deleteChannel(channel.id);
          Msg.success(`\u9891\u9053 "${channel.name}" \u5DF2\u5220\u9664\u3002`, player);
        });
        await this.openChannelManager(player);
        return;
      }
      idx++;
    }
    await this.openChannelManager(player);
  }
  // ============== 创建频道 ==============
  static async createChannelDialog(player) {
    const form = Gui.modalForm("\u521B\u5EFA\u9891\u9053");
    form.textField("\u9891\u9053\u540D\u79F0", "\u8F93\u5165\u9891\u9053\u540D\u79F0");
    form.textField("\u663E\u793A\u524D\u7F00", "\u804A\u5929\u663E\u793A\u7684\u524D\u7F00\uFF0C\u5EFA\u8BAE\u7B80\u77ED");
    const res = await Gui.showForm(player, form, "\u521B\u5EFA\u9891\u9053");
    if (res.canceled) {
      await this.openChannelManager(player);
      return;
    }
    const vals = res.formValues;
    const name = vals[0].trim();
    const prefix = vals[1].trim();
    if (!name || !prefix) {
      Msg.error("\u9891\u9053\u540D\u79F0\u548C\u524D\u7F00\u4E0D\u80FD\u4E3A\u7A7A\u3002", player);
      await this.createChannelDialog(player);
      return;
    }
    const cid = DogeChat.createChannel(name, prefix, "custom", {}, player);
    if (cid) {
      DogeChat.setActiveChannel(player, cid);
      Msg.success(`\u9891\u9053 "${name}" \u521B\u5EFA\u6210\u529F\uFF0C\u5DF2\u81EA\u52A8\u5207\u6362\u3002`, player);
      DogeChat.loadChannelHistory(player, cid);
    } else {
      Msg.error("\u9891\u9053\u540D\u79F0\u5DF2\u5B58\u5728\u3002", player);
    }
    await this.openChannelPanel(player);
  }
  // ============== 编辑频道名 ==============
  static async renameChannelDialog(player, channel) {
    const form = Gui.modalForm("\u7F16\u8F91\u9891\u9053\u540D");
    form.textField("\u9891\u9053\u540D\u79F0", "\u8F93\u5165\u65B0\u540D\u79F0", { "defaultValue": channel.name });
    form.textField("\u663E\u793A\u524D\u7F00", "\u8F93\u5165\u65B0\u524D\u7F00", { "defaultValue": channel.prefix });
    const res = await Gui.showForm(player, form, "\u7F16\u8F91\u9891\u9053\u540D");
    if (res.canceled) {
      await this.openChannelSettings(player, channel);
      return;
    }
    const vals = res.formValues;
    const newName = vals[0].trim();
    const newPrefix = vals[1].trim();
    if (!newName || !newPrefix) {
      Msg.error("\u540D\u79F0\u548C\u524D\u7F00\u4E0D\u80FD\u4E3A\u7A7A\u3002", player);
      await this.renameChannelDialog(player, channel);
      return;
    }
    DogeChat.updateChannelName(channel.id, newName, newPrefix);
    Msg.success(`\u9891\u9053\u5DF2\u91CD\u547D\u540D\u4E3A: ${newPrefix} - ${newName}`, player);
    const updated = DogeChat.getChannel(channel.id);
    if (updated) await this.openChannelSettings(player, updated);
    else await this.openChannelManager(player);
  }
  // ============== Level 2b: 私聊频道 ==============
  static async openPrivateChatPanel(player) {
    const active = DogeChat.getActiveChannel(player);
    const privateChannels = DogeChat.getPrivateChannels(player);
    const form = Gui.simpleForm("\u79C1\u804A\u9891\u9053", ListFormInfo([]));
    form.button("\u65B0\u6D88\u606F");
    for (const c of privateChannels) {
      const otherName = c.name.replace("\u4E0E ", "").replace(" \u7684\u79C1\u804A", "");
      const mark = c.id === active.id ? "\u25C0 " : "";
      form.button(`${mark}${otherName}`);
    }
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u79C1\u804A\u9891\u9053");
    if (res.canceled) {
      await this.openChannelPanel(player);
      return;
    }
    const sel = res.selection;
    if (sel === 0) {
      await this.selectPlayerForPrivate(player);
      return;
    }
    const channelIdx = sel - 1;
    if (channelIdx >= 0 && channelIdx < privateChannels.length) {
      const target = privateChannels[channelIdx];
      if (target.id !== active.id) {
        DogeChat.setActiveChannel(player, target.id);
        Msg.success(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${target.prefix}`, player);
        DogeChat.loadChannelHistory(player, target.id);
      }
      await this.openPrivateChatPanel(player);
      return;
    }
    await this.openChannelPanel(player);
  }
  /** 选择在线玩家发起私聊 */
  static async selectPlayerForPrivate(player) {
    const onlinePlayers = player.dimension.getPlayers().filter((p) => p.id !== player.id);
    if (onlinePlayers.length === 0) {
      Msg.info("\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u3002", player);
      await this.openPrivateChatPanel(player);
      return;
    }
    const form = Gui.simpleForm("\u9009\u62E9\u73A9\u5BB6", ListFormInfo(["\u9009\u62E9\u8981\u53D1\u9001\u79C1\u804A\u7684\u73A9\u5BB6"]));
    for (const p of onlinePlayers) {
      form.button(p.name);
    }
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u9009\u62E9\u73A9\u5BB6");
    if (res.canceled) {
      await this.openPrivateChatPanel(player);
      return;
    }
    const sel = res.selection;
    if (sel >= onlinePlayers.length) {
      await this.openPrivateChatPanel(player);
      return;
    }
    const target = onlinePlayers[sel];
    const channel = DogeChat.ensurePrivateChannel(player.id, target.id);
    DogeChat.setActiveChannel(player, channel.id);
    Msg.success(`\u5DF2\u5207\u6362\u5230\u4E0E ${target.name} \u7684\u79C1\u804A\u9891\u9053\u3002`, player);
    DogeChat.loadChannelHistory(player, channel.id);
    await this.openPrivateChatPanel(player);
  }
  // ============== 红包 ==============
  static async openRedPacketPanel(player) {
    const available = DogeChat.getAvailableRedPackets(player);
    const body = ListFormInfo(
      available.length > 0 ? [`\u6709 ${available.length} \u4E2A\u7EA2\u5305\u53EF\u9886\u53D6`] : ["\u6682\u65E0\u53EF\u7528\u7EA2\u5305"]
    );
    const form = Gui.simpleForm("\u7EA2\u5305", body);
    form.button("\u53D1\u9001\u7EA2\u5305");
    if (available.length > 0) form.button("\u9886\u53D6\u7EA2\u5305");
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u7EA2\u5305");
    if (res.canceled) return;
    const sel = res.selection;
    if (sel === 0) {
      await this.sendRedPacketDialog(player);
    } else if (available.length > 0 && sel === 1) {
      await this.claimRedPacketDialog(player, available);
    }
  }
  static async sendRedPacketDialog(player) {
    const form = Gui.modalForm("\u53D1\u9001\u7EA2\u5305");
    form.textField("\u91D1\u989D", "\u8F93\u5165\u7EA2\u5305\u603B\u91D1\u989D");
    form.textField("\u4EFD\u6570", "\u8F93\u5165\u7EA2\u5305\u4EFD\u6570");
    form.dropdown("\u76EE\u6807\u7C7B\u578B", ["\u5F53\u524D\u9891\u9053", "\u6307\u5B9A\u73A9\u5BB6"]);
    form.textField("\u76EE\u6807\u73A9\u5BB6\u540D\uFF08\u6307\u5B9A\u73A9\u5BB6\u65F6\u586B\u5199\uFF09", "\u7559\u7A7A\u5219\u53D1\u5230\u5F53\u524D\u9891\u9053");
    const res = await Gui.showForm(player, form, "\u53D1\u9001\u7EA2\u5305");
    if (res.canceled) return;
    const vals = res.formValues;
    const amount = parseInt(vals[0]);
    const count = parseInt(vals[1]);
    const targetTypeIdx = vals[2];
    const targetPlayer = vals[3].trim();
    if (isNaN(amount) || isNaN(count) || amount <= 0 || count <= 0) {
      Msg.error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u548C\u4EFD\u6570\u3002", player);
      return;
    }
    if (targetTypeIdx === 0) {
      const active = DogeChat.getActiveChannel(player);
      DogeChat.sendRedPacket(player, amount, count, "group", active.id);
    } else {
      const target = player.dimension.getPlayers().find((p) => p.name === targetPlayer);
      if (!target) {
        Msg.error(`\u73A9\u5BB6 "${targetPlayer}" \u4E0D\u5728\u7EBF\u3002`, player);
        return;
      }
      DogeChat.sendRedPacket(player, amount, count, "player", target.id);
    }
  }
  static async claimRedPacketDialog(player, packets) {
    const form = Gui.simpleForm("\u9886\u53D6\u7EA2\u5305", ListFormInfo([`\u53EF\u9886\u53D6 ${packets.length} \u4E2A\u7EA2\u5305`]));
    for (const p of packets) {
      form.button(`${p.senderName} \u7684\u7EA2\u5305 \xA77(${p.remainingAmount} \u5269\u4F59)`);
    }
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u9886\u53D6\u7EA2\u5305");
    if (res.canceled) return;
    const sel = res.selection;
    if (sel >= packets.length) return;
    DogeChat.claimRedPacket(player, packets[sel].id);
  }
  // ============== 快捷指令：定位 / 传送 / 红包 ==============
  /** !lo — 发送定位到当前频道 */
  static async sendLocation(player) {
    const channel = DogeChat.getActiveChannel(player);
    const loc2 = DogeChat.createLocationMessage(player);
    await DogeChat.sendChannelMessage(player, channel.id, loc2, "location");
  }
  /** !tp — 发送传送邀请 */
  static async sendTeleportInvite(player) {
    const channel = DogeChat.getActiveChannel(player);
    if (channel.config.isBroadcast && !DogeChat.isChannelOwner(player, channel.id)) {
      Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002", player);
      return;
    }
    if (channel.type === "private") {
      const otherid = DogeChat.getPrivateOther(channel.id, player.id);
      if (!otherid) {
        Msg.error("\u65E0\u6CD5\u627E\u5230\u79C1\u804A\u5BF9\u8C61\u3002", player);
        return;
      }
      const target = world11.getPlayers().find((p) => p.id === otherid);
      if (!target) {
        Msg.error("\u5BF9\u65B9\u4E0D\u5728\u7EBF\u3002", player);
        return;
      }
      DogeChat.sendTeleportInvite(player, target);
      return;
    }
    const online = world11.getPlayers().filter((p) => p.id !== player.id);
    if (online.length === 0) {
      Msg.info("\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u53EF\u9080\u8BF7\u3002", player);
      return;
    }
    const form = Gui.simpleForm("\u4F20\u9001\u9080\u8BF7", ListFormInfo(["\u9009\u62E9\u8981\u9080\u8BF7\u7684\u73A9\u5BB6"]));
    for (const p of online) form.button(p.name);
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u4F20\u9001\u9080\u8BF7");
    if (res.canceled) return;
    const sel = res.selection;
    if (sel >= online.length) return;
    DogeChat.sendTeleportInvite(player, online[sel]);
  }
  /** !hb — 发送红包（快捷指令，直接打开发送对话框） */
  static async sendRedPacketQuick(player) {
    const channel = DogeChat.getActiveChannel(player);
    if (channel.config.isBroadcast && !DogeChat.isChannelOwner(player, channel.id)) {
      Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002", player);
      return;
    }
    if (channel.type === "private") {
      const form = Gui.modalForm("\u53D1\u9001\u7EA2\u5305");
      form.textField("\u91D1\u989D", "\u8F93\u5165\u7EA2\u5305\u91D1\u989D");
      const res = await Gui.showForm(player, form, "\u53D1\u9001\u7EA2\u5305");
      if (res.canceled) return;
      const amount = parseInt(res.formValues[0]);
      if (isNaN(amount) || amount <= 0) {
        Msg.error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u3002", player);
        return;
      }
      const otherid = DogeChat.getPrivateOther(channel.id, player.id);
      if (!otherid) {
        Msg.error("\u65E0\u6CD5\u627E\u5230\u79C1\u804A\u5BF9\u8C61\u3002", player);
        return;
      }
      DogeChat.sendRedPacket(player, amount, 1, "player", otherid);
    } else {
      const form = Gui.modalForm("\u53D1\u9001\u7EA2\u5305");
      form.textField("\u91D1\u989D", "\u8F93\u5165\u7EA2\u5305\u603B\u91D1\u989D");
      form.textField("\u4EFD\u6570", "\u8F93\u5165\u7EA2\u5305\u4EFD\u6570");
      const res = await Gui.showForm(player, form, "\u53D1\u9001\u7EA2\u5305");
      if (res.canceled) return;
      const vals = res.formValues;
      const amount = parseInt(vals[0]);
      const count = parseInt(vals[1]);
      if (isNaN(amount) || isNaN(count) || amount <= 0 || count <= 0) {
        Msg.error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u548C\u4EFD\u6570\u3002", player);
        return;
      }
      DogeChat.sendRedPacket(player, amount, count, "group", channel.id);
    }
  }
};

// scripts/chat/ChatSystem.ts
var ChatSystem = class {
  static init() {
    Permission.register("chat.use", Permission.Any);
    Permission.register("chat.admin", Permission.OP);
    DogeChat.initChannels();
    registerSystemMsgHandler((player, text) => {
      DogeChat.sendSystemMessage(player, text);
    });
    world12.beforeEvents.chatSend.subscribe(async (event) => {
      const player = event.sender;
      const message = event.message;
      if (message.startsWith("!") || message.startsWith("\uFF01")) return;
      event.cancel = true;
      const channel = DogeChat.getActiveChannel(player);
      await DogeChat.sendChannelMessage(player, channel.id, message);
    });
    world12.afterEvents.playerJoin.subscribe((event) => {
      const player = world12.getEntity(event.playerId);
      system8.run(async () => {
        const channel = DogeChat.getActiveChannel(player);
        await DogeChat.loadChannelHistory(player, channel.id);
      });
    });
    this.registerCommands();
    system8.runInterval(() => {
      DogeChat.cleanupExpiredRedPackets();
    }, 6e3);
  }
  static registerCommands() {
    Command.register("channel", "chat.use", (player) => {
      if (player) ChatGUI.openChannelPanel(player);
    }, "\u9891\u9053\u7BA1\u7406 - \u5207\u6362/\u8BA2\u9605\u9891\u9053");
    Command.register("ch", "chat.use", async (player) => {
      if (!player) return;
      const next = DogeChat.cycleChannel(player);
      Msg.info(`\u5DF2\u5207\u6362\u5230\u9891\u9053: \xA7e${next.prefix}`, player);
      await DogeChat.loadChannelHistory(player, next.id);
    }, "\u5FEB\u901F\u5207\u6362\u9891\u9053");
    Command.register("msg", "chat.use", (player) => {
      if (player) ChatGUI.openPrivateChatPanel(player);
    }, "\u5FEB\u6377\u79C1\u804A");
    Command.register("lo", "chat.use", (player) => {
      if (player) ChatGUI.sendLocation(player);
    }, "\u53D1\u9001\u5F53\u524D\u4F4D\u7F6E\u5230\u5F53\u524D\u9891\u9053");
    Command.register("tp", "chat.use", (player) => {
      if (player) ChatGUI.sendTeleportInvite(player);
    }, "\u53D1\u9001\u4F20\u9001\u9080\u8BF7");
    Command.register("hongbao", "chat.use", (player) => {
      if (player) ChatGUI.openRedPacketPanel(player);
    }, "\u7EA2\u5305 - \u67E5\u770B/\u9886\u53D6\u7EA2\u5305");
    Command.register("hb", "chat.use", (player) => {
      if (player) ChatGUI.sendRedPacketQuick(player);
    }, "\u53D1\u9001\u7EA2\u5305");
  }
};

// scripts/doge/TPS.ts
import { system as system9, world as world13 } from "@minecraft/server";
var TPS = class _TPS {
  constructor() {
    this.tickTimes = [];
    this.MAX_SAMPLES = 100;
  }
  /**
   * @returns {TPS}
   */
  static getInstance() {
    if (!_TPS._instance) {
      _TPS._instance = new _TPS();
    }
    return _TPS._instance;
  }
  /**
   * 获取当前 TPS
   * @returns 保留两位小数的 TPS 值
   */
  getTPS() {
    if (this.tickTimes.length < 10) return 20;
    const elapsed = (this.tickTimes[this.tickTimes.length - 1] - this.tickTimes[0]) / 1e3;
    const tickCount = this.tickTimes.length - 1;
    const tps = tickCount / elapsed;
    return Math.round(Math.min(tps, 20) * 100) / 100;
  }
  /**
   * 获取 TPS 状态文本
   */
  getTPSStatus() {
    const tps = this.getTPS();
    let color;
    if (tps >= 19.5) color = "\xA7a";
    else if (tps >= 15) color = "\xA7e";
    else if (tps >= 10) color = "\xA76";
    else color = "\xA7c";
    return `\xA77[TPS] ${color}${tps} \xA77/ 20.00`;
  }
  init() {
    this.startRecord();
    this.registerCommands();
  }
  startRecord() {
    system9.runInterval(() => {
      this.tickTimes.push(Date.now());
      if (this.tickTimes.length > this.MAX_SAMPLES) {
        this.tickTimes.shift();
      }
    }, 1);
  }
  registerCommands() {
    Permission.register("tps.see", Permission.Any);
    Command.register(
      "tps",
      "tps.see",
      (player) => {
        const msg = this.getTPSStatus();
        if (player) {
          player.sendMessage(msg);
        } else {
          world13.sendMessage(msg);
        }
      },
      "\u67E5\u770B\u670D\u52A1\u5668 TPS"
    );
  }
};

// scripts/doge/OnlineTime.ts
import { system as system10, world as world14 } from "@minecraft/server";
var OnlineTime = class _OnlineTime {
  constructor() {
    // 缓存键名
    this.KEY_SESSION = "onlinetime:session";
    this.KEY_TODAY = "onlinetime:today";
    this.KEY_MONTH = "onlinetime:month";
    this.KEY_TOTAL = "onlinetime:total";
    this.KEY_LAST_DATE = "onlinetime:last_date";
    this.KEY_LAST_MONTH = "onlinetime:last_month";
  }
  /**
   * @returns {OnlineTime}
   */
  static getInstance() {
    if (!_OnlineTime._instance) {
      _OnlineTime._instance = new _OnlineTime();
    }
    return _OnlineTime._instance;
  }
  init() {
    this.registerEvents();
    this.startTick();
    this.registerCommands();
  }
  /**
   * 将秒数格式化为可读文本
   */
  formatTime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor(seconds % 86400 / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}\u5929`);
    if (h > 0) parts.push(`${h}\u65F6`);
    if (m > 0) parts.push(`${m}\u5206`);
    parts.push(`${s}\u79D2`);
    return parts.join("");
  }
  /**
   * 读取玩家的缓存属性，不存在时返回 0
   */
  getProp(player, key) {
    return Storage.playerGet(player, key, 0);
  }
  /**
   * 玩家进服时重置会话计数器
   */
  onPlayerJoin(player) {
    Storage.playerSet(player, this.KEY_SESSION, 0);
  }
  /**
   * 每秒为所有在线玩家增加时间
   * 使用 setThrottled 避免高频 HttpDB 写入，缓存实时更新
   */
  tickSecond() {
    const now = /* @__PURE__ */ new Date();
    const currentDate = now.getDate();
    const currentMonth = now.getMonth();
    for (const player of world14.getAllPlayers()) {
      if (this.getProp(player, this.KEY_LAST_DATE) !== currentDate) {
        Storage.playerSetThrottled(player, this.KEY_TODAY, 0);
        Storage.playerSetThrottled(player, this.KEY_LAST_DATE, currentDate);
      }
      if (this.getProp(player, this.KEY_LAST_MONTH) !== currentMonth) {
        Storage.playerSetThrottled(player, this.KEY_MONTH, 0);
        Storage.playerSetThrottled(player, this.KEY_LAST_MONTH, currentMonth);
      }
      Storage.playerSetThrottled(player, this.KEY_SESSION, this.getProp(player, this.KEY_SESSION) + 1);
      Storage.playerSetThrottled(player, this.KEY_TODAY, this.getProp(player, this.KEY_TODAY) + 1);
      Storage.playerSetThrottled(player, this.KEY_MONTH, this.getProp(player, this.KEY_MONTH) + 1);
      Storage.playerSetThrottled(player, this.KEY_TOTAL, this.getProp(player, this.KEY_TOTAL) + 1);
    }
  }
  registerEvents() {
    world14.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        this.onPlayerJoin(event.player);
      }
    });
  }
  startTick() {
    system10.runInterval(() => {
      this.tickSecond();
    }, 20);
  }
  registerCommands() {
    Permission.register("onlinetime.see", Permission.Any);
    Command.register(
      "onlinetime",
      "onlinetime.see",
      (player) => {
        if (!player) {
          world14.sendMessage("\xA7c\u8BE5\u6307\u4EE4\u5FC5\u987B\u7531\u73A9\u5BB6\u6267\u884C\u3002");
          return;
        }
        const session = this.getProp(player, this.KEY_SESSION);
        const today = this.getProp(player, this.KEY_TODAY);
        const month = this.getProp(player, this.KEY_MONTH);
        const total = this.getProp(player, this.KEY_TOTAL);
        Msg.info(
          `\u73A9\u5BB6 \xA7a${player.name}\xA7r \u7684\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1:
\xA7e\u672C\u6B21\u5728\u7EBF \xA7f${this.formatTime(session)}
\xA7e\u4ECA\u65E5\u5728\u7EBF \xA7f${this.formatTime(today)}
\xA7e\u672C\u6708\u5728\u7EBF \xA7f${this.formatTime(month)}
\xA7e\u603B\u5728\u7EBF \xA7f${this.formatTime(total)}
`,
          player
        );
      },
      "\u67E5\u770B\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1"
    );
  }
};

// scripts/area/CreativeArea.ts
import {
  system as system12,
  world as world16,
  GameMode as GameMode3,
  EntityInitializationCause as EntityInitializationCause2
} from "@minecraft/server";

// scripts/area/SurvivalArea.ts
import {
  system as system11,
  world as world15,
  GameMode as GameMode2
} from "@minecraft/server";
var SurvivalArea = class _SurvivalArea {
  constructor() {
    this.enable = true;
  }
  /**
   * @returns {SurvivalArea}
   */
  static getInstance() {
    if (!_SurvivalArea._instance) {
      _SurvivalArea._instance = new _SurvivalArea();
    }
    return _SurvivalArea._instance;
  }
  init() {
    Permission.register("survivalarea.gamemode.bypass", Permission.OP);
    this.registerEvents();
  }
  inCreativeArea(entity) {
    for (const area of Config.creativeArea) {
      if (entity.dimension.id === area.dimension) {
        if (pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
          return true;
        }
      }
    }
    return false;
  }
  forceSurvival(player) {
    player.setGameMode(GameMode2.Survival);
    player.sendMessage("\xA7c\u5DF2\u79BB\u5F00\u521B\u9020\u533A\u57DF\uFF0C\u5F3A\u5236\u5207\u6362\u4E3A\u751F\u5B58\u6A21\u5F0F\u3002");
  }
  registerEvents() {
    world15.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      if (!CreativeArea.enable) return;
      if (!this.enable) return;
      const player = event.player;
      const mode = player.getGameMode();
      if (mode === GameMode2.Survival || mode === GameMode2.Adventure) return;
      system11.runTimeout(() => {
        if (!this.inCreativeArea(player)) {
          this.forceSurvival(player);
        }
      }, 60);
    });
    world15.beforeEvents.playerGameModeChange.subscribe((event) => {
      if (!CreativeArea.enable) return;
      if (!this.enable) return;
      if (event.toGameMode === GameMode2.Creative || event.toGameMode === GameMode2.Spectator) {
        if (Permission.check(event.player, "survivalarea.gamemode.bypass")) return;
        if (!this.inCreativeArea(event.player)) {
          event.cancel = true;
          event.player.sendMessage("\xA7c\u4F60\u5F53\u524D\u4E0D\u5728\u521B\u9020\u533A\u57DF\u5185\uFF0C\u65E0\u6CD5\u5207\u6362\u5230\u8BE5\u6A21\u5F0F\u3002");
        }
      }
    });
    world15.afterEvents.playerDimensionChange.subscribe((event) => {
      if (!CreativeArea.enable) return;
      if (!this.enable) return;
      const player = event.player;
      const mode = player.getGameMode();
      if (mode === GameMode2.Survival || mode === GameMode2.Adventure) return;
      system11.runTimeout(() => {
        if (!this.inCreativeArea(player)) {
          this.forceSurvival(player);
        }
      }, 10);
    });
  }
};

// scripts/area/CreativeArea.ts
var CreativeArea = class _CreativeArea {
  constructor() {
    this.BORDER_THRESHOLD = 10;
    this.BORDER_WARNING_DISTANCE = 5;
    this.BUFFER_ZONE = 3;
  }
  static getInstance() {
    if (!_CreativeArea._instance) {
      _CreativeArea._instance = new _CreativeArea();
    }
    return _CreativeArea._instance;
  }
  static {
    /** 连锁开关（同时控制 CreativeArea + SurvivalArea） */
    this.enable = true;
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
        if (pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
          return area.name;
        }
      }
    }
    return void 0;
  }
  inAreaByPos(x, z, dimensionId) {
    for (const area of Config.creativeArea) {
      if (dimensionId === area.dimension) {
        if (pointInArea_2D(x, z, area.start[0], area.start[1], area.end[0], area.end[1])) {
          return true;
        }
      }
    }
    return false;
  }
  isNearBorder(entity, threshold = this.BORDER_THRESHOLD) {
    for (const area of Config.creativeArea) {
      if (entity.dimension.id !== area.dimension) continue;
      const minX = Math.min(area.start[0], area.end[0]) - threshold;
      const maxX = Math.max(area.start[0], area.end[0]) + threshold;
      const minZ = Math.min(area.start[1], area.end[1]) - threshold;
      const maxZ = Math.max(area.start[1], area.end[1]) + threshold;
      if (entity.location.x >= minX && entity.location.x <= maxX && entity.location.z >= minZ && entity.location.z <= maxZ) return true;
    }
    return false;
  }
  inBufferZone(entity) {
    for (const area of Config.creativeArea) {
      if (entity.dimension.id !== area.dimension) continue;
      const minX = Math.min(area.start[0], area.end[0]);
      const maxX = Math.max(area.start[0], area.end[0]);
      const minZ = Math.min(area.start[1], area.end[1]);
      const maxZ = Math.max(area.start[1], area.end[1]);
      const x = entity.location.x, z = entity.location.z;
      const inExpanded = x >= minX - this.BUFFER_ZONE && x <= maxX + this.BUFFER_ZONE && z >= minZ - this.BUFFER_ZONE && z <= maxZ + this.BUFFER_ZONE;
      if (!inExpanded) continue;
      if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) continue;
      return true;
    }
    return false;
  }
  get creativeDims() {
    const dims = /* @__PURE__ */ new Set();
    for (const area of Config.creativeArea) dims.add(area.dimension);
    return dims;
  }
  // ==========================================
  //  进入 / 离开 处理（背包由 InventorySwitcher 接管）
  // ==========================================
  enterArea(player, areaName) {
    this.saveScores(player);
    player.setGameMode(GameMode3.Creative);
    Storage.playerSet(player, "creative:area_name", areaName);
    Msg.info(`\u8FDB\u5165 \xA7a${areaName}\u521B\u9020\u533A\u57DF\xA7r \uFF0C\u5207\u6362\u4E3A\u521B\u9020\u6A21\u5F0F\u3002`, player);
  }
  leaveArea(player, areaName) {
    this.restoreScores(player);
    player.setGameMode(GameMode3.Survival);
    Storage.playerDelete(player, "creative:area_name");
    Msg.info(`\u79BB\u5F00 \xA7a${areaName}\u521B\u9020\u533A\u57DF\xA7r \uFF0C\u6062\u590D\u751F\u5B58\u6A21\u5F0F\u3002`, player);
  }
  // ==========================================
  //  计分项保存 / 恢复
  // ==========================================
  saveScores(player) {
    const identity = player.scoreboardIdentity;
    if (!identity) return;
    const scores = {};
    for (const obj of world16.scoreboard.getObjectives()) {
      try {
        const score = obj.getScore(identity);
        if (score !== void 0) scores[obj.id] = score;
      } catch {
      }
    }
    if (Object.keys(scores).length > 0) {
      Storage.playerSet(player, "creative:scores", scores);
    }
  }
  restoreScores(player) {
    const scores = Storage.playerGet(player, "creative:scores", void 0);
    if (!scores) return;
    const identity = player.scoreboardIdentity;
    if (!identity) return;
    for (const obj of world16.scoreboard.getObjectives()) {
      if (scores[obj.id] !== void 0) {
        try {
          obj.setScore(identity, scores[obj.id]);
        } catch {
        }
      }
    }
    Storage.playerDelete(player, "creative:scores");
  }
  // ==========================================
  //  事件注册
  // ==========================================
  registerEvents() {
    world16.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system12.runTimeout(() => {
        const areaName = this.inArea(event.player);
        if (areaName !== void 0) {
          this.enterArea(event.player, areaName);
        } else if (event.player.getGameMode() === GameMode3.Creative || event.player.getGameMode() === GameMode3.Spectator) {
          event.player.setGameMode(GameMode3.Survival);
        }
      }, 60);
    });
    world16.afterEvents.playerDimensionChange.subscribe((event) => {
      if (!_CreativeArea.enable) return;
      system12.runTimeout(() => {
        const areaName = this.inArea(event.player);
        const currentArea = Storage.playerGet(event.player, "creative:area_name", void 0);
        if (currentArea === void 0 && areaName !== void 0) {
          this.enterArea(event.player, areaName);
        } else if (currentArea !== void 0 && areaName === void 0) {
          this.leaveArea(event.player, currentArea);
        }
      }, 10);
    });
    world16.afterEvents.entitySpawn.subscribe((event) => {
      if (!_CreativeArea.enable) return;
      if (!event.entity) return;
      if (event.entity.typeId === "minecraft:player") return;
      if (!this.creativeDims.has(event.entity.dimension.id)) return;
      try {
        if (event.cause === EntityInitializationCause2.Spawned) {
          if (this.inArea(event.entity) !== void 0 || this.inBufferZone(event.entity)) {
            event.entity.remove();
          }
        }
      } catch {
      }
    });
    world16.beforeEvents.playerPlaceBlock.subscribe((event) => {
      if (!_CreativeArea.enable) return;
      const player = event.player;
      if (player.getGameMode() !== GameMode3.Creative) return;
      if (!this.inAreaByPos(event.block.location.x, event.block.location.z, player.dimension.id)) {
        event.cancel = true;
        Msg.error(`\u4F60\u53EA\u80FD\u5728\u521B\u9020\u533A\u57DF\u5185\u653E\u7F6E\u65B9\u5757\u3002`, player);
        return;
      }
      if (Config.creativeBannedItems.indexOf(event.permutationToPlace.type.id) !== -1) {
        if (!Permission.check(player, "creativearea.place_banned")) {
          event.cancel = true;
          Msg.error(`\u521B\u9020\u533A\u57DF\u5185\u7981\u6B62\u653E\u7F6E ${event.permutationToPlace.type.id}\u3002`, player);
        }
      }
    });
    world16.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (!_CreativeArea.enable) return;
      if (event.player.getGameMode() !== GameMode3.Creative) return;
      if (!this.inAreaByPos(event.block.location.x, event.block.location.z, event.player.dimension.id)) {
        event.cancel = true;
        Msg.error(`\u4F60\u53EA\u80FD\u7834\u574F\u521B\u9020\u533A\u57DF\u5185\u7684\u65B9\u5757\u3002`, event.player);
      }
    });
  }
  // ==========================================
  //  定时扫描（进出检测）
  // ==========================================
  startTick() {
    system12.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world16.getPlayers()) {
        if (player.getGameMode() === GameMode3.Spectator) continue;
        const currentArea = Storage.playerGet(player, "creative:area_name", void 0);
        if (currentArea === void 0) {
          const areaName = this.inArea(player);
          if (areaName !== void 0) this.enterArea(player, areaName);
        } else {
          if (this.inArea(player) === void 0) this.leaveArea(player, currentArea);
        }
      }
    }, 10);
  }
  // ==========================================
  //  边界快速检测
  // ==========================================
  startBorderFastCheck() {
    system12.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world16.getPlayers()) {
        if (player.getGameMode() !== GameMode3.Creative) continue;
        if (!this.isNearBorder(player)) continue;
        const currentArea = Storage.playerGet(player, "creative:area_name", void 0);
        if (currentArea !== void 0 && this.inArea(player) === void 0) {
          this.leaveArea(player, currentArea);
        }
      }
    }, 2);
  }
  // ==========================================
  //  边界视觉警告
  // ==========================================
  startBorderWarning() {
    system12.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world16.getPlayers()) {
        for (const area of Config.creativeArea) {
          if (player.dimension.id !== area.dimension) continue;
          const pos = player.location;
          const minX = Math.min(area.start[0], area.end[0]);
          const maxX = Math.max(area.start[0], area.end[0]);
          const minZ = Math.min(area.start[1], area.end[1]);
          const maxZ = Math.max(area.start[1], area.end[1]);
          const d = this.BORDER_WARNING_DISTANCE;
          if (pos.x < minX - d || pos.x > maxX + d || pos.z < minZ - d || pos.z > maxZ + d) continue;
          const cx = Math.max(minX, Math.min(maxX, pos.x));
          const cz = Math.max(minZ, Math.min(maxZ, pos.z));
          let bx = cx, bz = cz;
          if (cx === pos.x && cz === pos.z) {
            const dx = Math.min(pos.x - minX, maxX - pos.x);
            const dz = Math.min(pos.z - minZ, maxZ - pos.z);
            if (dx < dz) bx = pos.x - minX < maxX - pos.x ? minX : maxX;
            else bz = pos.z - minZ < maxZ - pos.z ? minZ : maxZ;
          }
          const y = Math.floor(pos.y);
          try {
            for (let dy = -1; dy <= 2; dy++) {
              player.dimension.spawnParticle("minecraft:colored_flame_particle", { x: bx, y: y + dy, z: bz });
            }
          } catch {
          }
          break;
        }
      }
    }, 20);
  }
  // ==========================================
  //  指令
  // ==========================================
  registerCommands() {
    Permission.register("creativearea.toggle", Permission.OP);
    Permission.register("creativearea.place_banned", Permission.Admin);
    Command.register("creativearea", "creativearea.toggle", () => {
      _CreativeArea.enable = !_CreativeArea.enable;
      SurvivalArea.getInstance().enable = _CreativeArea.enable;
      return _CreativeArea.enable ? "\u533A\u57DF\u7CFB\u7EDF\u5DF2\u5F00\u542F" : "\u533A\u57DF\u7CFB\u7EDF\u5DF2\u5173\u95ED";
    }, "\u5F00\u5173\u533A\u57DF\u7CFB\u7EDF");
  }
};

// scripts/doge/InventorySwitcher.ts
import {
  system as system13,
  world as world17,
  GameMode as GameMode4,
  EquipmentSlot,
  BlockComponentTypes as BlockComponentTypes3
} from "@minecraft/server";
var InventorySwitcher = class _InventorySwitcher {
  static getInstance() {
    if (!_InventorySwitcher._instance) {
      _InventorySwitcher._instance = new _InventorySwitcher();
    }
    return _InventorySwitcher._instance;
  }
  init() {
    this.registerEvents();
  }
  /**
   * 获取该索引对应的布局（左箱/右箱/告示牌位置），使用 Tools 工具
   */
  getLayout(index) {
    const cfg = Config.inventoryChest;
    const mainAxis = Math.floor(index / cfg.size[1]);
    const yOffset = index % cfg.size[1];
    return getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
  }
  /**
   * 获取玩家的箱子索引
   * 每个玩家占 2 个连续索引：survival = base * 2, creative = base * 2 + 1
   */
  getChestIndex(playerId2, forCreative) {
    const key = `invswitcher:player_${playerId2}`;
    let base = Storage.get(key, void 0);
    if (base === void 0) {
      let next = Storage.get("invswitcher:next_index", 0);
      const max = Config.inventoryChest.size[0] - 2;
      if (next > max) next = 0;
      base = next;
      Storage.set(key, base);
      Storage.set("invswitcher:next_index", base + 2);
    }
    return base * 2 + (forCreative ? 1 : 0);
  }
  /**
   * 将玩家背包存入指定箱子
   */
  saveToChest(player, forCreative) {
    const cfg = Config.inventoryChest;
    const dim = world17.getDimension("minecraft:overworld");
    const { left, sign } = this.getLayout(this.getChestIndex(player.id, forCreative));
    ensureDoubleChest(dim, left, getChestCardinal(cfg.direction, cfg.face), cfg.direction);
    const { date, time } = getShanghaiTime();
    placeSign(
      dim,
      sign,
      getSignFacing(cfg.direction, cfg.face),
      `${player.nameTag}
${forCreative ? "Creative" : "Survival"}
${date}
${time}`
    );
    const block = dim.getBlock(left);
    if (!block) return;
    const invComp = block.getComponent(BlockComponentTypes3.Inventory);
    if (!invComp?.container) return;
    const container = invComp.container;
    for (let i = 0; i < container.size; i++) container.setItem(i, void 0);
    const playerInv = player.getComponent("inventory");
    if (playerInv?.container) {
      for (let i = 0; i < playerInv.container.size && i < 36; i++) {
        const item = playerInv.container.getItem(i);
        if (item) {
          playerInv.container.setItem(i, void 0);
          container.setItem(i, item);
        }
      }
    }
    const eq = player.getComponent("equippable");
    if (eq) {
      for (const [ai, slot] of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet].entries()) {
        const item = eq.getEquipment(slot);
        if (item) {
          eq.setEquipment(slot, void 0);
          container.setItem(36 + ai, item);
        }
      }
      const offhand = eq.getEquipment(EquipmentSlot.Offhand);
      if (offhand) {
        eq.setEquipment(EquipmentSlot.Offhand, void 0);
        container.setItem(40, offhand);
      }
    }
  }
  /**
   * 从指定箱子恢复玩家背包
   */
  restoreFromChest(player, forCreative) {
    const cfg = Config.inventoryChest;
    const dim = world17.getDimension("minecraft:overworld");
    const { left } = this.getLayout(this.getChestIndex(player.id, forCreative));
    ensureDoubleChest(dim, left, getChestCardinal(cfg.direction, cfg.face), cfg.direction);
    const block = dim.getBlock(left);
    if (!block) return;
    const invComp = block.getComponent(BlockComponentTypes3.Inventory);
    if (!invComp?.container) return;
    const container = invComp.container;
    const playerInv = player.getComponent("inventory");
    if (playerInv?.container) {
      for (let i = 0; i < playerInv.container.size; i++) playerInv.container.setItem(i, void 0);
    }
    const eq = player.getComponent("equippable");
    if (eq) {
      eq.setEquipment(EquipmentSlot.Head, void 0);
      eq.setEquipment(EquipmentSlot.Chest, void 0);
      eq.setEquipment(EquipmentSlot.Legs, void 0);
      eq.setEquipment(EquipmentSlot.Feet, void 0);
      eq.setEquipment(EquipmentSlot.Offhand, void 0);
    }
    if (playerInv?.container) {
      for (let i = 0; i < 36; i++) {
        const item = container.getItem(i);
        if (item) {
          container.setItem(i, void 0);
          playerInv.container.setItem(i, item);
        }
      }
    }
    if (eq) {
      for (const [ai, slot] of [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet].entries()) {
        const item = container.getItem(36 + ai);
        if (item) {
          container.setItem(36 + ai, void 0);
          eq.setEquipment(slot, item);
        }
      }
      const offhand = container.getItem(40);
      if (offhand) {
        container.setItem(40, void 0);
        eq.setEquipment(EquipmentSlot.Offhand, offhand);
      }
    }
  }
  // ==========================================
  //  模式切换拦截
  // ==========================================
  registerEvents() {
    world17.afterEvents.playerGameModeChange.subscribe((event) => {
      const player = event.player;
      system13.run(() => {
        if (player.getGameMode() !== event.toGameMode) return;
        if (event.fromGameMode === GameMode4.Survival && event.toGameMode === GameMode4.Creative) {
          this.saveToChest(player, false);
          this.restoreFromChest(player, true);
        } else if (event.fromGameMode === GameMode4.Creative && event.toGameMode === GameMode4.Survival) {
          this.saveToChest(player, true);
          this.restoreFromChest(player, false);
        }
      });
    });
  }
};

// scripts/land/LandDatabase.ts
var DEFAULT_CONFIG = {
  priceFormula: "{square}*8+{height}*20",
  maxLandsPerPlayer: 5,
  minSquare: 4,
  maxSquare: 5e4,
  discount: 1,
  refundRate: 0.7
};
var DEFAULT_PERMISSIONS = {
  allow_place: false,
  allow_destroy: false,
  attack_entity: false,
  open_container: false
};
var Database2 = class {
  static {
    this.KEY_CONFIG = "land:config";
  }
  static {
    this.KEY_REGISTRY = "land:registry";
  }
  static {
    /** 运行时缓存 */
    this._config = null;
  }
  static {
    this._registry = null;
  }
  static {
    // landId → LandData
    this._ownerIndex = null;
  }
  // plid → landId[]
  // ── 内部工具 ──
  static readJSON(key, fallback) {
    return Storage.get(key, fallback);
  }
  static writeJSON(key, value) {
    Storage.set(key, value);
  }
  /** 重建 owner 索引 */
  static rebuildOwnerIndex() {
    this._ownerIndex = /* @__PURE__ */ new Map();
    if (!this._registry) return;
    for (const [, land] of this._registry) {
      const list = this._ownerIndex.get(land.ownerplid) || [];
      list.push(land.id);
      this._ownerIndex.set(land.ownerplid, list);
    }
  }
  // ── 配置 ──
  static getConfig() {
    if (this._config) return this._config;
    this._config = this.readJSON(this.KEY_CONFIG, { ...DEFAULT_CONFIG });
    return this._config;
  }
  static saveConfig(cfg) {
    this._config = cfg;
    this.writeJSON(this.KEY_CONFIG, cfg);
  }
  // ── 土地数据 ──
  /** 确保 registry 已加载 */
  static ensureLoaded() {
    if (this._registry) return;
    const raw = this.readJSON(this.KEY_REGISTRY, {});
    this._registry = new Map(Object.entries(raw));
    this.rebuildOwnerIndex();
  }
  /** 将 registry 序列化写入数据库中 */
  static flush() {
    if (!this._registry) return;
    const obj = {};
    for (const [id, data2] of this._registry) {
      obj[id] = data2;
    }
    this.writeJSON(this.KEY_REGISTRY, obj);
  }
  /** 获取所有土地 */
  static getAll() {
    this.ensureLoaded();
    return Array.from(this._registry.values());
  }
  /** 根据 ID 获取土地 */
  static getById(landId) {
    this.ensureLoaded();
    return this._registry.get(landId);
  }
  /** 获取玩家所有土地 ID */
  static getByOwner(plid) {
    this.ensureLoaded();
    return this._ownerIndex.get(plid) || [];
  }
  /** 生成唯一土地 ID */
  static generateId() {
    return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  /** 添加土地 */
  static add(land) {
    this.ensureLoaded();
    this._registry.set(land.id, land);
    const list = this._ownerIndex.get(land.ownerplid) || [];
    list.push(land.id);
    this._ownerIndex.set(land.ownerplid, list);
    this.flush();
  }
  /** 更新土地 */
  static update(land) {
    this.ensureLoaded();
    this._registry.set(land.id, land);
    this.flush();
  }
  /** 删除土地 */
  static delete(landId) {
    this.ensureLoaded();
    const land = this._registry.get(landId);
    if (!land) return;
    this._registry.delete(landId);
    const list = this._ownerIndex.get(land.ownerplid) || [];
    const idx = list.indexOf(landId);
    if (idx !== -1) list.splice(idx, 1);
    this._ownerIndex.set(land.ownerplid, list);
    this.flush();
  }
  /** 获取玩家的土地数量 */
  static getPlayerLandCount(plid) {
    return this.getByOwner(plid).length;
  }
  // ── 辅助工具 ──
  /** 创建新的土地数据对象（不含 id 和创建时间） */
  static createLandData(ownerplid, ownerName, dimid, posA, posB) {
    return {
      id: this.generateId(),
      ownerplid,
      ownerName,
      managers: [ownerplid],
      dimid,
      posA,
      posB,
      permissions: { ...DEFAULT_PERMISSIONS },
      nickname: "",
      createdAt: Date.now()
    };
  }
  /** 默认权限对象 */
  static getDefaultPermissions() {
    return { ...DEFAULT_PERMISSIONS };
  }
  /** 默认配置对象 */
  static getDefaultConfig() {
    return { ...DEFAULT_CONFIG };
  }
};

// scripts/land/LandCore.ts
var LandCore = class {
  static {
    /** 玩家会话：plid → { pos1, pos2 } */
    this.sessions = /* @__PURE__ */ new Map();
  }
  // ── 会话管理 ──
  /**
   * @description 获取玩家会话
   * @param plid 玩家 ID
   * @returns 玩家会话或 undefined
   */
  static getSession(plid) {
    return this.sessions.get(plid);
  }
  /**
   * @description 初始化玩家会话
   * @param plid 玩家 ID
   * @returns 是否成功初始化会话资源
   */
  static initSession(plid) {
    return this.sessions.set(plid, {}) ? true : false;
  }
  /**
   * @description 设置玩家会话中土地的第一点
   * @param plid 玩家 ID
   * @param pos 第一点坐标
   * @returns 玩家会话或 undefined
   */
  static setPos1(plid, pos) {
    let s = this.getSession(plid);
    if (s) {
      s.pos1 = pos;
      this.sessions.set(plid, s);
    }
    return s;
  }
  /**
   * @description 设置玩家会话中土地的第二点
   * @param plid 玩家 ID
   * @param pos 第二点坐标
   * @returns 玩家会话或 undefined
   */
  static setPos2(plid, pos) {
    let s = this.getSession(plid);
    if (s) {
      s.pos2 = pos;
      this.sessions.set(plid, s);
    }
    return s;
  }
  /**
   * @description 释放玩家会话
   * @param plid 玩家 ID
   * @returns 是否成功释放会话资源
   */
  static clearSession(plid) {
    return this.sessions.delete(plid);
  }
  /**
   * @description 判断玩家会话中土地是否有第一点和第二点
   * @param plid 玩家 ID
   * @returns 是否有第一点和第二点坐标
   */
  static hasBothPos(plid) {
    const s = this.sessions.get(plid);
    return !!s && !!s.pos1 && !!s.pos2;
  }
  // ── 方块信息计算 ──
  /** 标准化坐标：确保 posA 是 min 角，posB 是 max 角 */
  static normalize(posA, posB) {
    return {
      posA: {
        x: Math.min(posA.x, posB.x),
        y: Math.min(posA.y, posB.y),
        z: Math.min(posA.z, posB.z)
      },
      posB: {
        x: Math.max(posA.x, posB.x),
        y: Math.max(posA.y, posB.y),
        z: Math.max(posA.z, posB.z)
      }
    };
  }
  /** 获取立方体信息 */
  static getCubeInfo(posA, posB) {
    const n = this.normalize(posA, posB);
    const w = n.posB.x - n.posA.x + 1;
    const h = n.posB.y - n.posA.y + 1;
    const l = n.posB.z - n.posA.z + 1;
    return {
      length: l,
      width: w,
      height: h,
      square: w * l,
      volume: w * h * l
    };
  }
  /** 计算维度名 */
  static getDimensionName(dimid) {
    return ["\u4E3B\u4E16\u754C", "\u5730\u72F1", "\u672B\u5730"][dimid] ?? "\u672A\u77E5";
  }
  // ── 价格计算 ──
  /** 解析公式并计算价格 */
  static calculatePrice(posA, posB) {
    const cfg = Database2.getConfig();
    const info = this.getCubeInfo(posA, posB);
    const formula = cfg.priceFormula;
    let expr = formula.replace(/\{square\}/g, String(info.square)).replace(/\{height\}/g, String(info.height)).replace(/\{length\}/g, String(info.length)).replace(/\{width\}/g, String(info.width)).replace(/\{volume\}/g, String(info.volume));
    let price;
    try {
      price = Function(`"use strict"; return (${expr});`)();
    } catch {
      price = info.square * 8 + info.height * 20;
    }
    price = Math.max(0, Math.floor(price * cfg.discount));
    return price;
  }
  // ── 土地查询 ──
  /** 判断某点是否在土地范围内 */
  static isPosInLand(pos, dimid, land) {
    if (land.dimid !== dimid) return false;
    const n = this.normalize(land.posA, land.posB);
    return pos.x >= n.posA.x && pos.x <= n.posB.x && pos.y >= n.posA.y && pos.y <= n.posB.y && pos.z >= n.posA.z && pos.z <= n.posB.z;
  }
  /** 获取某位置所在的土地 */
  static getLandByPos(pos, dimid) {
    if (!pos || dimid === void 0) return void 0;
    return Database2.getAll().find((land) => this.isPosInLand(pos, dimid, land));
  }
  /** 获取玩家拥有的所有土地 */
  static getPlayerLands(plid) {
    const ids = Database2.getByOwner(plid);
    return ids.map((id) => Database2.getById(id)).filter((l) => !!l);
  }
  // ── 验证 ──
  /** 验证创建条件 */
  static validateCreation(player, posA, posB, dimid) {
    const plid = player.id;
    const cfg = Database2.getConfig();
    const info = this.getCubeInfo(posA, posB);
    if (!posA || !posB) {
      return { ok: false, msg: "\xA7c\u8BF7\u5148\u4F7F\u7528 !pos1 \u548C !pos2 \u547D\u4EE4\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002" };
    }
    if (info.square < cfg.minSquare) {
      return { ok: false, msg: `\xA7c\u571F\u5730\u9762\u79EF\u8FC7\u5C0F\uFF01
\u6700\u5C0F\u9762\u79EF\u4E3A ${cfg.minSquare} \u683C\u3002` };
    }
    if (info.square > cfg.maxSquare) {
      return { ok: false, msg: `\xA7c\u571F\u5730\u9762\u79EF\u8FC7\u5927\uFF01
\u6700\u5927\u9762\u79EF\u4E3A ${cfg.maxSquare} \u683C\u3002` };
    }
    const allLands = Database2.getAll();
    const candidates = allLands.filter((l) => l.dimid === dimid);
    for (const land of candidates) {
      if (this.cubesOverlap(
        this.normalize(posA, posB),
        { posA: land.posA, posB: land.posB }
      )) {
        return { ok: false, msg: "\xA7c\u8BE5\u533A\u57DF\u4E0E\u5176\u4ED6\u571F\u5730\u91CD\u53E0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002" };
      }
    }
    const count = Database2.getPlayerLandCount(plid);
    if (count >= cfg.maxLandsPerPlayer) {
      return { ok: false, msg: `\xA7c\u60A8\u5DF2\u8FBE\u5230\u6301\u6709\u571F\u5730\u4E0A\u9650\uFF08${cfg.maxLandsPerPlayer} \u5757\uFF09\uFF01` };
    }
    const price = this.calculatePrice(posA, posB);
    const balance = Money.get(player);
    if (balance < price) {
      return { ok: false, msg: `\xA7c${Money.UNIT}\u4E0D\u8DB3\uFF01
\u9700\u8981 \xA7e${price} \xA7c${Money.UNIT}\uFF0C\u800C\u5F53\u524D\u6301\u6709 \xA7e${balance} \xA7c${Money.UNIT}\u3002` };
    }
    return { ok: true };
  }
  /** 判断两个立方体是否重叠 */
  static cubesOverlap(a, b) {
    return a.posA.x <= b.posB.x && a.posB.x >= b.posA.x && a.posA.y <= b.posB.y && a.posB.y >= b.posA.y && a.posA.z <= b.posB.z && a.posB.z >= b.posA.z;
  }
  // ── 创建/删除 ──
  /** 创建土地（已通过验证后调用） */
  static createLand(player, posA, posB, dimid) {
    const plid = player.id;
    const n = this.normalize(posA, posB);
    const price = this.calculatePrice(n.posA, n.posB);
    const balance = Money.get(player);
    const land = Database2.createLandData(plid, player.name, dimid, n.posA, n.posB);
    Database2.add(land);
    Money.set(player, balance - price);
    this.clearSession(plid);
    return land;
  }
  /** 删除土地（拥有者/管理员） */
  static deleteLand(landId, player) {
    const land = Database2.getById(landId);
    if (!land) return false;
    if (land.ownerplid !== player.id && !land.managers.includes(player.id)) {
      return false;
    }
    const cfg = Database2.getConfig();
    const price = this.calculatePrice(land.posA, land.posB);
    const refund = Math.floor(price * cfg.refundRate);
    Database2.delete(landId);
    Money.add(player, refund);
    return true;
  }
  /** 检查玩家是否为土地的管理者 */
  static isManager(land, plid) {
    return land.managers.includes(plid);
  }
  /** 检查玩家是否为土地的拥有者 */
  static isOwner(land, plid) {
    return land.ownerplid === plid;
  }
  /** 检查玩家是否对该土地有完全管理权（拥有者或全局管理员） */
  static isOwnerOrManager(land, plid) {
    return this.isOwner(land, plid) || this.isManager(land, plid);
  }
  // ── 格式化显示 ──
  /** 格式化土地信息文本 */
  static formatLandInfo(posA, posB, dimid) {
    const n = this.normalize(posA, posB);
    const info = this.getCubeInfo(n.posA, n.posB);
    const price = this.calculatePrice(n.posA, n.posB);
    return [
      `[*] \u571F\u5730\u4FE1\u606F\uFF1A`,
      `  - \xA7l\u7EF4\u5EA6: \xA7r${this.getDimensionName(dimid)}`,
      `  - \xA7l\u8D77\u70B9: \xA7r(${n.posA.x}, ${n.posA.y}, ${n.posA.z})`,
      `  - \xA7l\u7EC8\u70B9: \xA7r(${n.posB.x}, ${n.posB.y}, ${n.posB.z})`,
      `  - \xA7l\u9762\u79EF: \xA7r${info.square} \u683C`,
      `  - \xA7l\u4F53\u79EF: \xA7r${info.volume} \u683C`,
      `  - \xA7l\u4EF7\u683C: \xA7r${price} ${Money.UNIT}`
    ].join("\n");
  }
};

// scripts/gui/LandGUI.ts
import { world as world18 } from "@minecraft/server";
import { ActionFormData as ActionFormData2, ModalFormData as ModalFormData2 } from "@minecraft/server-ui";
var LandGUI = class {
  /** !land 入口：按状态分发 */
  static showMainMenu(player) {
    const id = player.id;
    const session = LandCore.getSession(id);
    if (session) {
      this.showStateDialog(player);
    } else {
      this.showHomeMenu(player);
    }
  }
  // ══════════════════════════════════════
  //  主菜单
  // ══════════════════════════════════════
  static showHomeMenu(player) {
    const plid = player.id;
    const lands = LandCore.getPlayerLands(plid);
    const landCount = lands.length;
    const body = [`\u5F53\u524D\u62E5\u6709 \xA7e${landCount}\xA7r \u5757\u571F\u5730\u3002`];
    const form = new ActionFormData2().title("\u571F\u5730").body(ListFormInfo(body)).button("\u7533\u8BF7\u571F\u5730", "textures/ui/icon_iron_pickaxe");
    if (landCount > 0) {
      form.button("\u6211\u7684\u571F\u5730", "textures/ui/World");
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u571F\u5730").then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) {
        this.startApplication(player);
      } else if (landCount > 0 && res.selection === 1) {
        this.showLandList(player);
      }
    });
  }
  // ══════════════════════════════════════
  //  土地列表
  // ══════════════════════════════════════
  static showLandList(player) {
    const plid = player.id;
    const lands = LandCore.getPlayerLands(plid);
    if (lands.length === 0) {
      Msg.info("\u4F60\u8FD8\u6CA1\u6709\u4EFB\u4F55\u571F\u5730\u3002", player);
      return;
    }
    const form = new ActionFormData2().title("\u6211\u7684\u571F\u5730").body(ListFormInfo([
      `\u5F53\u524D\u62E5\u6709 \xA7e${lands.length}\xA7r \u5757\u571F\u5730\u3002`
    ]));
    for (const land of lands) {
      const name = land.nickname || land.id;
      const info = LandCore.getCubeInfo(land.posA, land.posB);
      form.button(`${name}
${info.square} \u683C | ${LandCore.getDimensionName(land.dimid)}`);
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u6211\u7684\u571F\u5730").then((res) => {
      if (res.canceled) return;
      if (res.selection < lands.length) {
        this.showLandManage(player, lands[res.selection]);
      }
    });
  }
  // ══════════════════════════════════════
  //  土地管理面板
  // ══════════════════════════════════════
  static showLandManage(player, land) {
    const plid = player.id;
    const isOwner = LandCore.isOwner(land, plid);
    const isMgr = LandCore.isManager(land, plid);
    const canManage = isOwner || isMgr;
    const name = land.nickname || land.id;
    const info = LandCore.getCubeInfo(land.posA, land.posB);
    const ownerName = land.ownerName || "\xA77\u672A\u77E5\xA7r";
    let body = [
      `\u571F\u5730\u4FE1\u606F\uFF1A`,
      `  \xA77- \u571F\u5730\u540D\u79F0: \xA7r${name}\xA77(${land.id})`,
      `  \xA77- \u62E5\u6709\u8005: \xA7r${ownerName}`,
      `  \xA77- \u9762\u79EF: \xA7r ${info.square}\xA77 \u683C | \u4F53\u79EF: \xA7r ${info.volume} \xA77\u683C`,
      `  \xA77- \u7EF4\u5EA6: \xA7r${LandCore.getDimensionName(land.dimid)}`,
      `  \xA77- \u7BA1\u7406\u8005: \xA7r${land.managers.length} \u4EBA`
    ];
    if (!canManage) {
      body.push("\u4F60\u6CA1\u6709\u6743\u9650\u7BA1\u7406\u6B64\u571F\u5730\u3002");
      Msg.info(body.join("\n"), player);
      return;
    }
    const form = new ActionFormData2().title("\u571F\u5730\u7BA1\u7406").body(ListFormInfo(body)).button("\u571F\u5730\u4FDD\u62A4", "textures/ui/icon_lock").button("\u7BA1\u7406\u8005\u7BA1\u7406", "textures/ui/icon_multiplayer").button("\u8BBE\u7F6E\u540D\u79F0", "textures/ui/icon_edit").button("\u5220\u9664\u571F\u5730", "textures/ui/icon_trash").button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u571F\u5730\u7BA1\u7406").then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          this.showPermEditor(player, land);
          break;
        case 1:
          this.showManagerEditor(player, land);
          break;
        case 2:
          this.showRenameDialog(player, land);
          break;
        case 3:
          this.showDeleteConfirm(player, land);
          break;
      }
    });
  }
  // ══════════════════════════════════════
  //  权限设置
  // ══════════════════════════════════════
  static showPermEditor(player, land) {
    const cfg = Database2.getDefaultPermissions();
    const perm = land.permissions;
    const form = new ModalFormData2().title("\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E").label(ListFormInfo([])).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u653E\u7F6E\u65B9\u5757`, { defaultValue: perm.allow_place }).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u7834\u574F\u65B9\u5757`, { defaultValue: perm.allow_destroy }).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u653B\u51FB\u5B9E\u4F53`, { defaultValue: perm.attack_entity }).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u6253\u5F00\u5BB9\u5668`, { defaultValue: perm.open_container });
    Gui.showForm(player, form, "\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E").then((res) => {
      if (res.canceled) return;
      const vals = res.formValues;
      land.permissions.allow_place = vals[0];
      land.permissions.allow_destroy = vals[1];
      land.permissions.attack_entity = vals[2];
      land.permissions.open_container = vals[3];
      Database2.update(land);
      Msg.success("\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E\u5DF2\u66F4\u65B0\u3002", player);
    });
  }
  // ══════════════════════════════════════
  //  管理者管理
  // ══════════════════════════════════════
  static showManagerEditor(player, land) {
    const plid = player.id;
    const isOwner = LandCore.isOwner(land, plid);
    const body = [
      "\u5F53\u524D\u7BA1\u7406\u8005\uFF1A",
      ...land.managers.map((m) => {
        if (m === land.ownerplid) return `  - ${land.ownerName} (\u62E5\u6709\u8005)`;
        const p = world18.getPlayers().find((pl) => pl.id === m);
        return p ? `  - ${p.name}` : `  - ${m.substring(0, 8)}...`;
      })
    ];
    const form = new ActionFormData2().title("\u7BA1\u7406\u8005\u7BA1\u7406").body(ListFormInfo(body)).button("\u6DFB\u52A0\u7BA1\u7406\u8005");
    if (isOwner && land.managers.length > 1) {
      form.button("\u79FB\u9664\u7BA1\u7406\u8005");
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u7BA1\u7406\u8005\u7BA1\u7406").then((res) => {
      if (res.canceled) return;
      if (res.selection === 0) {
        this.showAddManager(player, land);
      } else if (isOwner && land.managers.length > 1 && res.selection === 1) {
        this.showRemoveManager(player, land);
      }
    });
  }
  static showAddManager(player, land) {
    const plid = player.id;
    const online = world18.getPlayers().filter((p) => p.id !== plid && !land.managers.includes(p.id));
    if (online.length === 0) {
      Msg.error("\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u5728\u7EBF\u73A9\u5BB6\u3002", player);
      return;
    }
    const form = new ActionFormData2().title("\u6DFB\u52A0\u7BA1\u7406\u8005").body(ListFormInfo(["\u9009\u62E9\u8981\u6DFB\u52A0\u4E3A\u7BA1\u7406\u8005\u7684\u73A9\u5BB6\u3002"]));
    for (const p of online) {
      form.button(p.name);
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u6DFB\u52A0\u7BA1\u7406\u8005").then((res) => {
      if (res.canceled) return;
      if (res.selection < online.length) {
        const target = online[res.selection];
        if (land.managers.includes(target.id)) {
          Msg.error("\u8BE5\u73A9\u5BB6\u5DF2\u7ECF\u662F\u7BA1\u7406\u8005\u3002", player);
          return;
        }
        land.managers.push(target.id);
        Database2.update(land);
        Msg.success(`\u5DF2\u5C06 ${target.name} \u6DFB\u52A0\u4E3A\u7BA1\u7406\u8005\u3002`, player);
      }
    });
  }
  static showRemoveManager(player, land) {
    const nonOwnerMgrs = land.managers.filter((m) => m !== land.ownerplid);
    if (nonOwnerMgrs.length === 0) {
      Msg.error("\u6CA1\u6709\u53EF\u79FB\u9664\u7684\u7BA1\u7406\u8005\u3002", player);
      return;
    }
    const form = new ActionFormData2().title("\u79FB\u9664\u7BA1\u7406\u8005").body(ListFormInfo(["\u9009\u62E9\u8981\u79FB\u9664\u7684\u7BA1\u7406\u8005\u3002"]));
    for (const m of nonOwnerMgrs) {
      const p = world18.getPlayers().find((pl) => pl.id === m);
      form.button(p ? p.name : m.substring(0, 8) + "...");
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u79FB\u9664\u7BA1\u7406\u8005").then((res) => {
      if (res.canceled) return;
      if (res.selection < nonOwnerMgrs.length) {
        const targetId = nonOwnerMgrs[res.selection];
        const idx = land.managers.indexOf(targetId);
        if (idx !== -1) {
          land.managers.splice(idx, 1);
          Database2.update(land);
          Msg.success("\u5DF2\u79FB\u9664\u8BE5\u7BA1\u7406\u8005\u3002", player);
        }
      }
    });
  }
  // ══════════════════════════════════════
  //  重命名
  // ══════════════════════════════════════
  static showRenameDialog(player, land) {
    const form = new ModalFormData2().title("\u8BBE\u7F6E\u571F\u5730\u540D\u79F0").textField("\u571F\u5730\u540D\u79F0", "\u8F93\u5165\u65B0\u540D\u79F0\uFF08\u7559\u7A7A\u6062\u590D\u9ED8\u8BA4\uFF09", { defaultValue: land.nickname });
    Gui.showForm(player, form, "\u8BBE\u7F6E\u571F\u5730\u540D\u79F0").then((res) => {
      if (res.canceled) return;
      const name = (res.formValues[0] || "").trim();
      land.nickname = name;
      Database2.update(land);
      Msg.success(name ? `\u571F\u5730\u5DF2\u91CD\u547D\u540D\u4E3A ${name}\u3002` : "\u571F\u5730\u540D\u79F0\u5DF2\u6062\u590D\u9ED8\u8BA4\u3002", player);
    });
  }
  // ══════════════════════════════════════
  //  删除土地
  // ══════════════════════════════════════
  static showDeleteConfirm(player, land) {
    const plid = player.id;
    if (!LandCore.isOwner(land, plid) && !LandCore.isManager(land, plid)) {
      Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5220\u9664\u6B64\u571F\u5730\u3002", player);
      return;
    }
    const price = LandCore.calculatePrice(land.posA, land.posB);
    const cfg = Database2.getConfig();
    const refund = Math.floor(price * cfg.refundRate);
    const name = land.nickname || land.id;
    const body = [
      `\xA7c\u786E\u5B9A\u8981\u5220\u9664\u571F\u5730 \xA7r${name} \xA7c\u5417\uFF1F`,
      `  \xA77- \u9762\u79EF: \xA7a${LandCore.getCubeInfo(land.posA, land.posB).square} \xA77\u683C`,
      `  \xA77- \u9000\u6B3E: \xA7a${refund} \xA77${Money.UNIT}`,
      ``,
      `\xA7c\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF01`
    ].join("\n");
    Gui.confirm(player, "\u5220\u9664\u571F\u5730", body, () => {
      if (LandCore.deleteLand(land.id, player)) {
        Msg.success(`\u571F\u5730\u5DF2\u5220\u9664\uFF0C\u83B7\u5F97 ${refund} ${Money.UNIT}\u3002`, player);
      } else {
        Msg.error("\u5220\u9664\u5931\u8D25\u3002", player);
      }
    });
  }
  // ══════════════════════════════════════
  //  状态对话框（申请流程）
  // ══════════════════════════════════════
  static showStateDialog(player) {
    const plid = player.id;
    const session = LandCore.getSession(plid);
    const hasPos1 = !!session?.pos1;
    const hasPos2 = !!session?.pos2;
    const bothSet = hasPos1 && hasPos2;
    if (!bothSet) {
      const body = ["\u8BF7\u5148\u5B8C\u6574\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002"];
      if (hasPos1 && !hasPos2) body.push("  \xA76!pos2 \xA7r- \u7EE7\u7EED\u8BBE\u7F6E\u7B2C\u4E8C\u70B9");
      if (hasPos2 && !hasPos1) body.push("  \xA76!pos1 \xA7r- \u7EE7\u7EED\u8BBE\u7F6E\u7B2C\u4E00\u70B9");
      const form = new ActionFormData2().title("\u571F\u5730\u7533\u8BF7").body(ListFormInfo(body)).button("\u53D6\u6D88\u7533\u8BF7").button("\xA7l\u8FD4\u56DE");
      Gui.showForm(player, form, "\u571F\u5730\u7533\u8BF7").then((res) => {
        if (res.canceled) return;
        if (res.selection === 0) {
          LandCore.clearSession(plid);
          Msg.warning("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
        }
      });
    } else {
      const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
      const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid).replace(/§[cef6]/g, "");
      const body = [
        info,
        "\xA77\u786E\u8BA4\u7533\u8BF7\u8BE5\u571F\u5730\uFF1F"
      ];
      const form = new ActionFormData2().title("\u786E\u8BA4\u571F\u5730\u7533\u8BF7").body(ListFormInfo(body)).button("\u786E\u8BA4\u7533\u8BF7").button("\u53D6\u6D88\u7533\u8BF7");
      Gui.showForm(player, form, "\u786E\u8BA4\u571F\u5730\u7533\u8BF7").then((res) => {
        if (res.canceled) return;
        if (res.selection === 0) {
          this.handleApply(player, session?.pos1, session?.pos2, dimid);
        } else {
          if (LandCore.clearSession(plid))
            Msg.warning("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
          else
            Msg.error("\u571F\u5730\u7533\u8BF7\u53D6\u6D88\u5931\u8D25\u3002", player);
        }
      });
    }
  }
  // ══════════════════════════════════════
  //  申请入口
  // ══════════════════════════════════════
  static startApplication(player) {
    const plid = player.id;
    LandCore.initSession(plid);
    Msg.info([
      `\u53EF\u5728\u804A\u5929\u6846\u8F93\u5165\u4EE5\u4E0B\u547D\u4EE4\u5B8C\u6210\u571F\u5730\u7533\u8BF7\u6D41\u7A0B\uFF1A`,
      `  [1] \xA76\xA7l!pos1\xA7r \xA7f- \u8BBE\u7F6E\u7B2C\u4E00\u70B9\uFF08\u7AD9\u5728\u5BF9\u5E94\u4F4D\u7F6E\u8F93\u5165\uFF09`,
      `  [2] \xA76\xA7l!pos2\xA7r \xA7f- \u8BBE\u7F6E\u7B2C\u4E8C\u70B9`,
      `  [3] \xA76\xA7l!land\xA7r \xA7f- \u6253\u5F00\u83DC\u5355\u8FDB\u884C\xA7e\u9A8C\u8BC1\u4E0E\u786E\u8BA4\xA7r`
    ].join("\n"), player);
    Msg.tips(`\u5728\u786E\u8BA4\u571F\u5730\u524D\uFF0C\u53EF\u91CD\u590D\u8F93\u5165 !pos1 \u548C !pos2 \u547D\u4EE4\uFF0C\u6765\u4FEE\u6539\u5408\u9002\u7684\u571F\u5730\u8303\u56F4\u3002`, player);
  }
  // ══════════════════════════════════════
  //  处理创建
  // ══════════════════════════════════════
  static async handleApply(player, pos1, pos2, dimid) {
    const result = LandCore.validateCreation(player, pos1, pos2, dimid);
    if (!result.ok) {
      Msg.error(result.msg ?? "\u9A8C\u8BC1\u5931\u8D25\u3002", player);
      return;
    }
    const land = LandCore.createLand(player, pos1, pos2, dimid);
    if (land) {
      Msg.success(`\u571F\u5730\u521B\u5EFA\u6210\u529F\uFF01
\u571F\u5730\u7F16\u53F7: ${land.id}
\u9762\u79EF: ${LandCore.getCubeInfo(land.posA, land.posB).square} \u683C`, player);
    } else {
      Msg.error("\u571F\u5730\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002", player);
    }
  }
};

// scripts/land/LandEvents.ts
import { world as world19 } from "@minecraft/server";
var CONTAINER_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel"
  // 潜影盒用正则匹配
]);
function isContainerBlock(typeId) {
  if (CONTAINER_BLOCKS.has(typeId)) return true;
  return /^minecraft:.*_shulker_box$/.test(typeId);
}
function checkLandPermission(player, pos, dimid, permField) {
  if (player.hasTag("op") || player.hasTag("admin")) return true;
  const land = LandCore.getLandByPos(pos, dimid);
  if (!land) return true;
  if (LandCore.isOwnerOrManager(land, player.id)) return true;
  return land.permissions[permField] === true;
}
var LandEvents = class {
  static {
    this.initialized = false;
  }
  static init() {
    if (this.initialized) return;
    this.initialized = true;
    world19.beforeEvents.playerPlaceBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "allow_place")) {
        player.sendMessage("\xA7c\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u653E\u7F6E\u65B9\u5757\uFF01");
        ev.cancel = true;
      }
    });
    world19.beforeEvents.playerBreakBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "allow_destroy")) {
        player.sendMessage("\xA7c\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u7834\u574F\u65B9\u5757\uFF01");
        ev.cancel = true;
      }
    });
    world19.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      const { player, block } = ev;
      if (!isContainerBlock(block.typeId)) return;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "open_container")) {
        player.sendMessage("\xA7c\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u6253\u5F00\u5BB9\u5668\uFF01");
        ev.cancel = true;
      }
    });
  }
};

// scripts/land/LandSystem.ts
var LandSystem = class {
  static init() {
    Permission.register("land.use", Permission.Any);
    Command.register("land", "land.use", (player) => {
      if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
      LandGUI.showMainMenu(player);
    }, "\u571F\u5730\u7BA1\u7406");
    Command.register("land cancel", "land.use", (player) => {
      if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
      if (LandCore.clearSession(player.id))
        Msg.success("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
      else
        Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
    }, "\u53D6\u6D88\u571F\u5730\u7533\u8BF7");
    Command.register("pos1", "land.use", (player) => {
      if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
      handlePosCommand(player, 1);
    }, "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E00\u70B9");
    Command.register("pos2", "land.use", (player) => {
      if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
      handlePosCommand(player, 2);
    }, "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E8C\u70B9");
    LandEvents.init();
  }
};
function handlePosCommand(player, which) {
  const plid = player.id;
  const pos = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
  const session = LandCore.getSession(plid);
  if (!session) return Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
  if (which === 1) {
    LandCore.setPos1(plid, pos);
    Msg.success(`\u5DF2\u8BBE\u7F6E\u7B2C\u4E00\u70B9 \xA7f(${pos.x}, ${pos.y}, ${pos.z})`, player);
  } else {
    LandCore.setPos2(plid, pos);
    Msg.success(`\u5DF2\u8BBE\u7F6E\u7B2C\u4E8C\u70B9 \xA7f(${pos.x}, ${pos.y}, ${pos.z})`, player);
  }
  if (session.pos1 && session.pos2) {
    const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid);
    Msg.info(info, player);
    Msg.tips("\u4F7F\u7528 \xA7a!land \xA77\u6253\u5F00\u83DC\u5355\u786E\u8BA4\u7533\u8BF7\uFF0C\u6216\u4F7F\u7528 \xA7a!land cancel \xA77\u53D6\u6D88", player);
  } else {
    const next = which === 1 ? "2" : "1";
    Msg.tips(`\u8BF7\u4F7F\u7528 \xA7a!pos${next} \xA77\u8BBE\u7F6E\u7B2C${next}\u70B9`, player);
  }
}

// scripts/gui/MoneyGUI.ts
import { world as world20 } from "@minecraft/server";
import { ActionFormData as ActionFormData3, ModalFormData as ModalFormData3 } from "@minecraft/server-ui";
Permission.register("money.admin", Permission.Admin);
var MoneyCommand = class {
  static init() {
    Command.register("money", "money.admin", (player) => {
      if (!player) return;
      this.showMainMenu(player);
    }, "\u8D27\u5E01\u7BA1\u7406");
  }
  static showMainMenu(player) {
    const balance = Money.get(player);
    const body = [
      `\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\u3002`
    ];
    const form = new ActionFormData3().title("\u8D27\u5E01\u7BA1\u7406").body(ListFormInfo(body)).button("\u7ED9\u4E88\u73A9\u5BB6").button("\u67E5\u8BE2\u73A9\u5BB6").button("\u53D6\u6D88");
    Gui.showForm(player, form, "\u8D27\u5E01\u7BA1\u7406").then((res) => {
      if (res.canceled) return;
      switch (res.selection) {
        case 0:
          this.showGiveForm(player);
          break;
        case 1:
          this.showQueryForm(player);
          break;
      }
    });
  }
  static showGiveForm(player) {
    const form = new ModalFormData3().title("\u7ED9\u4E88\u73A9\u5BB6").textField("\u73A9\u5BB6\u540D\u79F0", "\u8BF7\u8F93\u5165\u73A9\u5BB6\u540D\u79F0").textField("\u6570\u91CF", "\u8BF7\u8F93\u5165\u8D27\u5E01\u6570\u91CF");
    Gui.showForm(player, form, "\u7ED9\u4E88\u73A9\u5BB6").then((res) => {
      if (res.canceled) return;
      const targetName = res.formValues[0];
      const amount = parseInt(res.formValues[1]);
      if (!targetName || isNaN(amount) || amount <= 0) {
        Msg.error("\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u6570\u91CF\u3002", player);
        return;
      }
      const targetPlayer = world20.getPlayers().find((p) => p.name === targetName);
      if (!targetPlayer) {
        Msg.error(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${targetName}\u300D\u3002`, player);
        return;
      }
      Money.add(targetPlayer, amount);
      Msg.success(`\u5DF2\u7ED9\u4E88 ${targetName} ${amount} ${Money.UNIT}\u3002`, player);
    });
  }
  static showQueryForm(player) {
    const form = new ModalFormData3().title("\u67E5\u8BE2\u73A9\u5BB6").textField("\u73A9\u5BB6\u540D\u79F0", "\u8BF7\u8F93\u5165\u73A9\u5BB6\u540D\u79F0");
    Gui.showForm(player, form, "\u67E5\u8BE2\u73A9\u5BB6").then((res) => {
      if (res.canceled) return;
      const targetName = res.formValues[0];
      if (!targetName) {
        Msg.error("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u73A9\u5BB6\u540D\u79F0\u3002", player);
        return;
      }
      const targetPlayer = world20.getPlayers().find((p) => p.name === targetName);
      if (!targetPlayer) {
        Msg.error(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${targetName}\u300D\u3002`, player);
        return;
      }
      const balance = Money.get(targetPlayer);
      Msg.info(`\u73A9\u5BB6 ${targetName} \u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\u3002`, player);
    });
  }
};

// scripts/gui/MainMenu.ts
var MainMenu = class {
  static show(player) {
    this.showMainMenu(player);
  }
  static async showMainMenu(player) {
    const balance = Money.get(player);
    const body = ListFormInfo([
      `\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}`
    ]);
    const form = Gui.simpleForm("\u4E3B\u83DC\u5355", body);
    form.button("\u571F\u5730");
    form.button("\u5408\u4F5C\u793E");
    form.button("\u9891\u9053");
    form.button("\u7EA2\u5305");
    form.button("\u8282\u64CD");
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u4E3B\u83DC\u5355");
    if (res.canceled) return;
    const sel = res.selection;
    switch (sel) {
      case 0:
        LandGUI.showMainMenu(player);
        break;
      case 1:
        new CoopGUI(player).mainPanel();
        break;
      case 2:
        await ChatGUI.openChannelPanel(player);
        break;
      case 3:
        await ChatGUI.openRedPacketPanel(player);
        break;
      case 4:
        await this.showEconomyPanel(player);
        break;
      case 5:
        return;
    }
  }
  static async showEconomyPanel(player) {
    const balance = Money.get(player);
    const body = ListFormInfo([
      `\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}`
    ]);
    const form = Gui.simpleForm("\u7ECF\u6D4E\u7CFB\u7EDF", body);
    form.button("\u67E5\u8BE2\u4F59\u989D");
    form.button("\u8F6C\u8D26");
    form.button("\xA7l\u8FD4\u56DE");
    const res = await Gui.showForm(player, form, "\u7ECF\u6D4E\u7CFB\u7EDF");
    if (res.canceled) return;
    const sel = res.selection;
    switch (sel) {
      case 0: {
        const bal = Money.get(player);
        Msg.info(`\u5F53\u524D\u4F59\u989D: ${bal} ${Money.UNIT}`, player);
        await this.showEconomyPanel(player);
        break;
      }
      case 1:
        await this.showTransferForm(player);
        break;
      case 2:
        await this.showMainMenu(player);
        break;
    }
  }
  static async showTransferForm(player) {
    const form = Gui.modalForm("\u8F6C\u8D26");
    form.textField("\u76EE\u6807\u73A9\u5BB6", "\u8F93\u5165\u73A9\u5BB6\u540D\u79F0");
    form.textField("\u91D1\u989D", "\u8F93\u5165\u8F6C\u8D26\u91D1\u989D");
    const res = await Gui.showForm(player, form, "\u8F6C\u8D26");
    if (res.canceled) {
      await this.showEconomyPanel(player);
      return;
    }
    const vals = res.formValues;
    const targetName = vals[0].trim();
    const amount = parseInt(vals[1]);
    if (!targetName || isNaN(amount) || amount <= 0) {
      Msg.error("\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u91D1\u989D\u3002", player);
      await this.showTransferForm(player);
      return;
    }
    const target = player.dimension.getPlayers().find((p) => p.name === targetName);
    if (!target) {
      Msg.error(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${targetName}\u300D\u3002`, player);
      await this.showTransferForm(player);
      return;
    }
    const balance = Money.get(player);
    if (amount > balance) {
      Msg.error(`\u4F59\u989D\u4E0D\u8DB3\u3002\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\uFF0C\u9700\u8981: ${amount} ${Money.UNIT}`, player);
      await this.showTransferForm(player);
      return;
    }
    Money.add(player, -amount);
    Money.add(target, amount);
    Msg.success(`\u6210\u529F\u8F6C\u8D26 ${amount} ${Money.UNIT} \u7ED9 ${targetName}\u3002`, player);
    await this.showEconomyPanel(player);
  }
};

// scripts/shop/ShopSystem.ts
import { world as world21, BlockComponentTypes as BlockComponentTypes4 } from "@minecraft/server";

// scripts/gui/ShopGUI.ts
var ShopGUI = class {
  /** 打开商店主菜单 — 列出所有分类 */
  static show(player) {
    const cfg = Config.shopChest;
    const totalShops = cfg.size[0] * cfg.size[1];
    const form = Gui.simpleForm("\u5546\u5E97", ListFormInfo(["\u9009\u62E9\u8981\u6D4F\u89C8\u7684\u5546\u54C1\u5206\u7C7B"]));
    for (let i = 0; i < totalShops; i++) {
      form.button(ShopSystem.getShopName(i));
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, "\u5546\u5E97").then((res) => {
      if (res.canceled) return;
      const sel = res.selection;
      if (sel >= totalShops) return;
      this.showShopCategory(player, sel);
    });
  }
  /** 显示某个商店分类的物品列表 */
  static showShopCategory(player, catIdx) {
    const items = ShopSystem.getChestItems(catIdx);
    const priceData = ShopSystem.getPriceData();
    const shopName = ShopSystem.getShopName(catIdx);
    const body = [`\u5F53\u524D\u4F59\u989D: ${Money.get(player)} ${Money.UNIT}`];
    const form = Gui.simpleForm(shopName, ListFormInfo(body));
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      const buyPrice = priceData.prices[`${catIdx}:${i}`];
      const sellPrice = priceData.sellPrices[`${catIdx}:${i}`];
      const label = `${item.typeId} \xA77x${item.amount}\xA7r`;
      const prices = `${buyPrice ? `\xA7a\u4E70:${buyPrice} ${Money.UNIT}\xA7r` : ""} ${sellPrice ? `\xA76\u5356:${sellPrice} ${Money.UNIT}\xA7r` : ""}`;
      form.button(`${label}
${prices}`);
    }
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, shopName).then((res) => {
      if (res.canceled) return;
      const sel = res.selection;
      if (sel >= items.length) return;
      let actualIdx = -1;
      let count = 0;
      for (let j = 0; j < items.length; j++) {
        if (items[j]) {
          if (count === sel) {
            actualIdx = j;
            break;
          }
          count++;
        }
      }
      if (actualIdx === -1) return;
      this.showItemDetail(player, catIdx, actualIdx);
    });
  }
  /** 显示某个物品的购买/回收操作界面 */
  static showItemDetail(player, catIdx, slotIdx) {
    const items = ShopSystem.getChestItems(catIdx);
    const item = items[slotIdx];
    if (!item) {
      Msg.error("\u8BE5\u7269\u54C1\u5DF2\u4E0D\u5B58\u5728\u3002", player);
      return;
    }
    const priceData = ShopSystem.getPriceData();
    const buyPrice = priceData.prices[`${catIdx}:${slotIdx}`];
    const sellPrice = priceData.sellPrices[`${catIdx}:${slotIdx}`];
    const title = item.typeId;
    const bodyParts = [`\xA77\u7269\u54C1: \xA7f${item.typeId}`, `\xA77\u5E93\u5B58: \xA7f${item.amount}`];
    if (buyPrice) bodyParts.push(`\xA7a\u8D2D\u4E70\u4EF7: ${buyPrice} ${Money.UNIT}/\u4E2A`);
    if (sellPrice) bodyParts.push(`\xA76\u56DE\u6536\u4EF7: ${sellPrice} ${Money.UNIT}/\u4E2A`);
    bodyParts.push(`\xA77\u5F53\u524D\u4F59\u989D: ${Money.get(player)} ${Money.UNIT}`);
    const form = Gui.simpleForm(title, bodyParts.join("\n"));
    if (buyPrice) form.button(`\xA7a\u8D2D\u4E70 \xA77(${buyPrice} ${Money.UNIT}/\u4E2A)`);
    if (sellPrice) form.button(`\xA76\u56DE\u6536 \xA77(${sellPrice} ${Money.UNIT}/\u4E2A)`);
    form.button("\xA7l\u8FD4\u56DE");
    Gui.showForm(player, form, title).then((res) => {
      if (res.canceled) return;
      const sel = res.selection;
      const hasBuy = !!buyPrice;
      const hasSell = !!sellPrice;
      let action = null;
      if (hasBuy && sel === 0) action = "buy";
      else if (hasSell && (hasBuy ? sel === 1 : sel === 0)) action = "sell";
      if (!action) return;
      this.showQuantityInput(player, catIdx, slotIdx, item, action);
    });
  }
  /** 弹出数量输入框 */
  static showQuantityInput(player, catIdx, slotIdx, item, action) {
    const priceData = ShopSystem.getPriceData();
    const buyPrice = priceData.prices[`${catIdx}:${slotIdx}`];
    const sellPrice = priceData.sellPrices[`${catIdx}:${slotIdx}`];
    const unitPrice = action === "buy" ? buyPrice : sellPrice;
    const label = action === "buy" ? "\u8D2D\u4E70" : "\u56DE\u6536";
    const maxStack = item.amount;
    const shopItems = ShopSystem.getChestItems(catIdx);
    const shopItem = shopItems[slotIdx];
    const buyMax = shopItem ? shopItem.amount : 0;
    const form = Gui.modalForm(`\xA7l${label} ${item.typeId}`);
    form.textField(
      `\xA77\u5355\u4EF7: ${unitPrice} ${Money.UNIT}/\u4E2A
\xA77\u5E93\u5B58: ${action === "buy" ? buyMax : "\u4E0D\u9650"}
\xA77\u8F93\u5165${label}\u6570\u91CF\uFF1A`,
      `\u8F93\u5165\u6570\u91CF (1-${action === "buy" ? buyMax : 64})`
    );
    form.submitButton(`\u786E\u8BA4${label}`);
    Gui.showForm(player, form, `${label} ${item.typeId}`).then((res) => {
      if (res.canceled) return;
      const amountStr = res.formValues[0];
      const amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        Msg.error("\u65E0\u6548\u7684\u6570\u91CF\u3002", player);
        return;
      }
      if (action === "buy") {
        if (amount > (shopItem?.amount ?? 0)) {
          Msg.error(`\u5E93\u5B58\u4E0D\u8DB3\uFF0C\u4EC5\u5269 ${shopItem?.amount ?? 0} \u4E2A\u3002`, player);
          return;
        }
        const total = amount * unitPrice;
        if (Money.get(player) < total) {
          Msg.error(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${total}\uFF0C\u5F53\u524D ${Money.get(player)}`, player);
          return;
        }
        ShopSystem.buy(player, catIdx, slotIdx, amount);
      } else {
        const playerInv = player.getComponent("inventory");
        if (!playerInv?.container) {
          Msg.error("\u65E0\u6CD5\u83B7\u53D6\u80CC\u5305\u4FE1\u606F\u3002", player);
          return;
        }
        let totalFound = 0;
        for (let i = 0; i < playerInv.container.size; i++) {
          const invItem = playerInv.container.getItem(i);
          if (invItem && invItem.typeId === item.typeId) totalFound += invItem.amount;
        }
        if (totalFound < amount) {
          Msg.error(`\u80CC\u5305\u4E2D\u4E0D\u8DB3\uFF0C\u4EC5\u6709 ${totalFound} \u4E2A\u3002`, player);
          return;
        }
        ShopSystem.sell(player, catIdx, slotIdx, item.typeId, amount);
      }
    });
  }
};

// scripts/shop/ShopSystem.ts
var KEY_PRICES = "shop:prices";
var KEY_STOCKS = "shop:stocks";
var ShopSystem = class _ShopSystem {
  static getInstance() {
    if (!_ShopSystem._instance) _ShopSystem._instance = new _ShopSystem();
    return _ShopSystem._instance;
  }
  init() {
    Permission.register("shop.use", Permission.Any);
  }
  /** 委托给 ShopGUI 打开商店主菜单 */
  showShop(player) {
    ShopGUI.show(player);
  }
  // ── 布局工具 ──
  /** 获取第 catIdx 个商店箱子的 { left, right, sign } 布局 */
  static getChestLayout(catIdx) {
    const cfg = Config.shopChest;
    const mainAxis = Math.floor(catIdx / cfg.size[1]);
    const yOffset = catIdx % cfg.size[1];
    return getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
  }
  /** 获取第 catIdx 个商店的名称（从告示牌读取） */
  static getShopName(catIdx) {
    const { sign } = this.getChestLayout(catIdx);
    const dim = world21.getDimension("minecraft:overworld");
    const block = dim.getBlock(sign);
    if (!block) return `\u5546\u5E97 #${catIdx + 1}`;
    try {
      const signComp = block.getComponent(BlockComponentTypes4.Sign);
      if (signComp?.getText) {
        const text = signComp.getText(true);
        if (text && text.rawtext?.[0]?.text) return text.rawtext[0].text;
      }
    } catch {
    }
    return `\u5546\u5E97 #${catIdx + 1}`;
  }
  /** 获取某个商店箱子里所有物品（实际库存） */
  static getChestItems(catIdx) {
    const dim = world21.getDimension("minecraft:overworld");
    const { left } = this.getChestLayout(catIdx);
    const block = dim.getBlock(left);
    if (!block) return [];
    ensureDoubleChest(dim, left, getChestCardinal(Config.shopChest.direction, Config.shopChest.face), Config.shopChest.direction);
    const invComp = block.getComponent(BlockComponentTypes4.Inventory);
    if (!invComp?.container) return [];
    const items = [];
    for (let i = 0; i < invComp.container.size; i++) {
      items.push(invComp.container.getItem(i));
    }
    return items;
  }
  // ── 价格管理 ──
  static getPriceData() {
    return {
      prices: Storage.get(KEY_PRICES, {}),
      sellPrices: Storage.get(KEY_STOCKS, {})
    };
  }
  static setPrice(catIdx, slotIdx, buyPrice, sellPrice) {
    const data2 = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    if (buyPrice > 0) data2.prices[key] = buyPrice;
    else delete data2.prices[key];
    if (sellPrice > 0) data2.sellPrices[key] = sellPrice;
    else delete data2.sellPrices[key];
    Storage.set(KEY_PRICES, data2.prices);
    Storage.set(KEY_STOCKS, data2.sellPrices);
  }
  // ── 购买 ──
  static buy(player, catIdx, slotIdx, amount) {
    const data2 = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    const price = data2.prices[key];
    if (!price || price <= 0) {
      Msg.error("\u8BE5\u7269\u54C1\u672A\u8BBE\u7F6E\u4EF7\u683C\u3002", player);
      return false;
    }
    const dim = world21.getDimension("minecraft:overworld");
    const { left } = this.getChestLayout(catIdx);
    ensureDoubleChest(dim, left, getChestCardinal(Config.shopChest.direction, Config.shopChest.face), Config.shopChest.direction);
    const block = dim.getBlock(left);
    if (!block) return false;
    const invComp = block.getComponent(BlockComponentTypes4.Inventory);
    if (!invComp?.container) return false;
    const container = invComp.container;
    const item = container.getItem(slotIdx);
    if (!item) {
      Msg.error("\u5E93\u5B58\u4E0D\u8DB3\u3002", player);
      return false;
    }
    if (item.amount < amount) {
      Msg.error(`\u5E93\u5B58\u4E0D\u8DB3\uFF0C\u4EC5\u5269 ${item.amount} \u4E2A\u3002`, player);
      return false;
    }
    const total = price * amount;
    const bal = Money.get(player);
    if (bal < total) {
      Msg.error(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${total}\uFF0C\u5F53\u524D ${bal}`, player);
      return false;
    }
    Money.set(player, bal - total);
    if (item.amount === amount) {
      container.setItem(slotIdx, void 0);
    } else {
      item.amount -= amount;
      container.setItem(slotIdx, item);
    }
    try {
      const itemName = item.typeId;
      const aux = item.data ?? 0;
      player.runCommand(`give "${player.name}" ${itemName} ${amount} ${aux}`);
    } catch (e) {
      Msg.error("\u7ED9\u4E88\u7269\u54C1\u65F6\u51FA\u9519\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002", player);
      return false;
    }
    Msg.success(`\u8D2D\u4E70\u6210\u529F\uFF01\u82B1\u8D39 ${total} ${Money.UNIT}`, player);
    return true;
  }
  // ── 出售 ──
  static sell(player, catIdx, slotIdx, itemTypeId, amount) {
    const data2 = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    const price = data2.sellPrices[key];
    if (!price || price <= 0) {
      Msg.error("\u8BE5\u4F4D\u7F6E\u4E0D\u652F\u6301\u56DE\u6536\u3002", player);
      return false;
    }
    const playerInv = player.getComponent("inventory");
    if (!playerInv?.container) {
      Msg.error("\u65E0\u6CD5\u83B7\u53D6\u80CC\u5305\u4FE1\u606F\u3002", player);
      return false;
    }
    let totalFound = 0;
    for (let i = 0; i < playerInv.container.size; i++) {
      const invItem = playerInv.container.getItem(i);
      if (invItem && invItem.typeId === itemTypeId) {
        totalFound += invItem.amount;
      }
    }
    if (totalFound < amount) {
      Msg.error(`\u80CC\u5305\u4E2D ${itemTypeId} \u4E0D\u8DB3\uFF0C\u4EC5\u6709 ${totalFound} \u4E2A\u3002`, player);
      return false;
    }
    let remaining = amount;
    for (let i = 0; i < playerInv.container.size && remaining > 0; i++) {
      const invItem = playerInv.container.getItem(i);
      if (invItem && invItem.typeId === itemTypeId) {
        if (invItem.amount <= remaining) {
          remaining -= invItem.amount;
          playerInv.container.setItem(i, void 0);
        } else {
          invItem.amount -= remaining;
          playerInv.container.setItem(i, invItem);
          remaining = 0;
        }
      }
    }
    const total = price * amount;
    Money.add(player, total);
    Msg.success(`\u56DE\u6536\u6210\u529F\uFF01\u83B7\u5F97 ${total} ${Money.UNIT}`, player);
    return true;
  }
  // ── 检测商店方块 ──
  /** 检测某个坐标是否为商店箱子区域，返回 catIdx，否则返回 -1 */
  static detectShopChest(location) {
    const cfg = Config.shopChest;
    for (let catIdx = 0; catIdx < cfg.size[0] * cfg.size[1]; catIdx++) {
      const { left, right } = this.getChestLayout(catIdx);
      for (const pos of [left, right]) {
        if (pos.x === Math.floor(location.x) && pos.y === Math.floor(location.y) && pos.z === Math.floor(location.z)) {
          return catIdx;
        }
      }
    }
    return -1;
  }
};

// scripts/backup/ScoreboardSync.ts
import { world as world22, system as system15, ScoreboardIdentityType } from "@minecraft/server";
var AUTO_SYNC_INTERVAL = 3e5;
var ScoreboardSync = class {
  static {
    this.initialized = false;
  }
  /** 初始化：注册权限、命令、定时同步 */
  static init() {
    if (this.initialized) return;
    this.initialized = true;
    Permission.register("scoreboard.sync", Permission.OP);
    Permission.register("scoreboard.load", Permission.OP);
    Command.register(
      "sbs",
      "scoreboard.sync",
      (player) => {
        if (!player) return;
        this.sync().then(() => {
          Msg.success("\u8BA1\u5206\u677F\u5DF2\u540C\u6B65\u5230\u6570\u636E\u5E93", player);
        });
      },
      "\u540C\u6B65\u8BA1\u5206\u677F\u5230\u6570\u636E\u5E93"
    );
    Command.register(
      "sbs_load",
      "scoreboard.load",
      (player) => {
        if (!player) return;
        this.load().then((result) => {
          Msg.success(`\u8BA1\u5206\u677F\u6062\u590D\u5B8C\u6210\uFF1A\u6210\u529F ${result.success}\uFF0C\u5931\u8D25 ${result.fail}`, player);
        });
      },
      "\u4ECE\u6570\u636E\u5E93\u6062\u590D\u8BA1\u5206\u677F"
    );
    system15.runInterval(() => {
      this.sync();
    }, AUTO_SYNC_INTERVAL / 50);
    console.info("[ScoreboardSync] \u5DF2\u521D\u59CB\u5316\uFF0C\u81EA\u52A8\u540C\u6B65\u95F4\u9694 5 \u5206\u949F");
  }
  /** 同步：游戏 → db-server */
  static async sync() {
    try {
      const entries = [];
      for (const obj of world22.scoreboard.getObjectives()) {
        const scores = obj.getScores();
        for (const info of scores) {
          const identity = info.participant;
          let id = "";
          if (identity.type === ScoreboardIdentityType.Player) {
            try {
              const entity = identity.getEntity();
              if (entity && "id" in entity) {
                id = entity.id || "";
              }
            } catch {
            }
          }
          entries.push({
            objectiveId: obj.id,
            objectiveDisplay: obj.displayName,
            participantId: identity.id,
            participantType: identity.type,
            participantName: identity.displayName,
            id,
            score: info.score
          });
        }
      }
      if (entries.length === 0) {
        console.warn("[ScoreboardSync] \u8BA1\u5206\u677F\u65E0\u6570\u636E\uFF0C\u8DF3\u8FC7\u540C\u6B65");
        return;
      }
      const ok = await HttpDB.syncScoreboards(entries);
      if (ok) {
        console.info(`[ScoreboardSync] \u540C\u6B65\u5B8C\u6210\uFF1A${entries.length} \u6761\u6570\u636E`);
      } else {
        console.warn("[ScoreboardSync] \u540C\u6B65\u5931\u8D25\uFF1Adb-server \u4E0D\u53EF\u7528");
      }
    } catch (err) {
      console.error(`[ScoreboardSync] \u540C\u6B65\u51FA\u9519\uFF1A${err}`);
    }
  }
  /** 恢复：db-server → 游戏 */
  static async load() {
    try {
      const entries = await HttpDB.loadScoreboards();
      if (!entries || entries.length === 0) {
        console.info("[ScoreboardSync] \u6570\u636E\u5E93\u65E0\u8BA1\u5206\u677F\u6570\u636E");
        return { success: 0, fail: 0 };
      }
      let success = 0;
      let fail = 0;
      const groups = /* @__PURE__ */ new Map();
      for (const e of entries) {
        const list = groups.get(e.objective_id) || [];
        list.push(e);
        groups.set(e.objective_id, list);
      }
      for (const [objId, objEntries] of groups) {
        let objective = world22.scoreboard.getObjective(objId);
        if (!objective) {
          try {
            objective = world22.scoreboard.addObjective(objId, objEntries[0].objective_display || objId);
          } catch (err) {
            console.warn(`[ScoreboardSync] \u65E0\u6CD5\u521B\u5EFA\u8BB0\u5206\u9879 "${objId}"\uFF1A${err}`);
            fail += objEntries.length;
            continue;
          }
        }
        for (const e of objEntries) {
          try {
            if (e.participant_type === "Player" && e.id) {
              const player = [...world22.getPlayers()].find((p) => p.id === e.id);
              if (player?.scoreboardIdentity) {
                objective.setScore(player.scoreboardIdentity, e.score);
                success++;
                continue;
              }
            }
            objective.setScore(e.participant_name || `#${e.participant_id}`, e.score);
            success++;
          } catch {
            fail++;
          }
        }
      }
      console.info(`[ScoreboardSync] \u6062\u590D\u5B8C\u6210\uFF1A\u6210\u529F ${success}\uFF0C\u5931\u8D25 ${fail}`);
      return { success, fail };
    } catch (err) {
      console.error(`[ScoreboardSync] \u6062\u590D\u51FA\u9519\uFF1A${err}`);
      return { success: 0, fail: 0 };
    }
  }
};

// scripts/doge/ActivityLog.ts
import { world as world23, system as system16 } from "@minecraft/server";
var ENABLED_EVENTS = /* @__PURE__ */ new Set([
  "player.join",
  "player.leave",
  "player.spawn",
  "player.dimension",
  "player.gamemode",
  "player.chat",
  "block.break",
  "block.place",
  "entity.death",
  "entity.hit",
  "entity.hurt",
  "entity.interact",
  "entity.tame",
  "entity.spawn",
  "item.drop",
  "item.pickup",
  "container.open",
  "container.close",
  "world.explosion"
]);
var FLUSH_INTERVAL2 = 2e3;
var CLEANUP_INTERVAL = 6 * 36e5;
var KEEP_DAYS = 30;
var queue = [];
var flushTimer = null;
var initialized = false;
function enqueue(entry) {
  queue.push(entry);
  if (!flushTimer) {
    flushTimer = system16.runTimeout(flush, FLUSH_INTERVAL2 / 50);
  }
}
async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await HttpDB.batchActivities(batch);
  } catch {
  }
}
function dimId(entityOrBlock) {
  try {
    return entityOrBlock.dimension?.id?.replace("minecraft:", "") || "";
  } catch {
    return "";
  }
}
function loc(v) {
  if (!v) return [0, 0, 0];
  return [v.x, v.y, v.z];
}
function playerId(player) {
  try {
    return player.id || "";
  } catch {
    return "";
  }
}
function playerEntry(player, eventType, extra = {}) {
  const [x, y, z] = loc(player.location);
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    dimension: dimId(player),
    sourceType: "player",
    sourceid: playerId(player),
    sourceName: player.name,
    sourceX: x,
    sourceY: y,
    sourceZ: z,
    eventType,
    targetType: extra.targetType || "",
    targetid: extra.targetid || "",
    targetName: extra.targetName || "",
    targetX: extra.targetX ?? null,
    targetY: extra.targetY ?? null,
    targetZ: extra.targetZ ?? null,
    detail: extra.detail || {}
  };
}
function getTargetPlayerId(entity) {
  if (entity.typeId !== "minecraft:player") return "";
  try {
    return entity.id || "";
  } catch {
    return "";
  }
}
function getTargetPlayerName(entity) {
  if (entity.typeId !== "minecraft:player") return entity.typeId;
  try {
    return entity.name || entity.typeId;
  } catch {
    return entity.typeId;
  }
}
function subscribe() {
  world23.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.join")) return;
    enqueue(playerEntry(event.player, "player.join"));
  });
  world23.afterEvents.playerLeave.subscribe((event) => {
    if (!ENABLED_EVENTS.has("player.leave")) return;
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension: "",
      sourceType: "player",
      sourceid: "",
      sourceName: event.playerName,
      sourceX: null,
      sourceY: null,
      sourceZ: null,
      eventType: "player.leave",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { playerId: event.playerId }
    });
  });
  world23.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.spawn")) return;
    enqueue(playerEntry(event.player, "player.spawn"));
  });
  world23.afterEvents.playerDimensionChange.subscribe((event) => {
    if (!ENABLED_EVENTS.has("player.dimension")) return;
    const [fx, fy, fz] = loc(event.fromLocation);
    const [tx, ty, tz] = loc(event.toLocation);
    enqueue(playerEntry(event.player, "player.dimension", {
      targetX: tx,
      targetY: ty,
      targetZ: tz,
      detail: {
        from: event.fromDimension.id.replace("minecraft:", ""),
        to: event.toDimension.id.replace("minecraft:", ""),
        fromLoc: { x: fx, y: fy, z: fz },
        toLoc: { x: tx, y: ty, z: tz }
      }
    }));
  });
  world23.afterEvents.playerGameModeChange.subscribe((event) => {
    if (!ENABLED_EVENTS.has("player.gamemode")) return;
    enqueue(playerEntry(event.player, "player.gamemode", {
      detail: {
        from: event.fromGameMode,
        to: event.toGameMode
      }
    }));
  });
  world23.afterEvents.chatSend.subscribe((event) => {
    if (!ENABLED_EVENTS.has("player.chat")) return;
    const targets = event.targets?.map((p) => p.name) || [];
    enqueue(playerEntry(event.sender, "player.chat", {
      detail: {
        message: event.message,
        targets: targets.length > 0 ? targets : void 0
      }
    }));
  });
  world23.afterEvents.playerBreakBlock.subscribe((event) => {
    if (!ENABLED_EVENTS.has("block.break")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(playerEntry(event.player, "block.break", {
      targetType: "block",
      targetName: event.brokenBlockPermutation.type.id,
      targetX: bx,
      targetY: by,
      targetZ: bz,
      detail: {
        itemBefore: event.itemStackBeforeBreak?.type?.id || null,
        itemAfter: event.itemStackAfterBreak?.type?.id || null
      }
    }));
  });
  world23.afterEvents.playerPlaceBlock.subscribe((event) => {
    if (!ENABLED_EVENTS.has("block.place")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(playerEntry(event.player, "block.place", {
      targetType: "block",
      targetName: event.block.typeId,
      targetX: bx,
      targetY: by,
      targetZ: bz,
      detail: {}
    }));
  });
  world23.afterEvents.entityDie.subscribe((event) => {
    if (!ENABLED_EVENTS.has("entity.death")) return;
    const dead = event.deadEntity;
    const [dx, dy, dz] = loc(dead.location);
    const ds = event.damageSource;
    const cause = ds.cause;
    const killer = ds.damagingEntity;
    const targetType = dead.typeId === "minecraft:player" ? "player" : "entity";
    const targetid = getTargetPlayerId(dead);
    const targetName = getTargetPlayerName(dead);
    if (killer && killer.typeId === "minecraft:player") {
      const player = killer;
      const proj = ds.damagingProjectile;
      enqueue(playerEntry(player, "entity.death", {
        targetType,
        targetid,
        targetName,
        targetX: dx,
        targetY: dy,
        targetZ: dz,
        detail: { cause, projectile: proj?.typeId || null }
      }));
    } else {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(dead),
        sourceType: killer ? "entity" : "world",
        sourceid: "",
        sourceName: killer?.typeId || cause,
        sourceX: killer ? loc(killer.location)[0] : null,
        sourceY: killer ? loc(killer.location)[1] : null,
        sourceZ: killer ? loc(killer.location)[2] : null,
        eventType: "entity.death",
        targetType,
        targetid,
        targetName,
        targetX: dx,
        targetY: dy,
        targetZ: dz,
        detail: { cause, projectile: ds.damagingProjectile?.typeId || null }
      });
    }
  });
  world23.afterEvents.entityHitEntity.subscribe((event) => {
    if (!ENABLED_EVENTS.has("entity.hit")) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    const [ax, ay, az] = loc(attacker.location);
    const [vx, vy, vz] = loc(victim.location);
    if (attacker.typeId === "minecraft:player") {
      enqueue(playerEntry(attacker, "entity.hit", {
        targetType: victim.typeId === "minecraft:player" ? "player" : "entity",
        targetid: getTargetPlayerId(victim),
        targetName: getTargetPlayerName(victim),
        targetX: vx,
        targetY: vy,
        targetZ: vz
      }));
    }
    if (victim.typeId === "minecraft:player" && attacker.typeId !== "minecraft:player") {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(attacker),
        sourceType: "entity",
        sourceid: "",
        sourceName: attacker.typeId,
        sourceX: ax,
        sourceY: ay,
        sourceZ: az,
        eventType: "entity.hit",
        targetType: "player",
        targetid: getTargetPlayerId(victim),
        targetName: getTargetPlayerName(victim),
        targetX: vx,
        targetY: vy,
        targetZ: vz,
        detail: {}
      });
    }
  });
  world23.afterEvents.entityHurt.subscribe((event) => {
    if (!ENABLED_EVENTS.has("entity.hurt")) return;
    const hurt = event.hurtEntity;
    const ds = event.damageSource;
    if (hurt.typeId !== "minecraft:player") return;
    const player = hurt;
    enqueue(playerEntry(player, "entity.hurt", {
      detail: {
        damage: event.damage,
        cause: ds.cause,
        damager: ds.damagingEntity?.typeId || null,
        projectile: ds.damagingProjectile?.typeId || null
      }
    }));
  });
  world23.afterEvents.playerInteractWithEntity.subscribe((event) => {
    if (!ENABLED_EVENTS.has("entity.interact")) return;
    const target = event.target;
    const [tx, ty, tz] = loc(target.location);
    enqueue(playerEntry(event.player, "entity.interact", {
      targetType: target.typeId === "minecraft:player" ? "player" : "entity",
      targetid: getTargetPlayerId(target),
      targetName: getTargetPlayerName(target),
      targetX: tx,
      targetY: ty,
      targetZ: tz,
      detail: {
        item: event.itemStack?.type?.id || null,
        itemBefore: event.beforeItemStack?.type?.id || null
      }
    }));
  });
  world23.afterEvents.entityTamed.subscribe((event) => {
    if (!ENABLED_EVENTS.has("entity.tame")) return;
    const tamer = event.tamingEntity;
    if (!tamer || tamer.typeId !== "minecraft:player") return;
    const target = event.entity;
    const [tx, ty, tz] = loc(target.location);
    enqueue(playerEntry(tamer, "entity.tame", {
      targetType: "entity",
      targetName: target.typeId,
      targetX: tx,
      targetY: ty,
      targetZ: tz
    }));
  });
  world23.afterEvents.entitySpawn.subscribe((event) => {
    if (!ENABLED_EVENTS.has("entity.spawn")) return;
    const e = event.entity;
    if (e.typeId === "minecraft:player") return;
    const [ex, ey, ez] = loc(e.location);
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension: dimId(e),
      sourceType: "entity",
      sourceid: "",
      sourceName: e.typeId,
      sourceX: ex,
      sourceY: ey,
      sourceZ: ez,
      eventType: "entity.spawn",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { cause: event.cause }
    });
  });
  world23.afterEvents.entityItemDrop.subscribe((event) => {
    if (!ENABLED_EVENTS.has("item.drop")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(playerEntry(e, "item.drop", {
        detail: {
          items: event.items.map(
            (item) => typeof item === "string" ? item : item?.typeId
          ).filter(Boolean)
        }
      }));
    } else {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(e),
        sourceType: "entity",
        sourceid: "",
        sourceName: e.typeId,
        sourceX: ex,
        sourceY: ey,
        sourceZ: ez,
        eventType: "item.drop",
        targetType: "",
        targetid: "",
        targetName: "",
        targetX: null,
        targetY: null,
        targetZ: null,
        detail: {
          items: event.items.map(
            (item) => typeof item === "string" ? item : item?.typeId
          ).filter(Boolean)
        }
      });
    }
  });
  world23.afterEvents.entityItemPickup.subscribe((event) => {
    if (!ENABLED_EVENTS.has("item.pickup")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(playerEntry(e, "item.pickup", {
        detail: {
          items: event.items.map((item) => item.type.id)
        }
      }));
    }
  });
  world23.afterEvents.blockContainerOpened.subscribe((event) => {
    if (!ENABLED_EVENTS.has("container.open")) return;
    const source = event.openSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(playerEntry(source, "container.open", {
      targetType: "block",
      targetName: event.block.typeId,
      targetX: bx,
      targetY: by,
      targetZ: bz
    }));
  });
  world23.afterEvents.blockContainerClosed.subscribe((event) => {
    if (!ENABLED_EVENTS.has("container.close")) return;
    const source = event.closeSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(playerEntry(source, "container.close", {
      targetType: "block",
      targetName: event.block.typeId,
      targetX: bx,
      targetY: by,
      targetZ: bz
    }));
  });
  world23.afterEvents.explosion.subscribe((event) => {
    if (!ENABLED_EVENTS.has("world.explosion")) return;
    const source = event.source;
    const dimension = event.dimension.id.replace("minecraft:", "");
    const [sx, sy, sz] = source ? loc(source.location) : [0, 0, 0];
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension,
      sourceType: source ? source.typeId === "minecraft:player" ? "player" : "entity" : "world",
      sourceid: source?.typeId === "minecraft:player" ? playerId(source) : "",
      sourceName: source?.typeId || "unknown",
      sourceX: sx,
      sourceY: sy,
      sourceZ: sz,
      eventType: "world.explosion",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { impactedBlocks: event.getImpactedBlocks().length }
    });
  });
}
async function doCleanup() {
  try {
    await HttpDB.cleanupActivities(KEEP_DAYS, true);
  } catch {
  }
}
var ActivityLog = class {
  static init() {
    if (initialized) return;
    initialized = true;
    subscribe();
    console.info("[ActivityLog] \u4E8B\u4EF6\u8BA2\u9605\u5B8C\u6210");
    system16.runInterval(flush, FLUSH_INTERVAL2 / 50);
    system16.runTimeout(() => {
      doCleanup();
      system16.runInterval(doCleanup, CLEANUP_INTERVAL / 50);
    }, 72e3 / 50);
  }
};

// scripts/entry.ts
var AddOnInit = class {
  static init() {
    this.registerEvents();
    this.createTasks();
    Peace.getInstance().init();
  }
  static registerEvents() {
    SpawnProtect.registerEvents();
    world24.beforeEvents.chatSend.subscribe((event) => {
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "\uFF01") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });
    system17.beforeEvents.startup.subscribe(async (e) => {
      await Storage.init();
      system17.run(() => {
        Money.initScoreboard();
        Command.registerHelpCommand();
        Permission.registerPermlistCommand();
        Command.register("menu", "menu.use", (player) => {
          if (player) MainMenu.show(player);
        }, "\u4E3B\u83DC\u5355");
        CoopSystem.init();
        ChatSystem.init();
        Clean.getInstance().init();
        init();
        TPS.getInstance().init();
        OnlineTime.getInstance().init();
        CreativeArea.getInstance().init();
        SurvivalArea.getInstance().init();
        InventorySwitcher.getInstance().init();
        LandSystem.init();
        MoneyCommand.init();
        ShopSystem.getInstance().init();
        ScoreboardSync.init();
        ActivityLog.init();
        Command.register("shop", "shop.use", (player) => {
          if (player) ShopSystem.getInstance().showShop(player);
        }, "\u5546\u5E97");
      });
    });
    world24.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        playerJoinEvent(event.player);
        reset(event.player);
      }
    });
  }
  /**
   * 创建定时任务
   */
  static createTasks() {
    QAManager.getInstance().start();
  }
};

// scripts/temp/ChatSoundsHelper.ts
import { system as system18, world as world25 } from "@minecraft/server";
var KEYWORDS = {
  "ciallo": "cs.ciallo",
  // Ciallo~
  "\u5495\u5495\u560E\u560E": "cs.gugugaga",
  // 咕咕嘎嘎！
  "\u6C69\u6C69\u5495": "cs.gugugu",
  // 汩汩咕
  "baka": "cs.baka",
  // BAKA!
  "yee": "cs.yee",
  // yee
  "\u5E72\u561B": "mob.chicken.hurt",
  // 鸡叫，不装神金资源包就是普通鸡叫
  "huh": "cs.huh"
  // huh 不安装神金资源包就没声音
};
var ChatSoundsHelper = class _ChatSoundsHelper {
  constructor(keyWords) {
    this.COOLDOWN = 20 * 10;
    this.keyWords = keyWords;
    this.playerCooldown = {};
    this.registerEvent();
  }
  static getInstance() {
    if (!_ChatSoundsHelper.instance) {
      _ChatSoundsHelper.instance = new _ChatSoundsHelper(KEYWORDS);
    }
    return _ChatSoundsHelper.instance;
  }
  registerEvent() {
    world25.beforeEvents.chatSend.subscribe((event) => {
      for (let keyWord in this.keyWords) {
        if (event.message.toLowerCase().includes(keyWord.toLowerCase())) {
          if (event.sender.getGameMode() !== "Creative") {
            let id = event.sender.id;
            if (this.playerCooldown[id]) {
              return;
            }
            this.playerCooldown[id] = true;
            system18.runTimeout(() => {
              delete this.playerCooldown[id];
            }, this.COOLDOWN);
          }
          system18.run(() => {
            world25.getAllPlayers().forEach((player) => {
              player.playSound(this.keyWords[keyWord]);
            });
          });
          return;
        }
      }
    });
  }
};

// scripts/main.ts
AddOnInit.init();
ChatSoundsHelper.getInstance();

//# sourceMappingURL=../debug/main.js.map
