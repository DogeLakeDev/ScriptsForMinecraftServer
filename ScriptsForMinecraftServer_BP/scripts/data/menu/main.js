export const main = {
    "type": "button",
    "permission": 0,
    "title": "/D Doge",
    "content": "如出现此行文字，请检查是否完整下载服务器资源，是否有资源包与服务器资源包冲突，否则可能会影响在本服的正常游玩！",
    "buttons": [
        {
            "title": "商店",
            "image": "",
            "onClick": {
                "type": "scriptCmd",
                "run": "shop"
            }
        },
        {
            "title": "河童的罗盘",
            "image": "",
            "onClick": {
                "type": "playerCmd",
                "run": "xyz"
            }
        },
        {
            "title": "合作社",
            "image": "",
            "onClick": {
                "type": "playerCmd",
                "run": "warp"
            }
        },
        {
            "title": "天界",
            "image": "",
            "onClick": {
                "type": "playerCmd",
                "run": "dogeworld bv"
            }
        },
        {
            "title": "领地",
            "image": "",
            "onClick": {
                "type": "playerCmd",
                "run": "land"
            }
        },
        {
            "title": "家",
            "image": "",
            "onClick": {
                "type": "playerCmd",
                "run": "home"
            }
        },
        {
            "title": "任务",
            "image": "",
            "onClick": {
                "type": "playerCmd",
                "run": "tell @s 此功能尚在开发，敬请期待..."
            }
        },
        {
            "title": "更多",
            "image": "",
            "onClick": {
                "type": "form",
                "run": "more"
            }
        }
    ]
    // "exit": {
    //     "type": "",
    //     "run": ""
    // }
}