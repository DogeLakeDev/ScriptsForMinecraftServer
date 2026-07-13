/* ---------------------------------------- *\
 *  Name        :  问答                      *
 *  Description :  答题                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */
import { system, world } from "@minecraft/server";
import { getRandomInteger, Msg } from "../libs/Tools";
import { ConfigManager } from "../libs/ConfigManager";
import { Money } from "../libs/Money";
export class QAManager {
    constructor() {
        // 记录玩家答题信息
        this.nowQuestion = undefined;
        this.playerList = {};
        this.rightAmount = 0;
        this.wrongAmount = 0;
        this.timeoutId = undefined;
        this.chatSub = undefined;
        // 出题记录，避免短时间重复出题
        this.record = []; // 最近出的几个题
        this.recordPtr = 0; // 下一个记录写入的位置
        this.recordLimit = Math.floor(ConfigManager.getQuestions().length - 2); // 最大记录数量
    }
    /**
     * @returns {QAManager}
     */
    static getInstance() {
        if (QAManager._instance === undefined) {
            QAManager._instance = new QAManager();
        }
        return QAManager._instance;
    }
    /**
     * 开始答题循环
     */
    start() {
        this.chatSub = world.beforeEvents.chatSend.subscribe((event) => {
            if (event.message.substring(0, 1) === "!" || event.message.substring(0, 1) === "！") {
                let answer = event.message.substring(1);
                answer = answer.replaceAll(" "); // 去除空格
                if (this.nowQuestion !== undefined) {
                    this.answer(event.sender, answer);
                    event.cancel = true;
                    return;
                }
            }
        });
        this.timeoutId = system.runTimeout(() => {
            this.nextQuestion();
        }, QAManager.getNextTimeout());
    }
    stop() {
        try {
            if (this.chatSub && typeof this.chatSub.unsubscribe === 'function')
                this.chatSub.unsubscribe();
        }
        catch { }
        this.chatSub = undefined;
        if (this.timeoutId !== undefined) {
            try {
                system.clearRun(this.timeoutId);
            }
            catch { }
            this.timeoutId = undefined;
        }
        this.nowQuestion = undefined;
    }
    // 下一个问题
    nextQuestion() {
        //// 计算权重 准备列表 ////
        let questionList = []; // 记录题目编号
        let totalWeight = 0;
        let startPoints = [];
        for (let i = 0; i < ConfigManager.getQuestions().length; i++) {
            if (!this.record.includes(i)) {
                questionList.push(i);
                totalWeight += ConfigManager.getQuestions()[i].weight;
                startPoints.push(totalWeight);
            }
        }
        //// 取出题目 ////
        let randomNum = getRandomInteger(0, totalWeight - 1);
        for (let i = 0; i < startPoints.length; i++) {
            if (randomNum < startPoints[i]) {
                this.nowQuestion = questionList[i];
                // 记录
                this.pushRecord(i);
                break;
            }
        }
        //// 开始答题 ////
        world.sendMessage(`§b[Baka Cirno]§r §g${ConfigManager.getQuestions()[this.nowQuestion].q}§r\n  §h发送 §e!答案§r §h来答题`);
        //// 结束答题 ////
        system.runTimeout(() => {
            this.finish();
        }, ConfigManager.getSetting("qa_timeout", 60) * 20);
    }
    // 结束答题，揭晓答案
    finish() {
        // 宣布答案
        let question = ConfigManager.getQuestions()[this.nowQuestion];
        world.sendMessage(`§b[Baka Cirno]§r 正确答案是 §e${question.a[0]}§r ! ${question.d !== undefined ? "\n  " + question.d : ""}`);
        // 重置变量
        this.nowQuestion = undefined;
        this.playerList = {};
        this.rightAmount = 0;
        this.wrongAmount = 0;
        // 下一题
        this.timeoutId = system.runTimeout(() => {
            this.nextQuestion();
        }, QAManager.getNextTimeout());
    }
    /**
     * 玩家答题
     * @returns -2答题未在进行 -1玩家已答过题 0错误 1正确
     */
    answer(pl, str) {
        // 答题正在进行
        if (this.nowQuestion !== undefined) {
            // 玩家未答题
            if (this.playerList[pl.nameTag] === undefined) {
                let question = ConfigManager.getQuestions()[this.nowQuestion];
                for (let a of question.a) {
                    if (str === a) {
                        // 回答正确
                        this.rightAmount++;
                        this.playerList[pl.nameTag] = true;
                        QAManager.giveBonus(pl, this.rightAmount, question.bonus);
                        if (question["msg_right"] !== undefined) {
                            Msg.tips(question["msg_right"], pl);
                        }
                        else {
                            Msg.success("§a回答正确！§r", pl);
                        }
                        return 1;
                    }
                }
                if (question["msg_wrong"] !== undefined) {
                    Msg.tips(question["msg_wrong"], pl);
                }
                else {
                    Msg.error("§c回答错误！§r", pl);
                }
                this.wrongAmount++;
                if (question.punish !== undefined) {
                    QAManager.giveBonus(pl, this.wrongAmount, question.punish);
                }
                this.playerList[pl.nameTag] = false;
                return 0;
            }
            Msg.tips("已经答过这题了^ ^§r", pl);
            return -1;
        }
        Msg.tips("当前没有正在进行的答题^ ^§r", pl);
        return -2;
    }
    pushRecord(index) {
        this.record[this.recordPtr] = index;
        this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
    }
    // 距离下一个问题的时间(秒)
    static getNextTimeout() {
        let min = ConfigManager.getSetting("qa_interval_min", 600) * 20;
        let max = ConfigManager.getSetting("qa_interval_max", 720) * 20;
        return min + Math.floor(Math.random() * max);
    }
    /**
     * 给予玩家奖励 也可以是惩罚，格式是一样的
     * @param pl 答题者
     * @param seq 顺序(从1开始)
     * @param bonus 奖励列表
     */
    static giveBonus(pl, seq, bonus) {
        if (!bonus)
            return;
        for (let b of bonus) {
            // 符合顺序
            if (b["seq"] === undefined || (b["seq"][0] <= seq && seq <= b["seq"][1])) {
                system.run(() => {
                    switch (b["type"]) {
                        case "money":
                            Money.add(pl, b["amount"]);
                            break;
                        case "item":
                            pl.runCommand(`give @s ${b["itemType"]} ${b["amount"]} ${b["data"] === undefined ? "" : b["data"]}`);
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
}
//# sourceMappingURL=QA.js.map