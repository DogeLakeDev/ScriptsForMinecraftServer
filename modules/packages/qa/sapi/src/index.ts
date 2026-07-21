/**
 * @sfmc/module-qa — v2 入口
 *
 * ModuleRegistry.register + 定时出题、玩家答题与奖惩。
 * - 配置:config.get("qa") 读 questions / qa_interval_{min,max} / qa_timeout
 * - 跨模块:Money 暂用 SDK runtime Money(待 feature-economy v2 迁移后改 service.get)
 */

import { Player, system, world } from "@minecraft/server";
import { config } from "@sfmc/sdk/sapi/config";
import { debug, getRandomInteger, Money, Msg } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-qa";

interface QAConfig {
  questions: Array<{
    weight: number;
    question: string;
    answers: string[];
    msg_right?: string;
    msg_wrong?: string;
    explanation?: string;
    rewards?: Bonus[];
    punishments?: Bonus[];
  }>;
  qa_interval_min: number;
  qa_interval_max: number;
  qa_timeout: number;
}

interface Bonus {
  type: "money" | "item" | "cmd";
  amount?: number;
  itemType?: string;
  data?: number;
  cmd?: string;
  seq?: [number, number];
}

let questions: QAConfig["questions"] = [];
let qa_interval_min = 600;
let qa_interval_max = 720;
let qa_timeout = 60;

let nowQuestion: number | undefined = undefined;
let playerList: Record<string, boolean> = {};
let rightAmount = 0;
let wrongAmount = 0;

let chatSub: { unsubscribe(): void } | undefined;
let timeoutId: number | undefined = undefined;
let finishTimeoutId: number | undefined = undefined;

let record: number[] = [];
let recordPtr = 0;
let recordLimit = 0;

function nextTimeoutSec(): number {
  const min = qa_interval_min * 20;
  const max = qa_interval_max * 20;
  if (max <= min) return min;
  return min + Math.floor(Math.random() * (max - min));
}

function pickNextQuestion(): void {
  if (questions.length === 0) {
    console.warn("[QA] 没有可用题目,稍后重试");
    timeoutId = system.runTimeout(() => pickNextQuestion(), 20 * 60);
    return;
  }
  recordLimit = Math.max(0, questions.length - 2);

  let pool: number[] = [];
  let totalWeight = 0;
  const startPoints: number[] = [];
  for (let i = 0; i < questions.length; i++) {
    if (!record.includes(i)) {
      pool.push(i);
      totalWeight += questions[i].weight;
      startPoints.push(totalWeight);
    }
  }
  if (pool.length === 0 || totalWeight <= 0) {
    record = [];
    recordPtr = 0;
    timeoutId = system.runTimeout(() => pickNextQuestion(), 20 * 60);
    return;
  }

  const r = getRandomInteger(0, totalWeight - 1);
  for (let i = 0; i < startPoints.length; i++) {
    if (r < startPoints[i]!) {
      nowQuestion = pool[i]!;
      record[recordPtr] = nowQuestion;
      recordPtr = recordPtr < recordLimit ? recordPtr + 1 : 0;
      break;
    }
  }

  world.sendMessage(
    `§b[Baka Cirno]§r §g${questions[nowQuestion!].question}§r\n  §h发送 §e!答案§r §h来答题`
  );
  finishTimeoutId = system.runTimeout(
    () => {
      finishTimeoutId = undefined;
      finishQuestion();
    },
    qa_timeout * 20
  );
}

function finishQuestion(): void {
  if (nowQuestion === undefined) return;
  const q = questions[nowQuestion];
  world.sendMessage(
    `§b[Baka Cirno]§r 正确答案是 §e${q.answers[0]}§r ! ${q.explanation !== undefined ? "\n  " + q.explanation : ""}`
  );
  nowQuestion = undefined;
  playerList = {};
  rightAmount = 0;
  wrongAmount = 0;
  timeoutId = system.runTimeout(() => {
    timeoutId = undefined;
    pickNextQuestion();
  }, nextTimeoutSec());
}

function applyBonus(pl: Player, seq: number, bonuses: Bonus[] | undefined): void {
  if (!bonuses) return;
  for (const b of bonuses) {
    if (b.seq !== undefined && (seq < b.seq[0] || seq > b.seq[1])) continue;
    system.run(async () => {
      switch (b.type) {
        case "money":
          await Money.add(pl, b.amount ?? 0);
          break;
        case "item":
          pl.runCommand(
            `give @s ${b.itemType} ${b.amount ?? 1} ${b.data === undefined ? "" : b.data}`
          );
          break;
        case "cmd":
          if (b.cmd !== undefined) pl.runCommand(b.cmd);
          break;
        default:
          Msg.error(`Unknown bonus type: ${b.type}`, pl);
      }
    });
  }
}

function handleAnswer(pl: Player, str: string): number {
  if (nowQuestion === undefined) {
    Msg.tips("当前没有正在进行的答题^ ^§r", pl);
    return -2;
  }
  if (playerList[pl.nameTag] !== undefined) {
    Msg.tips("已经答过这题了^ ^§r", pl);
    return -1;
  }
  const q = questions[nowQuestion];
  for (const a of q.answers) {
    if (str === a) {
      rightAmount++;
      playerList[pl.nameTag] = true;
      applyBonus(pl, rightAmount, q.rewards);
      if (q.msg_right !== undefined) {
        Msg.tips(q.msg_right, pl);
      } else {
        Msg.success("§a回答正确!§r", pl);
      }
      return 1;
    }
  }
  if (q.msg_wrong !== undefined) {
    Msg.tips(q.msg_wrong, pl);
  } else {
    Msg.error("§c回答错误!§r", pl);
  }
  wrongAmount++;
  applyBonus(pl, wrongAmount, q.punishments);
  playerList[pl.nameTag] = false;
  return 0;
}

function startLoop(): void {
  if (chatSub) return;
  chatSub = world.beforeEvents.chatSend.subscribe((event) => {
    const msg = event.message;
    if (msg.startsWith("!") || msg.startsWith("!")) {
      const answer = msg.substring(1).replaceAll(" ");
      if (nowQuestion !== undefined) {
        handleAnswer(event.sender, answer);
        event.cancel = true;
      }
    }
  });
  timeoutId = system.runTimeout(() => pickNextQuestion(), nextTimeoutSec());
  debug.i("QA", `start: ${questions.length} questions loaded`);
}

function stopLoop(): void {
  try {
    chatSub?.unsubscribe();
  } catch {
    /* ignore */
  }
  chatSub = undefined;
  if (timeoutId !== undefined) {
    try {
      system.clearRun(timeoutId);
    } catch {
      /* ignore */
    }
    timeoutId = undefined;
  }
  if (finishTimeoutId !== undefined) {
    try {
      system.clearRun(finishTimeoutId);
    } catch {
      /* ignore */
    }
    finishTimeoutId = undefined;
  }
  nowQuestion = undefined;
  debug.i("QA", "stop");
}

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      // QA 由 chatSend 触发,无独立命令 / 权限
    },
    async init() {
      const cfg = (await config.get<Partial<QAConfig>>("qa")) ?? {};
      questions = Array.isArray(cfg.questions) ? cfg.questions : [];
      qa_interval_min = cfg.qa_interval_min ?? 600;
      qa_interval_max = cfg.qa_interval_max ?? 720;
      qa_timeout = cfg.qa_timeout ?? 60;
      if (questions.length === 0) {
        debug.e("QA", "configs/qa.json missing or empty — module disabled");
        return;
      }
      startLoop();
    },
    cleanup() {
      stopLoop();
    },
  },
});