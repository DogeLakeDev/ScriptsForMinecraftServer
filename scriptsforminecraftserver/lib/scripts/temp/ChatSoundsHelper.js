/**
 * 临时放在这里，等chatSend走出实验再分离出去
 */
import { system, world } from "@minecraft/server";
export const KEYWORDS = {
    'ciallo': 'cs.ciallo', // Ciallo~
    '咕咕嘎嘎': 'cs.gugugaga', // 咕咕嘎嘎！
    '汩汩咕': 'cs.gugugu', // 汩汩咕
    'baka': 'cs.baka', // BAKA!
    'yee': 'cs.yee', // yee
    '干嘛': 'mob.chicken.hurt', // 鸡叫，不装神金资源包就是普通鸡叫
    'huh': 'cs.huh', // huh 不安装神金资源包就没声音
};
export class ChatSoundsHelper {
    static getInstance() {
        if (!ChatSoundsHelper.instance) {
            ChatSoundsHelper.instance = new ChatSoundsHelper(KEYWORDS);
        }
        return ChatSoundsHelper.instance;
    }
    constructor(keyWords) {
        this.COOLDOWN = 20 * 10; // 再次触发音效的冷却时间 10s
        this.keyWords = keyWords;
        this.playerCooldown = {};
        this.registerEvent();
    }
    registerEvent() {
        world.beforeEvents.chatSend.subscribe((event) => {
            for (let keyWord in this.keyWords) {
                if (event.message.toLowerCase().includes(keyWord.toLowerCase())) {
                    // 匹配成功，先检查冷却状态
                    if (event.sender.getGameMode() !== 'Creative') {
                        let id = event.sender.id;
                        if (this.playerCooldown[id]) {
                            return;
                        }
                        this.playerCooldown[id] = true;
                        system.runTimeout(() => {
                            delete this.playerCooldown[id];
                        }, this.COOLDOWN);
                    }
                    // 不在冷却，触发音效
                    system.run(() => {
                        world.getAllPlayers().forEach((player) => {
                            player.playSound(this.keyWords[keyWord]);
                        });
                    });
                    return;
                }
            }
        });
    }
}
//# sourceMappingURL=ChatSoundsHelper.js.map