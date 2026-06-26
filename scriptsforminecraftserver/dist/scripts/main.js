// scripts/entry.ts
import { system as system7, world as world10 } from "@minecraft/server";

// scripts/core/Money.ts
import { world } from "@minecraft/server";
var MONEY_NAME = "money";
var Money = class {
  /**
   * 获取玩家金钱
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
   * 设置玩家金钱
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
  static add(pl, money) {
    return this.set(pl, this.get(pl) + money);
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

// scripts/core/Command.ts
import { system } from "@minecraft/server";

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
  /**
   * @param player
   * @returns 权限等级
   */
  static getPermission(player) {
    if (data[player.name] !== void 0) {
      return data[player.name];
    }
    if (player.isOp()) {
      return this.OP;
    }
    return this.Any;
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
  /**
   * 注册指令
   * @param name 指令名称
   * @param permission 权限等级 如 Permission.Any
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
   * 触发指令
   * @param player 触发指令的玩家，不指定时使用最高权限执行
   * @param message
   */
  static trigger(player, message) {
    let commandInfo = this.list[message];
    if (commandInfo !== void 0) {
      if (player === void 0 || Permission.getPermission(player) >= commandInfo.permission) {
        system.run(() => {
          let result = commandInfo.callback(player);
          if (result !== void 0) {
            player.sendMessage(`${result}`);
          }
        });
        return;
      }
      if (player) player.sendMessage(`\xA7c\u4F60\u6CA1\u6709\u6267\u884C\u6B64\u6761\u6307\u4EE4\u7684\u6743\u9650\u3002`);
      return;
    }
    if (player) player.sendMessage(`\xA7c\u672A\u77E5\u7684\u547D\u4EE4! \u53D1\u9001'!help'\u67E5\u8BE2\u6240\u6709\u6307\u4EE4\u3002`);
    return;
  }
  /**
   * 注册帮助指令，在初始化时调用
   */
  static registerHelpCommand() {
    this.register(
      "help",
      Permission.Any,
      (player) => {
        let result = "";
        let permission = player ? Permission.getPermission(player) : Permission.Any;
        for (let command in this.list) {
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
  },
  //7
  {
    "weight": 1,
    "q": "[\u8BBE\u8BA1\u5C0F\u77E5\u8BC6] #1 HSV \u4E2D\uFF0CS \u4EE3\u8868\u4EC0\u4E48\uFF1F",
    "a": ["\u9971\u548C\u5EA6"],
    "msg_right": "\u5956\u52B1\u4F60\u4E00\u70B9\xA7cFF0000\xA7r\u5427",
    "bonus": [{
      "type": "item",
      "itemType": "touhou_little_maid:power_point",
      "amount": 3,
      "data": 0
    }]
  },
  {
    "weight": 1,
    "q": "\u72AC\u8D70\u691B\u4F4F\u5728\u54EA\uFF1F",
    "a": ["\u5996\u602A\u4E4B\u5C71"],
    "bonus": [{
      "type": "money",
      "amount": 200
    }]
  },
  {
    "weight": 1,
    "q": "\u98CE\u89C1\u5E7D\u9999\u4F4F\u5728\u54EA\uFF1F",
    "a": ["\u8FF7\u9014\u7AF9\u6797"],
    "bonus": [{
      "type": "money",
      "amount": 200
    }]
  },
  {
    "weight": 1,
    "q": "\u8389\u683C\u9732\xB7\u5948\u7279\u5DF4\u683C\u4F4F\u5728\u54EA",
    "a": ["\u96FE\u4E4B\u6E56"],
    "bonus": [{
      "type": "money",
      "amount": 200
    }]
  },
  {
    "weight": 1,
    "q": "\u5728\u73A9STG\u65F6\uFF0CZ\u952E\u53EF\u4EE5\u5E72\u561B\uFF1F",
    "a": ["\u5C04\u51FB", "\u786E\u8BA4"],
    "bonus": [{
      "type": "item",
      "itemType": "touhou_little_maid:power_point",
      "amount": 3,
      "data": 0
    }]
  },
  {
    "weight": 1,
    "q": "\u7531ZUNSoft\u5236\u4F5C\u7684\u7B2C\u4E00\u90E8\u4F5C\u54C1\uFF08\u88AB\u79F0\u4E3A\u65E7\u4F5C\uFF09\uFF0C\u662F\u4EC0\u4E48\uFF1F",
    "a": ["\u4E1C\u65B9\u7075\u5F02\u4F20"],
    "bonus": [{
      "type": "item",
      "itemType": "touhou_little_maid:power_point",
      "amount": 3,
      "data": 0
    }]
  },
  {
    "weight": 1,
    "q": "\u9B42\u9B44\u5996\u68A6\u7684\u804C\u52A1\u662F\u4EC0\u4E48\uFF1F",
    "a": ["\u5EAD\u5E08"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u4E0B\u5217\u89D2\u8272\u4E0E\u79CD\u65CF\u5BF9\u5E94\u9519\u8BEF\u7684\u662F\nA. \u85E4\u539F\u59B9\u7EA2---\u4EBA\u7C7B    B.\u6D29\u77E2\u8BF9\u8BBF\u5B50---\u795E\u660E\nC.\u661F\u718A\u52C7\u4EEA---\u9152\u9B3C     D.\u6751\u7EB1\u6C34\u871C---\u8239\u5E7D\u7075",
    "a": ["C", "c"],
    "msg_right": "\u7B54\u9898\u7CD5\u624B\uFF01",
    "seq": [1, 2],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u627E\u89C4\u5F8B\u586B\u7A7A\uFF1A\u516B\u5742\u795E\u5948\u5B50\u3001\u5723\u767D\u83B2\u3001______\u3001\u6469\u591A\u7F57\u9690\u5C90\u5948\nA. \u4E30\u806A\u8033\u795E\u5B50    B.\u5C11\u540D\u9488\u5999\u4E38    C.\u7EAF\u72D0   D.\u8D6B\u5361\u63D0\u4E9A",
    "a": ["B", "b"],
    "msg_right": "\u7B54\u9898\u7CD5\u624B\uFF01",
    "seq": [1, 2],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u5DF2\u77E5\u67D0\u4E00\u89D2\u8272\u5728TH x\u548CTH y\u4E24\u4F5C\u4E2D\u90FD\u4F5C\u4E3A\u5173\u5E95boss\u51FA\u73B0\u4E86\uFF0C\u4E14\u9762\u6570\u8DE8\u5EA6\u6700\u5927\uFF0C\u5219|x-y|=\nA.5       B.6      C.7     D.8",
    "a": ["B", "b"],
    "msg_right": "\u83B7\u5F97\u4E86\u7B2C\u4E00\u65E0\u4E8C\u7684\u79F0\u53F7\uFF1A\u7B54\u9898\u7CD5\u624B\uFF01\n \u5FEB\u4F7F\u7528/ch list \u4F69\u6234\uFF0C\u5411\u5927\u5BB6\u70AB\u8000\uFF01",
    "seq": [1, 2],
    "bonus": [
      {
        "type": "cmd",
        "cmd": "ch add '\xA7a\xA7l\u7B54\u9898\u9AD8\u624B'"
        //后期换为自定义符号
      },
      {
        "type": "money",
        "amount": 1e3
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u82E5TH l\u5960\u5B9A\u4E86\u4E1C\u65B9\u7CFB\u5217\u4E3B\u8981\u6E38\u620F\u7684\u578B\u6001\uFF0CTH m\u4E3Awindows \u5E73\u53F0\u4E0A\u7684\u7B2C\u4E00\u4F5C\uFF0CTH n\u7684\u73A9\u6CD5\u4E0E\u5176\u4ED6\u65B0\u4F5C\u7684\u73A9\u6CD5\u660E\u663E\u4E0D\u540C\uFF0C\u5219TH(l+m+n) \u7684\u7279\u8272\u4E3A\nA. \u52A8\u7269\u7075\u7CFB\u7EDF   B.\u5B63\u8282\u89E3\u653E\u7CFB\u7EDF  C.\u5361\u7247\u7CFB\u7EDF  D.\u5B8C\u7F8E\u65E0\u7F3A\u6A21\u5F0F",
    "a": ["A", "a"],
    "msg_right": "\u7B54\u9898\u7CD5\u624B\uFF01",
    "seq": [1, 2],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u82E5\u67D0\u89D2\u8272\u5728TH x\u4E2D\u662F x-4 \u9762\u7684\u5173\u5E95boss\uFF0C\u8FD8\u5728TH (x+1) \u4E2D\u5F53 x-5 \u9762\u7684\u5173\u5E95boss\uFF0C\u5219\u6B64\u89D2\u8272\u53EF\u4EE5\u5728 TH (x+y) \u4E2D\u5F53\u7B2C___\u9762\u7684\u5173\u5E95boss  \nA.y-x     B.y-x-1    C.2x-y    D.2x-y-1  ",
    "a": ["B", "b"],
    "msg_right": "\u83B7\u5F97\u4E86\u7B2C\u4E00\u65E0\u4E8C\u7684\u79F0\u53F7\uFF1A\u7B54\u9898\u7CD5\u624B\uFF01\n \u5FEB\u4F7F\u7528/ch list \u4F69\u6234\uFF0C\u5411\u5927\u5BB6\u70AB\u8000\uFF01",
    "seq": [1, 2],
    "bonus": [
      {
        "type": "cmd",
        "cmd": "ch add '\xA7a\xA7l\u7B54\u9898\u9AD8\u624B'"
        //后期换为自定义符号
      },
      {
        "type": "money",
        "amount": 1e3
      }
    ]
  },
  {
    "weight": 1,
    "q": "\u4E0B\u5217\u89D2\u8272\u5173\u7CFB\u6307\u5411\u4E0E\u5176\u4ED6\u4E09\u7EC4\u660E\u663E\u4E0D\u540C\u7684\u662F\nA. \u857E\u7C73\u8389\u4E9A\u2192\u5341\u516D\u591C\u54B2\u591C    B.\u516B\u5742\u795E\u5948\u5B50\u2192\u4E1C\u98CE\u8C37\u65E9\u82D7\nC.\u6756\u5200\u5076\u78E8\u5F13\u2192\u57F4\u5B89\u795E\u88BF\u59EC   D.\u5C11\u540D\u771F\u5999\u4E38\u2192\u9B3C\u4EBA\u6B63\u90AA",
    "a": ["C", "c"],
    "msg_right": "\u7B54\u9898\u7CD5\u624B\uFF01",
    "bonus": [{
      "type": "item",
      "itemType": "touhou_little_maid:power_point",
      "amount": 3,
      "data": 0
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Lunatic]\xA7r \u6C38\u8FDC\u4EAD\u7A97\u6237\u7684\u5F62\u72B6\u662F\uFF1F___\u5F62",
    "a": ["\u5706", "O"],
    "msg_right": "\xA7c\u60A8\uFF1F",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Lunatic]\xA7r\u300A\u4E1C\u65B9\u51ED\u4F9D\u534E\u300B\u4E2D\uFF0C\u4F9D\u795E\u5973\u82D1\u65E0\u540D\u6307\uFF0C\u4E2D\u6307\uFF0C\u98DF\u6307\u4E0A\u7684\u6212\u6307\u9576\u5D4C\u5B9D\u77F3\u7684\u989C\u8272\u4F9D\u6B21\u662F\uFF1F__\uFF0C__\uFF0C__ \n(\u6BCF\u7A7A\u53EA\u7528\u586B\u4E00\u4E2A\u5B57\uFF0C\u4E0D\u7528\u6253\u9017\u53F7)",
    "a": ["\u84DD\u7EA2\u7EFF"],
    "msg_right": "\xA7c\u60A8\uFF1F",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Lunatic]\xA7r\u300A\u4E1C\u65B9\u82B1\u6620\u51A2\u300B\u4E2D\uFF0C\u7C73\u65AF\u8482\u5A05\xB7\u841D\u857E\u62C9\u5728\u535A\u4E3D\u795E\u793E\u5531\u7684\u6B4C\u53EB\u4EC0\u4E48\uFF1F",
    "a": ["\u78B1\u8272\u7684\u6A31\u82B1"],
    "msg_right": "\xA7c\u60A8\uFF1F",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Lunatic]\xA7r \u54EA\u4F4D\u89D2\u8272\u5728\u5176\u521D\u767B\u573A\u4F5C\u54C1\u4E2D\u51FA\u73B0\u7684\u7B26\u5361\u540D\u5168\u90E8\u6CA1\u6709\u6CD5\u8BED\u5916\u6765\u8BCD\uFF1F",
    "a": ["\u8299\u5170\u6735\u9732\xB7\u65AF\u5361\u96F7\u7279", "\u8299\u5170\u6735\u9732", "\u8299\u5170", "\u6E56\u5357\u8EB2\u9E7F"],
    "msg_right": "\xA7c \u54E6\u3002",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Lunatic]\xA7r\u300A\u4E1C\u65B9\u6C42\u95FB\u53F2\u7EAA\u300B\u4E00\u5171\u6709\u591A\u5C11\u9875\uFF1F",
    "a": ["166"],
    "msg_right": "\u4F60\u771F\u4E70\u4E86\u554A\u3002",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Lunatic]\xA7r \u6709\u591A\u5C11\u89D2\u8272\u62E5\u6709\u4EE5\u201C\u6708\u7B26\u201D\u4E3A\u7B26\u540D\u7684\u7B26\u5361\uFF1F",
    "a": ["4", "\u56DB"],
    "msg_right": "\xA7c\u60A8\uFF1F",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA74[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Hard]\xA7r \u4EE5\u4E0B\u54EA\u4E00\u5F20\u7B26\u5361\u7684\u540D\u5B57\u4E2D\u4E0D\u542B\u7247\u5047\u540D\uFF1F\nA \u5149\u7B26\u300C\u51C0\u5316\u4E4B\u9B54\u300D B \u6291\u5236\u300C\u8D85\u6211\u300D C \u5154\u7B26\u300C\u56E2\u5B50\u5F71\u54CD\u529B\u300DD\u8679\u7B26\u300C\u96E8\u4F1E\u98CE\u66B4\u300D",
    "a": ["a", "A"],
    "msg_right": "\xA7c\u7B54\u9898\u7CD5\u624B\uFF01",
    "bonus": [{
      "type": "money",
      "amount": 600
    }]
  },
  {
    "weight": 1,
    "q": "\xA7a[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Easy]\xA7r \u4EE5\u4E0B\u54EA\u4F4D\u4EBA\u7269\u4E0D\u662F\u957F\u76F4\u53D1\uFF1F\nA \u84EC\u83B1\u5C71\u8F89\u591C B \u6BD4\u90A3\u540D\u5C45\u5929\u5B50 C\n \u65AF\u5854\xB7\u8428\u83F2\u5A05 D \u5723\u767D\u83B2",
    "a": ["D", "d"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\xA7a[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Easy]\xA7r \u53E4\u660E\u5730\u89C9\u662F\u300A\u4E1C\u65B9\u5730\u7075\u6BBF\u300B\u7684\u51E0\u9762 Boss\uFF1F",
    "a": ["\u56DB\u9762", "\u56DB", "4"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\u5BAB\u53E4\u82B3\u9999\u7684\u80FD\u529B\u662F\u4EC0\u4E48\uFF1F\u9009\u586B\uFF1A\u4EC0\u4E48\u90FD\u80FD\u5403\u7A0B\u5EA6\u7684\u80FD\u529B\u3001\u611F\u89C9\u4E0D\u5230\u75BC\u75DB\u7A0B\u5EA6\u7684\u80FD\u529B\u3001\u4F7F\u4EBA\u53D8\u6210\u50F5\u5C38\u7A0B\u5EA6\u7684\u80FD\u529B\u3001\u541E\u566C\u7075\u7A0B\u5EA6\u7684\u80FD\u529B",
    "a": ["\u4EC0\u4E48\u90FD\u80FD\u5403\u7A0B\u5EA6\u7684\u80FD\u529B"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  },
  {
    "weight": 1,
    "q": "\xA7a[\u4E8C\u8272\u5E7D\u7D2B\u8776\u2022Easy]\xA7r \u300A\u4E1C\u65B9\u7EEF\u60F3\u5929\u300B\u4E2D\uFF0C\u662F\u8C01\u6BC1\u574F\u4E86\u795E\u793E\uFF1F",
    "a": ["\u6BD4\u90A3\u540D\u5C45\u5929\u5B50", "\u5929\u5B50"],
    "bonus": [{
      "type": "money",
      "amount": 500
    }]
  }
  // 24+7
];

// scripts/libs/Tools.ts
import { world as world2 } from "@minecraft/server";
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

// scripts/data/Config.ts
var Config = {
  // 生存飞行区
  flyArea: [
    {
      "name": "",
      "dimension": "minecraft:overworld",
      "start": [951, -2715],
      "end": [4604, 5628]
    }
  ],
  // 和平区域
  peaceArea: [
    {
      "dimension": "minecraft:overworld",
      "start": [951, -2715],
      "end": [4604, 5628]
    }
  ],
  // AFK等待时间 秒
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
  }
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

// scripts/doge/Fly.ts
import { system as system3, world as world4, GameMode } from "@minecraft/server";
function playerJoinEvent(player) {
  system3.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      enableFly(player);
      player.sendMessage(`[Doge] \u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`);
      player.setDynamicProperty("dogefly", areaName);
    } else {
      disableFly(player);
      player.sendMessage(`[Doge] \u5F53\u524D\u4E0D\u5904\u4E8E\u98DE\u884C\u533A, \u5DF2\u5173\u95ED\u98DE\u884C\u6A21\u5F0F\u3002`);
      player.setDynamicProperty("dogefly", void 0);
    }
  }, 60);
}
system3.runInterval(() => {
  for (let player of world4.getPlayers({ "gameMode": GameMode.Survival })) {
    let nowArea = player.getDynamicProperty("dogefly");
    let areaName = inFlyArea(player);
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
  player.runCommand("gamerule sendcommandfeedback false");
  player.runCommand("ability @s mayfly true");
  player.runCommand("gamerule sendcommandfeedback true");
}
function disableFly(player) {
  let res = player.dimension.getBlockFromRay(player.location, { x: 0, y: -1, z: 0 }, { "includeLiquidBlocks": true, "includePassableBlocks": false });
  if (res !== void 0) {
    player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
  }
  player.runCommand("gamerule sendcommandfeedback false");
  player.runCommand("ability @s mayfly false");
  player.runCommand("gamemode adventure");
  player.runCommand("gamemode survival");
  player.runCommand("gamerule sendcommandfeedback true");
}

// scripts/doge/AFK.ts
import { system as system4, world as world5 } from "@minecraft/server";
function init() {
  for (let player of world5.getAllPlayers()) {
    reset(player);
  }
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
  world5.sendMessage(`\xA77* ${player.nameTag} is now AFK. *`);
  player.setDynamicProperty("afk:step", 0);
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
    let lastLoaction = player.getDynamicProperty("afk:last_location");
    let nowLocation = player.location;
    if (lastLoaction !== void 0) {
      let nowStep = player.getDynamicProperty("afk:step");
      if (!locationMoved(lastLoaction, nowLocation)) {
        if (nowStep === void 0) {
          nowStep = 1;
        } else {
          nowStep++;
        }
        if (nowStep * STEP_TIME >= Config.AFKTime) {
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
          player.setDynamicProperty("afk:last_location", player.location);
          player.setDynamicProperty("afk:step", 0);
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
  Command.register("afk", Permission.Any, setAFK, "\u8FDB\u5165AFK\u72B6\u6001");
  Command.register("noafk", Permission.OP, (pl) => {
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
  BlockComponentTypes,
  BlockPermutation
} from "@minecraft/server";
var DYNAMIC_PROPERTY_KEY = "DOGE_CLEAN_INDEX";
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
    let res = world7.getDynamicProperty(DYNAMIC_PROPERTY_KEY);
    if (!res || typeof res !== "number") {
      world7.setDynamicProperty(DYNAMIC_PROPERTY_KEY, 0);
      return 0;
    }
    return res;
  }
  setCleanIndex(index) {
    world7.setDynamicProperty(DYNAMIC_PROPERTY_KEY, index);
  }
  /**
   * 将物品放入箱子
   * @param itemProvider 物品给予函数，函数会返回物品的ItemStack，当返回undefined时说明任务结束此时会退出
   * @param isFirstCall 是否是首次调用，如果是，在一次循环后物品没有放完，会重置index，再进行一次循环直到放完
   */
  placeItem(itemProvider, isFirstCall = true) {
    let base = [1, 0];
    switch (this.direction) {
      case 1:
        base = [1, 0];
        break;
      case -1:
        base = [-1, 0];
        break;
      case 2:
        base = [0, 1];
        break;
      case -2:
        base = [0, -1];
        break;
      default:
        break;
    }
    let cardinalDirection = "north";
    let facingDirection = 2;
    if (this.direction === -1 || this.direction === 1) {
      cardinalDirection = this.face > 0 ? "south" : "north";
      facingDirection = this.face > 0 ? 3 : 2;
    } else {
      cardinalDirection = this.face > 0 ? "east" : "west";
      facingDirection = this.face > 0 ? 5 : 4;
    }
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
        if (!block || block.typeId !== "minecraft:chest") {
          dimension.setBlockPermutation(coordinate, BlockPermutation.resolve("chest", {
            "minecraft:cardinal_direction": cardinalDirection
          }));
        }
        if (!block2 || block2.typeId !== "minecraft:chest") {
          dimension.setBlockPermutation(coordinate2, BlockPermutation.resolve("chest", {
            "minecraft:cardinal_direction": cardinalDirection
          }));
        }
        let inventory = block.getComponent(BlockComponentTypes.Inventory);
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
        dimension.setBlockPermutation(signCoordinate, BlockPermutation.resolve("pale_oak_wall_sign", {
          "facing_direction": facingDirection
        }));
        let sign = dimension.getBlock(signCoordinate);
        sign.getComponent(BlockComponentTypes.Sign).setText(this.getTimeStr());
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
    const now = /* @__PURE__ */ new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `
${year}-${month}-${day}
${hours}:${minutes}:${seconds}`;
  }
};
function registerCommand2() {
  Command.register("clean", Permission.OP, () => {
    Clean.getInstance().startClean(void 0);
  }, "\u5F00\u59CB\u626B\u5730");
}
registerCommand2();

// scripts/doge/Peace.ts
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
          if (this.inPeaceArea(entity) && entity.matches({ families: ["monster"], excludeFamilies: ["zombie_villager", "wither", "illager"] })) {
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
    Command.register("peace", Permission.OP, () => {
      return _Peace.getInstance().switchPeace() ? "\u5F00\u542F\u533A\u57DF\u548C\u5E73" : "\u5173\u95ED\u533A\u57DF\u548C\u5E73";
    }, "\u5207\u6362\u533A\u57DF\u548C\u5E73");
  }
};

// scripts/shit/ShitMountain.ts
import { world as world9, system as system6 } from "@minecraft/server";
var ShitMountain = class {
  /**
   * 因为 LL 插件改了事件拦截机制，导致聊天消息被一个插件拦截后，另一个插件就监听不到了
   * 所以在这里统一拦截掉，由称号插件负责服内信息播报
   */
  static cancelChat() {
    world9.beforeEvents.chatSend.subscribe((event) => {
      event.cancel = true;
    });
    world9.afterEvents.itemStartUseOn.subscribe((event) => {
      system6.run(() => {
        let item = event.itemStack;
        if (item.typeId.substring(0, 18) === "minecraft:brush") {
          event.source.runCommand("tp CommetWind ~~~ facing AbruptFox116621");
        }
      });
    });
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
    ShitMountain.cancelChat();
    SpawnProtect.registerEvents();
    world10.beforeEvents.chatSend.subscribe((event) => {
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "\uFF01") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });
    system7.beforeEvents.startup.subscribe((e) => {
      system7.run(() => {
        Money.initScoreboard();
        Command.registerHelpCommand();
        Clean.getInstance().init();
        init();
      });
    });
    world10.afterEvents.playerSpawn.subscribe((event) => {
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
import { system as system8, world as world11 } from "@minecraft/server";
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
    world11.beforeEvents.chatSend.subscribe((event) => {
      for (let keyWord in this.keyWords) {
        if (event.message.toLowerCase().includes(keyWord.toLowerCase())) {
          if (event.sender.getGameMode() !== "Creative") {
            let id = event.sender.id;
            if (this.playerCooldown[id]) {
              return;
            }
            this.playerCooldown[id] = true;
            system8.runTimeout(() => {
              delete this.playerCooldown[id];
            }, this.COOLDOWN);
          }
          system8.run(() => {
            world11.getAllPlayers().forEach((player) => {
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
