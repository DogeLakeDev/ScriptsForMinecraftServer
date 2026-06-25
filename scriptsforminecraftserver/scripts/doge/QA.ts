import { Player, system, world } from "@minecraft/server";
import { Questions, Question, QuestionBonus } from "../data/Questions";
import { getRandomInteger, logger } from "../libs/Tools";
import { Config } from "../data/Config";
import { Money } from "../libs/Money";

export class QAManager {
    nowQuestion: number | undefined = undefined;
    playerList: Record<string, boolean> = {};
    rightAmount = 0;
    wrongAmount = 0;
    record: number[] = [];
    recordPtr = 0;
    recordLimit = Math.floor(Questions.length - 2);
    timeoutId: number | undefined = undefined;

    constructor() {
        (world.beforeEvents as any).chatSend.subscribe((event: any) => {
            if (event.message.substring(0, 1) === "!" || event.message.substring(0, 1) === "！") {
                const answer = event.message.substring(1).replaceAll(' ', '');
                if (this.nowQuestion !== undefined) {
                    this.answer(event.sender, answer);
                    event.cancel = true;
                    return;
                }
            }
        });
        system.runTimeout(() => {
            this.nextQuestion();
        }, QAManager.getNextTimeout());
    }

    nextQuestion(): void {
        const questionList: number[] = [];
        let totalWeight = 0;
        const startPoints: number[] = [];

        for (let i = 0; i < Questions.length; i++) {
            if (!this.record.includes(i)) {
                questionList.push(i);
                totalWeight += Questions[i].weight;
                startPoints.push(totalWeight);
            }
        }

        const randomNum = getRandomInteger(0, totalWeight - 1);
        for (let i = 0; i < startPoints.length; i++) {
            if (randomNum < startPoints[i]) {
                this.nowQuestion = questionList[i];
                this.pushRecord(i);
                break;
            }
        }

        if (this.nowQuestion !== undefined) {
            world.sendMessage(`§b[Baka Cirno]§r §g${Questions[this.nowQuestion].q}§r\n  §h发送 §e!答案§r §h来答题`);
        }

        system.runTimeout(() => {
            this.finish();
        }, Config.QATimeout * 20);
    }

    finish(): void {
        const question = Questions[this.nowQuestion!];
        world.sendMessage(`§b[Baka Cirno]§r 正确答案是 §e${question.a[0]}§r ! ${question.d !== undefined ? "\n  " + question.d : ''}`);

        this.nowQuestion = undefined;
        this.playerList = {};
        this.rightAmount = 0;
        this.wrongAmount = 0;

        this.timeoutId = system.runTimeout(() => {
            this.nextQuestion();
        }, QAManager.getNextTimeout());
    }

    answer(pl: Player, str: string): number {
        if (this.nowQuestion !== undefined) {
            if (this.playerList[pl.nameTag] === undefined) {
                const question = Questions[this.nowQuestion];
                for (const a of question.a) {
                    if (str === a) {
                        this.rightAmount++;
                        this.playerList[pl.nameTag] = true;
                        QAManager.giveBonus(pl, this.rightAmount, question.bonus);
                        if (question.msg_right !== undefined) {
                            pl.sendMessage(question.msg_right);
                        } else {
                            pl.sendMessage("§a回答正确！§r");
                        }
                        return 1;
                    }
                }
                if (question.msg_wrong !== undefined) {
                    pl.sendMessage(question.msg_wrong);
                } else {
                    pl.sendMessage("§c回答错误！§r");
                }
                this.wrongAmount++;
                if (question.punish !== undefined) {
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

    pushRecord(index: number): void {
        this.record[this.recordPtr] = index;
        this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
    }

    static getNextTimeout(): number {
        const min = Config.QAInterval[0] * 20;
        const max = Config.QAInterval[1] * 20;
        return min + Math.floor(Math.random() * max);
    }

    static giveBonus(pl: Player, seq: number, bonus?: QuestionBonus[]): void {
        if (!bonus) return;
        for (const b of bonus) {
            if (b.seq === undefined || (b.seq[0] <= seq && seq <= b.seq[1])) {
                system.run(() => {
                    switch (b.type) {
                        case "money":
                            Money.add(pl, b.amount!);
                            break;
                        case "item":
                            pl.runCommand(`give @s ${b.itemType} ${b.amount} ${b.data === undefined ? "" : b.data}`);
                            break;
                        case "cmd":
                            pl.runCommand(b.cmd!);
                            break;
                        default:
                            pl.sendMessage(`Unknown bonus type: ${b.type}`);
                            break;
                    }
                });
            }
        }
    }
}
