export interface QuestionBonus {
    seq?: [number, number];
    type: "money" | "item" | "cmd";
    amount?: number;
    itemType?: string;
    data?: number;
    cmd?: string;
}

export interface Question {
    weight: number;
    q: string;
    a: string[];
    d?: string;
    msg_right?: string;
    msg_wrong?: string;
    bonus?: QuestionBonus[];
    punish?: QuestionBonus[];
}

export const Questions: Question[] = [
    {
        "weight": 1,
        "q": "在《东方鬼形兽》中, 六面BOSS是? (五个字)",
        "a": ["埴安神袿姬"],
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
        "q": "打一车万人物: 光明牛奶（五个字）",
        "a": ["桑尼米尔克"],
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
        "q": "谁是 BBA ?",
        "a": ["八云紫", "紫", "紫BBA"],
        "msg_right": "8要命啦？",
        "bonus": [
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
        "bonus": [
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
        "q": "道家学派的创始人是",
        "a": ["老子"],
        "bonus": [
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
        "bonus": [
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
        "bonus": [
            {
                "type": "money",
                "amount": 500
            }
        ]
    }
];
