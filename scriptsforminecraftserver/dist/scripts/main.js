// scripts/main.ts
import { world as world8 } from "@minecraft/server";

// scripts/doge/Fly.ts
import { system, world as world2, GameMode } from "@minecraft/server";

// scripts/data/Config.ts
var Config = {
  ITEMMAX: 100,
  flyArea: [
    {
      "name": "",
      "dimension": "minecraft:overworld",
      "start": [951, -2715],
      "end": [4604, 5628]
    }
  ],
  peaceArea: [
    {
      "dimension": "minecraft:overworld",
      "start": [951, -2715],
      "end": [4604, 5628]
    }
  ],
  AFKTime: 120,
  QAInterval: [300, 360],
  QATimeout: 60
};

// scripts/libs/Tools.ts
import { world } from "@minecraft/server";
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

// scripts/doge/Fly.ts
function playerJoinEvent(player) {
  system.runTimeout(() => {
    const areaName = inFlyArea(player);
    if (areaName !== void 0) {
      enableFly(player);
      player.sendMessage("[Doge] \u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002");
      player.setDynamicProperty("dogefly", areaName);
    } else {
      disableFly(player);
      player.sendMessage("[Doge] \u5F53\u524D\u4E0D\u5904\u4E8E\u98DE\u884C\u533A, \u5DF2\u5173\u95ED\u98DE\u884C\u6A21\u5F0F\u3002");
      player.setDynamicProperty("dogefly", void 0);
    }
  }, 60);
}
system.runInterval(() => {
  for (const player of world2.getPlayers()) {
    const nowArea = player.getDynamicProperty("dogefly");
    const areaName = inFlyArea(player);
    if (nowArea === void 0) {
      if (areaName !== void 0) {
        enableFly(player);
        player.sendMessage(`[Doge] \u8FDB\u5165\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`);
        player.setDynamicProperty("dogefly", areaName);
      }
    } else {
      if (areaName === void 0) {
        disableFly(player);
        player.sendMessage(`[Doge] \u79BB\u5F00\u98DE\u884C\u533A ${nowArea}, \u5DF2\u5173\u95ED\u98DE\u884C\u6A21\u5F0F\u3002`);
        player.setDynamicProperty("dogefly", void 0);
      }
    }
  }
}, 400);
function inFlyArea(entity) {
  for (const area of Config.flyArea) {
    if (entity.dimension.id === area.dimension) {
      if (pointInArea_2D(entity.location.x, entity.location.z, area.start[0], area.start[1], area.end[0], area.end[1])) {
        return area.name;
      }
    }
  }
  return void 0;
}
function enableFly(player) {
  player.runCommand("ability @s mayfly true");
}
function disableFly(player) {
  const res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { includeLiquidBlocks: true, includePassableBlocks: false });
  if (res !== void 0) {
    player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
  }
  player.runCommand("ability @s mayfly false");
  player.setGameMode(GameMode.Adventure);
  player.setGameMode(GameMode.Survival);
}

// scripts/doge/AFK.ts
import { system as system3, world as world3 } from "@minecraft/server";

// scripts/core/Command.ts
import { system as system2 } from "@minecraft/server";

// scripts/data/Permission.ts
var data = {
  "CommetWind": 2
};

// scripts/core/Permission.ts
var Permission = class {
  static {
    this.Guest = -1;
  }
  static {
    // 脚本指定的无权限访客
    this.Any = 0;
  }
  static {
    // 普通玩家
    this.OP = 1;
  }
  static {
    // 服务器原生 OP
    this.ScriptAdmin = 2;
  }
  // 脚本指定的 OP
  static getPermission(player) {
    if (data[player.name] !== void 0) {
      return data[player.name];
    } else {
      if (player.isOp()) {
        return this.OP;
      } else {
        return this.Any;
      }
    }
  }
  /**
   * TODO: 因为脚本无法保存数据，tag/动态属性存储不稳定，这个函数没有作用
   */
  static setPermission(player, permission) {
  }
};

// scripts/core/Command.ts
var Command = class {
  static {
    this.list = {};
  }
  static register(name, permission, callback, description) {
    if (this.list[name] === void 0) {
      this.list[name] = {
        callback,
        permission,
        description: description === void 0 ? name : description
      };
      return false;
    }
    return false;
  }
  static trigger(player, message) {
    const commandInfo = this.list[message];
    if (commandInfo !== void 0) {
      if (Permission.getPermission(player) >= commandInfo.permission) {
        system2.run(() => {
          const result = commandInfo.callback(player);
          if (result !== void 0) {
            player.sendMessage(`${result}`);
          }
        });
        return;
      } else {
        player.sendMessage(`\xA7c\u4F60\u6CA1\u6709\u6267\u884C\u6B64\u6761\u6307\u4EE4\u7684\u6743\u9650\u3002`);
        return;
      }
    }
    player.sendMessage(`\xA7c\u672A\u77E5\u7684\u547D\u4EE4! \u53D1\u9001"!help"\u67E5\u8BE2\u6240\u6709\u6307\u4EE4\u3002`);
    return;
  }
  static registerHelpCommand() {
    this.register(
      "help",
      Permission.Any,
      (player) => {
        let result = "";
        const permission = Permission.getPermission(player);
        for (const command in this.list) {
          if (this.list[command].permission <= permission) {
            result += `${command} - ${this.list[command].description}
`;
          }
        }
        return result;
      },
      "\u83B7\u53D6\u6240\u6709\u6307\u4EE4"
    );
  }
  static registerScriptEvent() {
    system2.afterEvents.scriptEventReceive.subscribe((event) => {
      if (event.sourceEntity === void 0) return;
      this.trigger(event.sourceEntity, event.id.substring(5));
    }, { namespaces: ["doge"] });
  }
};
Command.registerScriptEvent();

// scripts/doge/AFK.ts
for (const player of world3.getAllPlayers()) {
  reset(player);
}
function reset(player) {
  player.setDynamicProperty("afk:last_location", void 0);
  player.setDynamicProperty("afk:step", void 0);
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
function setAFK(player) {
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world3.sendMessage(`\xA77* ${player.nameTag} is now AFK. *`);
  player.setDynamicProperty("afk:step", 0);
  player.addTag("AFK");
}
function locationMoved(lastLocation, nowLocation) {
  const deltaX = lastLocation.x - nowLocation.x;
  if (-1 < deltaX && deltaX < 1) {
    const deltaY = lastLocation.y - nowLocation.y;
    if (-1 < deltaY && deltaY < 1) {
      const deltaZ = lastLocation.z - nowLocation.z;
      if (-1 < deltaZ && deltaZ < 1) {
        return false;
      }
    }
  }
  return true;
}
var STEPTIME = 15;
system3.runInterval(() => {
  for (const player of world3.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
    const lastLocation = player.getDynamicProperty("afk:last_location");
    const nowLocation = player.location;
    if (lastLocation !== void 0) {
      let nowStep = player.getDynamicProperty("afk:step");
      if (!locationMoved(lastLocation, nowLocation)) {
        if (nowStep === void 0) {
          nowStep = 1;
        } else {
          nowStep++;
        }
        if (nowStep * STEPTIME >= Config.AFKTime) {
          setAFK(player);
        } else {
          player.setDynamicProperty("afk:step", nowStep);
        }
      } else {
        player.setDynamicProperty("afk:step", 0);
      }
    }
    player.setDynamicProperty("afk:last_location", nowLocation);
  }
}, STEPTIME * 20);
var intervalId = void 0;
var playerList = {};
function startAFKScan() {
  if (intervalId === void 0) {
    intervalId = system3.runInterval(() => {
      let count = 0;
      for (const id in playerList) {
        const player = world3.getEntity(id);
        if (player === void 0) {
          delete playerList[id];
        } else {
          if (locationMoved(playerList[id], player.location)) {
            world3.sendMessage(`\xA77* ${player.nameTag} is no longer AFK. *`);
            player.removeTag("AFK");
            player.setDynamicProperty("afk:last_location", player.location);
            player.setDynamicProperty("afk:step", 0);
            delete playerList[id];
          } else {
            count++;
          }
        }
      }
      if (count === 0) stopAFKScan();
    }, 100);
  }
}
function stopAFKScan() {
  if (intervalId !== void 0) {
    system3.clearRun(intervalId);
    intervalId = void 0;
  }
}
function registerCommand() {
  Command.register("afk", Permission.Any, setAFK, "\u8FDB\u5165AFK\u72B6\u6001");
  Command.register("noafk", Permission.OP, (pl) => {
    pl.addTag("NOAFK");
  }, "\u4EE4\u73A9\u5BB6\u4E0D\u4F1A\u8FDB\u5165AFK\u72B6\u6001");
}
registerCommand();

// scripts/doge/QA.ts
import { system as system4, world as world5 } from "@minecraft/server";

// scripts/data/Questions.ts
var Questions = [
  {
    "weight": 1,
    "q": "\u5728\u300A\u4E1C\u65B9\u9B3C\u5F62\u517D\u300B\u4E2D, \u516D\u9762BOSS\u662F? (\u4E94\u4E2A\u5B57)",
    "a": ["\u57F4\u5B89\u795E\u88BF\u59EC"],
    "bonus": [
      {
        "seq": [1, 5],
        "type": "money",
        "amount": 500
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u6253\u4E00\u8F66\u4E07\u4EBA\u7269: \u5149\u660E\u725B\u5976\uFF08\u4E94\u4E2A\u5B57\uFF09",
    "a": ["\u6851\u5C3C\u7C73\u5C14\u514B"],
    "bonus": [
      {
        "type": "item",
        "itemType": "milk_bucket",
        "amount": 1,
        "data": 0
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u8C01\u662F BBA ?",
    "a": ["\u516B\u4E91\u7D2B", "\u7D2B", "\u7D2BBBA"],
    "msg_right": "8\u8981\u547D\u5566\uFF1F",
    "bonus": [
      {
        "type": "cmd",
        "cmd": "damage @s 10"
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u6253\u4E00\u8F66\u4E07\u4EBA\u7269: \u9752\u91D1\u77F3",
    "a": ["\u8D6B\u5361\u63D0\u4E9A", "\u8D6B\u5361\u63D0\u4E9A\xB7\u62C9\u78A7\u65AF\u62C9\u7956\u5229", "\u8D6B\u5361\u63D0\u4E9A\u62C9\u78A7\u65AF\u62C9\u7956\u5229", "\u8D6B\u5361\u63D0\u4E9A \u62C9\u78A7\u65AF\u62C9\u7956\u5229"],
    "d": "\u8D6B\u5361\u63D0\u4E9A \xB7 \u62C9\u78A7\u65AF\u62C9\u7956\u5229\u7684\u201C\u62C9\u78A7\u65AF\u62C9\u7956\u5229\u201D\uFF08Lapislazuli\uFF09\u5373\u4E3A\u201C\u9752\u91D1\u77F3\u201D",
    "bonus": [
      {
        "type": "money",
        "amount": 500
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u5728\u5C11\u6797\u5BFA\u5341\u516B\u94DC\u4EBA\u9635\u4E2D, \u542C\u58F0\u8FA8\u4F4D\u7684\u8003\u5B98\u662F\u4EC0\u4E48\u505A\u7684\uFF1F",
    "a": ["\u8089", "\u4EBA\u8089", "\u8840\u8089"],
    "msg_right": "\u4F60\u8FC7\u5173!",
    "msg_wrong": "\u8BE5\u7F5A!",
    "bonus": [
      {
        "type": "money",
        "amount": 500
      }
    ],
    "punish": [
      {
        "type": "cmd",
        "cmd": "damage @s 10"
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u9053\u5BB6\u5B66\u6D3E\u7684\u521B\u59CB\u4EBA\u662F",
    "a": ["\u8001\u5B50"],
    "bonus": [
      {
        "type": "money",
        "amount": 500
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u4E2D\u534E\u4E09\u7956\u662F \u9EC4\u5E1D\u3001\u708E\u5E1D\u548C____",
    "a": ["\u86A9\u5C24"],
    "bonus": [
      {
        "type": "money",
        "amount": 500
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u4E2D\u534E\u4E09\u7956\u662F \u9EC4\u5E1D\u3001\u708E\u5E1D\u548C____",
    "a": ["\u86A9\u5C24"],
    "bonus": [
      {
        "type": "money",
        "amount": 500
      }
    ]
  }
];

// scripts/libs/Money.ts
import { world as world4 } from "@minecraft/server";
if (world4.scoreboard.getObjective("money") == null) {
  world4.getDimension("overworld").runCommand("scoreboard objectives add money dummy money");
}
var Money = class {
  static get(player) {
    const scores = world4.scoreboard.getObjective("money").getScores();
    const name = player.nameTag;
    for (const s of scores) {
      if (s.participant.displayName === name) {
        return s.score;
      }
    }
    player.runCommand("scoreboard players add @s money 0");
    return 0;
  }
  static set(player, money) {
    player.runCommand(`scoreboard players set @s money ${money}`);
  }
  static add(pl, money) {
    return this.set(pl, this.get(pl) + money);
  }
};

// scripts/doge/QA.ts
var QAManager = class _QAManager {
  constructor() {
    this.nowQuestion = void 0;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;
    this.record = [];
    this.recordPtr = 0;
    this.recordLimit = Math.floor(Questions.length - 2);
    this.timeoutId = void 0;
    world5.beforeEvents.chatSend.subscribe((event) => {
      if (event.message.substring(0, 1) === "!" || event.message.substring(0, 1) === "\uFF01") {
        const answer = event.message.substring(1).replaceAll(" ", "");
        if (this.nowQuestion !== void 0) {
          this.answer(event.sender, answer);
          event.cancel = true;
          return;
        }
      }
    });
    system4.runTimeout(() => {
      this.nextQuestion();
    }, _QAManager.getNextTimeout());
  }
  nextQuestion() {
    const questionList = [];
    let totalWeight = 0;
    const startPoints = [];
    for (let i = 0; i < Questions.length; i++) {
      if (!this.record.includes(i)) {
        questionList.push(i);
        totalWeight += Questions[i].weight;
        startPoints.push(totalWeight);
      }
    }
    const randomNum = getRandomInteger(0, totalWeight - 1);
    for (let i = 0; i < startPoints.length; i++) {
      if (randomNum < startPoints[i]) {
        this.nowQuestion = questionList[i];
        this.pushRecord(i);
        break;
      }
    }
    if (this.nowQuestion !== void 0) {
      world5.sendMessage(`\xA7b[Baka Cirno]\xA7r \xA7g${Questions[this.nowQuestion].q}\xA7r
  \xA7h\u53D1\u9001 \xA7e!\u7B54\u6848\xA7r \xA7h\u6765\u7B54\u9898`);
    }
    system4.runTimeout(() => {
      this.finish();
    }, Config.QATimeout * 20);
  }
  finish() {
    const question = Questions[this.nowQuestion];
    world5.sendMessage(`\xA7b[Baka Cirno]\xA7r \u6B63\u786E\u7B54\u6848\u662F \xA7e${question.a[0]}\xA7r ! ${question.d !== void 0 ? "\n  " + question.d : ""}`);
    this.nowQuestion = void 0;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;
    this.timeoutId = system4.runTimeout(() => {
      this.nextQuestion();
    }, _QAManager.getNextTimeout());
  }
  answer(pl, str) {
    if (this.nowQuestion !== void 0) {
      if (this.playerList[pl.nameTag] === void 0) {
        const question = Questions[this.nowQuestion];
        for (const a of question.a) {
          if (str === a) {
            this.rightAmount++;
            this.playerList[pl.nameTag] = true;
            _QAManager.giveBonus(pl, this.rightAmount, question.bonus);
            if (question.msg_right !== void 0) {
              pl.sendMessage(question.msg_right);
            } else {
              pl.sendMessage("\xA7a\u56DE\u7B54\u6B63\u786E\uFF01\xA7r");
            }
            return 1;
          }
        }
        if (question.msg_wrong !== void 0) {
          pl.sendMessage(question.msg_wrong);
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
  pushRecord(index) {
    this.record[this.recordPtr] = index;
    this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
  }
  static getNextTimeout() {
    const min = Config.QAInterval[0] * 20;
    const max = Config.QAInterval[1] * 20;
    return min + Math.floor(Math.random() * max);
  }
  static giveBonus(pl, seq, bonus) {
    if (!bonus) return;
    for (const b of bonus) {
      if (b.seq === void 0 || b.seq[0] <= seq && seq <= b.seq[1]) {
        system4.run(() => {
          switch (b.type) {
            case "money":
              Money.add(pl, b.amount);
              break;
            case "item":
              pl.runCommand(`give @s ${b.itemType} ${b.amount} ${b.data === void 0 ? "" : b.data}`);
              break;
            case "cmd":
              pl.runCommand(b.cmd);
              break;
            default:
              pl.sendMessage(`Unknown bonus type: ${b.type}`);
              break;
          }
        });
      }
    }
  }
};

// scripts/core/index.ts
import { world as world7 } from "@minecraft/server";

// scripts/core/Money.ts
import { world as world6 } from "@minecraft/server";
var MONEY_NAME = "money";
var Money2 = class {
  static get(player) {
    const scoreboard = world6.scoreboard.getObjective(MONEY_NAME);
    try {
      const score = scoreboard.getScore(player);
      if (score !== void 0) return score;
    } catch {
    }
    world6.scoreboard.getObjective(MONEY_NAME).setScore(player, 0);
    return 0;
  }
  static set(player, money) {
    world6.scoreboard.getObjective(MONEY_NAME).setScore(player, money);
  }
  static initScoreboard() {
    if (world6.scoreboard.getObjective(MONEY_NAME) == null) {
      world6.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
    }
  }
};

// scripts/core/index.ts
world7.beforeEvents.chatSend.subscribe((event) => {
  const firstChar = event.message.substring(0, 1);
  if (firstChar === "!" || firstChar === "\uFF01") {
    Command.trigger(event.sender, event.message.substring(1));
    event.cancel = true;
  }
});
world7.afterEvents.worldLoad.subscribe(() => {
  Money2.initScoreboard();
  Command.registerHelpCommand();
});

// scripts/main.ts
world8.afterEvents.playerSpawn.subscribe((event) => {
  if (event.initialSpawn) {
    playerJoinEvent(event.player);
    for (const player of world8.getAllPlayers()) {
      reset(player);
    }
  }
});
var QA;
world8.afterEvents.worldLoad.subscribe(() => {
  QA = new QAManager();
});

//# sourceMappingURL=../debug/main.js.map
