/* ---------------------------------------- *\
 *  Name        :  问答                      *
 *  Description :  答题                      *
 *  Version     :  1.0.0                    *
 *  Author      :  ENIAC_Jushi              *
\* ---------------------------------------- */

import { Player, system, world } from "@minecraft/server";
import { ConfigManager } from "@sfmc/sdk/module-loader";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { Money } from "@sfmc/sdk/sapi/runtime";
import { getRandomInteger, Msg } from "@sfmc/sdk/sapi/runtime";

export class QAManager {
  static _instance: QAManager;
  /**
   * @returns {QAManager}
   */
  static getInstance() {
    if (QAManager._instance === undefined) {
      QAManager._instance = new QAManager();
    }
    return QAManager._instance;
  }

  // 记录玩家答题信息
  nowQuestion: number | undefined = undefined;
  playerList: Record<string, boolean> = {};
  rightAmount = 0;
  wrongAmount = 0;
  timeoutId: number | undefined = undefined;
  private finishTimeoutId: number | undefined = undefined;

  /**
   * 开始答题循环
   */
  start() {
    debug.i("QA", "start");
    if (this.chatSub) return;
    this.chatSub = (world.beforeEvents as any).chatSend.subscribe((event: any) => {
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

  private chatSub: any = undefined;

  stop() {
    debug.i("QA", "stop");
    try {
      if (this.chatSub && typeof this.chatSub.unsubscribe === "function") this.chatSub.unsubscribe();
    } catch {}
    this.chatSub = undefined;
    if (this.timeoutId !== undefined) {
      try {
        system.clearRun(this.timeoutId);
      } catch {}
      this.timeoutId = undefined;
    }
    if (this.finishTimeoutId !== undefined) {
      try {
        system.clearRun(this.finishTimeoutId);
      } catch {}
      this.finishTimeoutId = undefined;
    }
    this.nowQuestion = undefined;
  }

  // 下一个问题
  nextQuestion() {
    debug.i("QA", `nextQuestion: current=${this.nowQuestion}`);
    const questions = ConfigManager.getQuestions();
    this.recordLimit = Math.max(0, questions.length - 2);
    if (questions.length === 0) {
      console.warn("[QA] 没有可用题目，稍后重试");
      this.timeoutId = system.runTimeout(() => this.nextQuestion(), 20 * 60);
      return;
    }
    //// 计算权重 准备列表 ////
    let questionList: number[] = []; // 记录题目编号
    let totalWeight = 0;
    let startPoints: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      if (!this.record.includes(i)) {
        questionList.push(i);
        totalWeight += ConfigManager.getQuestions()[i].weight;
        startPoints.push(totalWeight);
      }
    }

    //// 取出题目 ////
    if (questionList.length === 0 || totalWeight <= 0) {
      this.record = [];
      this.recordPtr = 0;
      this.timeoutId = system.runTimeout(() => this.nextQuestion(), 20 * 60);
      return;
    }
    let randomNum = getRandomInteger(0, totalWeight - 1);
    for (let i = 0; i < startPoints.length; i++) {
      if (randomNum < startPoints[i]!) {
        this.nowQuestion = questionList[i]!;
        // 记录
        this.pushRecord(this.nowQuestion);
        break;
      }
    }
    //// 开始答题 ////
    world.sendMessage(
      `§b[Baka Cirno]§r §g${ConfigManager.getQuestions()[this.nowQuestion!].q}§r\n  §h发送 §e!答案§r §h来答题`
    );

    //// 结束答题 ////
    this.finishTimeoutId = system.runTimeout(
      () => {
        this.finishTimeoutId = undefined;
        this.finish();
      },
      ConfigManager.getSetting("qa_timeout", 60) * 20
    );
  }
  // 结束答题，揭晓答案
  finish() {
    debug.i("QA", "finish");
    if (this.nowQuestion === undefined) return;
    // 宣布答案
    let question = ConfigManager.getQuestions()[this.nowQuestion!];
    world.sendMessage(
      `§b[Baka Cirno]§r 正确答案是 §e${question.a[0]}§r ! ${question.d !== undefined ? "\n  " + question.d : ""}`
    );

    // 重置变量
    this.nowQuestion = undefined;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;

    // 下一题
    this.timeoutId = system.runTimeout(() => {
      this.timeoutId = undefined;
      this.nextQuestion();
    }, QAManager.getNextTimeout());
  }
  /**
   * 玩家答题
   * @returns -2答题未在进行 -1玩家已答过题 0错误 1正确
   */
  answer(pl: Player, str: string): number {
    debug.i("QA", `answer: player=${pl.name} answer=${str}`);
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
            } else {
              Msg.success("§a回答正确！§r", pl);
            }
            return 1;
          }
        }
        if (question["msg_wrong"] !== undefined) {
          Msg.tips(question["msg_wrong"], pl);
        } else {
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
  // 出题记录，避免短时间重复出题
  record: number[] = []; // 最近出的几个题
  recordPtr = 0; // 下一个记录写入的位置
  recordLimit = Math.max(0, Math.floor(ConfigManager.getQuestions().length - 2)); // 最大记录数量
  pushRecord(index: number) {
    this.record[this.recordPtr] = index;
    this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
  }

  // 距离下一个问题的时间(秒)
  static getNextTimeout() {
    let min = ConfigManager.getSetting("qa_interval_min", 600) * 20;
    let max = ConfigManager.getSetting("qa_interval_max", 720) * 20;
    if (max <= min) return min;
    return min + Math.floor(Math.random() * (max - min));
  }

  /**
   * 给予玩家奖励 也可以是惩罚，格式是一样的
   * @param pl 答题者
   * @param seq 顺序(从1开始)
   * @param bonus 奖励列表
   */
  static giveBonus(pl: Player, seq: number, bonus: any[] | undefined) {
    if (!bonus) return;
    debug.i("QA", `giveBonus: player=${pl.name} seq=${seq} bonusCount=${bonus.length}`);
    for (let b of bonus) {
      // 符合顺序
      if (b["seq"] === undefined || (b["seq"][0] <= seq && seq <= b["seq"][1])) {
        system.run(async () => {
          switch (b["type"]) {
            case "money":
              await Money.add(pl, b["amount"]);
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
