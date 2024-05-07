
export const Questions = [
    {
        "weight": 1, // 出现的权重，权重越大越可能出现
        "q": "在《东方鬼形兽》中, 六面BOSS是? (五个字)",
        "a": ["埴安神袿姬"],
        "bonus":[
            {
                "seq": [1, 5],    // 1~5名答对者可以获得此奖励，留空则所有排名均可获得
                "type": "money",  // 奖励种类: 节操
                "amount": 500
            }
        ]
    },
    {
        "weight": 1,
        "q": "打一车万人物: 光明牛奶（五个字）",
        "a": ["桑尼米尔克"],
        "bonus":[
            {
                "type": "item",   // 奖励种类: 物品，仅支持give能给予的物品，特殊物品请使用指令给予（dogelake gift）
                "itemType": "milk_bucket",
                "amount": 1,
                "data": 0
            }
        ]
    },
    {
        "weight": 1,
        "q": "谁是 BBA ?",
        "a": ["八云紫", "紫", "紫BBA"],
        "msg_right": "8要命啦？", // 回答正确的提示
        "bonus":[
            {
                "type": "cmd",
                "cmd": "damage @s 10"
            }
        ]
    },
    {
        "weight": 1,
        "q": "打一车万人物: 青金石",
        "a": ["赫卡提亚", "赫卡提亚·拉碧斯拉祖利", "赫卡提亚拉碧斯拉祖利", "赫卡提亚 拉碧斯拉祖利"],
        "d": "赫卡提亚 · 拉碧斯拉祖利的“拉碧斯拉祖利”（Lapislazuli）即为“青金石”",
        "bonus":[
            {
                "type": "money",
                "amount": 500
            }
        ]
    },
    {
        "weight": 1,
        "q": "在少林寺十八铜人阵中, 听声辨位的考官是什么做的？",
        "a": ["肉", "人肉", "血肉"],
        "msg_right": "你过关!",
        "msg_wrong": "该罚!",
        "bonus":[
            {
                "type": "money",
                "amount": 500
            }
        ],
        "punish":[
            {
                "type": "cmd",
                "cmd": "damage @s 10"
            }
        ]
    },
    {
        "weight": 1,
        "q": "道家学派的创始人是",
        "a": ["老子"],
        "bonus":[
            {
                "type": "money",
                "amount": 500
            }
        ]
    },
    {
        "weight": 1,
        "q": "中华三祖是 黄帝、炎帝和____",
        "a": ["蚩尤"],
        "bonus":[
            {
                "type": "money",
                "amount": 500
            }
        ]
    },
    {
        "weight": 1,
        "q": "中华三祖是 黄帝、炎帝和____",
        "a": ["蚩尤"],
        "bonus":[
            {
                "type": "money",
                "amount": 500
            }
        ]
    }
]