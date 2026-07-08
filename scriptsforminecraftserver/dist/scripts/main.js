// scripts/entry.ts
import { system as system18, world as world27 } from "@minecraft/server";

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

// scripts/data/PermissionData.ts
var data = {
  CommetWind: 2,
  Shiroha7z: 3
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
  dimension.setBlockPermutation(pos, BlockPermutation.resolve("pale_oak_wall_sign", { facing_direction: facing }));
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
function formatTimestamp(ts) {
  const offset = 8 * 60;
  const d = new Date(ts + offset * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
var _systemMsgHandler = null;
function registerSystemMsgHandler(handler) {
  _systemMsgHandler = handler;
}
function generateId(type) {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
}
function toQueryString(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== void 0 && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length > 0 ? "?" + parts.join("&") : "";
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
var Permission = class {
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
        callback,
        permission,
        description: description === void 0 ? name : description
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
        system.run(async () => {
          const result = await commandInfo.callback(player);
          if (result !== void 0 && player) Msg.success(`${result}`, player);
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
    system.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        this.trigger(event.sourceEntity, event.id.substring(5));
      },
      { namespaces: ["doge"] }
    );
  }
};
Command.registerScriptEvent();

// scripts/doge/QA.ts
import { system as system2, world as world3 } from "@minecraft/server";

// scripts/data/Questions.ts
var Questions = [
  {
    weight: 1,
    // 出现的权重，权重越大越可能出现
    q: "\u5728\u300A\u4E1C\u65B9\u9B3C\u5F62\u517D\u300B\u4E2D, \u516D\u9762BOSS\u662F? (\u4E94\u4E2A\u5B57)",
    a: ["\u57F4\u5B89\u795E\u88BF\u59EC"],
    bonus: [
      {
        seq: [1, 5],
        // 1~5名答对者可以获得此奖励，留空则所有排名均可获得
        type: "money",
        // 奖励种类: 节操
        amount: 500
      }
    ]
  },
  {
    weight: 1,
    q: "\u6253\u4E00\u8F66\u4E07\u4EBA\u7269: \u5149\u660E\u725B\u5976\uFF08\u4E94\u4E2A\u5B57\uFF09",
    a: ["\u6851\u5C3C\u7C73\u5C14\u514B"],
    bonus: [
      {
        type: "item",
        // 奖励种类: 物品，仅支持give能给予的物品，特殊物品请使用指令给予（dogelake gift）
        itemType: "milk_bucket",
        amount: 1,
        data: 0
      }
    ]
  },
  {
    weight: 1,
    q: "\u8C01\u662F BBA ?",
    a: ["\u516B\u4E91\u7D2B", "\u7D2B", "\u7D2BBBA"],
    msg_right: "8\u8981\u547D\u5566\uFF1F",
    // 回答正确的提示
    bonus: [
      {
        type: "cmd",
        cmd: "damage @s 10"
      }
    ]
  },
  {
    weight: 1,
    q: "\u6253\u4E00\u8F66\u4E07\u4EBA\u7269: \u9752\u91D1\u77F3",
    a: ["\u8D6B\u5361\u63D0\u4E9A", "\u8D6B\u5361\u63D0\u4E9A\xB7\u62C9\u78A7\u65AF\u62C9\u7956\u5229", "\u8D6B\u5361\u63D0\u4E9A\u62C9\u78A7\u65AF\u62C9\u7956\u5229", "\u8D6B\u5361\u63D0\u4E9A \u62C9\u78A7\u65AF\u62C9\u7956\u5229"],
    d: "\u8D6B\u5361\u63D0\u4E9A \xB7 \u62C9\u78A7\u65AF\u62C9\u7956\u5229\u7684\u201C\u62C9\u78A7\u65AF\u62C9\u7956\u5229\u201D\uFF08Lapislazuli\uFF09\u5373\u4E3A\u201C\u9752\u91D1\u77F3\u201D",
    bonus: [
      {
        type: "money",
        amount: 500
      }
    ]
  },
  {
    weight: 1,
    q: "\u5728\u5C11\u6797\u5BFA\u5341\u516B\u94DC\u4EBA\u9635\u4E2D, \u542C\u58F0\u8FA8\u4F4D\u7684\u8003\u5B98\u662F\u4EC0\u4E48\u505A\u7684\uFF1F",
    a: ["\u8089", "\u4EBA\u8089", "\u8840\u8089"],
    msg_right: "\u4F60\u8FC7\u5173!",
    msg_wrong: "\u8BE5\u7F5A!",
    bonus: [
      {
        type: "money",
        amount: 500
      }
    ],
    punish: [
      {
        type: "cmd",
        cmd: "damage @s 10"
      }
    ]
  },
  {
    weight: 1,
    q: "\u9053\u5BB6\u5B66\u6D3E\u7684\u521B\u59CB\u4EBA\u662F",
    a: ["\u8001\u5B50"],
    bonus: [
      {
        type: "money",
        amount: 500
      }
    ]
  },
  {
    weight: 1,
    q: "\u4E2D\u534E\u4E09\u7956\u662F \u9EC4\u5E1D\u3001\u708E\u5E1D\u548C____",
    a: ["\u86A9\u5C24"],
    bonus: [
      {
        type: "money",
        amount: 500
      }
    ]
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
      name: "f1",
      dimension: "minecraft:overworld",
      start: [-16, 16],
      end: [-12, 12]
    },
    {
      name: "f2",
      dimension: "minecraft:overworld",
      start: [951, -2715],
      end: [4604, 5628]
    }
  ],
  // 创造区域
  creativeArea: [
    {
      name: "\u5EFA\u7B51\u533A",
      dimension: "minecraft:overworld",
      start: [-16, 16],
      end: [-12, 12]
    }
  ],
  // 和平区域
  peaceArea: [
    {
      dimension: "minecraft:overworld",
      start: [-16, 16],
      end: [-12, 12]
    },
    {
      dimension: "minecraft:overworld",
      start: [951, -2715],
      end: [4604, 5628]
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
      killList: ["shitcraft:shit"]
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
    "minecraft:bedrock"
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
    world3.sendMessage(
      `\xA7b[Baka Cirno]\xA7r \u6B63\u786E\u7B54\u6848\u662F \xA7e${question.a[0]}\xA7r ! ${question.d !== void 0 ? "\n  " + question.d : ""}`
    );
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
              Msg.tips(question["msg_right"], pl);
            } else {
              Msg.success("\xA7a\u56DE\u7B54\u6B63\u786E\uFF01\xA7r", pl);
            }
            return 1;
          }
        }
        if (question["msg_wrong"] !== void 0) {
          Msg.tips(question["msg_wrong"], pl);
        } else {
          Msg.error("\xA7c\u56DE\u7B54\u9519\u8BEF\uFF01\xA7r", pl);
        }
        this.wrongAmount++;
        if (question.punish !== void 0) {
          _QAManager.giveBonus(pl, this.wrongAmount, question.punish);
        }
        this.playerList[pl.nameTag] = false;
        return 0;
      }
      Msg.tips("\u5DF2\u7ECF\u7B54\u8FC7\u8FD9\u9898\u4E86^ ^\xA7r", pl);
      return -1;
    }
    Msg.tips("\u5F53\u524D\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u7B54\u9898^ ^\xA7r", pl);
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
              Msg.error(`Unknown bonus type: ${b["type"]}`, pl);
              break;
          }
        });
      }
    }
  }
};

// scripts/area/Fly.ts
import { system as system3, world as world4, GameMode } from "@minecraft/server";
function init() {
  Permission.register("fly.use", Permission.Any);
}
function playerJoinEvent(player) {
  system3.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      enableFly(player);
      Msg.info(`\u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`, player);
      player.setDynamicProperty("hpbe:dogefly", areaName);
    }
  }, 60);
}
system3.runInterval(() => {
  for (let player of world4.getPlayers({ gameMode: GameMode.Survival })) {
    let nowArea = player.getDynamicProperty("hpbe:dogefly");
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      if (nowArea === void 0) {
        enableFly(player);
        Msg.info(`\u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`, player);
        player.setDynamicProperty("hpbe:dogefly", areaName);
      } else if (nowArea !== areaName) {
        player.setDynamicProperty("hpbe:dogefly", areaName);
      }
    } else {
      if (nowArea !== void 0) {
        disableFly(player);
        Msg.info(`\u79BB\u5F00\u98DE\u884C\u533A ${nowArea}, \u5DF2\u5173\u95ED\u98DE\u884C\u6A21\u5F0F\u3002`, player);
        player.setDynamicProperty("hpbe:dogefly", void 0);
      }
    }
  }
}, 40);
function inFlyArea(entity) {
  for (let area of Config.flyArea) {
    if (entity.dimension.id === area.dimension) {
      if (pointInArea_2D(
        entity.location.x,
        entity.location.z,
        area.start[0],
        area.start[1],
        area.end[0],
        area.end[1]
      )) {
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
  let res = player.dimension.getBlockFromRay(
    player.location,
    { x: 0, y: -1, z: 0 },
    { includeLiquidBlocks: true, includePassableBlocks: false }
  );
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

// scripts/data/menu/main.ts
var main = {
  type: "button",
  permission: 0,
  title: "/D Doge",
  content: "\u5982\u51FA\u73B0\u6B64\u884C\u6587\u5B57\uFF0C\u8BF7\u68C0\u67E5\u662F\u5426\u5B8C\u6574\u4E0B\u8F7D\u670D\u52A1\u5668\u8D44\u6E90\uFF0C\u662F\u5426\u6709\u8D44\u6E90\u5305\u4E0E\u670D\u52A1\u5668\u8D44\u6E90\u5305\u51B2\u7A81\uFF0C\u5426\u5219\u53EF\u80FD\u4F1A\u5F71\u54CD\u5728\u672C\u670D\u7684\u6B63\u5E38\u6E38\u73A9\uFF01",
  buttons: [
    {
      title: "\u5546\u5E97",
      image: "",
      onClick: {
        type: "scriptCmd",
        run: "shop"
      }
    },
    {
      title: "\u6CB3\u7AE5\u7684\u7F57\u76D8",
      image: "",
      onClick: {
        type: "playerCmd",
        run: "xyz"
      }
    },
    {
      title: "\u5408\u4F5C\u793E",
      image: "",
      onClick: {
        type: "playerCmd",
        run: "warp"
      }
    },
    {
      title: "\u5929\u754C",
      image: "",
      onClick: {
        type: "playerCmd",
        run: "dogeworld bv"
      }
    },
    {
      title: "\u9886\u5730",
      image: "",
      onClick: {
        type: "playerCmd",
        run: "land"
      }
    },
    {
      title: "\u5BB6",
      image: "",
      onClick: {
        type: "playerCmd",
        run: "home"
      }
    },
    {
      title: "\u4EFB\u52A1",
      image: "",
      onClick: {
        type: "playerCmd",
        run: "tell @s \u6B64\u529F\u80FD\u5C1A\u5728\u5F00\u53D1\uFF0C\u656C\u8BF7\u671F\u5F85..."
      }
    },
    {
      title: "\u66F4\u591A",
      image: "",
      onClick: {
        type: "form",
        run: "more"
      }
    }
  ]
};

// scripts/data/menu/ad1.ts
var ad1 = {
  type: "button",
  op: "false",
  title: "/A textures/menu/ad_1.png",
  content: "",
  buttons: [
    {
      title: "",
      image: "",
      onClick: {}
    }
  ],
  exit: {
    type: "",
    run: ""
  }
};

// scripts/data/menu/more.ts
var more = {
  type: "button",
  op: "false",
  title: "\u66F4\u591A\u529F\u80FD",
  content: "",
  buttons: [
    {
      title: "\xA7l\u5E7F\u544A",
      image: "",
      onClick: {
        type: "form",
        run: "ad1"
      }
    },
    {
      title: "\xA7l\xA7a\u524D\xA73\u5F80\xA7c\u63D0\xA7d\u74E6\xA7e\u7279\xA76\u5927\xA7b\u9646",
      image: "textures/ui/monkey_god",
      onClick: {
        type: "playerCmd",
        run: "startgenshin"
      }
    },
    {
      title: "\xA7l\u4F20\u9001",
      image: "textures/items/hakurei_gohei",
      onClick: {
        type: "form",
        run: "tp"
      }
    },
    {
      title: "\xA7l\u6295\u7968\u91CD\u542F",
      image: "textures/ui/recap_glyph_color_2x",
      onClick: {
        type: "playerCmd",
        run: "voter"
      }
    },
    {
      title: "\xA7l\u266A\u97F3\u4E50\u76D2\u266C",
      image: "textures/ui/music_rumia_ddr",
      onClick: {
        type: "playerCmd",
        run: "tell @s \u6B64\u529F\u80FD\u6682\u65F6\u4E0B\u7EBF\uFF0C\u656C\u8BF7\u671F\u5F85\u3002"
      }
    }
  ],
  exit: {
    type: "",
    run: ""
  }
};

// scripts/data/menu/tp.ts
var tp = {
  type: "button",
  op: "false",
  title: "\u4F20\u9001\u7CFB\u7EDF",
  content: "\xA7d\u5FEB\u901F\u524D\u5F80\u4F60\u60F3\u53BB\u7684\u5730\u65B9",
  buttons: [
    {
      title: "\xA7lTPA",
      image: "textures/ui/FriendsDiversity",
      onClick: {
        type: "playerCmd",
        run: "/tpa"
      }
    },
    {
      title: "\xA7l\u4F20\u9001\u7535\u8BDD",
      image: "textures/ui/phone",
      onClick: {
        type: "playerCmd",
        run: "hifuutp"
      }
    },
    {
      title: "\xA7l\u524D\u5F80\u63D0\u74E6\u7279\u5927\u9646",
      image: "textures/ui/monkey_god",
      onClick: {
        type: "playerCmd",
        run: "startgenshin"
      }
    }
  ],
  exit: {
    type: "",
    run: ""
  }
};

// scripts/data/menu/index.ts
var forms = {
  main,
  ad1,
  more,
  tp
};
var menuItems = ["minecraft:brush"];

// scripts/doge/Menu.ts
import { world as world5 } from "@minecraft/server";

// scripts/libs/Gui.ts
import { system as system4 } from "@minecraft/server";
import {
  CustomForm,
  DataDrivenScreenClosedReason,
  ObservableBoolean,
  ObservableNumber,
  ObservableString
} from "@minecraft/server-ui";
var Gui = class {
  static async showForm(player, form, title, retryInterval = 10, timeoutTicks = 160) {
    const startTick = system4.currentTick;
    let notified = false;
    while (true) {
      if (system4.currentTick - startTick >= timeoutTicks) {
        Msg.warning(`\u83DC\u5355 [${title}] \u7B49\u5F85\u8D85\u65F6\uFF088\u79D2\uFF09\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u3002`, player);
        return DataDrivenScreenClosedReason.ClientClosed;
      }
      try {
        const reason = await form.show();
        if (reason === DataDrivenScreenClosedReason.UserBusy) {
          if (!notified) {
            notified = true;
            Msg.info(`\u60A8\u6709\u4E00\u5219\u83DC\u5355\u5904\u7406\uFF1A [${title}] \u8BF7\u5173\u95ED\u5F53\u524D\u754C\u9762\u540E\u663E\u793A\u3002\xA77\uFF08\u8D85\u65F68\u79D2\uFF09`, player);
          }
          await system4.waitTicks(retryInterval);
          continue;
        }
        return reason;
      } catch {
        return DataDrivenScreenClosedReason.ClientClosed;
      }
    }
  }
  static async confirm(player, title, body, onConfirm, onCancel) {
    let confirmed = false;
    const form = new CustomForm(player, title).label(body).button("\u786E\u8BA4", () => {
      confirmed = true;
      onConfirm();
    }).closeButton();
    await this.showForm(player, form, title);
    if (!confirmed) onCancel?.();
  }
};

// scripts/doge/Menu.ts
import { CustomForm as CustomForm2 } from "@minecraft/server-ui";
var Menu = class {
  static show(player, formName) {
    let formData = forms[formName];
    if (formData === void 0) {
      player.sendMessage("\u83DC\u5355\u4E0D\u5B58\u5728");
      return;
    }
    if (formData["permission"] > Permission.getPermission(player)) {
      player.sendMessage("\u4F60\u6CA1\u6709\u67E5\u770B\u8BE5\u83DC\u5355\u7684\u6743\u9650");
      return;
    }
    if (formData["buttons"] === void 0 || formData["buttons"].length === 0) {
      player.sendMessage("\u8FD9\u4E2A\u83DC\u5355\u6CA1\u6709\u6309\u94AE^ ^");
      return;
    }
    const form = new CustomForm2(player, formData["title"]);
    if (formData["content"]) form.label(formData["content"]);
    for (let btn of formData["buttons"]) {
      const data2 = btn["onClick"];
      form.button(btn["title"] || "", () => {
        this.clickButton(player, data2);
      });
    }
    form.closeButton();
    Gui.showForm(player, form, formData["title"]);
  }
  static clickButton(player, data2) {
    switch (data2.type) {
      case "playerCmd":
        player.runCommand(data2.run);
        break;
      case "scriptCmd":
        Command.trigger(player, data2.run);
        break;
      case "form":
        this.show(player, data2.run);
        break;
      default:
        break;
    }
  }
  static registerMenuItem() {
    try {
      world5.afterEvents.itemUseOn?.subscribe((event) => {
        if (menuItems.includes(event.itemStack.typeId)) {
          this.show(event.source, "main");
        }
      });
    } catch {
    }
  }
};
function init2() {
  Menu.registerMenuItem();
}

// scripts/doge/AFK.ts
import { system as system5, world as world6 } from "@minecraft/server";
var afkCache = /* @__PURE__ */ new Map();
function cacheGet(player, key, fallback) {
  const pc = afkCache.get(player.id);
  if (!pc || !pc.has(key)) return fallback;
  return pc.get(key);
}
function cacheSet(player, key, value) {
  let pc = afkCache.get(player.id);
  if (!pc) {
    pc = /* @__PURE__ */ new Map();
    afkCache.set(player.id, pc);
  }
  pc.set(key, value);
}
function cacheDelete(player, key) {
  const pc = afkCache.get(player.id);
  if (pc) pc.delete(key);
}
function init3() {
  console.log(`Initializing AFK...`);
  for (let player of world6.getAllPlayers()) {
    reset(player);
  }
  console.log(`AFK initialized successfully.`);
}
function reset(player) {
  cacheDelete(player, "afk:last_location");
  cacheDelete(player, "afk:step");
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
function setAFK(player) {
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world6.sendMessage(`\xA77* ${player.nameTag} is now AFK. *`);
  cacheSet(player, "afk:step", 0);
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
system5.runInterval(() => {
  for (let player of world6.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
    let lastLoaction = cacheGet(
      player,
      "afk:last_location",
      void 0
    );
    let nowLocation = player.location;
    if (lastLoaction !== void 0) {
      let nowStep = cacheGet(player, "afk:step", void 0);
      if (!locationMoved(lastLoaction, nowLocation)) {
        if (nowStep === void 0) {
          nowStep = 1;
        } else {
          nowStep++;
        }
        if (nowStep * STEP_TIME >= Config.AFKTime) {
          setAFK(player);
        } else {
          cacheSet(player, "afk:step", nowStep);
        }
      } else {
        cacheSet(player, "afk:step", 0);
      }
    }
    cacheSet(player, "afk:last_location", nowLocation);
  }
}, STEP_TIME * 20);
var intervalId = void 0;
var playerList = {};
function startAFKScan() {
  if (intervalId !== void 0) {
    return;
  }
  intervalId = system5.runInterval(() => {
    let count = 0;
    for (let id in playerList) {
      let player = world6.getEntity(id);
      if (player === void 0) {
        delete playerList[id];
      } else {
        if (locationMoved(playerList[id], player.location)) {
          world6.sendMessage(`\xA77* ${player.nameTag} is no longer AFK. *`);
          player.removeTag("AFK");
          cacheSet(player, "afk:last_location", player.location);
          cacheSet(player, "afk:step", 0);
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
  system5.clearRun(intervalId);
  intervalId = void 0;
}
function registerCommand() {
  Command.register("afk", "afk.use", setAFK, "\u8FDB\u5165AFK\u72B6\u6001");
  Command.register(
    "noafk",
    "afk.clear.other",
    (pl) => {
      if (pl) pl.addTag("NOAFK");
    },
    "\u4EE4\u73A9\u5BB6\u4E0D\u4F1A\u8FDB\u5165AFK\u72B6\u6001"
  );
}

// scripts/doge/SpawnProtect.ts
var SpawnProtect = class {
  static setProtect(player) {
    if (player.getEffect("minecraft:resistance") === void 0) {
      player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
    }
  }
};

// scripts/doge/Clean.ts
import { system as system6, world as world7, BlockComponentTypes as BlockComponentTypes2 } from "@minecraft/server";
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
  static {
    this.cleanIndex = 0;
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
    return _Clean.cleanIndex;
  }
  setCleanIndex(index) {
    _Clean.cleanIndex = index;
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
      system6.clearRun(this.intervalId);
      this.intervalId = void 0;
    }
    this.intervalId = system6.runInterval(() => {
      let entities = this.getAllItemEntities();
      if (entities.length > this.itemMax) {
        world7.sendMessage({ rawtext: [{ text: "\u300C\xA76\u8AAD\u7D4C\u3059\u308B\u30E4\u30DE\u30D3\u30B3 ~ \u5E7D\u8C37 \u97FF\u5B50\xA7f\u300D \u8DDD\u79BB\u6E05\u7406\u6389\u843D\u7269\u8FD8\u6709\xA7c 5 \xA7fs" }] });
        system6.runTimeout(() => {
          this.startClean(void 0);
          system6.runTimeout(() => {
            world7.sendMessage({ rawtext: [{ text: "\xA7a* \u5DF2\u6E05\u7406\u6389\u843D\u7269 *" }] });
          }, 5);
        }, 100);
      }
    }, this.timeout * 20);
  }
  stopCleanInterval() {
    if (this.intervalId) {
      system6.clearRun(this.intervalId);
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
  Command.register(
    "clean",
    "clean.admin",
    () => {
      Clean.getInstance().startClean(void 0);
    },
    "\u5F00\u59CB\u626B\u5730"
  );
}

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
        if (pointInArea_2D(
          entity.location.x,
          entity.location.z,
          area.start[0],
          area.start[1],
          area.end[0],
          area.end[1]
        )) {
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
    Command.register(
      "peace",
      "peace.toggle",
      () => {
        return _Peace.getInstance().switchPeace() ? "\u5F00\u542F\u533A\u57DF\u548C\u5E73" : "\u5173\u95ED\u533A\u57DF\u548C\u5E73";
      },
      "\u5207\u6362\u533A\u57DF\u548C\u5E73"
    );
  }
};

// scripts/coop/Database.ts
var Database = class {
  static {
    // ==========================================
    //  内部工具 — 内存 KV 存储（会话级持久化）
    // ==========================================
    this.memoryStore = /* @__PURE__ */ new Map();
  }
  static {
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
    if (this.memoryStore.has(key)) return this.memoryStore.get(key);
    this.memoryStore.set(key, fallback);
    return fallback;
  }
  static writeJSON(key, value) {
    this.memoryStore.set(key, value);
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
    this.writeJSON(
      this.KEY_COOP_DATA,
      this.getAllCoop().filter((e) => e.cid !== cid)
    );
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
    this.writeJSON(
      this.KEY_SHOP_GOODS,
      this.getAllGoods().filter((e) => e.id !== id)
    );
  }
  static deleteGoodsByCid(cid) {
    this.writeJSON(
      this.KEY_SHOP_GOODS,
      this.getAllGoods().filter((e) => e.cid !== cid)
    );
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
      {
        groupid: "default_block",
        displayname: "\u9ED8\u8BA4\u65B9\u5757",
        displaydescribe: "\u65B9\u5757\u7C7B\u7269\u54C1",
        icon: "/textures/ui/icon_recipe_construction",
        type_function: { mode_enum: ["default_block"] }
      },
      {
        groupid: "default_item",
        displayname: "\u9ED8\u8BA4\u7269\u54C1",
        displaydescribe: "\u7269\u54C1\u7C7B",
        icon: "/textures/ui/icon_recipe_item",
        type_function: { mode_enum: ["default_item"] }
      },
      {
        groupid: "default_equip",
        displayname: "\u9ED8\u8BA4\u88C5\u5907",
        displaydescribe: "\u88C5\u5907\u6B66\u5668\u7C7B",
        icon: "/textures/ui/icon_recipe_equipment",
        type_function: {
          type_enum: [
            "minecraft:bow",
            "minecraft:arrow",
            "minecraft:crossbow",
            "minecraft:trident",
            "minecraft:shield",
            "minecraft:mace",
            "minecraft:elytra",
            "minecraft:wolf_armor",
            "minecraft:saddle"
          ],
          type_reg_enum: [
            "[a-z].+_shovel",
            "[a-z].+_axe",
            "[a-z].+_sword",
            "[a-z].+_hoe",
            "[a-z].+_pickaxe",
            "[a-z].+_horse_armor"
          ]
        }
      },
      {
        groupid: "default_book",
        displayname: "\u4E66\u7C4D",
        displaydescribe: "\u4E0E\u4E66\u76F8\u5173",
        icon: "/textures/items/book_enchanted",
        type_function: {
          type_enum: [
            "minecraft:book",
            "minecraft:bookshelf",
            "minecraft:writable_book",
            "minecraft:enchanted_book",
            "minecraft:chiseled_bookshelf"
          ]
        }
      },
      {
        groupid: "default_shulker_box",
        displayname: "\u6F5C\u5F71\u76D2",
        displaydescribe: "\u5404\u79CD\u6F5C\u5F71\u76D2",
        icon: "/textures/items/shulker_shell",
        type_function: { type_reg_enum: ["[a-z].+_shulker_box"] }
      },
      {
        groupid: "default_potion",
        displayname: "\u836F\u6C34",
        displaydescribe: "\u836F\u6C34\u7C7B",
        icon: "/textures/items/potion_bottle_heal",
        type_function: { type_enum: ["minecraft:splash_potion", "minecraft:potion", "minecraft:lingering_potion"] }
      }
    ];
    for (const g of defaults) this.saveGroup(g);
  }
};

// scripts/gui/CoopGUI.ts
import { CustomForm as CustomForm3, ObservableString as ObservableString2, ObservableNumber as ObservableNumber2 } from "@minecraft/server-ui";

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
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E").label(ListFormInfo(["\u4F60\u6CA1\u6709\u52A0\u5165\u4EFB\u4F55\u4E00\u4E2A\u5408\u4F5C\u793E\uFF0C\u8BF7\u9009\u62E9\u64CD\u4F5C\u3002\n\nCiallo\uFF5E(\u2220\u30FB\u03C9\uFF1C)\u2322\u2606"])).button("\u901A\u8FC7 CID \u52A0\u5165\u5408\u4F5C\u793E", () => this.joinByCid()).button("\u67E5\u770B\u6240\u6709\u5408\u4F5C\u793E", () => this.coopList()).button("\u521B\u5EFA\u5408\u4F5C\u793E", () => this.createCoop()).button("\u5408\u4F5C\u793E\u6392\u884C\u699C", () => this.rank(1)).button("\u63D2\u4EF6\u66F4\u65B0\u65E5\u5FD7", () => this.log()).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E").catch(() => {
    });
  }
  // ==========================================
  //  加入 / 列表 / 创建
  // ==========================================
  joinByCid() {
    let clicked = false;
    const obsCid = new ObservableString2("");
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u52A0\u5165\u5408\u4F5C\u793E").textField("CID", obsCid, { description: "\u4EC5\u652F\u6301\u82F1\u6587/\u6570\u5B57" }).button("\u786E\u8BA4", () => {
      clicked = true;
      const cid = obsCid.getData()?.trim();
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
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u52A0\u5165\u5408\u4F5C\u793E").then(() => {
      if (!clicked) this.mainPanel();
    }).catch(() => {
    });
  }
  coopList() {
    const all = Database.getAllCoop();
    if (all.length === 0) {
      this.errorPop("\u8FD8\u6CA1\u6709\u4EFB\u4F55\u5408\u4F5C\u793E");
      return;
    }
    let clicked = false;
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E\u5217\u8868");
    for (const c of all) {
      const coopCid = c.cid;
      form.button(c.name, () => {
        clicked = true;
        this.coopInfoPanel(coopCid, "info");
      });
    }
    form.button("\xA7l\u8FD4\u56DE", () => {
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E\u5217\u8868").then(() => {
      if (!clicked) this.mainPanel();
    }).catch(() => {
    });
  }
  createCoop() {
    let clicked = false;
    const obsName = new ObservableString2("");
    const obsCid = new ObservableString2("");
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u521B\u5EFA\u5408\u4F5C\u793E").textField("\u5408\u4F5C\u793E\u540D\u79F0", obsName).textField("CID", obsCid, { description: "\u4EC5\u652F\u6301\u82F1\u6587/\u6570\u5B57\uFF0C\u7528\u4F5C\u9080\u8BF7\u7801" }).button("\u786E\u8BA4", () => {
      clicked = true;
      const name = obsName.getData();
      const cid = obsCid.getData();
      if (!name || !cid) {
        this.errorPop("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F");
        return;
      }
      if (CoopCore.registerCoop(name, cid, this.player)) {
        this.infoPop("\u5408\u4F5C\u793E\u521B\u5EFA\u6210\u529F\uFF01");
      } else {
        this.errorPop(`\u4F60\u7684${Money.UNIT}\u4F3C\u4E4E\u4E0D\u591F\u6216CID\u5DF2\u88AB\u5360\u7528\uFF01`);
      }
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u521B\u5EFA\u5408\u4F5C\u793E").then(() => {
      if (!clicked) this.mainPanel();
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
      const form2 = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u52A0\u5165\u786E\u8BA4").label(ListFormInfo([text])).button("\u52A0\u5165", () => CoopCore.joinCoop(this.player, cid)).button("\xA7l\u8FD4\u56DE", () => {
      }).closeButton();
      Gui.showForm(this.player, form2, "\u5408\u4F5C\u793E - \u52A0\u5165\u786E\u8BA4").catch(() => {
      });
      return;
    }
    const isOp = CoopCore.isOp(this.player.name, cid);
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E").label(ListFormInfo([text])).button("\u96C6\u4F53\u5546\u5E97\u540E\u53F0", () => this.shopMgr(cid, 1)).button("\u516C\u6709\u94F6\u884C", () => this.bankPanel(cid)).button("\u6210\u5458\u5217\u8868", () => this.infoPop(CoopCore.getMemberList(cid).join(", "))).button("\u67E5\u770B\u6240\u6709\u5408\u4F5C\u793E", () => this.coopList()).button("\u5408\u4F5C\u793E\u6392\u884C\u699C", () => this.rank(1)).button(isOp ? "\u89E3\u6563\u6B64\u5408\u4F5C\u793E" : "\u9000\u51FA\u6B64\u5408\u4F5C\u793E", () => this.exitConfirm(cid)).button("\u63D2\u4EF6\u66F4\u65B0\u65E5\u5FD7", () => this.log());
    if (isOp) form.button("\u7BA1\u7406\u9762\u677F", () => this.adminPanel(cid));
    form.closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E").catch(() => {
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
    let clicked = false;
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u7BA1\u7406\u9762\u677F").label(ListFormInfo(["\xA76CID:\xA7r " + cid])).button("\u7F16\u8F91\u516C\u544A", () => {
      clicked = true;
      this.editNotice(cid);
    }).button("\u5411\u6240\u6709\u6210\u5458\u558A\u8BDD", () => {
      clicked = true;
      this.talkToMembers(cid);
    }).button("\u6DFB\u52A0\u7BA1\u7406\u6210\u5458", () => {
      clicked = true;
      this.addAdmin(cid);
    }).button("\xA7l\u8FD4\u56DE", () => {
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u7BA1\u7406\u9762\u677F").then(() => {
      if (!clicked) this.coopInfoPanel(cid, "menu");
    }).catch(() => {
    });
  }
  editNotice(cid) {
    let clicked = false;
    const obsNotice = new ObservableString2("");
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u7F16\u8F91\u516C\u544A").textField("\u516C\u544A\u5185\u5BB9", obsNotice).button("\u786E\u8BA4", () => {
      clicked = true;
      CoopCore.setNotice(cid, obsNotice.getData() || "");
      this.infoPop("\u8BBE\u7F6E\u6210\u529F\u3002");
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u7F16\u8F91\u516C\u544A").then(() => {
      if (!clicked) this.coopInfoPanel(cid, "menu");
    }).catch(() => {
    });
  }
  talkToMembers(cid) {
    let clicked = false;
    const obsMsg = new ObservableString2("");
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u5411\u6240\u6709\u6210\u5458\u558A\u8BDD").textField("\u558A\u8BDD\u5185\u5BB9", obsMsg, { description: "(\u1D5C \u02F0 \u1D5C)" }).button("\u786E\u8BA4", () => {
      clicked = true;
      CoopCore.sendToMembers(cid, this.player.name + ": " + obsMsg.getData());
      this.infoPop("\u558A\u8BDD\u6210\u529F\u3002");
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u5411\u6240\u6709\u6210\u5458\u558A\u8BDD").then(() => {
      if (!clicked) this.coopInfoPanel(cid, "menu");
    }).catch(() => {
    });
  }
  addAdmin(cid) {
    const members = CoopCore.getMemberList(cid);
    if (members.length === 0) return;
    const memberItems = members.map((m, i) => ({ label: m, value: i }));
    let clicked = false;
    const obsIdx = new ObservableNumber2(0);
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u6DFB\u52A0\u7BA1\u7406").dropdown("\u5C06\u5408\u4F5C\u793E\u4E2D\u7684\u6210\u5458\u6743\u9650\u63D0\u5347\u81F3\u7BA1\u7406\u5458...", obsIdx, memberItems).button("\u786E\u8BA4", () => {
      clicked = true;
      const idx = obsIdx.getData();
      this.confirmPop("\u5408\u4F5C\u793E - \u786E\u8BA4", "\u76EE\u6807\u73A9\u5BB6\u4F1A\u83B7\u5F97\u7BA1\u7406\u9762\u677F\u7684\u4F7F\u7528\u6743\uFF0C\u786E\u8BA4\u64CD\u4F5C\u5417\uFF1F", () => {
        CoopCore.setOp(cid, idx);
        this.tipsPop("\u64CD\u4F5C\u6210\u529F\u3002");
      });
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u6DFB\u52A0\u7BA1\u7406").then(() => {
      if (!clicked) this.coopInfoPanel(cid, "menu");
    }).catch(() => {
    });
  }
  // ==========================================
  //  银行
  // ==========================================
  bankPanel(cid) {
    const data2 = Database.getCoopByCid(cid);
    if (!data2) return;
    let clicked = false;
    const obsAction = new ObservableNumber2(0);
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u94F6\u884C").dropdown("\u8BF7\u9009\u62E9\u64CD\u4F5C", obsAction, [{ label: "\u5B58\u5165", value: 0 }, { label: "\u53D6\u51FA", value: 1 }]).label("\xA76\u5408\u4F5C\u793E\u94F6\u884C\u7ECF\u6D4E\uFF1A\xA7r" + data2.money + "\n\xA76\u8D26\u5355\uFF1A\xA7r\n" + data2.moneylist).button("\u786E\u8BA4", () => {
      clicked = true;
      this.bankControl(cid, obsAction.getData() + 1);
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u94F6\u884C").then(() => {
      if (!clicked) this.coopInfoPanel(cid, "menu");
    }).catch(() => {
    });
  }
  bankControl(cid, type) {
    const title = type === 1 ? "\u5B58\u5165" + Money.UNIT : "\u53D6\u51FA" + Money.UNIT;
    let clicked = false;
    const obsAmount = new ObservableString2("");
    const obsNote = new ObservableString2("");
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - " + title).textField("\u91D1\u989D", obsAmount).textField("\u5907\u6CE8(\u53EF\u9009)", obsNote, { description: "\u65E0" }).button("\u786E\u8BA4", () => {
      clicked = true;
      const val = parseInt(obsAmount.getData());
      if (isNaN(val) || val <= 0) {
        this.errorPop("\u91D1\u989D\u586B\u5199\u4E0D\u6B63\u786E");
        return;
      }
      if (CoopCore.bankControl(cid, this.player, val, obsNote.getData() || "", type === 1 ? 1 : 2)) {
        if (type === 1) Msg.success("\u5B58\u5165\u6210\u529F\uFF01" + Money.UNIT + "\uFF1A" + val, this.player);
        else Msg.success("\u53D6\u51FA\u6210\u529F\uFF01" + Money.UNIT + "\uFF1A" + val, this.player);
      } else {
        this.errorPop("\u91D1\u989D\u586B\u5199\u4E0D\u6B63\u786E");
      }
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - " + title).then(() => {
      if (!clicked) this.coopInfoPanel(cid, "menu");
    }).catch(() => {
    });
  }
  // ==========================================
  //  排行榜
  // ==========================================
  rank(type) {
    const obsType = new ObservableNumber2(type - 1);
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u6392\u884C\u699C").label(CoopCore.getRankInfo(type)).dropdown("\u5207\u6362\u6392\u884C\u699C", obsType, [{ label: "\u94F6\u884C\u7ECF\u6D4E", value: 0 }, { label: "\u4EBA\u6570", value: 1 }]).button("\u786E\u8BA4", () => this.rank(obsType.getData() + 1)).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u6392\u884C\u699C").catch(() => {
    });
  }
  // ==========================================
  //  更新日志
  // ==========================================
  log() {
    const form = new CustomForm3(this.player, "\u5408\u4F5C\u793E - \u66F4\u65B0\u65E5\u5FD7").label(ListFormInfo(["\u6682\u65E0\u66F4\u65B0\u65E5\u5FD7\u3002"])).button("\xA7l\u8FD4\u56DE", () => {
    }).closeButton();
    Gui.showForm(this.player, form, "\u5408\u4F5C\u793E - \u66F4\u65B0\u65E5\u5FD7").catch(() => {
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
        const form = new CustomForm3(this.player, "\u5546\u5E97\u7BA1\u7406\u540E\u53F0").label(ListFormInfo(["\u9009\u62E9\u64CD\u4F5C"])).button("\u4E0A\u67B6\u7269\u54C1", () => this.shopAdd(cid, 1)).button("\u56DE\u6536\u7269\u54C1\u7BA1\u7406", () => this.shopMgr(cid, 6)).button("\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4", () => this.shopAdd(cid, 4));
        if (isOp) form.button("\u56DE\u6536\u62DB\u52DF\u5BA1\u6838", () => {
          if (!this.shopMgr(cid, 8)) this.tipsPop("\u6CA1\u6709\u5F85\u5BA1\u6838\u7684\u56DE\u6536\u62DB\u52DF");
        });
        for (const g of goods) {
          const goodItem = g;
          form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, true), () => this.shopMgr(cid, 2, goodItem.id));
        }
        form.button("\xA7l\u8FD4\u56DE", () => this.coopInfoPanel(cid, "menu")).closeButton();
        Gui.showForm(this.player, form, "\u5546\u5E97\u7BA1\u7406\u540E\u53F0").catch(() => {
        });
        break;
      }
      // ---- step 2: 选择操作（补货/下架/编辑） ----
      case 2: {
        if (!good) return;
        const obsAction = new ObservableNumber2(0);
        const form = new CustomForm3(this.player, "\u5546\u5E97\u7BA1\u7406\u540E\u53F0").label("gid:" + gid).dropdown("\u64CD\u4F5C", obsAction, [{ label: "\u8865\u8D27", value: 0 }, { label: "\u4E0B\u67B6", value: 1 }, { label: "\u7F16\u8F91", value: 2 }]).button("\u786E\u8BA4", () => this.shopMgr(cid, obsAction.getData() + 3, gid)).closeButton();
        Gui.showForm(this.player, form, "\u5546\u5E97\u7BA1\u7406\u540E\u53F0").catch(() => {
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
        let clicked = false;
        const obsNum = new ObservableNumber2(1);
        const form = new CustomForm3(this.player, "\u8865\u8D27").label("\u5F53\u524D\u5E93\u5B58\uFF1A" + good.num).slider("\u8865\u8D27\u6570\u91CF", obsNum, 1, Math.max(total, 1), { step: 1 }).button("\u786E\u8BA4", () => {
          clicked = true;
          const num = obsNum.getData();
          if (num <= 0) {
            this.errorPop("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F\uFF01");
            return;
          }
          good.num += num;
          Database.saveGood(good);
          this.player.runCommand(
            'clear "' + this.player.name + '" ' + good.item.type + " " + good.item.aux + " " + num
          );
          Msg.success("\u8865\u8D27\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        }).closeButton();
        Gui.showForm(this.player, form, "\u8865\u8D27").then(() => {
          if (!clicked) this.shopMgr(cid, 1);
        }).catch(() => {
        });
        break;
      }
      // ---- step 4: 下架确认 ----
      case 4: {
        if (!good) return;
        this.confirmPop("\u4E0B\u67B6\u786E\u8BA4", "\u786E\u8BA4\u4E0B\u67B6 " + good.name + " \uFF1F\n\u4E0B\u67B6\u540E\u5E93\u5B58\u5C06\u8FD4\u8FD8\u7ED9\u4F60\u3002", () => {
          Database.deleteGood(gid);
          this.player.runCommand(
            'give "' + this.player.name + '" ' + good.item.type + " " + good.num + " " + good.item.aux
          );
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
        const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));
        let clicked = false;
        const obsName = new ObservableString2(good.name);
        const obsDes = new ObservableString2(good.des);
        const obsPrice = new ObservableString2(String(good.money));
        const obsGroup = new ObservableNumber2(0);
        const form = new CustomForm3(this.player, "\u7F16\u8F91\u5546\u54C1\u4FE1\u606F").textField("\u5546\u54C1\u540D\u79F0", obsName).textField("\u5546\u54C1\u63CF\u8FF0", obsDes).textField("\u4EF7\u683C", obsPrice).dropdown("\u81EA\u5B9A\u4E49\u5206\u7EC4", obsGroup, cgItems).button("\u786E\u8BA4", () => {
          clicked = true;
          good.name = obsName.getData();
          good.des = obsDes.getData();
          good.money = parseInt(obsPrice.getData()) || 0;
          const cgIdx = obsGroup.getData();
          if (cgIdx > 0) {
            const idx = good.groups.findIndex((g) => customGroups.some((cg) => cg.groupid === g));
            if (idx !== -1) good.groups.splice(idx, 1);
            good.groups.push(customGroups[cgIdx - 1].groupid);
          }
          Database.saveGood(good);
          Msg.success("\u4FEE\u6539\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        }).closeButton();
        Gui.showForm(this.player, form, "\u7F16\u8F91\u5546\u54C1\u4FE1\u606F").then(() => {
          if (!clicked) this.shopMgr(cid, 1);
        }).catch(() => {
        });
        break;
      }
      // ---- step 6: 回收物品管理列表 ----
      case 6: {
        const goods2 = CoopCore.getGoods(1, true, 2, cid);
        const form = new CustomForm3(this.player, "\u5546\u5E97\u7BA1\u7406\u540E\u53F0").label(ListFormInfo(["\u56DE\u6536\u7269\u54C1\u7BA1\u7406"]));
        for (const g of goods2) {
          const goodItem = g;
          form.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, false), () => this.shopMgr(cid, 7, goodItem.id));
        }
        form.button("\xA7l\u8FD4\u56DE", () => this.shopMgr(cid, 1)).closeButton();
        Gui.showForm(this.player, form, "\u5546\u5E97\u7BA1\u7406\u540E\u53F0").catch(() => {
        });
        break;
      }
      // ---- step 7: 取出回收库存 ----
      case 7: {
        if (!good || good.sv <= 0) {
          this.errorPop("\u6682\u65F6\u6CA1\u6709\u9700\u8981\u53D6\u51FA\u7684\u5E93\u5B58\u3002");
          break;
        }
        let clicked = false;
        const obsNum = new ObservableNumber2(1);
        const form = new CustomForm3(this.player, "\u53D6\u51FA\u56DE\u6536\u5E93\u5B58").slider("\u53D6\u51FA\u6570\u91CF", obsNum, 1, good.sv, { step: 1 }).button("\u786E\u8BA4", () => {
          clicked = true;
          const num = obsNum.getData();
          good.sv -= num;
          Database.saveGood(good);
          this.player.runCommand(
            'give "' + this.player.name + '" ' + good.item.type + " " + num + " " + good.item.aux
          );
          Msg.success("\u53D6\u51FA\u6210\u529F\u3002", this.player);
          this.shopMgr(cid, 1);
        }).closeButton();
        Gui.showForm(this.player, form, "\u53D6\u51FA\u56DE\u6536\u5E93\u5B58").then(() => {
          if (!clicked) this.shopMgr(cid, 1);
        }).catch(() => {
        });
        break;
      }
      // ---- step 8: 回收招募审核 ----
      case 8: {
        const goods1 = CoopCore.getGoods(1, true, 2, cid, void 0, false);
        if (goods1.length === 0) return false;
        const form = new CustomForm3(this.player, "\u56DE\u6536\u62DB\u52DF\u5BA1\u6838\u5217\u8868");
        for (const g of goods1) {
          const goodItem = g;
          form.button(g.name + " " + unit + g.money + "\n\u5F85\u5BA1\u6838", () => {
            this.confirmPop(
              "\u56DE\u6536\u62DB\u52DF\u5BA1\u6838\u5217\u8868",
              "\u540D\u79F0: " + goodItem.name + "\n\u63CF\u8FF0: " + (goodItem.des || "") + "\n\u4EF7\u683C: " + goodItem.money + "\n\u5E93\u5B58: " + goodItem.num + "\n\n\u786E\u5B9A\u901A\u8FC7\u5BA1\u6838\uFF1F",
              () => {
                goodItem.isTrue = true;
                Database.saveGood(goodItem);
                Msg.success("\u64CD\u4F5C\u6210\u529F\u3002", this.player);
              }
            );
          });
        }
        form.closeButton();
        Gui.showForm(this.player, form, "\u56DE\u6536\u62DB\u52DF\u5BA1\u6838\u5217\u8868").catch(() => {
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
        const obsSlot = new ObservableNumber2(0);
        const obsType = new ObservableNumber2(0);
        const form = new CustomForm3(this.player, "\u4E0A\u67B6\u7269\u54C1").dropdown("\u8BF7\u9009\u62E9\u7269\u54C1\u680F", obsSlot, [{ label: "1", value: 0 }, { label: "2", value: 1 }, { label: "3", value: 2 }, { label: "4", value: 3 }, { label: "5", value: 4 }, { label: "6", value: 5 }, { label: "7", value: 6 }, { label: "8", value: 7 }, { label: "9", value: 8 }]).dropdown("\u8BF7\u9009\u62E9\u64CD\u4F5C\u7C7B\u578B", obsType, [{ label: "\u6C42\u8D2D", value: 0 }, { label: "\u56DE\u6536", value: 1 }]).button("\u786E\u8BA4", () => this.shopAdd(cid, obsType.getData() + 2, obsSlot.getData())).closeButton();
        Gui.showForm(this.player, form, "\u4E0A\u67B6\u7269\u54C1").catch(() => {
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
        const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));
        const obsType = new ObservableString2(item.typeId);
        const obsName = new ObservableString2(item.typeId);
        const obsDes = new ObservableString2("");
        const obsPrice = new ObservableString2("0");
        const obsGroup = new ObservableNumber2(0);
        const form = new CustomForm3(this.player, "\u5546\u54C1\u4FE1\u606F").textField("type: " + item.typeId, obsType, { description: item.typeId }).textField("\u5546\u54C1\u540D\u79F0", obsName, { description: item.typeId }).textField("\u5546\u54C1\u63CF\u8FF0", obsDes).textField("\u4EF7\u683C", obsPrice, { description: "0" }).dropdown("\u81EA\u5B9A\u4E49\u5206\u7EC4", obsGroup, cgItems).button("\u786E\u8BA4", () => {
          const money = parseInt(obsPrice.getData()) || 0;
          const cgIdx = obsGroup.getData();
          const gt = [];
          if (cgIdx > 0) gt.push(customGroups[cgIdx - 1].groupid);
          gt.push(...CoopCore.typeGood(item));
          const newGood = {
            name: obsName.getData(),
            id: CoopCore.generateId(),
            time: Date.now(),
            type: 1,
            groups: gt,
            des: obsDes.getData(),
            num: 1,
            sv: 0,
            money,
            cid,
            isTrue: true,
            item: { nbt: "", type: item.typeId, aux: 0 }
          };
          Database.saveGood(newGood);
          Msg.success("\u4E0A\u67B6\u6210\u529F\uFF01", this.player);
        }).closeButton();
        Gui.showForm(this.player, form, "\u5546\u54C1\u4FE1\u606F").catch(() => {
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
        const obsName = new ObservableString2("");
        const form = new CustomForm3(this.player, "\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4").textField("\u5206\u7EC4\u540D\u79F0", obsName).button("\u786E\u8BA4", () => {
          const name = obsName.getData()?.trim();
          if (!name) {
            this.errorPop("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F\uFF01");
            return;
          }
          Database.saveGroup({ groupid: "custom_" + _genId(), displayname: name });
          Msg.success("\u64CD\u4F5C\u6210\u529F\u3002", this.player);
        }).closeButton();
        Gui.showForm(this.player, form, "\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4").catch(() => {
        });
        break;
      }
    }
  }
};

// scripts/coop/CoopSystem.ts
var CoopSystem = class {
  static init() {
    console.log(`Initializing CoopSystem...`);
    Database.initDefaultGroups();
    console.log(`CoopSystem initialized successfully.`);
  }
  static registerPermissions() {
    Permission.register("coop.use", Permission.Member);
    Permission.register("coop.admin", Permission.OP);
    Permission.register("coopshop.use", Permission.Member);
  }
  static registerCommands() {
    Command.register(
      "coop",
      "coop.use",
      (player) => {
        if (player) new CoopGUI(player).mainPanel();
      },
      "\u5408\u4F5C\u793E"
    );
    Command.register(
      "coopshop",
      "coopshop.use",
      (player) => {
        if (!player) return;
        new CoopGUI(player).shopMgr(Database.getPlayerCid(player.name) ?? "", 1);
      },
      "\u5408\u4F5C\u793E\u5546\u5E97"
    );
  }
  static registerEvents() {
  }
};

// scripts/chat/ChatSystem.ts
import { world as world12, system as system8 } from "@minecraft/server";

// scripts/chat/DogeChat.ts
import { world as world10 } from "@minecraft/server";

// scripts/libs/HttpDB.ts
import { http, HttpRequest } from "@minecraft/server-net";
var BASE_URL = `http://${Config.dbHost}:${Config.dbPort}`;
var TIMEOUT = 3;
var HttpDB = class _HttpDB {
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
  static async fetchJSON(basePath, id, key) {
    const body = await _HttpDB.get(`${basePath}/${encodeURIComponent(id)}`);
    if (!body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed[key] ?? null;
    } catch {
      return null;
    }
  }
  // ---- 通用 HTTP 方法 ----
  static async request(method, path, bodyData) {
    try {
      const req = new HttpRequest(`${BASE_URL}${path}`);
      req.timeout = TIMEOUT;
      req.method = method;
      if (bodyData) {
        req.body = JSON.stringify(bodyData);
        req.addHeader("Content-Type", "application/json");
      }
      const res = await http.request(req);
      return { status: res.status, body: res.body };
    } catch (err) {
      this.available = false;
      console.error(`[HttpDB] ${method} ${path} \u7F51\u7EDC\u9519\u8BEF: ${err}`);
      return { status: 0, body: "" };
    }
  }
  static async get(path) {
    const { status, body } = await this.request("Get", path);
    if (status !== 200) {
      console.warn(`[HttpDB] GET ${path} \u8FD4\u56DE ${status} \u2014 ${body?.slice(0, 200)}`);
    }
    return status === 200 ? body : null;
  }
  static async post(path, bodyData) {
    const { status, body } = await this.request("Post", path, bodyData);
    if (status !== 200) {
      console.warn(`[HttpDB] POST ${path} \u8FD4\u56DE ${status} \u2014 ${body?.slice(0, 200)}`);
    }
    return status === 200;
  }
  static async put(path, bodyData) {
    const { status, body } = await this.request("Put", path, bodyData);
    if (status !== 200) {
      console.warn(`[HttpDB] PUT ${path} \u8FD4\u56DE ${status} \u2014 ${body?.slice(0, 200)}`);
    }
    return status === 200;
  }
  static async patch(path, bodyData) {
    const { status, body } = await this.request("Patch", path, bodyData);
    if (status !== 200) {
      console.warn(`[HttpDB] PATCH ${path} \u8FD4\u56DE ${status} \u2014 ${body?.slice(0, 200)}`);
    }
    return status === 200;
  }
  static async del(path) {
    const { status, body } = await this.request("Delete", path);
    if (status !== 200) {
      console.warn(`[HttpDB] DELETE ${path} \u8FD4\u56DE ${status} \u2014 ${body?.slice(0, 200)}`);
    }
    return status === 200;
  }
  // ---- Holoprint 投影 ----
  static async uploadHoloStructure(projection, structureBase64) {
    return this.post("/api/hpbe/upload", { projection, structure: structureBase64 });
  }
  static async getHoloProjections(ownerId, visibility) {
    const qs = [];
    if (ownerId) qs.push(`owner_id=${encodeURIComponent(ownerId)}`);
    if (visibility) qs.push(`visibility=${encodeURIComponent(visibility)}`);
    const query = qs.length > 0 ? "?" + qs.join("&") : "";
    const body = await this.get(`/api/hpbe/projections${query}`);
    if (!body) return null;
    try {
      return JSON.parse(body).projections;
    } catch {
      return null;
    }
  }
  static async getHoloProjection(id) {
    const body = await this.get(`/api/hpbe/projections/${encodeURIComponent(id)}`);
    if (!body) return null;
    try {
      return JSON.parse(body).projection;
    } catch {
      return null;
    }
  }
  static async updateHoloProjection(id, settings) {
    return this.post(`/api/hpbe/projections/${encodeURIComponent(id)}`, { settings });
  }
  static async deleteHoloProjection(id) {
    return this.del(`/api/hpbe/projections/${encodeURIComponent(id)}`);
  }
  static async getHoloPackVersion() {
    const body = await this.get("/api/hpbe/pack-version");
    if (!body) return null;
    try {
      return JSON.parse(body).version;
    } catch {
      return null;
    }
  }
  static async getHoloMaterials(projectionId) {
    const body = await this.get(`/api/hpbe/materials/${encodeURIComponent(projectionId)}`);
    if (!body) return null;
    try {
      return JSON.parse(body).materials;
    } catch {
      return null;
    }
  }
};

// scripts/api/ChatApi.ts
var PATH_CHANNELS = "/api/sfmc/channels";
var PATH_MESSAGES = "/api/sfmc/messages";
var PATH_REDPACKET = "/api/sfmc/redpacket";
async function getChannels(filter) {
  const qs = toQueryString({
    search: filter?.search,
    type: filter?.type,
    ownerId: filter?.ownerId,
    minCreatedAt: filter?.minCreatedAt,
    maxCreatedAt: filter?.maxCreatedAt
  });
  const path = `${PATH_CHANNELS}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    const raw = JSON.parse(body).channels;
    return raw.map(toChannel);
  } catch {
    return null;
  }
}
function toChannel(r) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    prefix: r.prefix,
    ownerid: r.owner_id || void 0,
    createdAt: r.created_at,
    config: {
      allowChat: !!r.config_allow_chat,
      slowMode: r.config_slow_mode || 0,
      isBroadcast: !!r.config_is_broadcast
    }
  };
}
function toMessage(r) {
  return {
    id: r.id,
    fromid: r.from_id,
    fromName: r.from_name,
    channelId: r.channel_id,
    type: r.type || "text",
    content: r.content,
    attachment: r.attachment,
    showTimestamp: !!r.show_timestamp,
    timestamp: r.created_at
  };
}
function toRedPacket(r) {
  return {
    id: r.id,
    senderid: r.sender_id,
    senderName: r.sender_name,
    totalAmount: r.total_amount,
    remainingAmount: r.remaining_amount,
    totalCount: r.total_count,
    remainingCount: r.remaining_count,
    receivers: JSON.parse(r.receivers || "[]"),
    targetType: r.target_type,
    targetId: r.target_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at
  };
}
async function getChannel(channelId) {
  const raw = await HttpDB.fetchJSON(PATH_CHANNELS, channelId, "channel");
  if (!raw) return null;
  return toChannel(raw);
}
async function createChannel(channel) {
  return saveChannels([channel]);
}
async function saveChannels(channels) {
  const flat = channels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    prefix: c.prefix,
    ownerId: c.ownerid,
    createdAt: c.createdAt,
    configAllowChat: c.config?.allowChat,
    configSlowMode: c.config?.slowMode,
    configIsBroadcast: c.config?.isBroadcast
  }));
  return HttpDB.post(PATH_CHANNELS, { channels: flat });
}
async function patchChannel(channelId, data2) {
  return HttpDB.patch(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`, data2);
}
async function deleteChannel(channelId) {
  return HttpDB.del(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`);
}
async function getMessages(filter) {
  const qs = toQueryString({
    search: filter?.search,
    type: filter?.type,
    channelId: filter?.channelId,
    from: filter?.from,
    minSentAt: filter?.minSentAt,
    maxSentAt: filter?.maxSentAt
  });
  const path = `${PATH_MESSAGES}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    const raw = JSON.parse(body).messages;
    return raw.map(toMessage);
  } catch {
    return null;
  }
}
async function saveMessages(messages) {
  return HttpDB.post(PATH_MESSAGES, { messages });
}
async function getRedPackets() {
  const body = await HttpDB.get(PATH_REDPACKET);
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    const raw = parsed.redpackets || parsed.redpacket || [];
    return raw.map(toRedPacket);
  } catch {
    return [];
  }
}
async function getRedPacket(redpacketId) {
  const raw = await HttpDB.fetchJSON(PATH_REDPACKET, redpacketId, "redpacket");
  if (!raw) return null;
  return toRedPacket(raw);
}
async function saveRedPacket(redpacket) {
  return HttpDB.post(PATH_REDPACKET, { redpacket });
}
async function updateRedPacket(redpacketId, redpacketModify) {
  return HttpDB.patch(`${PATH_REDPACKET}/${encodeURIComponent(redpacketId)}`, redpacketModify);
}

// scripts/chat/DogeChat.ts
var DogeChat = class _DogeChat {
  static {
    this.DEFAULT_CHANNEL_CONFIG = {
      allowChat: true,
      slowMode: 0,
      isBroadcast: false
    };
  }
  static {
    this.DEFAULT_CHANNELS = [
      {
        id: generateId("CH"),
        name: "\u516C\u5171\u9891\u9053",
        type: "public",
        prefix: "PB",
        createdAt: Date.now(),
        config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG }
      },
      {
        id: generateId("CH"),
        name: "\u516C\u544A",
        type: "custom",
        prefix: "BC",
        createdAt: Date.now(),
        config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG, isBroadcast: true }
      }
    ];
  }
  static {
    this.slowModeTracker = /* @__PURE__ */ new Map();
  }
  static {
    /** 当前在线玩家活跃频道映射（运行时状态，非缓存，仅用于广播推送给同一频道的其他玩家） */
    this.activeChannelMap = /* @__PURE__ */ new Map();
  }
  // ---------- 保留期 ----------
  /** 拉取消息历史时的频道消息保留期（毫秒） */
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
  //  频道初始化
  // ============================================
  /** 确保默认频道存在于 DB */
  static async ensureDefaultChannels() {
    const existing = await getChannels();
    if (existing && existing.length > 0) return;
    await saveChannels(_DogeChat.DEFAULT_CHANNELS).catch(
      (err) => console.warn(`[DogeChat] \u4FDD\u5B58\u9ED8\u8BA4\u9891\u9053\u5931\u8D25: ${err}`)
    );
  }
  /** 获取公共频道 */
  static async getPublicChannel() {
    const rows = await getChannels({ type: "public" });
    if (rows && rows.length > 0) return rows[0];
    await this.ensureDefaultChannels();
    const retry = await getChannels({ type: "public" });
    return retry && retry.length > 0 ? retry[0] : null;
  }
  /** 获取活跃频道对象 */
  static async getActiveChannel(player) {
    const channelId = _DogeChat.activeChannelMap.get(player.id);
    if (channelId) {
      const ch = await getChannel(channelId);
      if (ch) return ch;
    }
    const pub = await this.getPublicChannel();
    if (pub) {
      _DogeChat.activeChannelMap.set(player.id, pub.id);
      HttpDB.patch(`/api/sfmc/players/${player.id}`, { player: { activeChannel: pub.id } }).catch(() => {
      });
    }
    return pub;
  }
  /** 设置玩家的活跃频道 */
  static async setActiveChannel(player, channelId) {
    _DogeChat.activeChannelMap.set(player.id, channelId);
    await HttpDB.patch(`/api/sfmc/players/${player.id}`, { player: { activeChannel: channelId } }).catch(() => {
    });
  }
  /** 频道在线人数 */
  static getOnlineCount(channelId) {
    let count = 0;
    for (const p of world10.getPlayers()) {
      if (_DogeChat.activeChannelMap.get(p.id) === channelId) count++;
    }
    return count;
  }
  /** 创建新频道 */
  static async createChannel(name, prefix, type, config, owner) {
    const channel = {
      id: generateId("CH"),
      name,
      prefix,
      type,
      ownerid: owner?.id,
      createdAt: Date.now(),
      config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG, ...config }
    };
    const ok = await createChannel(channel);
    return ok ? channel.id : "";
  }
  /** 删除指定频道 */
  static async deleteChannel(channelId) {
    const ch = await getChannel(channelId);
    if (!ch) return false;
    if (ch.type === "public") return false;
    return deleteChannel(channelId);
  }
  /** 更新频道配置 */
  static async updateChannelConfig(channelId, config) {
    const data2 = {};
    if (config.allowChat !== void 0) data2.configAllowChat = config.allowChat ? 1 : 0;
    if (config.slowMode !== void 0) data2.configSlowMode = config.slowMode;
    if (config.isBroadcast !== void 0) data2.configIsBroadcast = config.isBroadcast ? 1 : 0;
    if (Object.keys(data2).length === 0) return false;
    return patchChannel(channelId, data2);
  }
  /** 更新频道名称和前缀 */
  static async updateChannelName(channelId, newName, newPrefix) {
    return patchChannel(channelId, { name: newName, prefix: newPrefix });
  }
  /** 获取玩家的私聊频道 */
  static async getPrivateChannels(player) {
    const rows = await getChannels({ type: "private", ownerId: player.id });
    return rows ?? [];
  }
  // ============================================
  //  系统消息频道
  // ============================================
  /** 玩家的系统频道 ID */
  static getSystemChannelId(player) {
    return `sys_${player.id}`;
  }
  /** 确保系统频道存在 */
  static async ensureSystemChannel(player) {
    const channelId = this.getSystemChannelId(player);
    const existing = await getChannel(channelId);
    if (existing) return existing;
    const channel = {
      id: channelId,
      name: "\u7CFB\u7EDF\u6D88\u606F",
      type: "system",
      prefix: "SYS",
      ownerid: player.id,
      createdAt: Date.now(),
      config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG, allowChat: false }
    };
    await createChannel(channel).catch(() => {
    });
    return channel;
  }
  /** 发送系统消息到玩家的系统频道 */
  static async sendSystemMessage(player, content) {
    const channel = await this.ensureSystemChannel(player);
    const msg = {
      id: generateId("M"),
      fromid: "system",
      fromName: "SYS",
      channelId: channel.id,
      type: "text",
      content,
      timestamp: Date.now(),
      showTimestamp: true
    };
    saveMessages([msg]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
  }
  /** 判断是否为私聊频道参与者 */
  static isPrivateParticipant(channelId, playerId2) {
    if (!channelId.startsWith("priv_")) return false;
    return channelId.includes(playerId2);
  }
  /** 获取私聊频道中的另一方 id */
  static getPrivateOther(channelId, myId) {
    if (!channelId.startsWith("priv_")) return void 0;
    const parts = channelId.split("_");
    return parts[1] === myId ? parts[2] : parts[1];
  }
  /** 循环切换频道（跳过私聊） */
  static async cycleChannel(player) {
    const all = await getChannels();
    if (!all) return null;
    const switchable = all.filter((c) => c.type !== "private");
    if (switchable.length === 0) {
      const pub = await this.getPublicChannel();
      if (pub) await this.setActiveChannel(player, pub.id);
      return pub;
    }
    const currentId = _DogeChat.activeChannelMap.get(player.id);
    const current = all.find((c) => c.id === currentId);
    const idx = current ? switchable.findIndex((c) => c.id === current.id) : -1;
    const next = switchable[(idx + 1) % switchable.length];
    if (next) await this.setActiveChannel(player, next.id);
    return next ?? null;
  }
  // ============================================
  //  消息同步
  // ============================================
  /** 获取频道的历史消息 */
  static async getChannelHistory(channelId) {
    const channel = await getChannel(channelId);
    if (!channel) return [];
    const cutoff = Date.now() - this.getRetention(channel);
    const rows = await getMessages({ channelId, minSentAt: cutoff });
    if (rows !== null) return rows;
    return [];
  }
  /** 加载历史消息 */
  static async loadChannelHistory(player, channelId) {
    const channel = await getChannel(channelId);
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
    const channel = await getChannel(channelId);
    if (!channel) {
      Msg.warning("\u9891\u9053\u4E0D\u5B58\u5728\u3002", from);
      return false;
    }
    if (!channel.config?.allowChat) {
      if (channel.type === "system") Msg.warning("\u8BE5\u9891\u9053\u53EA\u8BFB\u3002", from);
      return false;
    }
    if (channel.config?.isBroadcast) {
      const owner = await this.isChannelOwner(from, channelId);
      if (!owner) {
        Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u6A21\u5F0F\uFF0C\u53EA\u6709\u7BA1\u7406\u5458\u624D\u80FD\u53D1\u8A00\u3002", from);
        return false;
      }
      const msg2 = {
        id: generateId("M"),
        fromid: from.id,
        fromName: from.name,
        channelId,
        type,
        content,
        attachment,
        timestamp: Date.now(),
        showTimestamp: true
      };
      await saveMessages([msg2]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
      const prefix = `\xA7a[${channel.prefix}]`;
      Msg.info(`\xA7r\xA77${formatTimestamp(msg2.timestamp)}`, from);
      from.sendMessage({ rawtext: [{ text: `${prefix} ${from.name}: ${content}` }] });
      return true;
    }
    if (channel.config?.slowMode && channel.config.slowMode > 0) {
      const playerMap = this.slowModeTracker.get(from.id);
      const lastTs = playerMap?.get(channelId) ?? 0;
      const elapsed = (Date.now() - lastTs) / 1e3;
      if (elapsed < channel.config.slowMode) {
        Msg.warning(
          `\u9891\u9053 ${channel.prefix} \u6162\u901F\u6A21\u5F0F\u4E2D\uFF0C\u8BF7\u7B49\u5F85 ${Math.ceil(channel.config.slowMode - elapsed)} \u79D2\u3002`,
          from
        );
        return false;
      }
    }
    const history = await this.getChannelHistory(channelId);
    const lastMsg = history.length > 0 ? history[history.length - 1] : void 0;
    const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1e3;
    const msg = {
      id: generateId("M"),
      fromid: from.id,
      fromName: from.name,
      channelId,
      type,
      content,
      attachment,
      timestamp: Date.now(),
      showTimestamp
    };
    saveMessages([msg]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
    if (showTimestamp) from.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
    from.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${from.name}: ${content}` }] });
    for (const p of world10.getPlayers()) {
      if (p.id === from.id) continue;
      if (_DogeChat.activeChannelMap.get(p.id) !== channelId) continue;
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
      p.chatNamePrefix = `[${channel.prefix}]`;
      p.sendMessage(`${display}`);
    }
    if (channel.config?.slowMode && channel.config.slowMode > 0) {
      if (!this.slowModeTracker.has(from.id)) this.slowModeTracker.set(from.id, /* @__PURE__ */ new Map());
      this.slowModeTracker.get(from.id).set(channelId, Date.now());
    }
    return true;
  }
  /** 发送私聊 */
  static async sendPrivateMessage(from, toPlayer, content, type = "text") {
    const channel = await this.ensurePrivateChannel(from.id, toPlayer.id);
    const history = await this.getChannelHistory(channel.id);
    const lastMsg = history.length > 0 ? history[history.length - 1] : void 0;
    const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1e3;
    const msg = {
      id: generateId("M"),
      fromid: from.id,
      fromName: from.name,
      channelId: channel.id,
      type,
      content,
      timestamp: Date.now(),
      showTimestamp
    };
    saveMessages([msg]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
    for (const p of [from, toPlayer]) {
      if (_DogeChat.activeChannelMap.get(p.id) === channel.id) {
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
  static async ensurePrivateChannel(idA, idB) {
    const ids = [idA, idB].sort();
    const channelId = `priv_${ids[0]}_${ids[1]}`;
    const existing = await getChannel(channelId);
    if (existing) return existing;
    const nameB = world10.getPlayers().find((p) => p.id === idB)?.name ?? idB;
    const channel = {
      id: channelId,
      name: `\u4E0E ${nameB} \u7684\u79C1\u804A`,
      type: "private",
      prefix: `\u79C1\u804A-${nameB}`,
      ownerid: idA,
      createdAt: Date.now(),
      config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG }
    };
    await createChannel(channel).catch(() => {
    });
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
  //  红包（纯 DB，无缓存）
  // ============================================
  static async sendRedPacket(sender, amount, count, targetType, targetId) {
    if (amount <= 0 || count <= 0 || count > amount) {
      Msg.error("\u7EA2\u5305\u53C2\u6570\u65E0\u6548\u3002", sender);
      return false;
    }
    const balance = Money.get(sender);
    if (balance < amount) {
      Msg.error(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${amount}\uFF0C\u5F53\u524D ${balance}\u3002`, sender);
      return false;
    }
    const packet = {
      id: generateId("RP"),
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
    const saved = await saveRedPacket(packet);
    if (!saved) {
      Msg.error("\u7EA2\u5305\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", sender);
      return false;
    }
    Money.set(sender, balance - amount);
    Msg.success(`${sender.name} \u53D1\u9001\u4E86\u7EA2\u5305\uFF1A${amount} ${Money.UNIT}\uFF08\u5171 ${count} \u4EFD\uFF09\u3002`, sender);
    const channelId = targetType === "group" ? targetId : (await this.ensurePrivateChannel(sender.id, targetId)).id;
    saveMessages([
      {
        id: generateId("M"),
        fromid: sender.id,
        fromName: sender.name,
        channelId,
        type: "redpacket",
        content: `\u53D1\u9001\u4E86 ${amount} ${Money.UNIT} \u7684\u7EA2\u5305\uFF08\u5171 ${count} \u4EFD\uFF09`,
        timestamp: Date.now()
      }
    ]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
    return true;
  }
  static async claimRedPacket(player, packetId) {
    const packet = await getRedPacket(packetId);
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
    const updated = await updateRedPacket(packet.id, {
      remainingAmount: packet.remainingAmount - amount,
      remainingCount: packet.remainingCount - 1,
      receivers: [...packet.receivers, player.id]
    });
    if (!updated) {
      Msg.error("\u9886\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", player);
      return 0;
    }
    Money.add(player, amount);
    Msg.success(`\u4F60\u9886\u53D6\u4E86 ${packet.senderName} \u7684\u7EA2\u5305\uFF0C\u83B7\u5F97 ${amount} ${Money.UNIT}\uFF01`, player);
    return amount;
  }
  static async getAvailableRedPackets(player) {
    const rows = await getRedPackets();
    const now = Date.now();
    return rows.filter((p) => {
      if (p.remainingCount <= 0 || now > p.expiresAt) return false;
      if (p.receivers.includes(player.id)) return false;
      if (p.targetType === "player") return p.targetId === player.id;
      return true;
    });
  }
  /** DB 层面过期的红包不返回即可，无需显式清理 */
  static cleanupExpiredRedPackets() {
  }
  // ============================================
  //  权限判断
  // ============================================
  static async isChannelOwner(player, channelId) {
    const ch = await getChannel(channelId);
    return ch?.ownerid === player.id;
  }
};

// scripts/gui/ChatGUI.ts
import { world as world11 } from "@minecraft/server";
import { CustomForm as CustomForm4 } from "@minecraft/server-ui";
var ChatGUI = class {
  static async openChannelPanel(player) {
    const active = await DogeChat.getActiveChannel(player);
    const allChannels = await getChannels() ?? [];
    const displayChannels = allChannels.filter((c) => {
      if (c.type === "private") return false;
      if (c.type === "system") return c.ownerid === player.id;
      return true;
    });
    const isAdmin = Permission.check(player, "chat.admin");
    const form = new CustomForm4(player, "DogeChat").label(ListFormInfo([`\u5F53\u524D\u9891\u9053: ${active.prefix} - ${active.name}`])).button("\u9891\u9053\u7BA1\u7406", () => this.openChannelManager(player)).button("\u79C1\u804A\u9891\u9053", () => this.openPrivateChatPanel(player));
    for (const c of displayChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      const mark = c.id === active.id ? "\u25C0 " : "";
      let tag = "";
      if (c.config.isBroadcast) tag = "\xA77[\u516C\u544A]";
      else if (c.type === "system") tag = "\xA79[\u7CFB\u7EDF]";
      form.button(`${mark}${c.prefix} - ${c.name} ${tag}
\xA7a${online} \u4EBA\u5728\u7EBF`, async () => {
        if (c.config.isBroadcast && !isAdmin && !await DogeChat.isChannelOwner(player, c.id)) {
          Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002\u7BA1\u7406\u5458\u53EF\u5207\u6362\u5230\u8BE5\u9891\u9053\u3002", player);
          return;
        }
        if (c.id !== active.id) {
          await DogeChat.setActiveChannel(player, c.id);
          Msg.success(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${c.prefix}`, player);
          await DogeChat.loadChannelHistory(player, c.id);
        }
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "DogeChat");
  }
  static async openChannelManager(player) {
    const allChannels = await getChannels() ?? [];
    const isAdmin = Permission.check(player, "chat.admin");
    const form = new CustomForm4(player, "\u9891\u9053\u7BA1\u7406").label(ListFormInfo([`\u5171\u6709 ${allChannels.length} \u4E2A\u9891\u9053`])).button("\u521B\u5EFA\u9891\u9053", () => this.createChannelDialog(player));
    for (const c of allChannels) {
      const online = DogeChat.getOnlineCount(c.id);
      form.button(`${c.prefix} - \xA7f${c.name}
\xA77${online} \u4EBA\u5728\u7EBF`, async () => {
        if (c.config.isBroadcast && !isAdmin && !await DogeChat.isChannelOwner(player, c.id)) {
          Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u5207\u6362\u3002\u7BA1\u7406\u5458\u53EF\u5728\u9891\u9053\u8BBE\u7F6E\u4E2D\u64CD\u4F5C\u3002", player);
          return;
        }
        if (isAdmin || await DogeChat.isChannelOwner(player, c.id)) {
          await this.openChannelSettings(player, c);
        } else {
          await DogeChat.setActiveChannel(player, c.id);
          Msg.success(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${c.prefix}`, player);
          await DogeChat.loadChannelHistory(player, c.id);
          await this.openChannelPanel(player);
        }
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u9891\u9053\u7BA1\u7406");
  }
  static async openChannelSettings(player, channel) {
    const isOwner = await DogeChat.isChannelOwner(player, channel.id);
    const lines = [
      `${channel.prefix} - ${channel.name}`,
      `\u7C7B\u578B: ${channel.type}`,
      `\u5728\u7EBF: ${DogeChat.getOnlineCount(channel.id)} \u4EBA`,
      `\u516C\u544A\u677F: ${channel.config.isBroadcast ? "\xA7a\u5F00\u542F" : "\xA7c\u5173\u95ED"}`
    ];
    const form = new CustomForm4(player, "\u9891\u9053\u8BBE\u7F6E").label(ListFormInfo(lines)).button("\u7F16\u8F91\u9891\u9053\u540D", () => this.renameChannelDialog(player, channel)).button(`\u516C\u544A\u677F\u6A21\u5F0F (${channel.config.isBroadcast ? "\u5F00" : "\u5173"})`, async () => {
      await DogeChat.updateChannelConfig(channel.id, { isBroadcast: !channel.config.isBroadcast });
      Msg.success(`\u516C\u544A\u677F\u6A21\u5F0F\u5DF2${channel.config.isBroadcast ? "\u5173\u95ED" : "\u5F00\u542F"}\u3002`, player);
      const updated = await getChannel(channel.id);
      if (updated) await this.openChannelSettings(player, updated);
      else await this.openChannelManager(player);
    });
    if (isOwner && channel.type !== "public") {
      form.button("\u5220\u9664\u9891\u9053", () => {
        Gui.confirm(player, "\u5220\u9664\u9891\u9053", `\u786E\u8BA4\u5220\u9664\u9891\u9053 "${channel.name}" \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`, async () => {
          await DogeChat.deleteChannel(channel.id);
          Msg.success(`\u9891\u9053 "${channel.name}" \u5DF2\u5220\u9664\u3002`, player);
        });
        this.openChannelManager(player);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u9891\u9053\u8BBE\u7F6E");
  }
  static async createChannelDialog(player) {
    const name = new ObservableString("");
    const prefix = new ObservableString("");
    const form = new CustomForm4(player, "\u521B\u5EFA\u9891\u9053").textField("\u9891\u9053\u540D\u79F0", name, { description: "\u8F93\u5165\u9891\u9053\u540D\u79F0" }).textField("\u663E\u793A\u524D\u7F00", prefix, { description: "\u804A\u5929\u663E\u793A\u7684\u524D\u7F00\uFF0C\u5EFA\u8BAE\u7B80\u77ED" }).button("\u521B\u5EFA", async () => {
      const n = name.getData().trim();
      const p = prefix.getData().trim();
      if (!n || !p) {
        Msg.error("\u9891\u9053\u540D\u79F0\u548C\u524D\u7F00\u4E0D\u80FD\u4E3A\u7A7A\u3002", player);
        return;
      }
      const cid = await DogeChat.createChannel(n, p, "custom", {}, player);
      if (cid) {
        await DogeChat.setActiveChannel(player, cid);
        Msg.success(`\u9891\u9053 "${n}" \u521B\u5EFA\u6210\u529F\uFF0C\u5DF2\u81EA\u52A8\u5207\u6362\u3002`, player);
        await DogeChat.loadChannelHistory(player, cid);
      } else {
        Msg.error("\u521B\u5EFA\u5931\u8D25\uFF0C\u53EF\u80FD\u7684\u539F\u56E0\u662F\u9891\u9053\u540D\u79F0\u5DF2\u5B58\u5728\u3002", player);
      }
    }).closeButton();
    await Gui.showForm(player, form, "\u521B\u5EFA\u9891\u9053");
    await this.openChannelPanel(player);
  }
  static async renameChannelDialog(player, channel) {
    const newName = new ObservableString(channel.name);
    const newPrefix = new ObservableString(channel.prefix);
    const form = new CustomForm4(player, "\u7F16\u8F91\u9891\u9053\u540D").textField("\u9891\u9053\u540D\u79F0", newName, { description: "\u8F93\u5165\u65B0\u540D\u79F0" }).textField("\u663E\u793A\u524D\u7F00", newPrefix, { description: "\u8F93\u5165\u65B0\u524D\u7F00" }).button("\u786E\u8BA4", async () => {
      const nn = newName.getData().trim();
      const np = newPrefix.getData().trim();
      if (!nn || !np) {
        Msg.error("\u540D\u79F0\u548C\u524D\u7F00\u4E0D\u80FD\u4E3A\u7A7A\u3002", player);
        return;
      }
      await DogeChat.updateChannelName(channel.id, nn, np);
      Msg.success(`\u9891\u9053\u5DF2\u91CD\u547D\u540D\u4E3A: ${np} - ${nn}`, player);
    }).closeButton();
    await Gui.showForm(player, form, "\u7F16\u8F91\u9891\u9053\u540D");
    const updated = await getChannel(channel.id);
    if (updated) await this.openChannelSettings(player, updated);
    else await this.openChannelManager(player);
  }
  static async openPrivateChatPanel(player) {
    const active = await DogeChat.getActiveChannel(player);
    const privateChannels = await DogeChat.getPrivateChannels(player);
    const form = new CustomForm4(player, "\u79C1\u804A\u9891\u9053").label(ListFormInfo([])).button("\u65B0\u6D88\u606F", () => this.selectPlayerForPrivate(player));
    for (const c of privateChannels) {
      const otherName = c.name.replace("\u4E0E ", "").replace(" \u7684\u79C1\u804A", "");
      const mark = c.id === (active?.id ?? "") ? "\u25C0 " : "";
      form.button(`${mark}${otherName}`, async () => {
        if (c.id !== (active?.id ?? "")) {
          await DogeChat.setActiveChannel(player, c.id);
          Msg.success(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${c.prefix}`, player);
          await DogeChat.loadChannelHistory(player, c.id);
        }
        await this.openPrivateChatPanel(player);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u79C1\u804A\u9891\u9053");
  }
  static async selectPlayerForPrivate(player) {
    const onlinePlayers = player.dimension.getPlayers().filter((p) => p.id !== player.id);
    if (onlinePlayers.length === 0) {
      Msg.info("\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u3002", player);
      await this.openPrivateChatPanel(player);
      return;
    }
    const form = new CustomForm4(player, "\u9009\u62E9\u73A9\u5BB6").label(ListFormInfo(["\u9009\u62E9\u8981\u53D1\u9001\u79C1\u804A\u7684\u73A9\u5BB6"]));
    for (const p of onlinePlayers) {
      form.button(p.name, async () => {
        const channel = await DogeChat.ensurePrivateChannel(player.id, p.id);
        await DogeChat.setActiveChannel(player, channel.id);
        Msg.success(`\u5DF2\u5207\u6362\u5230\u4E0E ${p.name} \u7684\u79C1\u804A\u9891\u9053\u3002`, player);
        await DogeChat.loadChannelHistory(player, channel.id);
        await this.openPrivateChatPanel(player);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u9009\u62E9\u73A9\u5BB6");
  }
  static async openRedPacketPanel(player) {
    const available = await DogeChat.getAvailableRedPackets(player);
    const body = ListFormInfo(available.length > 0 ? [`\u6709 ${available.length} \u4E2A\u7EA2\u5305\u53EF\u9886\u53D6`] : ["\u6682\u65E0\u53EF\u7528\u7EA2\u5305"]);
    const form = new CustomForm4(player, "\u7EA2\u5305").label(body).button("\u53D1\u9001\u7EA2\u5305", () => this.sendRedPacketDialog(player));
    if (available.length > 0) {
      form.button("\u9886\u53D6\u7EA2\u5305", () => this.claimRedPacketDialog(player, available));
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u7EA2\u5305");
  }
  static async sendRedPacketDialog(player) {
    const amount = new ObservableString("");
    const count = new ObservableString("1");
    const targetTypeIdx = new ObservableNumber(0);
    const targetPlayer = new ObservableString("");
    const form = new CustomForm4(player, "\u53D1\u9001\u7EA2\u5305").textField("\u91D1\u989D", amount, { description: "\u8F93\u5165\u7EA2\u5305\u603B\u91D1\u989D" }).textField("\u4EFD\u6570", count, { description: "\u8F93\u5165\u7EA2\u5305\u4EFD\u6570" }).dropdown("\u76EE\u6807\u7C7B\u578B", targetTypeIdx, [
      { label: "\u5F53\u524D\u9891\u9053", value: 0 },
      { label: "\u6307\u5B9A\u73A9\u5BB6", value: 1 }
    ]).textField("\u76EE\u6807\u73A9\u5BB6\u540D\uFF08\u6307\u5B9A\u73A9\u5BB6\u65F6\u586B\u5199\uFF09", targetPlayer, { description: "\u7559\u7A7A\u5219\u53D1\u5230\u5F53\u524D\u9891\u9053" }).button("\u53D1\u9001", async () => {
      const amt = parseInt(amount.getData());
      const cnt = parseInt(count.getData());
      const targetType = targetTypeIdx.getData();
      const tp2 = targetPlayer.getData().trim();
      if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
        Msg.error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u548C\u4EFD\u6570\u3002", player);
        return;
      }
      if (targetType === 0) {
        const active = await DogeChat.getActiveChannel(player);
        if (active) await DogeChat.sendRedPacket(player, amt, cnt, "group", active.id);
      } else {
        const target = player.dimension.getPlayers().find((p) => p.name === tp2);
        if (!target) {
          Msg.error(`\u73A9\u5BB6 "${tp2}" \u4E0D\u5728\u7EBF\u3002`, player);
          return;
        }
        await DogeChat.sendRedPacket(player, amt, cnt, "player", target.id);
      }
    }).closeButton();
    await Gui.showForm(player, form, "\u53D1\u9001\u7EA2\u5305");
  }
  static async claimRedPacketDialog(player, packets) {
    const form = new CustomForm4(player, "\u9886\u53D6\u7EA2\u5305").label(ListFormInfo([`\u53EF\u9886\u53D6 ${packets.length} \u4E2A\u7EA2\u5305`]));
    for (const p of packets) {
      form.button(`${p.senderName} \u7684\u7EA2\u5305 \xA77(${p.remainingAmount} \u5269\u4F59)`, () => {
        DogeChat.claimRedPacket(player, p.id);
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u9886\u53D6\u7EA2\u5305");
  }
  static async sendLocation(player) {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;
    const loc2 = DogeChat.createLocationMessage(player);
    await DogeChat.sendChannelMessage(player, channel.id, loc2, "location");
  }
  static async sendTeleportInvite(player) {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;
    if (channel.config.isBroadcast && !await DogeChat.isChannelOwner(player, channel.id)) {
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
    const form = new CustomForm4(player, "\u4F20\u9001\u9080\u8BF7").label(ListFormInfo(["\u9009\u62E9\u8981\u9080\u8BF7\u7684\u73A9\u5BB6"]));
    for (const p of online) {
      form.button(p.name, () => DogeChat.sendTeleportInvite(player, p));
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u4F20\u9001\u9080\u8BF7");
  }
  static async sendRedPacketQuick(player) {
    const channel = await DogeChat.getActiveChannel(player);
    if (!channel) return;
    if (channel.config.isBroadcast && !await DogeChat.isChannelOwner(player, channel.id)) {
      Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002", player);
      return;
    }
    if (channel.type === "private") {
      const amount = new ObservableString("");
      const form = new CustomForm4(player, "\u53D1\u9001\u7EA2\u5305").textField("\u91D1\u989D", amount, { description: "\u8F93\u5165\u7EA2\u5305\u91D1\u989D" }).button("\u53D1\u9001", async () => {
        const amt = parseInt(amount.getData());
        if (isNaN(amt) || amt <= 0) {
          Msg.error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u3002", player);
          return;
        }
        const otherid = DogeChat.getPrivateOther(channel.id, player.id);
        if (!otherid) {
          Msg.error("\u65E0\u6CD5\u627E\u5230\u79C1\u804A\u5BF9\u8C61\u3002", player);
          return;
        }
        await DogeChat.sendRedPacket(player, amt, 1, "player", otherid);
      }).closeButton();
      await Gui.showForm(player, form, "\u53D1\u9001\u7EA2\u5305");
    } else {
      const amount = new ObservableString("");
      const count = new ObservableString("1");
      const form = new CustomForm4(player, "\u53D1\u9001\u7EA2\u5305").textField("\u91D1\u989D", amount, { description: "\u8F93\u5165\u7EA2\u5305\u603B\u91D1\u989D" }).textField("\u4EFD\u6570", count, { description: "\u8F93\u5165\u7EA2\u5305\u4EFD\u6570" }).button("\u53D1\u9001", async () => {
        const amt = parseInt(amount.getData());
        const cnt = parseInt(count.getData());
        if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
          Msg.error("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u548C\u4EFD\u6570\u3002", player);
          return;
        }
        await DogeChat.sendRedPacket(player, amt, cnt, "group", channel.id);
      }).closeButton();
      await Gui.showForm(player, form, "\u53D1\u9001\u7EA2\u5305");
    }
  }
};

// scripts/chat/ChatSystem.ts
var ChatSystem = class {
  static init() {
    console.log(`Initializing ChatSystem...`);
    DogeChat.ensureDefaultChannels();
    HttpDB.checkHealth().then((ok) => {
      if (ok) console.info("[DogeChat] \u5916\u90E8\u6570\u636E\u5E93\u5DF2\u8FDE\u63A5\uFF0C\u6D88\u606F\u5C06\u6301\u4E45\u5316\u5B58\u50A8\u3002");
      else console.warn("[DogeChat] \u5916\u90E8\u6570\u636E\u5E93\u672A\u8FDE\u63A5\u3002");
    });
    registerSystemMsgHandler((player, text) => {
      DogeChat.sendSystemMessage(player, text);
    });
    console.log(`ChatSystem initialized successfully.`);
  }
  static registerEvents() {
    world12.beforeEvents.chatSend.subscribe(async (event) => {
      const player = event.sender;
      const message = event.message;
      if (message.startsWith("!") || message.startsWith("\uFF01")) return;
      event.cancel = true;
      const channel = await DogeChat.getActiveChannel(player);
      if (channel) await DogeChat.sendChannelMessage(player, channel.id, message);
    });
    world12.afterEvents.playerJoin.subscribe((event) => {
      const player = world12.getEntity(event.playerId);
      system8.run(async () => {
        const channel = await DogeChat.getActiveChannel(player);
        if (channel) await DogeChat.loadChannelHistory(player, channel.id);
      });
    });
  }
  static registerCommands() {
    Command.register(
      "channel",
      "chat.use",
      (player) => {
        if (player) ChatGUI.openChannelPanel(player);
      },
      "\u9891\u9053\u7BA1\u7406 - \u5207\u6362/\u8BA2\u9605\u9891\u9053"
    );
    Command.register(
      "ch",
      "chat.use",
      async (player) => {
        if (!player) return;
        const next = await DogeChat.cycleChannel(player);
        if (next) await DogeChat.loadChannelHistory(player, next.id);
      },
      "\u5FEB\u901F\u5207\u6362\u9891\u9053"
    );
    Command.register(
      "msg",
      "chat.use",
      (player) => {
        if (player) ChatGUI.openPrivateChatPanel(player);
      },
      "\u5FEB\u6377\u79C1\u804A"
    );
    Command.register(
      "lo",
      "chat.use",
      (player) => {
        if (player) ChatGUI.sendLocation(player);
      },
      "\u53D1\u9001\u5F53\u524D\u4F4D\u7F6E\u5230\u5F53\u524D\u9891\u9053"
    );
    Command.register(
      "tp",
      "chat.use",
      (player) => {
        if (player) ChatGUI.sendTeleportInvite(player);
      },
      "\u53D1\u9001\u4F20\u9001\u9080\u8BF7"
    );
    Command.register(
      "hongbao",
      "chat.use",
      (player) => {
        if (player) ChatGUI.openRedPacketPanel(player);
      },
      "\u7EA2\u5305 - \u67E5\u770B/\u9886\u53D6\u7EA2\u5305"
    );
    Command.register(
      "hb",
      "chat.use",
      (player) => {
        if (player) ChatGUI.sendRedPacketQuick(player);
      },
      "\u53D1\u9001\u7EA2\u5305"
    );
  }
};

// scripts/doge/TPS.ts
import { system as system9, world as world13 } from "@minecraft/server";
var TPS = class _TPS {
  static {
    this.tickTimes = [];
  }
  static {
    this.MAX_SAMPLES = 100;
  }
  static getTPS() {
    if (_TPS.tickTimes.length < 10) return 20;
    const elapsed = (_TPS.tickTimes[_TPS.tickTimes.length - 1] - _TPS.tickTimes[0]) / 1e3;
    const tickCount = _TPS.tickTimes.length - 1;
    const tps = tickCount / elapsed;
    return Math.round(Math.min(tps, 20) * 100) / 100;
  }
  static getTPSStatus() {
    const tps = this.getTPS();
    let color;
    if (tps >= 19.5) color = "\xA7a";
    else if (tps >= 15) color = "\xA7e";
    else if (tps >= 10) color = "\xA76";
    else color = "\xA7c";
    return `\xA77[TPS] ${color}${tps} \xA77/ 20.00`;
  }
  static init() {
    this.startRecord();
  }
  static startRecord() {
    system9.runInterval(() => {
      _TPS.tickTimes.push(Date.now());
      if (_TPS.tickTimes.length > _TPS.MAX_SAMPLES) {
        _TPS.tickTimes.shift();
      }
    }, 1);
  }
  static registerCommands() {
    Command.register(
      "tps",
      "tps.see",
      (player) => {
        const msg = this.getTPSStatus();
        if (player) {
          Msg.info(msg, player);
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
    this.dataMap = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_OnlineTime._instance) {
      _OnlineTime._instance = new _OnlineTime();
    }
    return _OnlineTime._instance;
  }
  registerCommandsAndPermissions() {
    Permission.register("onlinetime.see", Permission.Any);
    Command.register(
      "onlinetime",
      "onlinetime.see",
      async (player) => {
        if (!player) {
          world14.sendMessage("\xA7c\u8BE5\u6307\u4EE4\u5FC5\u987B\u7531\u73A9\u5BB6\u6267\u884C\u3002");
          return;
        }
        const data2 = await this.load(player);
        Msg.info(
          `\u73A9\u5BB6 \xA7a${player.name}\xA7r \u7684\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1:
\xA7e\u672C\u6B21\u5728\u7EBF \xA7f${this.formatTime(data2.session)}
\xA7e\u4ECA\u65E5\u5728\u7EBF \xA7f${this.formatTime(data2.today)}
\xA7e\u672C\u6708\u5728\u7EBF \xA7f${this.formatTime(data2.month)}
\xA7e\u603B\u5728\u7EBF \xA7f${this.formatTime(data2.total)}
`,
          player
        );
      },
      "\u67E5\u770B\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1"
    );
  }
  registerEvents() {
    world14.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        this.onPlayerJoin(event.player);
      }
    });
  }
  init() {
    this.startTick();
  }
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
  /** 从 DB 加载玩家在线时间数据 */
  async load(player) {
    const existing = this.dataMap.get(player.id);
    if (existing) return existing;
    const raw = await HttpDB.fetchJSON("/api/sfmc/players", player.id, "player");
    const def = (val, fallback) => typeof val === "number" ? val : fallback;
    const data2 = {
      session: 0,
      today: def(raw?.onlinetime_today, 0),
      month: def(raw?.onlinetime_month, 0),
      total: def(raw?.onlinetime_total, 0),
      lastDate: def(raw?.onlinetime_last_date, (/* @__PURE__ */ new Date()).getDate()),
      lastMonth: def(raw?.onlinetime_last_month, (/* @__PURE__ */ new Date()).getMonth())
    };
    this.dataMap.set(player.id, data2);
    return data2;
  }
  /** 持久化在线时间到 DB（排除 session，仅持久化跨重启字段） */
  async persist(player, data2) {
    await HttpDB.patch(`/api/sfmc/players/${player.id}`, {
      player: {
        onlinetimeToday: data2.today,
        onlinetimeMonth: data2.month,
        onlinetimeTotal: data2.total,
        onlinetimeLastDate: data2.lastDate,
        onlinetimeLastMonth: data2.lastMonth
      }
    }).catch(() => {
    });
  }
  onPlayerJoin(player) {
    this.load(player).then((data2) => {
      data2.session = 0;
    });
  }
  onPlayerLeave(player) {
    const data2 = this.dataMap.get(player.id);
    if (data2) {
      this.persist(player, data2).catch(() => {
      });
      this.dataMap.delete(player.id);
    }
  }
  tickSecond() {
    const now = /* @__PURE__ */ new Date();
    const currentDate = now.getDate();
    const currentMonth = now.getMonth();
    for (const player of world14.getAllPlayers()) {
      const data2 = this.dataMap.get(player.id);
      if (!data2) {
        this.load(player).then((d) => {
          d.session++;
          d.today++;
          d.month++;
          d.total++;
        });
        continue;
      }
      if (data2.lastDate !== currentDate) {
        data2.today = 0;
        data2.lastDate = currentDate;
      }
      if (data2.lastMonth !== currentMonth) {
        data2.month = 0;
        data2.lastMonth = currentMonth;
      }
      data2.session++;
      data2.today++;
      data2.month++;
      data2.total++;
      this.persist(player, data2).catch(() => {
      });
    }
  }
  startTick() {
    system10.runInterval(() => {
      this.tickSecond();
    }, 20);
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
  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  registerCommandsAndPermissions() {
    Permission.register("survivalarea.gamemode.bypass", Permission.OP);
  }
  /** 注册事件（由 entry.ts 统一调用） */
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
          Msg.error(`\u4F60\u5F53\u524D\u4E0D\u5728\u521B\u9020\u533A\u57DF\u5185\uFF0C\u65E0\u6CD5\u5207\u6362\u5230\u8BE5\u6A21\u5F0F\u3002`, event.player);
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
  init() {
  }
  inCreativeArea(entity) {
    for (const area of Config.creativeArea) {
      if (entity.dimension.id === area.dimension) {
        if (pointInArea_2D(
          entity.location.x,
          entity.location.z,
          area.start[0],
          area.start[1],
          area.end[0],
          area.end[1]
        )) {
          return true;
        }
      }
    }
    return false;
  }
  forceSurvival(player) {
    player.setGameMode(GameMode2.Survival);
    Msg.info(`\u5DF2\u79BB\u5F00\u521B\u9020\u533A\u57DF\uFF0C\u5F3A\u5236\u5207\u6362\u4E3A\u751F\u5B58\u6A21\u5F0F\u3002`, player);
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
  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  registerCommandsAndPermissions() {
    Permission.register("creativearea.toggle", Permission.OP);
    Permission.register("creativearea.place_banned", Permission.Admin);
    Command.register(
      "creativearea",
      "creativearea.toggle",
      () => {
        _CreativeArea.enable = !_CreativeArea.enable;
        SurvivalArea.getInstance().enable = _CreativeArea.enable;
        return _CreativeArea.enable ? "\u533A\u57DF\u7CFB\u7EDF\u5DF2\u5F00\u542F" : "\u533A\u57DF\u7CFB\u7EDF\u5DF2\u5173\u95ED";
      },
      "\u5F00\u5173\u533A\u57DF\u7CFB\u7EDF"
    );
  }
  /** 注册事件（由 entry.ts 统一调用） */
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
        const currentArea = event.player.getDynamicProperty("hpbe:creative_area");
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
  init() {
    this.startTick();
    this.startBorderFastCheck();
    this.startBorderWarning();
  }
  // ==========================================
  //  区域判定
  // ==========================================
  inArea(entity) {
    for (const area of Config.creativeArea) {
      if (entity.dimension.id === area.dimension) {
        if (pointInArea_2D(
          entity.location.x,
          entity.location.z,
          area.start[0],
          area.start[1],
          area.end[0],
          area.end[1]
        )) {
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
      if (entity.location.x >= minX && entity.location.x <= maxX && entity.location.z >= minZ && entity.location.z <= maxZ)
        return true;
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
    player.setDynamicProperty("hpbe:creative_area", areaName);
    Msg.info(`\u8FDB\u5165 \xA7a${areaName}\u521B\u9020\u533A\u57DF\xA7r \uFF0C\u5207\u6362\u4E3A\u521B\u9020\u6A21\u5F0F\u3002`, player);
  }
  leaveArea(player, areaName) {
    this.restoreScores(player);
    player.setGameMode(GameMode3.Survival);
    player.setDynamicProperty("hpbe:creative_area", void 0);
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
      player.setDynamicProperty("hpbe:creative_scores", JSON.stringify(scores));
    }
  }
  restoreScores(player) {
    const raw = player.getDynamicProperty("hpbe:creative_scores");
    const scores = raw ? JSON.parse(raw) : void 0;
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
    player.setDynamicProperty("hpbe:creative_scores", void 0);
  }
  // ==========================================
  //  定时扫描（进出检测）
  // ==========================================
  startTick() {
    system12.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world16.getPlayers()) {
        if (player.getGameMode() === GameMode3.Spectator) continue;
        const currentArea = player.getDynamicProperty("hpbe:creative_area");
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
        const currentArea = player.getDynamicProperty("hpbe:creative_area");
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
};

// scripts/area/InventorySwitcher.ts
import {
  system as system13,
  world as world17,
  GameMode as GameMode4,
  EquipmentSlot,
  BlockComponentTypes as BlockComponentTypes3
} from "@minecraft/server";
var InventorySwitcher = class _InventorySwitcher {
  static {
    this.chestMap = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_InventorySwitcher._instance) {
      _InventorySwitcher._instance = new _InventorySwitcher();
    }
    return _InventorySwitcher._instance;
  }
  /** 注册事件（由 entry.ts 统一调用） */
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
  init() {
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
    let base = _InventorySwitcher.chestMap.get(key);
    if (base === void 0) {
      let nextIdx = world17.getDynamicProperty("hpbe:invswitcher_next");
      if (nextIdx === void 0) nextIdx = 0;
      const max = Config.inventoryChest.size[0] - 2;
      if (nextIdx > max) nextIdx = 0;
      base = nextIdx;
      _InventorySwitcher.chestMap.set(key, base);
      world17.setDynamicProperty("hpbe:invswitcher_next", base + 2);
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
      for (const [ai, slot] of [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet
      ].entries()) {
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
      for (const [ai, slot] of [
        EquipmentSlot.Head,
        EquipmentSlot.Chest,
        EquipmentSlot.Legs,
        EquipmentSlot.Feet
      ].entries()) {
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
  static {
    // plid → landId[]
    // ── 内部工具 ──
    this.memoryStore = /* @__PURE__ */ new Map();
  }
  static readJSON(key, fallback) {
    if (this.memoryStore.has(key)) return this.memoryStore.get(key);
    this.memoryStore.set(key, fallback);
    return fallback;
  }
  static writeJSON(key, value) {
    this.memoryStore.set(key, value);
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
      if (this.cubesOverlap(this.normalize(posA, posB), { posA: land.posA, posB: land.posB })) {
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
      return {
        ok: false,
        msg: `\xA7c${Money.UNIT}\u4E0D\u8DB3\uFF01
\u9700\u8981 \xA7e${price} \xA7c${Money.UNIT}\uFF0C\u800C\u5F53\u524D\u6301\u6709 \xA7e${balance} \xA7c${Money.UNIT}\u3002`
      };
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
import { CustomForm as CustomForm5 } from "@minecraft/server-ui";
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
    const form = new CustomForm5(player, "\u571F\u5730").label(ListFormInfo(body)).button("\u7533\u8BF7\u571F\u5730", () => this.startApplication(player));
    if (landCount > 0) {
      form.button("\u6211\u7684\u571F\u5730", () => this.showLandList(player));
    }
    form.closeButton();
    Gui.showForm(player, form, "\u571F\u5730");
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
    const form = new CustomForm5(player, "\u6211\u7684\u571F\u5730").label(ListFormInfo([`\u5F53\u524D\u62E5\u6709 \xA7e${lands.length}\xA7r \u5757\u571F\u5730\u3002`]));
    for (const land of lands) {
      const name = land.nickname || land.id;
      const info = LandCore.getCubeInfo(land.posA, land.posB);
      form.button(`${name}
${info.square} \u683C | ${LandCore.getDimensionName(land.dimid)}`, () => {
        this.showLandManage(player, land);
      });
    }
    form.closeButton();
    Gui.showForm(player, form, "\u6211\u7684\u571F\u5730");
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
    const form = new CustomForm5(player, "\u571F\u5730\u7BA1\u7406").label(ListFormInfo(body)).button("\u571F\u5730\u4FDD\u62A4", () => this.showPermEditor(player, land)).button("\u7BA1\u7406\u8005\u7BA1\u7406", () => this.showManagerEditor(player, land)).button("\u8BBE\u7F6E\u540D\u79F0", () => this.showRenameDialog(player, land)).button("\u5220\u9664\u571F\u5730", () => this.showDeleteConfirm(player, land)).closeButton();
    Gui.showForm(player, form, "\u571F\u5730\u7BA1\u7406");
  }
  // ══════════════════════════════════════
  //  权限设置
  // ══════════════════════════════════════
  static showPermEditor(player, land) {
    const cfg = Database2.getDefaultPermissions();
    const perm = land.permissions;
    const allowPlace = new ObservableBoolean(perm.allow_place);
    const allowDestroy = new ObservableBoolean(perm.allow_destroy);
    const attackEntity = new ObservableBoolean(perm.attack_entity);
    const openContainer = new ObservableBoolean(perm.open_container);
    const form = new CustomForm5(player, "\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E").label(ListFormInfo([])).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u653E\u7F6E\u65B9\u5757`, allowPlace).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u7834\u574F\u65B9\u5757`, allowDestroy).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u653B\u51FB\u5B9E\u4F53`, attackEntity).toggle(`\u5141\u8BB8\u8BBF\u5BA2\xA76\u6253\u5F00\u5BB9\u5668`, openContainer).button("\u786E\u8BA4", () => {
      land.permissions.allow_place = allowPlace.getData();
      land.permissions.allow_destroy = allowDestroy.getData();
      land.permissions.attack_entity = attackEntity.getData();
      land.permissions.open_container = openContainer.getData();
      Database2.update(land);
      Msg.success("\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E\u5DF2\u66F4\u65B0\u3002", player);
    }).closeButton();
    Gui.showForm(player, form, "\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E");
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
    const form = new CustomForm5(player, "\u7BA1\u7406\u8005\u7BA1\u7406").label(ListFormInfo(body)).button("\u6DFB\u52A0\u7BA1\u7406\u8005", () => this.showAddManager(player, land));
    if (isOwner && land.managers.length > 1) {
      form.button("\u79FB\u9664\u7BA1\u7406\u8005", () => this.showRemoveManager(player, land));
    }
    form.closeButton();
    Gui.showForm(player, form, "\u7BA1\u7406\u8005\u7BA1\u7406");
  }
  static showAddManager(player, land) {
    const plid = player.id;
    const online = world18.getPlayers().filter((p) => p.id !== plid && !land.managers.includes(p.id));
    if (online.length === 0) {
      Msg.error("\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u5728\u7EBF\u73A9\u5BB6\u3002", player);
      return;
    }
    const form = new CustomForm5(player, "\u6DFB\u52A0\u7BA1\u7406\u8005").label(ListFormInfo(["\u9009\u62E9\u8981\u6DFB\u52A0\u4E3A\u7BA1\u7406\u8005\u7684\u73A9\u5BB6\u3002"]));
    for (const p of online) {
      const targetId = p.id;
      const targetName = p.name;
      form.button(p.name, () => {
        if (land.managers.includes(targetId)) {
          Msg.error("\u8BE5\u73A9\u5BB6\u5DF2\u7ECF\u662F\u7BA1\u7406\u8005\u3002", player);
          return;
        }
        land.managers.push(targetId);
        Database2.update(land);
        Msg.success(`\u5DF2\u5C06 ${targetName} \u6DFB\u52A0\u4E3A\u7BA1\u7406\u8005\u3002`, player);
      });
    }
    form.closeButton();
    Gui.showForm(player, form, "\u6DFB\u52A0\u7BA1\u7406\u8005");
  }
  static showRemoveManager(player, land) {
    const nonOwnerMgrs = land.managers.filter((m) => m !== land.ownerplid);
    if (nonOwnerMgrs.length === 0) {
      Msg.error("\u6CA1\u6709\u53EF\u79FB\u9664\u7684\u7BA1\u7406\u8005\u3002", player);
      return;
    }
    const form = new CustomForm5(player, "\u79FB\u9664\u7BA1\u7406\u8005").label(ListFormInfo(["\u9009\u62E9\u8981\u79FB\u9664\u7684\u7BA1\u7406\u8005\u3002"]));
    for (const m of nonOwnerMgrs) {
      const targetId = m;
      const p = world18.getPlayers().find((pl) => pl.id === m);
      form.button(p ? p.name : m.substring(0, 8) + "...", () => {
        const idx = land.managers.indexOf(targetId);
        if (idx !== -1) {
          land.managers.splice(idx, 1);
          Database2.update(land);
          Msg.success("\u5DF2\u79FB\u9664\u8BE5\u7BA1\u7406\u8005\u3002", player);
        }
      });
    }
    form.closeButton();
    Gui.showForm(player, form, "\u79FB\u9664\u7BA1\u7406\u8005");
  }
  // ══════════════════════════════════════
  //  重命名
  // ══════════════════════════════════════
  static showRenameDialog(player, land) {
    const name = new ObservableString(land.nickname || "");
    const form = new CustomForm5(player, "\u8BBE\u7F6E\u571F\u5730\u540D\u79F0").textField("\u571F\u5730\u540D\u79F0", name, { description: "\u8F93\u5165\u65B0\u540D\u79F0\uFF08\u7559\u7A7A\u6062\u590D\u9ED8\u8BA4\uFF09" }).button("\u786E\u8BA4", () => {
      const val = name.getData().trim();
      land.nickname = val;
      Database2.update(land);
      Msg.success(val ? `\u571F\u5730\u5DF2\u91CD\u547D\u540D\u4E3A ${val}\u3002` : "\u571F\u5730\u540D\u79F0\u5DF2\u6062\u590D\u9ED8\u8BA4\u3002", player);
    }).closeButton();
    Gui.showForm(player, form, "\u8BBE\u7F6E\u571F\u5730\u540D\u79F0");
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
      const form = new CustomForm5(player, "\u571F\u5730\u7533\u8BF7").label(ListFormInfo(body)).button("\u53D6\u6D88\u7533\u8BF7", () => {
        LandCore.clearSession(plid);
        Msg.warning("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
      }).closeButton();
      Gui.showForm(player, form, "\u571F\u5730\u7533\u8BF7");
    } else {
      const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
      const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid).replace(/§[cef6]/g, "");
      const body = [info, "\xA77\u786E\u8BA4\u7533\u8BF7\u8BE5\u571F\u5730\uFF1F"];
      const form = new CustomForm5(player, "\u786E\u8BA4\u571F\u5730\u7533\u8BF7").label(ListFormInfo(body)).button("\u786E\u8BA4\u7533\u8BF7", () => {
        this.handleApply(player, session?.pos1, session?.pos2, dimid);
      }).button("\u53D6\u6D88\u7533\u8BF7", () => {
        if (LandCore.clearSession(plid)) Msg.warning("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
        else Msg.error("\u571F\u5730\u7533\u8BF7\u53D6\u6D88\u5931\u8D25\u3002", player);
      }).closeButton();
      Gui.showForm(player, form, "\u786E\u8BA4\u571F\u5730\u7533\u8BF7");
    }
  }
  // ══════════════════════════════════════
  //  申请入口
  // ══════════════════════════════════════
  static startApplication(player) {
    const plid = player.id;
    LandCore.initSession(plid);
    Msg.info(
      [
        `\u53EF\u5728\u804A\u5929\u6846\u8F93\u5165\u4EE5\u4E0B\u547D\u4EE4\u5B8C\u6210\u571F\u5730\u7533\u8BF7\u6D41\u7A0B\uFF1A`,
        `  [1] \xA76\xA7l!pos1\xA7r \xA7f- \u8BBE\u7F6E\u7B2C\u4E00\u70B9\uFF08\u7AD9\u5728\u5BF9\u5E94\u4F4D\u7F6E\u8F93\u5165\uFF09`,
        `  [2] \xA76\xA7l!pos2\xA7r \xA7f- \u8BBE\u7F6E\u7B2C\u4E8C\u70B9`,
        `  [3] \xA76\xA7l!land\xA7r \xA7f- \u6253\u5F00\u83DC\u5355\u8FDB\u884C\xA7e\u9A8C\u8BC1\u4E0E\u786E\u8BA4\xA7r`
      ].join("\n"),
      player
    );
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
      Msg.success(
        `\u571F\u5730\u521B\u5EFA\u6210\u529F\uFF01
\u571F\u5730\u7F16\u53F7: ${land.id}
\u9762\u79EF: ${LandCore.getCubeInfo(land.posA, land.posB).square} \u683C`,
        player
      );
    } else {
      Msg.error("\u571F\u5730\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002", player);
    }
  }
};

// scripts/land/LandSystem.ts
var LandSystem = class {
  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  static registerCommandsAndPermissions() {
    Permission.register("land.use", Permission.Any);
    Command.register(
      "land",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
        LandGUI.showMainMenu(player);
      },
      "\u571F\u5730\u7BA1\u7406"
    );
    Command.register(
      "land cancel",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
        if (LandCore.clearSession(player.id)) Msg.success("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
        else Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
      },
      "\u53D6\u6D88\u571F\u5730\u7533\u8BF7"
    );
    Command.register(
      "pos1",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
        handlePosCommand(player, 1);
      },
      "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E00\u70B9"
    );
    Command.register(
      "pos2",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
        handlePosCommand(player, 2);
      },
      "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E8C\u70B9"
    );
  }
  static init() {
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
  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents() {
    if (this.initialized) return;
    this.initialized = true;
    world19.beforeEvents.playerPlaceBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "allow_place")) {
        Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u653E\u7F6E\u65B9\u5757\uFF01", player);
        ev.cancel = true;
      }
    });
    world19.beforeEvents.playerBreakBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "allow_destroy")) {
        Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u7834\u574F\u65B9\u5757\uFF01", player);
        ev.cancel = true;
      }
    });
    world19.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      const { player, block } = ev;
      if (!isContainerBlock(block.typeId)) return;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "open_container")) {
        Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u6253\u5F00\u5BB9\u5668\uFF01", player);
        ev.cancel = true;
      }
    });
  }
};

// scripts/gui/MoneyGUI.ts
import { world as world20 } from "@minecraft/server";
import { CustomForm as CustomForm6 } from "@minecraft/server-ui";
var MoneyGUI = class {
  static registerCommand() {
    Command.register(
      "money",
      "money.admin",
      (player) => {
        if (!player) return;
        this.showMainMenu(player);
      },
      "\u8D27\u5E01\u7BA1\u7406"
    );
  }
  static showMainMenu(player) {
    const balance = Money.get(player);
    const form = new CustomForm6(player, "\u8D27\u5E01\u7BA1\u7406").label(ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\u3002`])).button("\u7ED9\u4E88\u73A9\u5BB6", () => this.showGiveForm(player)).button("\u67E5\u8BE2\u73A9\u5BB6", () => this.showQueryForm(player)).closeButton();
    Gui.showForm(player, form, "\u8D27\u5E01\u7BA1\u7406");
  }
  static showGiveForm(player) {
    const targetName = new ObservableString("");
    const amountStr = new ObservableString("");
    const form = new CustomForm6(player, "\u7ED9\u4E88\u73A9\u5BB6").textField("\u73A9\u5BB6\u540D\u79F0", targetName, { description: "\u8BF7\u8F93\u5165\u73A9\u5BB6\u540D\u79F0" }).textField("\u6570\u91CF", amountStr, { description: "\u8BF7\u8F93\u5165\u8D27\u5E01\u6570\u91CF" }).button("\u786E\u8BA4", () => {
      const name = targetName.getData().trim();
      const val = parseInt(amountStr.getData());
      if (!name || isNaN(val) || val <= 0) {
        Msg.error("\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u6570\u91CF\u3002", player);
        return;
      }
      const target = world20.getPlayers().find((p) => p.name === name);
      if (!target) {
        Msg.error(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`, player);
        return;
      }
      Money.add(target, val);
      Msg.success(`\u5DF2\u7ED9\u4E88 ${name} ${val} ${Money.UNIT}\u3002`, player);
    }).closeButton();
    Gui.showForm(player, form, "\u7ED9\u4E88\u73A9\u5BB6");
  }
  static showQueryForm(player) {
    const targetName = new ObservableString("");
    const form = new CustomForm6(player, "\u67E5\u8BE2\u73A9\u5BB6").textField("\u73A9\u5BB6\u540D\u79F0", targetName, { description: "\u8BF7\u8F93\u5165\u73A9\u5BB6\u540D\u79F0" }).button("\u67E5\u8BE2", () => {
      const name = targetName.getData().trim();
      if (!name) {
        Msg.error("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u73A9\u5BB6\u540D\u79F0\u3002", player);
        return;
      }
      const target = world20.getPlayers().find((p) => p.name === name);
      if (!target) {
        Msg.error(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`, player);
        return;
      }
      const balance = Money.get(target);
      Msg.info(`\u73A9\u5BB6 ${name} \u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\u3002`, player);
    }).closeButton();
    Gui.showForm(player, form, "\u67E5\u8BE2\u73A9\u5BB6");
  }
};

// scripts/gui/MainMenu.ts
import { CustomForm as CustomForm7 } from "@minecraft/server-ui";
var MainMenu = class _MainMenu {
  static registerMenuCommand() {
    Command.register(
      "menu",
      "menu.use",
      (player) => {
        if (player) _MainMenu.show(player);
      },
      "\u4E3B\u83DC\u5355"
    );
  }
  static show(player) {
    this.showMainMenu(player);
  }
  static async showMainMenu(player) {
    const balance = Money.get(player);
    const body = ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}`]);
    const form = new CustomForm7(player, "\u4E3B\u83DC\u5355").label(body).button("\u571F\u5730", () => LandGUI.showMainMenu(player)).button("\u5408\u4F5C\u793E", () => {
      new CoopGUI(player).mainPanel();
    }).button("\u9891\u9053", () => ChatGUI.openChannelPanel(player)).button("\u7EA2\u5305", () => ChatGUI.openRedPacketPanel(player)).button("\u8282\u64CD", () => this.showEconomyPanel(player)).closeButton();
    await Gui.showForm(player, form, "\u4E3B\u83DC\u5355");
  }
  static async showEconomyPanel(player) {
    const balance = Money.get(player);
    const body = ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}`]);
    const form = new CustomForm7(player, "\u7ECF\u6D4E\u7CFB\u7EDF").label(body).button("\u67E5\u8BE2\u4F59\u989D", async () => {
      const bal = Money.get(player);
      Msg.info(`\u5F53\u524D\u4F59\u989D: ${bal} ${Money.UNIT}`, player);
      await this.showEconomyPanel(player);
    }).button("\u8F6C\u8D26", () => this.showTransferForm(player)).closeButton();
    await Gui.showForm(player, form, "\u7ECF\u6D4E\u7CFB\u7EDF");
  }
  static async showTransferForm(player) {
    const targetName = new ObservableString("");
    const amountStr = new ObservableString("");
    const form = new CustomForm7(player, "\u8F6C\u8D26").textField("\u76EE\u6807\u73A9\u5BB6", targetName, { description: "\u8F93\u5165\u73A9\u5BB6\u540D\u79F0" }).textField("\u91D1\u989D", amountStr, { description: "\u8F93\u5165\u8F6C\u8D26\u91D1\u989D" }).button("\u786E\u8BA4\u8F6C\u8D26", async () => {
      const name = targetName.getData().trim();
      const amount = parseInt(amountStr.getData());
      if (!name || isNaN(amount) || amount <= 0) {
        Msg.error("\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u91D1\u989D\u3002", player);
        return;
      }
      const target = player.dimension.getPlayers().find((p) => p.name === name);
      if (!target) {
        Msg.error(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`, player);
        return;
      }
      const balance = Money.get(player);
      if (amount > balance) {
        Msg.error(`\u4F59\u989D\u4E0D\u8DB3\u3002\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\uFF0C\u9700\u8981: ${amount} ${Money.UNIT}`, player);
        return;
      }
      Money.add(player, -amount);
      Money.add(target, amount);
      Msg.success(`\u6210\u529F\u8F6C\u8D26 ${amount} ${Money.UNIT} \u7ED9 ${name}\u3002`, player);
    }).closeButton();
    const reason = await Gui.showForm(player, form, "\u8F6C\u8D26");
    if (reason === "ClientClosed" || reason === "ServerClosed") {
      await this.showEconomyPanel(player);
    }
  }
};

// scripts/shop/ShopSystem.ts
import {
  world as world21,
  BlockComponentTypes as BlockComponentTypes4
} from "@minecraft/server";

// scripts/gui/ShopGUI.ts
import { CustomForm as CustomForm8 } from "@minecraft/server-ui";
var ShopGUI = class {
  static show(player) {
    const cfg = Config.shopChest;
    const totalShops = cfg.size[0] * cfg.size[1];
    const form = new CustomForm8(player, "\u5546\u5E97");
    form.label(ListFormInfo(["\u9009\u62E9\u8981\u6D4F\u89C8\u7684\u5546\u54C1\u5206\u7C7B"]));
    for (let i = 0; i < totalShops; i++) {
      const idx = i;
      form.button(ShopSystem.getShopName(i), () => {
        this.showShopCategory(player, idx);
      });
    }
    form.closeButton();
    Gui.showForm(player, form, "\u5546\u5E97");
  }
  static showShopCategory(player, catIdx) {
    const items = ShopSystem.getChestItems(catIdx);
    const priceData = ShopSystem.getPriceData();
    const shopName = ShopSystem.getShopName(catIdx);
    const body = [`\u5F53\u524D\u4F59\u989D: ${Money.get(player)} ${Money.UNIT}`];
    const form = new CustomForm8(player, shopName);
    form.label(ListFormInfo(body));
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      if (!item) continue;
      const actualIdx = j;
      const buyPrice = priceData.prices[`${catIdx}:${j}`];
      const sellPrice = priceData.sellPrices[`${catIdx}:${j}`];
      const label = `${item.typeId} \xA77x${item.amount}\xA7r`;
      const prices = `${buyPrice ? `\xA7a\u4E70:${buyPrice} ${Money.UNIT}\xA7r` : ""} ${sellPrice ? `\xA76\u5356:${sellPrice} ${Money.UNIT}\xA7r` : ""}`;
      form.button(`${label}
${prices}`, () => {
        this.showItemDetail(player, catIdx, actualIdx);
      });
    }
    form.closeButton();
    Gui.showForm(player, form, shopName);
  }
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
    const form = new CustomForm8(player, title);
    form.label(bodyParts.join("\n"));
    if (buyPrice) {
      form.button(`\xA7a\u8D2D\u4E70 \xA77(${buyPrice} ${Money.UNIT}/\u4E2A)`, () => {
        this.showQuantityInput(player, catIdx, slotIdx, item, "buy");
      });
    }
    if (sellPrice) {
      form.button(`\xA76\u56DE\u6536 \xA77(${sellPrice} ${Money.UNIT}/\u4E2A)`, () => {
        this.showQuantityInput(player, catIdx, slotIdx, item, "sell");
      });
    }
    form.closeButton();
    Gui.showForm(player, form, title);
  }
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
    const amountObs = new ObservableString("");
    const form = new CustomForm8(player, `\xA7l${label} ${item.typeId}`);
    form.label(`\xA77\u5355\u4EF7: ${unitPrice} ${Money.UNIT}/\u4E2A
\xA77\u5E93\u5B58: ${action === "buy" ? buyMax : "\u4E0D\u9650"}
\xA77\u8F93\u5165${label}\u6570\u91CF\uFF1A`);
    form.textField(`\u8F93\u5165\u6570\u91CF (1-${action === "buy" ? buyMax : 64})`, amountObs);
    form.button(`\u786E\u8BA4${label}`, () => {
      const amountStr = amountObs.getData();
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
    form.closeButton();
    Gui.showForm(player, form, `${label} ${item.typeId}`);
  }
};

// scripts/shop/ShopSystem.ts
var ShopSystem = class {
  static registerCommand() {
    Command.register(
      "shop",
      "shop.use",
      (player) => {
        if (player) this.showShop(player);
      },
      "\u5546\u5E97"
    );
  }
  /** 委托给 ShopGUI 打开商店主菜单 */
  static showShop(player) {
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
    ensureDoubleChest(
      dim,
      left,
      getChestCardinal(Config.shopChest.direction, Config.shopChest.face),
      Config.shopChest.direction
    );
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
    let pricesData = world21.getDynamicProperty("hpbe:shop_prices");
    let prices = {};
    if (typeof pricesData === "string") prices = JSON.parse(pricesData);
    let stocksData = world21.getDynamicProperty("hpbe:shop_stocks");
    let sellPrices = {};
    if (typeof stocksData === "string") sellPrices = JSON.parse(stocksData);
    return {
      prices,
      sellPrices
    };
  }
  static setPrice(catIdx, slotIdx, buyPrice, sellPrice) {
    const data2 = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    if (buyPrice > 0) data2.prices[key] = buyPrice;
    else delete data2.prices[key];
    if (sellPrice > 0) data2.sellPrices[key] = sellPrice;
    else delete data2.sellPrices[key];
    world21.setDynamicProperty("hpbe:shop_prices", JSON.stringify(data2.prices));
    world21.setDynamicProperty("hpbe:shop_stocks", JSON.stringify(data2.sellPrices));
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
    ensureDoubleChest(
      dim,
      left,
      getChestCardinal(Config.shopChest.direction, Config.shopChest.face),
      Config.shopChest.direction
    );
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

// scripts/data/Scoreboards.ts
import { world as world22 } from "@minecraft/server";

// scripts/api/ScoreboardsSyncApi.ts
async function backupScoreboards(entries) {
  return HttpDB.post("/api/sfmc/scoreboards", { entries });
}
async function loadScoreboards(filter) {
  const qs = toQueryString({
    objective: filter?.objective,
    name: filter?.name,
    id: filter?.id
  });
  const body = await HttpDB.get(`/api/sfmc/scoreboards${qs}`);
  if (!body) return null;
  try {
    return JSON.parse(body).entries;
  } catch {
    return null;
  }
}

// scripts/data/Scoreboards.ts
function ScoreboardsBackup() {
  let entries = [];
  world22.scoreboard.getObjectives().forEach((obj, index) => {
    const scores = obj.getScores();
    entries.push({
      id: obj.id,
      displayName: obj.displayName,
      participants: []
    });
    for (const info of scores) {
      const identity = info.participant;
      entries[index].participants?.push({
        id: identity.id,
        type: identity.type,
        name: identity.displayName,
        score: info.score
      });
    }
  });
  backupScoreboards(entries);
}
var ScoreboardSync = class {
  static init() {
    ScoreboardsBackup();
    console.info("[ScoreboardSync] \u8BA1\u5206\u677F\u540C\u6B65\u5DF2\u521D\u59CB\u5316");
  }
  /** 恢复：db-server → 游戏 */
  static async load() {
    try {
      const entries = await loadScoreboards();
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

// scripts/data/ActivityLog.ts
import { world as world23, system as system15 } from "@minecraft/server";
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
var FLUSH_INTERVAL = 2e3;
var CLEANUP_INTERVAL = 6 * 36e5;
var KEEP_DAYS = 30;
var queue = [];
var flushTimer = null;
var initialized = false;
function enqueue(entry) {
  queue.push(entry);
  if (!flushTimer) {
    flushTimer = system15.runTimeout(flush, FLUSH_INTERVAL / 50);
  }
}
async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await HttpDB.post("/api/sfmc/activities/batch", { entries: batch });
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
  function safeSubscribe(signal, cb) {
    if (signal && typeof signal.subscribe === "function") {
      signal.subscribe(cb);
    }
  }
  const AE = world23.afterEvents;
  safeSubscribe(AE.playerSpawn, (event) => {
    if (!event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.join")) return;
    enqueue(playerEntry(event.player, "player.join"));
  });
  safeSubscribe(AE.playerLeave, (event) => {
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
  safeSubscribe(AE.playerSpawn, (event) => {
    if (event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.spawn")) return;
    enqueue(playerEntry(event.player, "player.spawn"));
  });
  safeSubscribe(AE.playerDimensionChange, (event) => {
    if (!ENABLED_EVENTS.has("player.dimension")) return;
    const [fx, fy, fz] = loc(event.fromLocation);
    const [tx, ty, tz] = loc(event.toLocation);
    enqueue(
      playerEntry(event.player, "player.dimension", {
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        detail: {
          from: event.fromDimension.id.replace("minecraft:", ""),
          to: event.toDimension.id.replace("minecraft:", ""),
          fromLoc: { x: fx, y: fy, z: fz },
          toLoc: { x: tx, y: ty, z: tz }
        }
      })
    );
  });
  safeSubscribe(AE.playerGameModeChange, (event) => {
    if (!ENABLED_EVENTS.has("player.gamemode")) return;
    enqueue(
      playerEntry(event.player, "player.gamemode", {
        detail: {
          from: event.fromGameMode,
          to: event.toGameMode
        }
      })
    );
  });
  safeSubscribe(AE.chatSend, (event) => {
    if (!ENABLED_EVENTS.has("player.chat")) return;
    const targets = event.targets?.map((p) => p.name) || [];
    enqueue(
      playerEntry(event.sender, "player.chat", {
        detail: {
          message: event.message,
          targets: targets.length > 0 ? targets : void 0
        }
      })
    );
  });
  safeSubscribe(AE.playerBreakBlock, (event) => {
    if (!ENABLED_EVENTS.has("block.break")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(event.player, "block.break", {
        targetType: "block",
        targetName: event.brokenBlockPermutation.type.id,
        targetX: bx,
        targetY: by,
        targetZ: bz,
        detail: {
          itemBefore: event.itemStackBeforeBreak?.type?.id || null,
          itemAfter: event.itemStackAfterBreak?.type?.id || null
        }
      })
    );
  });
  safeSubscribe(AE.playerPlaceBlock, (event) => {
    if (!ENABLED_EVENTS.has("block.place")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(event.player, "block.place", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz,
        detail: {}
      })
    );
  });
  safeSubscribe(AE.entityDie, (event) => {
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
      enqueue(
        playerEntry(player, "entity.death", {
          targetType,
          targetid,
          targetName,
          targetX: dx,
          targetY: dy,
          targetZ: dz,
          detail: { cause, projectile: proj?.typeId || null }
        })
      );
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
  safeSubscribe(AE.entityHitEntity, (event) => {
    if (!ENABLED_EVENTS.has("entity.hit")) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    const [ax, ay, az] = loc(attacker.location);
    const [vx, vy, vz] = loc(victim.location);
    if (attacker.typeId === "minecraft:player") {
      enqueue(
        playerEntry(attacker, "entity.hit", {
          targetType: victim.typeId === "minecraft:player" ? "player" : "entity",
          targetid: getTargetPlayerId(victim),
          targetName: getTargetPlayerName(victim),
          targetX: vx,
          targetY: vy,
          targetZ: vz
        })
      );
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
  safeSubscribe(AE.entityHurt, (event) => {
    if (!ENABLED_EVENTS.has("entity.hurt")) return;
    const hurt = event.hurtEntity;
    const ds = event.damageSource;
    if (hurt.typeId !== "minecraft:player") return;
    const player = hurt;
    enqueue(
      playerEntry(player, "entity.hurt", {
        detail: {
          damage: event.damage,
          cause: ds.cause,
          damager: ds.damagingEntity?.typeId || null,
          projectile: ds.damagingProjectile?.typeId || null
        }
      })
    );
  });
  safeSubscribe(AE.playerInteractWithEntity, (event) => {
    if (!ENABLED_EVENTS.has("entity.interact")) return;
    const target = event.target;
    const [tx, ty, tz] = loc(target.location);
    enqueue(
      playerEntry(event.player, "entity.interact", {
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
      })
    );
  });
  safeSubscribe(AE.entityTamed, (event) => {
    if (!ENABLED_EVENTS.has("entity.tame")) return;
    const tamer = event.tamingEntity;
    if (!tamer || tamer.typeId !== "minecraft:player") return;
    const target = event.entity;
    const [tx, ty, tz] = loc(target.location);
    enqueue(
      playerEntry(tamer, "entity.tame", {
        targetType: "entity",
        targetName: target.typeId,
        targetX: tx,
        targetY: ty,
        targetZ: tz
      })
    );
  });
  safeSubscribe(AE.entitySpawn, (event) => {
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
  safeSubscribe(AE.entityItemDrop, (event) => {
    if (!ENABLED_EVENTS.has("item.drop")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(
        playerEntry(e, "item.drop", {
          detail: {
            items: event.items.map((item) => item.typeId).filter(Boolean)
          }
        })
      );
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
          items: event.items.map((item) => item.typeId).filter(Boolean)
        }
      });
    }
  });
  safeSubscribe(AE.entityItemPickup, (event) => {
    if (!ENABLED_EVENTS.has("item.pickup")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(
        playerEntry(e, "item.pickup", {
          detail: {
            items: event.items.map((item) => item.type.id)
          }
        })
      );
    }
  });
  safeSubscribe(AE.blockContainerOpened, (event) => {
    if (!ENABLED_EVENTS.has("container.open")) return;
    const source = event.openSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(source, "container.open", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz
      })
    );
  });
  safeSubscribe(AE.blockContainerClosed, (event) => {
    if (!ENABLED_EVENTS.has("container.close")) return;
    const source = event.closeSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(source, "container.close", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz
      })
    );
  });
  safeSubscribe(AE.explosion, (event) => {
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
    await HttpDB.post("/api/sfmc/activities/cleanup", { keepDays: KEEP_DAYS, keepAdmin: true });
  } catch {
  }
}
var ActivityLog = class {
  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents() {
    subscribe();
  }
  static init() {
    if (initialized) return;
    initialized = true;
    console.info("[ActivityLog] \u4E8B\u4EF6\u8BA2\u9605\u5B8C\u6210");
    system15.runInterval(flush, FLUSH_INTERVAL / 50);
    system15.runTimeout(() => {
      doCleanup();
      system15.runInterval(doCleanup, CLEANUP_INTERVAL / 50);
    }, 72e3 / 50);
  }
};

// scripts/data/World.ts
import { world as world24 } from "@minecraft/server";

// scripts/api/WorldDataApi.ts
async function saveWorldData(data2) {
  return HttpDB.post("/api/sfmc/world", { data: data2 });
}

// scripts/data/World.ts
function serializeGameRules() {
  const g = world24.gameRules;
  const rules = {};
  const props = [
    "commandBlockOutput",
    "doDayLightCycle",
    "doEntityDrops",
    "doFireTick",
    "doImmediateRespawn",
    "doInsomnia",
    "doLimitedCrafting",
    "doMobLoot",
    "doMobSpawning",
    "doTileDrops",
    "doWeatherCycle",
    "drowningDamage",
    "fallDamage",
    "fireDamage",
    "freezeDamage",
    "functionCommandLimit",
    "keepInventory",
    "maxCommandChainLength",
    "mobGriefing",
    "naturalRegeneration",
    "randomTickSpeed",
    "sendCommandFeedback",
    "showBorderEffect",
    "showCoordinates",
    "showDeathMessage",
    "showRecipeMessages",
    "showTags",
    "spawnRadius",
    "tntExplodes"
  ];
  for (const key of props) {
    try {
      rules[key] = g[key];
    } catch {
    }
  }
  return JSON.stringify(rules);
}
async function getWorldData() {
  const data2 = {
    allowCheats: world24.allowCheats,
    gameRules: serializeGameRules(),
    seed: world24.seed,
    defaultSpawnLocation: JSON.stringify(world24.getDefaultSpawnLocation()),
    difficulty: world24.getDifficulty(),
    day: world24.getDay(),
    tickingAreasCount: world24.tickingAreaManager.chunkCount,
    absoluteTime: world24.getAbsoluteTime(),
    structuresFromAddon: world24.structureManager.getPackStructureIds().toString(),
    structuresFromWorld: world24.structureManager.getWorldStructureIds().toString(),
    MoonPhase: world24.getMoonPhase(),
    dynamicPropertyTotalByteCount: world24.getDynamicPropertyTotalByteCount(),
    updatedAt: getShanghaiTime().date + getShanghaiTime().time
  };
  return data2;
}
async function syncWorldData() {
  const data2 = await getWorldData();
  saveWorldData(data2);
}

// scripts/api/PlayersDataApi.ts
var PATH_PLAYERS = "/api/sfmc/players";
async function savePlayers(players) {
  return HttpDB.post(PATH_PLAYERS, { players });
}

// scripts/data/Player.ts
async function getPlayerData(player) {
  const data2 = {
    id: player.id,
    name: player.name,
    clientSystemInfoLocal: player.clientSystemInfo?.locale,
    clientSystemInfoMaxRenderDistance: player.clientSystemInfo?.maxRenderDistance,
    clientSystemInfoMemoryTierLevel: player.clientSystemInfo?.memoryTier,
    clientSystemInfoPlatformType: player.clientSystemInfo?.platformType,
    graphicsMode: player.graphicsMode,
    dynamicPropertyTotalByteCount: player.getDynamicPropertyTotalByteCount(),
    ping: player.getPing(),
    level: player.level,
    spawnPoint: JSON.stringify(player.getSpawnPoint()),
    tags: player.getTags().toString(),
    totalXp: player.getTotalXp(),
    updatedAt: formatTimestamp(Date.now())
  };
  return data2;
}

// scripts/holo/HoloEntity.ts
import { world as world25, Player as Player23 } from "@minecraft/server";
var HOLOGRAM_ENTITY_ID = "sfmc:hologram";
var DP_PROJECTION_ID = "hpbe_projection_id";
var DP_OWNER_ID = "hpbe_owner_id";
var DP_SCALE = "hpbe_scale";
var DP_OPACITY = "hpbe_opacity";
var DP_ROTATION = "hpbe_rotation";
var DP_VISIBLE = "hpbe_visible";
var DP_LAYER = "hpbe_layer";
var DP_OFFSET_X = "hpbe_offset_x";
var DP_OFFSET_Y = "hpbe_offset_y";
var DP_OFFSET_Z = "hpbe_offset_z";
var HoloEntity = class {
  static {
    /** projectionId → ActiveHologram */
    this.activeHolograms = /* @__PURE__ */ new Map();
  }
  // ──────── 公开方法 ────────
  /**
   * 在世界中生成全息实体
   * @param player    所属玩家
   * @param projectionId  投影 ID
   * @param location  生成位置
   * @returns 生成的 Entity，失败返回 null
   */
  static spawnProjection(player, projectionId, location) {
    try {
      const dimension = player.dimension;
      const entity = dimension.spawnEntity(HOLOGRAM_ENTITY_ID, location);
      entity.setDynamicProperty(DP_PROJECTION_ID, projectionId);
      entity.setDynamicProperty(DP_OWNER_ID, player.id);
      this.activeHolograms.set(projectionId, {
        entity,
        projectionId,
        ownerId: player.id
      });
      console.info(`[HoloEntity] \u5DF2\u751F\u6210\u6295\u5F71 ${projectionId} \u4E8E ${location.x},${location.y},${location.z}`);
      return entity;
    } catch (err) {
      console.error(`[HoloEntity] \u751F\u6210\u6295\u5F71\u5931\u8D25 ${projectionId}: ${err}`);
      return null;
    }
  }
  /**
   * 移除指定投影实体
   * @param projectionId  投影 ID
   * @returns 是否成功移除
   */
  static removeProjection(projectionId) {
    const entry = this.activeHolograms.get(projectionId);
    if (!entry) {
      console.warn(`[HoloEntity] \u6295\u5F71 ${projectionId} \u4E0D\u5B58\u5728\u4E8E\u6D3B\u8DC3\u6620\u5C04\u4E2D`);
      return false;
    }
    try {
      entry.entity.remove();
      this.activeHolograms.delete(projectionId);
      console.info(`[HoloEntity] \u5DF2\u79FB\u9664\u6295\u5F71 ${projectionId}`);
      return true;
    } catch (err) {
      console.error(`[HoloEntity] \u79FB\u9664\u6295\u5F71\u5931\u8D25 ${projectionId}: ${err}`);
      this.activeHolograms.delete(projectionId);
      return false;
    }
  }
  /**
   * 更新实体属性（透明度、比例等）
   *
   * 实体的几何体由资源包渲染控制器驱动，此处仅更新动态属性，
   * 渲染控制器通过 Molang 查询这些属性来调节视觉效果。
   *
   * @param projectionId  投影 ID
   * @param settings      要更新的设置字段
   * @returns 是否成功更新
   */
  static updateProjection(projectionId, settings) {
    const entry = this.activeHolograms.get(projectionId);
    if (!entry) {
      console.warn(`[HoloEntity] \u6295\u5F71 ${projectionId} \u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u66F4\u65B0`);
      return false;
    }
    try {
      const entity = entry.entity;
      if (settings.scale !== void 0) entity.setDynamicProperty(DP_SCALE, settings.scale);
      if (settings.opacity !== void 0) entity.setDynamicProperty(DP_OPACITY, settings.opacity);
      if (settings.rotation !== void 0) entity.setDynamicProperty(DP_ROTATION, settings.rotation);
      if (settings.visible !== void 0) entity.setDynamicProperty(DP_VISIBLE, settings.visible);
      if (settings.layer !== void 0) entity.setDynamicProperty(DP_LAYER, settings.layer);
      if (settings.offsetX !== void 0) entity.setDynamicProperty(DP_OFFSET_X, settings.offsetX);
      if (settings.offsetY !== void 0) entity.setDynamicProperty(DP_OFFSET_Y, settings.offsetY);
      if (settings.offsetZ !== void 0) entity.setDynamicProperty(DP_OFFSET_Z, settings.offsetZ);
      return true;
    } catch (err) {
      console.error(`[HoloEntity] \u66F4\u65B0\u6295\u5F71\u5931\u8D25 ${projectionId}: ${err}`);
      return false;
    }
  }
  /**
   * 获取玩家操作的投影 ID
   * @param entity  全息实体实例
   * @returns 投影 ID 或 null
   */
  static getProjectionForEntity(entity) {
    const projectionId = entity.getDynamicProperty(DP_PROJECTION_ID);
    return projectionId ?? null;
  }
  /**
   * 注册事件（由 entry.ts 统一调用）
   */
  static registerEvents() {
    world25.afterEvents.entityHitEntity.subscribe((event) => {
      const { damagingEntity, hitEntity } = event;
      if (hitEntity.typeId !== HOLOGRAM_ENTITY_ID) return;
      if (!(damagingEntity instanceof Player23)) return;
      const projectionId = hitEntity.getDynamicProperty(DP_PROJECTION_ID);
      if (!projectionId) return;
      console.info(`[HoloEntity] \u73A9\u5BB6 ${damagingEntity.name} \u70B9\u51FB\u4E86\u5168\u606F\u6295\u5F71 ${projectionId}`);
    });
  }
  /**
   * 初始化所有活跃全息实体
   *
   * 在 worldLoad 时调用，扫描所有已存在的 sfmc:hologram 实体并重新注册
   */
  static init() {
    try {
      const dimensions = ["overworld", "nether", "the_end"];
      let count = 0;
      for (const dimId2 of dimensions) {
        const dim = world25.getDimension(dimId2);
        const entities = dim.getEntities({ type: HOLOGRAM_ENTITY_ID });
        for (const entity of entities) {
          const projectionId = entity.getDynamicProperty(DP_PROJECTION_ID);
          const ownerId = entity.getDynamicProperty(DP_OWNER_ID);
          if (projectionId && ownerId) {
            this.activeHolograms.set(projectionId, { entity, projectionId, ownerId });
            count++;
          }
        }
      }
      console.info(`[HoloEntity] \u521D\u59CB\u5316\u5B8C\u6210\uFF0C\u5DF2\u6CE8\u518C ${count} \u4E2A\u6D3B\u8DC3\u5168\u606F\u5B9E\u4F53`);
    } catch (err) {
      console.error(`[HoloEntity] \u521D\u59CB\u5316\u626B\u63CF\u5931\u8D25: ${err}`);
    }
  }
};

// scripts/holo/HoloGUI.ts
import { CustomForm as CustomForm9 } from "@minecraft/server-ui";

// scripts/holo/HoloCore.ts
import { world as world26 } from "@minecraft/server";

// scripts/data/HoloPrint.ts
var COLOR_PRESETS = [
  { name: "\u767D\u8272", value: "255 255 255", hex: "#FFFFFF" },
  { name: "\u7EA2\u8272", value: "255 85 85", hex: "#FF5555" },
  { name: "\u6A59\u8272", value: "255 170 0", hex: "#FFAA00" },
  { name: "\u9EC4\u8272", value: "255 255 85", hex: "#FFFF55" },
  { name: "\u7EFF\u8272", value: "85 255 85", hex: "#55FF55" },
  { name: "\u9752\u8272", value: "85 255 255", hex: "#55FFFF" },
  { name: "\u84DD\u8272", value: "85 85 255", hex: "#5555FF" },
  { name: "\u7D2B\u8272", value: "170 0 170", hex: "#AA00AA" },
  { name: "\u7C89\u8272", value: "255 85 255", hex: "#FF55FF" },
  { name: "\u7070\u8272", value: "170 170 170", hex: "#AAAAAA" }
];
var DEFAULT_HOLO_SETTINGS = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotation: 0,
  opacity: 1,
  layer: 0,
  visible: true,
  spawnAnimation: false,
  blockInspect: false,
  overlayTint: "",
  overlayTintOpacity: 0,
  textureOutlineWidth: 0,
  textureOutlineColor: "",
  textureOutlineOpacity: 0,
  layerMode: "all"
};

// scripts/api/HoloprintApi.ts
import { http as http2, HttpRequest as HttpRequest2 } from "@minecraft/server-net";
var BASE_URL2 = `http://${Config.dbHost}:${Config.dbPort}`;
var TIMEOUT2 = 3;
var HoloprintApi = class {
  static async request(method, path, bodyData) {
    try {
      const req = new HttpRequest2(`${BASE_URL2}${path}`);
      req.timeout = TIMEOUT2;
      req.method = method;
      if (bodyData) {
        req.body = JSON.stringify(bodyData);
        req.addHeader("Content-Type", "application/json");
      }
      const res = await http2.request(req);
      return { status: res.status, body: res.body };
    } catch (err) {
      console.warn(`[HoloprintApi] ${method} ${path} \u5931\u8D25: ${err}`);
      return { status: 0, body: "" };
    }
  }
  // ---- Holoprint 投影 ----
  static async uploadHoloStructure(projectionData, structureBase64) {
    const { status } = await this.request("Post", "/api/hpbe/upload", {
      projection: projectionData,
      structure: structureBase64
    });
    return status === 200;
  }
  static async getHoloProjections(ownerId, visibility) {
    const qs = [];
    if (ownerId) qs.push(`owner_id=${encodeURIComponent(ownerId)}`);
    if (visibility) qs.push(`visibility=${encodeURIComponent(visibility)}`);
    const query = qs.length > 0 ? "?" + qs.join("&") : "";
    const { status, body } = await this.request("Get", `/api/hpbe/projections${query}`);
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.projections ?? null;
    } catch {
      return null;
    }
  }
  static async getHoloProjection(id) {
    const { status, body } = await this.request("Get", `/api/hpbe/projections/${encodeURIComponent(id)}`);
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.projection ?? null;
    } catch {
      return null;
    }
  }
  static async updateHoloProjection(id, settings) {
    const { status } = await this.request("Put", `/api/hpbe/projections/${encodeURIComponent(id)}`, { settings });
    return status === 200;
  }
  static async deleteHoloProjection(id) {
    const { status } = await this.request("Delete", `/api/hpbe/projections/${encodeURIComponent(id)}`);
    return status === 200;
  }
  static async getHoloPackVersion() {
    const { status, body } = await this.request("Get", "/api/hpbe/pack-version");
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.version ?? null;
    } catch {
      return null;
    }
  }
  static async getHoloMaterials(projectionId) {
    const { status, body } = await this.request("Get", `/api/hpbe/materials/${encodeURIComponent(projectionId)}`);
    if (status !== 200 || !body) return null;
    try {
      const parsed = JSON.parse(body);
      return parsed.materials ?? null;
    } catch {
      return null;
    }
  }
};

// scripts/holo/HoloCore.ts
var STRUCTURE_ID_PREFIX = "hpbe_";
var HoloCore = class {
  static {
    /**
     * 玩家选区状态
     * key: player.id
     */
    this.playerSelections = /* @__PURE__ */ new Map();
  }
  // ──────── 选区操作 ────────
  /**
   * 设置玩家选区点
   * @param player    当前玩家
   * @param posNumber 1 = pos1, 2 = pos2
   */
  static setPos(player, posNumber) {
    const loc2 = player.location;
    const point = { x: Math.floor(loc2.x), y: Math.floor(loc2.y), z: Math.floor(loc2.z) };
    let sel = this.playerSelections.get(player.id);
    if (!sel) {
      sel = { pos1: null, pos2: null };
      this.playerSelections.set(player.id, sel);
    }
    if (posNumber === 1) {
      sel.pos1 = point;
      player.sendMessage(`\xA7a[HPBE] \u5DF2\u8BBE\u7F6E\u4F4D\u7F6E1: ${point.x}, ${point.y}, ${point.z}`);
    } else {
      sel.pos2 = point;
      player.sendMessage(`\xA7a[HPBE] \u5DF2\u8BBE\u7F6E\u4F4D\u7F6E2: ${point.x}, ${point.y}, ${point.z}`);
    }
  }
  // ──────── 上传流程 ────────
  /**
   * 执行上传流程
   *
   * 1. 检查选区完整性
   * 2. 使用 StructureManager 保存方块区域为临时结构
   * 3. 通过 HoloprintApi 上传结构元数据到 db-server
   * 4. 清理临时结构
   *
   * @param player  当前玩家
   * @param config  上传配置（名称、作者、描述、可见性）
   */
  static async startUpload(player, config) {
    try {
      const sel = this.playerSelections.get(player.id);
      if (!sel || !sel.pos1 || !sel.pos2) {
        player.sendMessage("\xA7c[HPBE] \u8BF7\u5148\u4F7F\u7528 !hpbe pos1 \u548C !hpbe pos2 \u8BBE\u7F6E\u9009\u533A");
        return;
      }
      const min = {
        x: Math.min(sel.pos1.x, sel.pos2.x),
        y: Math.min(sel.pos1.y, sel.pos2.y),
        z: Math.min(sel.pos1.z, sel.pos2.z)
      };
      const max = {
        x: Math.max(sel.pos1.x, sel.pos2.x),
        y: Math.max(sel.pos1.y, sel.pos2.y),
        z: Math.max(sel.pos1.z, sel.pos2.z)
      };
      const sizeX = max.x - min.x + 1;
      const sizeY = max.y - min.y + 1;
      const sizeZ = max.z - min.z + 1;
      if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) {
        player.sendMessage("\xA7c[HPBE] \u9009\u533A\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8BBE\u7F6E");
        return;
      }
      const timestamp = Date.now();
      const structureId = `${STRUCTURE_ID_PREFIX}${player.id}_${timestamp}`;
      try {
        world26.structureManager.createFromWorld(structureId, player.dimension, min, max);
      } catch (err) {
        player.sendMessage("\xA7c[HPBE] \u4FDD\u5B58\u7ED3\u6784\u5931\u8D25\uFF0C\u9009\u533A\u53EF\u80FD\u5305\u542B\u672A\u52A0\u8F7D\u533A\u5757");
        console.error(`[HoloCore] createFromWorld \u5931\u8D25: ${err}`);
        return;
      }
      const projectionData = {
        name: config.name,
        author: config.author,
        description: config.description,
        ownerId: player.id,
        visibility: config.visibility,
        scale: DEFAULT_HOLO_SETTINGS.scale,
        opacity: DEFAULT_HOLO_SETTINGS.opacity,
        sizeX,
        sizeY,
        sizeZ,
        blockCount: 0
      };
      const success = await HoloprintApi.uploadHoloStructure(projectionData, "");
      this.playerSelections.delete(player.id);
      if (success) {
        player.sendMessage(`\xA7a[HPBE] \u6295\u5F71 "${config.name}" \u4E0A\u4F20\u6210\u529F\uFF01`);
        console.info(`[HoloCore] \u73A9\u5BB6 ${player.name} \u4E0A\u4F20\u4E86\u6295\u5F71 ${config.name}`);
      } else {
        player.sendMessage("\xA7c[HPBE] \u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u8FDE\u63A5");
      }
    } catch (err) {
      player.sendMessage("\xA7c[HPBE] \u4E0A\u4F20\u8FC7\u7A0B\u4E2D\u53D1\u751F\u5F02\u5E38");
      console.error(`[HoloCore] startUpload \u5F02\u5E38: ${err}`);
    }
  }
  // ──────── 加载流程 ────────
  /**
   * 获取并返回投影列表数据（公共 + 玩家私有）
   *
   * @param player  当前玩家
   * @returns 投影数据数组，用于 GUI 展示
   */
  static async loadProjectionList(player) {
    try {
      const [privateProjections, publicProjections] = await Promise.all([
        HoloprintApi.getHoloProjections(player.id, "private"),
        HoloprintApi.getHoloProjections(void 0, "public")
      ]);
      const all = [];
      if (privateProjections && Array.isArray(privateProjections)) {
        all.push(...privateProjections.map(this.normalizeProjection));
      }
      const privateIds = new Set(privateProjections?.map((p) => p.id) ?? []);
      if (publicProjections && Array.isArray(publicProjections)) {
        for (const proj of publicProjections) {
          if (!privateIds.has(proj.id)) {
            all.push(this.normalizeProjection(proj));
          }
        }
      }
      if (all.length === 0) {
        player.sendMessage("\xA7e[HPBE] \u6CA1\u6709\u53EF\u7528\u7684\u6295\u5F71");
        return [];
      }
      return all;
    } catch (err) {
      console.error(`[HoloCore] \u52A0\u8F7D\u6295\u5F71\u5217\u8868\u5931\u8D25: ${err}`);
      player.sendMessage("\xA7c[HPBE] \u83B7\u53D6\u6295\u5F71\u5217\u8868\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u8FDE\u63A5");
      return null;
    }
  }
  // ──────── 操作执行 ────────
  /**
   * 执行投影操作
   *
   * @param player        操作玩家
   * @param projectionId  投影 ID
   * @param operation     操作名
   * @param value         操作参数（可选）
   */
  static async executeOperation(player, projectionId, operation, value) {
    try {
      switch (operation) {
        case "materials":
          await this.handleMaterials(player, projectionId);
          break;
        case "toggle_visibility":
          await this.handleToggle(player, projectionId, "visible", value);
          break;
        case "set_scale":
          await this.handleSet(player, projectionId, "scale", value);
          break;
        case "set_opacity":
          await this.handleSet(player, projectionId, "opacity", value);
          break;
        case "set_rotation":
          await this.handleSet(player, projectionId, "rotation", value);
          break;
        case "move":
          await this.handleMove(player, projectionId, value);
          break;
        case "set_layer":
          await this.handleSet(player, projectionId, "layer", value);
          break;
        case "toggle_inspect":
          await this.handleToggle(player, projectionId, "blockInspect", value);
          break;
        case "delete":
          await this.handleDelete(player, projectionId);
          break;
        default:
          player.sendMessage(`\xA7c[HPBE] \u672A\u77E5\u64CD\u4F5C: ${operation}`);
      }
    } catch (err) {
      console.error(`[HoloCore] \u6267\u884C\u64CD\u4F5C ${operation} \u5931\u8D25: ${err}`);
      player.sendMessage(`\xA7c[HPBE] \u64CD\u4F5C\u6267\u884C\u5931\u8D25: ${err}`);
    }
  }
  // ──────── 内部操作方法 ────────
  /** 获取并显示方块清单 */
  static async handleMaterials(player, projectionId) {
    const materials = await HoloprintApi.getHoloMaterials(projectionId);
    if (!materials || materials.length === 0) {
      player.sendMessage("\xA7e[HPBE] \u8BE5\u6295\u5F71\u6CA1\u6709\u65B9\u5757\u6E05\u5355\u6570\u636E");
      return;
    }
    player.sendMessage(`\xA7a[HPBE] \u5171 ${materials.length} \u79CD\u65B9\u5757`);
  }
  /** 切换布尔属性 */
  static async handleToggle(player, projectionId, field, value) {
    const currentValue = typeof value === "boolean" ? value : value === true;
    const newValue = !currentValue;
    const success = await HoloprintApi.updateHoloProjection(projectionId, { [field]: newValue });
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u66F4\u65B0\u5931\u8D25");
      return;
    }
    HoloEntity.updateProjection(projectionId, { [field]: newValue });
    player.sendMessage(`\xA7a[HPBE] ${field} \u5DF2\u5207\u6362\u4E3A ${newValue}`);
  }
  /** 设置数值属性 */
  static async handleSet(player, projectionId, field, value) {
    if (value === void 0) {
      player.sendMessage("\xA7c[HPBE] \u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u6570\u503C\u53C2\u6570");
      return;
    }
    const settings = { [field]: value };
    const success = await HoloprintApi.updateHoloProjection(projectionId, settings);
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u66F4\u65B0\u5931\u8D25");
      return;
    }
    HoloEntity.updateProjection(projectionId, settings);
    player.sendMessage(`\xA7a[HPBE] ${field} \u5DF2\u66F4\u65B0\u4E3A ${value}`);
  }
  /** 移动投影（偏移量） */
  static async handleMove(player, projectionId, value) {
    if (!value || typeof value.x !== "number" || typeof value.y !== "number" || typeof value.z !== "number") {
      player.sendMessage("\xA7c[HPBE] \u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u504F\u79FB\u91CF (x, y, z)");
      return;
    }
    const success = await HoloprintApi.updateHoloProjection(projectionId, {
      offsetX: value.x,
      offsetY: value.y,
      offsetZ: value.z
    });
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u66F4\u65B0\u504F\u79FB\u5931\u8D25");
      return;
    }
    HoloEntity.updateProjection(projectionId, {
      offsetX: value.x,
      offsetY: value.y,
      offsetZ: value.z
    });
    player.sendMessage(`\xA7a[HPBE] \u5DF2\u79FB\u52A8\u6295\u5F71\u5230\u504F\u79FB ${value.x}, ${value.y}, ${value.z}`);
  }
  /** 删除投影 */
  static async handleDelete(player, projectionId) {
    const success = await HoloprintApi.deleteHoloProjection(projectionId);
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u5220\u9664\u6295\u5F71\u5931\u8D25");
      return;
    }
    HoloEntity.removeProjection(projectionId);
    player.sendMessage(`\xA7a[HPBE] \u6295\u5F71\u5DF2\u5220\u9664`);
    console.info(`[HoloCore] \u73A9\u5BB6 ${player.name} \u5220\u9664\u4E86\u6295\u5F71 ${projectionId}`);
  }
  // ──────── 工具 ────────
  /**
   * 将 API 返回的原始数据规整为 ProjectionData
   */
  static normalizeProjection(raw) {
    if (raw.settings && raw.ownerId !== void 0) {
      return raw;
    }
    return {
      id: raw.id,
      name: raw.name,
      author: raw.author ?? "",
      description: raw.description ?? "",
      ownerId: raw.owner_id ?? raw.ownerId ?? "",
      isPublic: !!(raw.is_public ?? raw.isPublic ?? false),
      visibility: raw.visibility ?? (raw.isPublic ? "public" : "private"),
      settings: {
        scale: raw.scale ?? raw.settings?.scale ?? 1,
        offsetX: raw.offset_x ?? raw.settings?.offsetX ?? 0,
        offsetY: raw.offset_y ?? raw.settings?.offsetY ?? 0,
        offsetZ: raw.offset_z ?? raw.settings?.offsetZ ?? 0,
        rotation: raw.rotation ?? raw.settings?.rotation ?? 0,
        opacity: raw.opacity ?? raw.settings?.opacity ?? 1,
        layer: raw.layer ?? raw.settings?.layer ?? 0,
        visible: !!(raw.visible ?? raw.settings?.visible ?? true),
        spawnAnimation: !!(raw.spawn_animation ?? raw.settings?.spawnAnimation ?? false),
        blockInspect: !!(raw.block_inspect ?? raw.settings?.blockInspect ?? false),
        overlayTint: raw.overlay_tint ?? raw.settings?.overlayTint ?? "",
        overlayTintOpacity: raw.overlay_tint_opacity ?? raw.settings?.overlayTintOpacity ?? 0,
        textureOutlineWidth: raw.texture_outline_width ?? raw.settings?.textureOutlineWidth ?? 0,
        textureOutlineColor: raw.texture_outline_color ?? raw.settings?.textureOutlineColor ?? "",
        textureOutlineOpacity: raw.texture_outline_opacity ?? raw.settings?.textureOutlineOpacity ?? 0,
        layerMode: raw.layer_mode ?? raw.settings?.layerMode ?? "all"
      },
      dbVersion: raw.db_version ?? raw.dbVersion ?? 1,
      geometryFile: raw.geometry_file ?? raw.geometryFile ?? "",
      blockCount: raw.block_count ?? raw.blockCount ?? 0,
      sizeX: raw.size_x ?? raw.sizeX ?? 0,
      sizeY: raw.size_y ?? raw.sizeY ?? 0,
      sizeZ: raw.size_z ?? raw.sizeZ ?? 0,
      materials: raw.materials ?? [],
      createdAt: raw.created_at ?? raw.createdAt ?? 0,
      updatedAt: raw.updated_at ?? raw.updatedAt ?? 0
    };
  }
};

// scripts/holo/HoloGUI.ts
var HoloGUI = class _HoloGUI {
  static registerCommand() {
    Command.register(
      "holorint",
      "holorint.menu",
      (player) => {
        if (player) _HoloGUI.showMainMenu(player);
      },
      "\u5168\u606F\u6295\u5F71"
    );
    Command.register(
      "hpbe pos1",
      "holorint.pos1",
      (player) => {
        if (player) HoloCore.setPos(player, 1);
      },
      "\u8BBE\u7F6E\u9009\u533A\u70B91"
    );
    Command.register(
      "hpbe pos2",
      "holorint.pos2",
      (player) => {
        if (player) HoloCore.setPos(player, 2);
      },
      "\u8BBE\u7F6E\u9009\u533A\u70B92"
    );
  }
  // ══════════════════════════════════════
  //  1. 主菜单
  // ══════════════════════════════════════
  static showMainMenu(player) {
    const form = new CustomForm9(player, "\u5168\u606F\u6295\u5F71").label("\u9009\u62E9\u4E00\u4E2A\u64CD\u4F5C\uFF1A").button("\u{1F4E4} \u4E0A\u4F20\u6295\u5F71", () => {
      player.sendMessage(
        "\xA7a[HPBE] \u8BF7\u4F7F\u7528 \xA7e!hpbe pos1 \xA7a\u548C \xA7e!hpbe pos2 \xA7a\u8BBE\u7F6E\u9009\u533A\uFF0C\u7136\u540E\u4F7F\u7528 \xA7e!hpbe\xA7a \u6253\u5F00\u83DC\u5355\u9009\u62E9\u4E0A\u4F20"
      );
      _HoloGUI.showUploadConfig(player);
    }).button("\u{1F4E5} \u52A0\u8F7D\u6295\u5F71", () => {
      HoloCore.loadProjectionList(player);
    }).closeButton();
    Gui.showForm(player, form, "\u5168\u606F\u6295\u5F71");
  }
  // ══════════════════════════════════════
  //  2. 上传配置
  // ══════════════════════════════════════
  static async showUploadConfig(player) {
    const name = new ObservableString("");
    const author = new ObservableString(player.name);
    const description = new ObservableString("");
    const visibilityIndex = new ObservableNumber(0);
    const form = new CustomForm9(player, "\u4E0A\u4F20\u6295\u5F71").textField("\xA7a\u6295\u5F71\u540D\u79F0", name, { description: "\u8BF7\u8F93\u5165\u6295\u5F71\u540D\u79F0\u2026" }).textField("\xA7a\u4F5C\u8005", author, { description: "\u4F5C\u8005\u540D" }).textField("\xA77\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09", description, { description: "\u8BF7\u8F93\u5165\u63CF\u8FF0\u2026" }).dropdown("\xA7a\u53EF\u89C1\u6027", visibilityIndex, [
      { label: "\u516C\u5171", value: 0 },
      { label: "\u79C1\u4EBA", value: 1 }
    ]).button("\u786E\u8BA4\u4E0A\u4F20", () => {
      HoloCore.startUpload(player, {
        name: name.getData(),
        author: author.getData(),
        description: description.getData(),
        visibility: visibilityIndex.getData() === 0 ? "public" : "private"
      });
    }).closeButton();
    await Gui.showForm(player, form, "\u4E0A\u4F20\u6295\u5F71");
  }
  // ══════════════════════════════════════
  //  3. 投影列表
  // ══════════════════════════════════════
  static async showProjectionList(player, privateList, publicList) {
    const form = new CustomForm9(player, "\u52A0\u8F7D\u6295\u5F71").button("\xA7l=== \u6211\u7684\u6295\u5F71 ===", () => {
      this.showProjectionList(player, privateList, publicList);
    });
    for (const p of privateList) {
      form.button(`${p.name} - ${p.sizeX}x${p.sizeY}x${p.sizeZ} [${p.blockCount}\u65B9\u5757]`, () => {
        Gui.confirm(player, "\u653E\u7F6E\u6295\u5F71", "\u662F\u5426\u5C06\u6295\u5F71\u653E\u7F6E\u5728\u5F53\u524D\u4F4D\u7F6E\uFF1F", () => {
          HoloEntity.spawnProjection(player, p.id, player.location);
        });
      });
    }
    form.button("\xA7l=== \u516C\u5171\u6295\u5F71 ===", () => {
      this.showProjectionList(player, privateList, publicList);
    });
    for (const p of publicList) {
      form.button(`${p.name} - ${p.sizeX}x${p.sizeY}x${p.sizeZ} [${p.blockCount}\u65B9\u5757]`, () => {
        Gui.confirm(player, "\u653E\u7F6E\u6295\u5F71", "\u662F\u5426\u5C06\u6295\u5F71\u653E\u7F6E\u5728\u5F53\u524D\u4F4D\u7F6E\uFF1F", () => {
          HoloEntity.spawnProjection(player, p.id, player.location);
        });
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u52A0\u8F7D\u6295\u5F71");
  }
  // ══════════════════════════════════════
  //  4. 操作菜单
  // ══════════════════════════════════════
  static async showOperationMenu(player, projection) {
    const s = projection.settings;
    const form = new CustomForm9(player, `\u64CD\u4F5C - ${projection.name}`).button("\u{1F9F1} \u7269\u54C1\u6E05\u5355", () => {
      HoloCore.executeOperation(player, projection.id, "materials");
    }).button(`\u{1F441} \u663E\u793A/\u9690\u85CF (\u5F53\u524D: ${s.visible ? "\u663E\u793A" : "\u9690\u85CF"})`, () => {
      HoloCore.executeOperation(player, projection.id, "toggle_visibility");
    }).button(`\u{1F4D0} \u6BD4\u4F8B (\u5F53\u524D: ${s.scale})`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u6BD4\u4F8B", s.scale, 0.1, 10);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_scale", val);
    }).button(`\u{1F3A8} \u7EB9\u7406\u8F6E\u5ED3\u5BBD\u5EA6 (\u5F53\u524D: ${s.textureOutlineWidth})`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u7EB9\u7406\u8F6E\u5ED3\u5BBD\u5EA6", s.textureOutlineWidth, 0, 10);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_texture_outline_width", val);
    }).button("\u{1F3A8} \u7EB9\u7406\u8F6E\u5ED3\u989C\u8272", async () => {
      const color = await _HoloGUI.showColorPicker(player, "\u9009\u62E9\u7EB9\u7406\u8F6E\u5ED3\u989C\u8272");
      if (color !== null) HoloCore.executeOperation(player, projection.id, "set_texture_outline_color", color);
    }).button(`\u{1F3A8} \u7EB9\u7406\u8F6E\u5ED3\u900F\u660E\u5EA6 (\u5F53\u524D: ${s.textureOutlineOpacity})`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u7EB9\u7406\u8F6E\u5ED3\u900F\u660E\u5EA6", s.textureOutlineOpacity, 0, 1);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_texture_outline_opacity", val);
    }).button("\u{1F308} \u53E0\u52A0\u67D3\u8272", async () => {
      const color = await _HoloGUI.showColorPicker(player, "\u9009\u62E9\u53E0\u52A0\u67D3\u8272\u989C\u8272");
      if (color !== null) HoloCore.executeOperation(player, projection.id, "set_overlay_tint", color);
    }).button(`\u{1F308} \u53E0\u52A0\u67D3\u8272\u900F\u660E\u5EA6 (\u5F53\u524D: ${s.overlayTintOpacity})`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u53E0\u52A0\u67D3\u8272\u900F\u660E\u5EA6", s.overlayTintOpacity, 0, 1);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_overlay_tint_opacity", val);
    }).button(`\u25B6 \u751F\u6210\u52A8\u753B (\u5F53\u524D: ${s.spawnAnimation ? "\u5F00" : "\u5173"})`, () => {
      HoloCore.executeOperation(player, projection.id, "toggle_spawn_animation");
    }).button(`\u{1F506} \u900F\u660E\u5EA6 (\u5F53\u524D: ${s.opacity})`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u900F\u660E\u5EA6", s.opacity, 0, 1);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_opacity", val);
    }).button(`\u{1F4CA} \u5C42\u7EA7 (\u5F53\u524D: ${s.layer})`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u5C42\u7EA7", s.layer, -64, 320);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_layer", val);
    }).button("\u{1F4CF} \u79FB\u52A8", async () => {
      await _HoloGUI.showMoveInput(player, projection);
    }).button(`\u{1F504} \u65CB\u8F6C (\u5F53\u524D: ${s.rotation}\xB0)`, async () => {
      const val = await _HoloGUI.showNumberInput(player, "\u8BBE\u7F6E\u65CB\u8F6C\u89D2\u5EA6", s.rotation, 0, 360);
      if (val !== null) HoloCore.executeOperation(player, projection.id, "set_rotation", val);
    }).button(`\u{1F50D} \u65B9\u5757\u68C0\u67E5 (\u5F53\u524D: ${s.blockInspect ? "\u5F00" : "\u5173"})`, () => {
      HoloCore.executeOperation(player, projection.id, "toggle_block_inspect");
    }).button(`\u{1F3A8} \u53E0\u52A0\u67D3\u8272\u5F00\u5173 (\u5F53\u524D: ${s.overlayTint ? "\u5F00" : "\u5173"})`, () => {
      HoloCore.executeOperation(player, projection.id, "toggle_overlay_tint");
    }).button(`\u{1F4CB} \u5C42\u6A21\u5F0F (\u5F53\u524D: ${s.layerMode === "all" ? "\u5168\u90E8" : s.layerMode === "single" ? "\u5355\u5C42" : "\u8303\u56F4"})`, async () => {
      await _HoloGUI.showLayerModePicker(player, projection);
    }).button("\u274C \u5220\u9664\u6295\u5F71", () => {
      Gui.confirm(player, "\u5220\u9664\u6295\u5F71", "\u786E\u5B9A\u8981\u5220\u9664\u6B64\u6295\u5F71\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002", () => {
        HoloCore.executeOperation(player, projection.id, "delete");
      });
    }).button("\u{1F504} \u66F4\u6362\u6295\u5F71", () => {
      HoloCore.loadProjectionList(player);
    }).closeButton();
    await Gui.showForm(player, form, "\u64CD\u4F5C\u83DC\u5355");
  }
  // ══════════════════════════════════════
  //  5. 物品清单
  // ══════════════════════════════════════
  static async showMaterialList(player, materials) {
    const sorted = [...materials].sort((a, b) => b.count - a.count);
    const form = new CustomForm9(player, "\u7269\u54C1\u6E05\u5355").label(`\u5171 \xA7e${sorted.length}\xA7r \u79CD\u6750\u6599`);
    const maxDisplay = 50;
    const displayItems = sorted.slice(0, maxDisplay);
    for (const m of displayItems) {
      form.label(`\xA77${m.count}\xA7r x ${m.name}`);
    }
    if (sorted.length > maxDisplay) {
      form.label(`\xA78... \u8FD8\u6709 ${sorted.length - maxDisplay} \u79CD\u6750\u6599`);
    }
    form.closeButton();
    await Gui.showForm(player, form, "\u7269\u54C1\u6E05\u5355");
  }
  // ══════════════════════════════════════
  //  6. 颜色选择器
  // ══════════════════════════════════════
  static async showColorPicker(player, title) {
    let result = null;
    const form = new CustomForm9(player, title).label("\u9009\u62E9\u4E00\u4E2A\u989C\u8272\u9884\u8BBE\uFF1A");
    for (const preset of COLOR_PRESETS) {
      form.button(`\xA7l${preset.name}\xA7r  ${preset.hex}`, () => {
        result = preset.value;
      });
    }
    form.closeButton();
    await Gui.showForm(player, form, title);
    return result;
  }
  // ══════════════════════════════════════
  //  7. 数字输入
  // ══════════════════════════════════════
  static async showNumberInput(player, title, defaultValue, min, max) {
    let result = null;
    const val = new ObservableNumber(defaultValue);
    const form = new CustomForm9(player, title).slider("\u6570\u503C", val, min ?? 0, max ?? 100, { step: 1 }).button("\u786E\u8BA4", () => {
      result = val.getData();
    }).closeButton();
    await Gui.showForm(player, form, title);
    return result;
  }
  // ══════════════════════════════════════
  //  8. 版本警告
  // ══════════════════════════════════════
  static showVersionWarning(player) {
    Gui.confirm(
      player,
      "\u7248\u672C\u4E0D\u5339\u914D",
      "\u68C0\u6D4B\u5230\u63D2\u4EF6\u7248\u672C\u4E0E\u670D\u52A1\u5668\u7AEF\u4E0D\u5339\u914D\uFF0C\u90E8\u5206\u6295\u5F71\u53EF\u80FD\u65E0\u6CD5\u6B63\u5E38\u663E\u793A\u3002\n\n\u8BF7\u91CD\u65B0\u52A0\u5165\u6E38\u620F\u4EE5\u83B7\u53D6\u66F4\u65B0\u540E\u7684\u6295\u5F71\u3002",
      () => {
      }
    );
  }
  // ══════════════════════════════════════
  //  内部辅助 - 移动输入
  // ══════════════════════════════════════
  static async showMoveInput(player, projection) {
    const s = projection.settings;
    const offsetX = new ObservableNumber(s.offsetX);
    const offsetY = new ObservableNumber(s.offsetY);
    const offsetZ = new ObservableNumber(s.offsetZ);
    const form = new CustomForm9(player, "\u79FB\u52A8\u6295\u5F71").slider("X \u504F\u79FB", offsetX, -64, 64).slider("Y \u504F\u79FB", offsetY, -64, 64).slider("Z \u504F\u79FB", offsetZ, -64, 64).button("\u786E\u8BA4", () => {
      const x = offsetX.getData();
      const y = offsetY.getData();
      const z = offsetZ.getData();
      if (x === s.offsetX && y === s.offsetY && z === s.offsetZ) return;
      HoloCore.executeOperation(player, projection.id, "move", { x, y, z });
    }).closeButton();
    await Gui.showForm(player, form, "\u79FB\u52A8\u6295\u5F71");
  }
  // ══════════════════════════════════════
  //  内部辅助 - 层模式选择
  // ══════════════════════════════════════
  static async showLayerModePicker(player, projection) {
    const index = new ObservableNumber(0);
    const form = new CustomForm9(player, "\u5C42\u6A21\u5F0F").dropdown("\u9009\u62E9\u5C42\u6A21\u5F0F", index, [
      { label: "\u5168\u90E8", value: 0 },
      { label: "\u5355\u5C42", value: 1 },
      { label: "\u8303\u56F4", value: 2 }
    ]).button("\u786E\u8BA4", () => {
      const mode = index.getData() === 0 ? "all" : index.getData() === 1 ? "single" : "range";
      HoloCore.executeOperation(player, projection.id, "set_layer_mode", mode);
    }).closeButton();
    await Gui.showForm(player, form, "\u5C42\u6A21\u5F0F");
  }
};

// scripts/entry.ts
var AddOnInit = class {
  static init() {
    this.registerEvents();
    this.createTasks();
  }
  static registerEvents() {
    system18.beforeEvents.startup.subscribe(async (e) => {
      system18.run(() => {
        Permission.register("permlist.see", Permission.Member);
        Permission.register("help.see", Permission.Member);
        Permission.register("menu.use", Permission.Member);
        Permission.register("shop.use", Permission.Member);
        Permission.register("money.admin", Permission.OP);
        Permission.register("holorint.menu", Permission.Member);
        Permission.register("holorint.pos1", Permission.Member);
        Permission.register("holorint.pos2", Permission.Member);
        Permission.register("afk.use", Permission.Member);
        Permission.register("afk.clear.other", Permission.OP);
        CoopSystem.registerPermissions();
        Permission.register("chat.use", Permission.Member);
        Permission.register("chat.admin", Permission.OP);
        Permission.register("tps.see", Permission.Any);
        init();
        init2();
        OnlineTime.getInstance().registerCommandsAndPermissions();
        CreativeArea.getInstance().registerCommandsAndPermissions();
        SurvivalArea.getInstance().registerCommandsAndPermissions();
        LandSystem.registerCommandsAndPermissions();
        Permission.registerPermlistCommand();
        Command.registerHelpCommand();
        MainMenu.registerMenuCommand();
        MoneyGUI.registerCommand();
        ShopSystem.registerCommand();
        HoloGUI.registerCommand();
        registerCommand();
        CoopSystem.registerCommands();
        ChatSystem.registerCommands();
        TPS.registerCommands();
        registerCommand2();
      });
    });
    world27.afterEvents.worldLoad.subscribe(() => {
      init3();
      CoopSystem.init();
      ChatSystem.init();
      Clean.getInstance().init();
      TPS.init();
      OnlineTime.getInstance().init();
      CreativeArea.getInstance().init();
      SurvivalArea.getInstance().init();
      InventorySwitcher.getInstance().init();
      LandSystem.init();
      ActivityLog.init();
      Money.initScoreboard();
      ScoreboardSync.init();
      syncWorldData();
      HoloEntity.init();
    });
    OnlineTime.getInstance().registerEvents();
    CreativeArea.getInstance().registerEvents();
    SurvivalArea.getInstance().registerEvents();
    InventorySwitcher.getInstance().registerEvents();
    LandEvents.registerEvents();
    ActivityLog.registerEvents();
    HoloEntity.registerEvents();
    ChatSystem.registerEvents();
    world27.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        Peace.getInstance().init();
        playerJoinEvent(event.player);
        reset(event.player);
        getPlayerData(event.player).then((data2) => {
          savePlayers([data2]).catch(() => {
          });
        });
      }
    });
    world27.afterEvents.playerLeave.subscribe((event) => {
      const player = world27.getEntity(event.playerId);
      if (player) {
        getPlayerData(player).then((data2) => {
          savePlayers([data2]).catch(() => {
          });
        });
        OnlineTime.getInstance().onPlayerLeave(player);
      }
    });
    world27.afterEvents.playerSpawn.subscribe((ev) => {
      SpawnProtect.setProtect(ev.player);
    });
    world27.beforeEvents.chatSend.subscribe((event) => {
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "\uFF01") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });
    system18.beforeEvents.shutdown.subscribe(() => {
      syncWorldData();
      ScoreboardsBackup();
    });
  }
  static createTasks() {
    QAManager.getInstance().start();
  }
};

// scripts/temp/ChatSoundsHelper.ts
import { system as system19, world as world28 } from "@minecraft/server";
var KEYWORDS = {
  ciallo: "cs.ciallo",
  // Ciallo~
  \u5495\u5495\u560E\u560E: "cs.gugugaga",
  // 咕咕嘎嘎！
  \u6C69\u6C69\u5495: "cs.gugugu",
  // 汩汩咕
  baka: "cs.baka",
  // BAKA!
  yee: "cs.yee",
  // yee
  \u5E72\u561B: "mob.chicken.hurt",
  // 鸡叫，不装神金资源包就是普通鸡叫
  huh: "cs.huh"
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
    world28.beforeEvents.chatSend.subscribe((event) => {
      for (let keyWord in this.keyWords) {
        if (event.message.toLowerCase().includes(keyWord.toLowerCase())) {
          if (event.sender.getGameMode() !== "Creative") {
            let id = event.sender.id;
            if (this.playerCooldown[id]) {
              return;
            }
            this.playerCooldown[id] = true;
            system19.runTimeout(() => {
              delete this.playerCooldown[id];
            }, this.COOLDOWN);
          }
          system19.run(() => {
            world28.getAllPlayers().forEach((player) => {
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
