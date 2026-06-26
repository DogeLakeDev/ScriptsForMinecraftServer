/**
 * 问答数据
 */
export const Questions = [{
        "weight": 1, // 出现的权重，权重越大越可能出现
        "q": "在《东方鬼形兽》中, 六面BOSS是? (五个字)",
        "a": ["埴安神袿姬"],
        "bonus": [{
                "seq": [1, 5], // 1~5名答对者可以获得此奖励，留空则所有排名均可获得
                "type": "money", // 奖励种类: 节操
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "打一车万人物: 光明牛奶（五个字）",
        "a": ["桑尼米尔克"],
        "bonus": [{
                "type": "item", // 奖励种类: 物品，仅支持give能给予的物品，特殊物品请使用指令给予（dogelake gift）
                "itemType": "milk_bucket",
                "amount": 1,
                "data": 0
            }]
    },
    {
        "weight": 1,
        "q": "谁是 BBA ?",
        "a": ["八云紫", "紫", "紫BBA"],
        "msg_right": "8要命啦？", // 回答正确的提示
        "bonus": [{
                "type": "cmd",
                "cmd": "damage @s 10"
            }]
    },
    {
        "weight": 1,
        "q": "打一车万人物: 青金石",
        "a": ["赫卡提亚", "赫卡提亚·拉碧斯拉祖利", "赫卡提亚拉碧斯拉祖利", "赫卡提亚 拉碧斯拉祖利"],
        "d": "赫卡提亚 · 拉碧斯拉祖利的“拉碧斯拉祖利”（Lapislazuli）即为“青金石”",
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "在少林寺十八铜人阵中, 听声辨位的考官是什么做的？",
        "a": ["肉", "人肉", "血肉"],
        "msg_right": "你过关!",
        "msg_wrong": "该罚!",
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
        "q": "道家学派的创始人是",
        "a": ["老子"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "中华三祖是 黄帝、炎帝和____",
        "a": ["蚩尤"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    }, //7
    {
        "weight": 1,
        "q": "[设计小知识] #1 HSV 中，S 代表什么？",
        "a": ["饱和度"],
        "msg_right": "奖励你一点§cFF0000§r吧",
        "bonus": [{
                "type": "item",
                "itemType": "touhou_little_maid:power_point",
                "amount": 3,
                "data": 0
            }]
    },
    {
        "weight": 1,
        "q": "犬走椛住在哪？",
        "a": ["妖怪之山"],
        "bonus": [{
                "type": "money",
                "amount": 200
            }]
    },
    {
        "weight": 1,
        "q": "风见幽香住在哪？",
        "a": ["迷途竹林"],
        "bonus": [{
                "type": "money",
                "amount": 200
            }]
    },
    {
        "weight": 1,
        "q": "莉格露·奈特巴格住在哪",
        "a": ["雾之湖"],
        "bonus": [{
                "type": "money",
                "amount": 200
            }]
    },
    {
        "weight": 1,
        "q": "在玩STG时，Z键可以干嘛？",
        "a": ["射击", "确认"],
        "bonus": [{
                "type": "item",
                "itemType": "touhou_little_maid:power_point",
                "amount": 3,
                "data": 0
            }]
    },
    {
        "weight": 1,
        "q": "由ZUNSoft制作的第一部作品（被称为旧作），是什么？",
        "a": ["东方灵异传"],
        "bonus": [{
                "type": "item",
                "itemType": "touhou_little_maid:power_point",
                "amount": 3,
                "data": 0
            }]
    },
    {
        "weight": 1,
        "q": "魂魄妖梦的职务是什么？",
        "a": ["庭师"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "下列角色与种族对应错误的是\nA. 藤原妹红---人类    B.洩矢诹访子---神明\nC.星熊勇仪---酒鬼     D.村纱水蜜---船幽灵",
        "a": ["C", "c"],
        "msg_right": "答题糕手！",
        "seq": [1, 2],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "找规律填空：八坂神奈子、圣白莲、______、摩多罗隐岐奈\nA. 丰聪耳神子    B.少名针妙丸    C.纯狐   D.赫卡提亚",
        "a": ["B", "b"],
        "msg_right": "答题糕手！",
        "seq": [1, 2],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "已知某一角色在TH x和TH y两作中都作为关底boss出现了，且面数跨度最大，则|x-y|=\nA.5       B.6      C.7     D.8",
        "a": ["B", "b"],
        "msg_right": "获得了第一无二的称号：答题糕手！\n 快使用/ch list 佩戴，向大家炫耀！",
        "seq": [1, 2],
        "bonus": [{
                "type": "cmd",
                "cmd": "ch add '§a§l答题高手'" //后期换为自定义符号
            },
            {
                "type": "money",
                "amount": 1000
            }]
    },
    {
        "weight": 1,
        "q": "若TH l奠定了东方系列主要游戏的型态，TH m为windows 平台上的第一作，TH n的玩法与其他新作的玩法明显不同，则TH(l+m+n) 的特色为\nA. 动物灵系统   B.季节解放系统  C.卡片系统  D.完美无缺模式",
        "a": ["A", "a"],
        "msg_right": "答题糕手！",
        "seq": [1, 2],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "若某角色在TH x中是 x-4 面的关底boss，还在TH (x+1) 中当 x-5 面的关底boss，则此角色可以在 TH (x+y) 中当第___面的关底boss  \nA.y-x     B.y-x-1    C.2x-y    D.2x-y-1  ",
        "a": ["B", "b"],
        "msg_right": "获得了第一无二的称号：答题糕手！\n 快使用/ch list 佩戴，向大家炫耀！",
        "seq": [1, 2],
        "bonus": [{
                "type": "cmd",
                "cmd": "ch add '§a§l答题高手'" //后期换为自定义符号
            },
            {
                "type": "money",
                "amount": 1000
            }]
    },
    {
        "weight": 1,
        "q": "下列角色关系指向与其他三组明显不同的是\nA. 蕾米莉亚→十六夜咲夜    B.八坂神奈子→东风谷早苗\nC.杖刀偶磨弓→埴安神袿姬   D.少名真妙丸→鬼人正邪",
        "a": ["C", "c"],
        "msg_right": "答题糕手！",
        "bonus": [{
                "type": "item",
                "itemType": "touhou_little_maid:power_point",
                "amount": 3,
                "data": 0
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Lunatic]§r 永远亭窗户的形状是？___形",
        "a": ["圆", "O"],
        "msg_right": "§c您？",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Lunatic]§r《东方凭依华》中，依神女苑无名指，中指，食指上的戒指镶嵌宝石的颜色依次是？__，__，__ \n(每空只用填一个字，不用打逗号)",
        "a": ["蓝红绿"],
        "msg_right": "§c您？",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Lunatic]§r《东方花映冢》中，米斯蒂娅·萝蕾拉在博丽神社唱的歌叫什么？",
        "a": ["碱色的樱花"],
        "msg_right": "§c您？",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Lunatic]§r 哪位角色在其初登场作品中出现的符卡名全部没有法语外来词？",
        "a": ["芙兰朵露·斯卡雷特", "芙兰朵露", "芙兰", "湖南躲鹿"],
        "msg_right": "§c 哦。",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Lunatic]§r《东方求闻史纪》一共有多少页？",
        "a": ["166"],
        "msg_right": "你真买了啊。",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Lunatic]§r 有多少角色拥有以“月符”为符名的符卡？",
        "a": ["4", "四"],
        "msg_right": "§c您？",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§4[二色幽紫蝶•Hard]§r 以下哪一张符卡的名字中不含片假名？\nA 光符「净化之魔」 B 抑制「超我」 C 兔符「团子影响力」D虹符「雨伞风暴」",
        "a": ["a", "A"],
        "msg_right": "§c答题糕手！",
        "bonus": [{
                "type": "money",
                "amount": 600
            }]
    },
    {
        "weight": 1,
        "q": "§a[二色幽紫蝶•Easy]§r 以下哪位人物不是长直发？\nA 蓬莱山辉夜 B 比那名居天子 C\n 斯塔·萨菲娅 D 圣白莲",
        "a": ["D", "d"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "§a[二色幽紫蝶•Easy]§r 古明地觉是《东方地灵殿》的几面 Boss？",
        "a": ["四面", "四", "4"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "宫古芳香的能力是什么？选填：什么都能吃程度的能力、感觉不到疼痛程度的能力、使人变成僵尸程度的能力、吞噬灵程度的能力",
        "a": ["什么都能吃程度的能力"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    },
    {
        "weight": 1,
        "q": "§a[二色幽紫蝶•Easy]§r 《东方绯想天》中，是谁毁坏了神社？",
        "a": ["比那名居天子", "天子"],
        "bonus": [{
                "type": "money",
                "amount": 500
            }]
    } // 24+7
];
//# sourceMappingURL=Questions.js.map