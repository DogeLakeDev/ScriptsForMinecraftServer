export const more ={
    "type": "button",
    "op": "false",
    "title": "更多功能",
    "content": "",
    "buttons": [
        {
            "title": "§l广告",
            "image": "",
            "onClick": {
                "type": "form",
                "run": "ad1"
            }
        },
        {
            "title": "§l§a前§3往§c提§d瓦§e特§6大§b陆",
            "image": "textures/ui/monkey_god",
            "onClick": {
                "type": "playerCmd",
                "run": "startgenshin"
            }
        },
        {
            "title": "§l传送",
            "image": "textures/items/hakurei_gohei",
            "onClick": {
                "type": "form",
                "run": "tp"
            }
        },
        {
            "title": "§l投票重启",
            "image": "textures/ui/recap_glyph_color_2x",
            "onClick": {
                "type": "playerCmd",
                "run": "voter"
            }
        },
        {
            "title": "§l♪音乐盒♬",
            "image": "textures/ui/music_rumia_ddr",
            "onClick": {
                "type": "playerCmd",
                "run": "tell @s 此功能暂时下线，敬请期待。"
            }
        }
    ],
    "exit": {
        "type": "",
        "run": ""
    }
}