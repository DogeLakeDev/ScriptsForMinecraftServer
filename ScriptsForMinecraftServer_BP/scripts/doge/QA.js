
  /* ---------------------------------------- *\
   *  Name        :  DogeLake QA              *
   *  Description :  QA.                      *
   *  Version     :  1.0.0                    *
   *  Author      :  ENIAC_Jushi              *
  \* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { Questions } from "../data/Questions"
import { getRandomInteger, logger } from "../libs/Tools";
import { Config } from "../data/Config";
import { Money } from "../libs/Money";

export class QAManager{
    // 记录玩家答题信息
    nowQuestion = undefined;
    playerList = {};
    rightAmount = 0;
    wrongAmount = 0;

    constructor(){
        world.beforeEvents.chatSend.subscribe(event=>{
            if(event.message.substring(0, 1) === "!" || event.message.substring(0, 1) === "！"){
                let answer = event.message.substring(1);
                answer = answer.replaceAll(' '); // 去除空格
                if(this.nowQuestion !== undefined){
                    this.answer(event.sender, answer);
                    event.cancel = true;
                    return;
                }
            }
        })
        system.runTimeout(()=>{
            this.nextQuestion();
        }, QAManager.getNextTimeout());
    }
    // 下一个问题
    nextQuestion(){
        //// 计算权重 准备列表 ////
        let questionList = []; // 记录题目编号
        let totalWeight = 0;
        let startPoints = [];
        for(let i = 0; i < Questions.length; i++){
            if(!this.record.includes(i)){
                questionList.push(i);
                totalWeight += Questions[i].weight;
                startPoints.push(totalWeight);
            }
        }

        //// 取出题目 ////
        let randomNum = getRandomInteger(0, totalWeight - 1);
        for(let i = 0; i < startPoints.length; i++){
            if(randomNum < startPoints[i]){
                this.nowQuestion = questionList[i];
                // 记录
                this.pushRecord(i);
                break;
            }
        }
        //// 开始答题 ////
        world.sendMessage(`§b[Baka Cirno]§r §g${Questions[this.nowQuestion].q}§r\n  §h发送 §e!答案§r §h来答题`);
        
        //// 结束答题 ////
        system.runTimeout(()=>{
            this.finish();
        }, Config.QATimeout * 20);
    }
    // 结束答题，揭晓答案
    finish(){
        // 宣布答案
        let question = Questions[this.nowQuestion];
        world.sendMessage(`§b[Baka Cirno]§r 正确答案是 §e${question.a[0]}§r ! ${question.d !== undefined ? "\n  " + question.d : ''}`);
        
        // 重置变量
        this.nowQuestion = undefined;
        this.playerList = {};
        this.rightAmount = 0;
        this.wrongAmount = 0;

        // 下一题
        this.timeoutId = system.runTimeout(()=>{
            this.nextQuestion();
        }, QAManager.getNextTimeout());
    }
    /**
     * 玩家答题
     * @param {Player} pl  答题者
     * @param {string} str 答案
     * @returns {number} -2答题未在进行 -1玩家已答过题 0错误 1正确
     */
    answer(pl, str){
        // 答题正在进行
        if(this.nowQuestion !== undefined){
            // 玩家未答题
            if(this.playerList[pl.nameTag] === undefined){
                let question = Questions[this.nowQuestion]
                for(let a of question.a){
                    if(str === a){
                        // 回答正确
                        this.rightAmount ++;
                        this.playerList[pl.nameTag] = true;
                        QAManager.giveBonus(pl, this.rightAmount, question.bonus);
                        if(question["msg_right"] !== undefined){
                            pl.sendMessage(question["msg_right"]);
                        }
                        else{
                            pl.sendMessage("§a回答正确！§r");
                        }
                        return 1;// todo: playerList没改完
                    }
                }
                if(question["msg_wrong"] !== undefined){
                    pl.sendMessage(question["msg_wrong"]);
                }
                else{
                    pl.sendMessage("§c回答错误！§r");
                }
                this.wrongAmount ++;
                if(question.punish != undefined){
                    QAManager.giveBonus(pl, this.wrongAmount, question.punish);
                }
                this.playerList[pl.nameTag] = false;
                return 0;
            }
            pl.sendMessage("§h已经答过这题了^ ^§r");
            return -1;
        }
        pl.sendMessage("§h当前没有正在进行的答题^ ^§r");
        return -2;
    }
    // 出题记录，避免短时间重复出题
    record = [];             // 最近出的几个题
    recordPtr = 0;          // 下一个记录写入的位置
    recordLimit = Math.floor(Questions.length - 2); // 最大记录数量
    pushRecord(index){
        this.record[this.recordPtr] = index;
        this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
    }
    
    // 距离下一个问题的时间(秒)
    static getNextTimeout(){
        let min = Config.QAInterval[0] * 20;
        let max = Config.QAInterval[1] * 20;
        return min + Math.floor(Math.random() * max);
    }
    
    /**
     * 给予玩家奖励 也可以是惩罚，格式是一样的
     * @param {Player} pl 答题者
     * @param {Number} seq 顺序(从1开始)
     * @param {Array} bonus 奖励列表
     */
    static giveBonus(pl, seq, bonus){
        for(let b of bonus){
            // 符合顺序
            if(b["seq"] === undefined || (b["seq"][0] <= seq && seq <= b["seq"][1])){
                system.run(()=>{
                    switch(b["type"]){
                        case "money":
                            Money.add(pl, b["amount"]);
                            break;
                        case "item":
                            pl.runCommand(`give @s ${b["itemType"]} ${b["amount"]} ${b["data"]===undefined?"":b["data"]}`);
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
}