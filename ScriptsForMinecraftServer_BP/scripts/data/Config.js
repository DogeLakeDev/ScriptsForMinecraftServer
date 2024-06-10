export const Config = {
    ITEMMAX: 100, // 掉落物清理阈值
    
    flyArea: [ // 生存飞行区
        {
            "name": "",
            "dimension": "minecraft:overworld",
            "start": [951, -2715],
            "end": [4604, 5628]
        }
    ],
    peaceArea: [ // 和平区域
        {
            "dimension": "minecraft:overworld",
            "start": [951, -2715],
            "end": [4604, 5628]
        }
    ],

    AFKTime: 120, // AFK等待时间 秒,
    QAInterval: [300, 360], // 从一题结束到下一题开始的时间区间（秒）
    QATimeout: 60           // 答题限时
}