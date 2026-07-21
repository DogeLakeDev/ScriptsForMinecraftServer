/**
 * @sfmc/module-daily-task — v2 入口
 *
 * ModuleRegistry.register + 跨模块调 service.get("economy.dailyTasks.*")。
 * /task 命令打开 MenuNavigator,列出活跃任务,允许玩家提交物品换 reward。
 */

import { Player, world } from "@minecraft/server";
import { service } from "@sfmc/sdk/sapi/service";
import { Command, debug, FormStatus, ListFormInfo, MenuNavigator, Money, obsNum, Permission } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-daily-task";

interface DailyTaskRow {
  id: string;
  item_type: string;
  item_aux?: number;
  target_qty: number;
  filled_qty: number;
  unit_reward: number;
}

interface DailyTasksEnvelope {
  tasks: DailyTaskRow[];
}

interface SubmitResult {
  ok: boolean;
  reward?: number;
  balance?: number;
  balanceVersion?: number;
  error?: string;
}

async function listTasks(): Promise<DailyTaskRow[]> {
  try {
    const env = await service.get<DailyTasksEnvelope>("economy.dailyTasks.list");
    return env?.tasks ?? [];
  } catch (err) {
    debug.w("DailyTask", `list failed: ${(err as Error).message}`);
    return [];
  }
}

async function submitTask(task: DailyTaskRow, player: Player, qty: number): Promise<SubmitResult> {
  return service.get<SubmitResult>("economy.dailyTasks.submit", {
    taskId: task.id,
    actorId: player.id,
    actorName: player.name,
    quantity: qty,
  });
}

function showDailyTaskUI(player: Player): void {
  const nav = new MenuNavigator(player);
  nav.section(
    "main",
    "每日任务",
    async (page: { label(s: string): void; button(label: string, cb: () => void): void }) => {
      page.label(ListFormInfo(["完成每日任务获得节操奖励！"]));
      page.button("刷新任务列表", () => nav.rebuild("main"));
      const tasks = await listTasks();
      if (tasks.length === 0) {
        page.label("§7当前没有可用任务。");
        return;
      }
      for (const t of tasks) {
        const remaining = t.target_qty - t.filled_qty;
        if (remaining <= 0) continue;
        const itemType = t.item_type;
        const aux = t.item_aux ?? 0;
        const unitReward = t.unit_reward;
        page.button(`${itemType}\n进度: ${t.filled_qty}/${t.target_qty}  奖励: ${unitReward}§r/个`, () => {
          nav.state.taskId = t.id;
          nav.state.taskItemType = itemType;
          nav.state.taskItemAux = aux;
          nav.state.maxQty = remaining;
          nav.state.unitReward = unitReward;
          nav.go("submit");
        });
      }
    }
  );
  nav.section("submit", "提交任务物品", (page: { label(s: string): void; slider(label: string, obs: unknown, min: number, max: number, opts: { step: number }): void; button(label: string, cb: () => void | Promise<void>): void }) => {
    const status = new FormStatus(page as never);
    const taskId = nav.state.taskId as string | undefined;
    const maxQty = nav.state.maxQty as number | undefined;
    const unitReward = nav.state.unitReward as number | undefined;
    const itemType = nav.state.taskItemType as string | undefined;
    const aux = (nav.state.taskItemAux as number | undefined) ?? 0;
    if (!taskId || !maxQty || !unitReward || !itemType) {
      page.label("任务数据丢失。");
      return;
    }
    const obsQty = obsNum(Math.min(1, maxQty));
    page.label(`物品: ${itemType}\n可提交: ${maxQty}个\n奖励: ${unitReward} §r/个`);
    page.slider("数量", obsQty, 1, maxQty, { step: 1 });
    page.button("提交", async () => {
      const qty = obsQty.getData() as number;
      if (qty <= 0 || qty > maxQty) {
        status.fail("数量无效");
        return;
      }
      try {
        player.runCommand(`clear "${player.name}" ${itemType} ${aux} ${qty}`);
      } catch {
        status.fail("从背包扣除物品失败。");
        return;
      }
      const result = await submitTask(
        { id: taskId, item_type: itemType, item_aux: aux, target_qty: maxQty, filled_qty: 0, unit_reward: unitReward },
        player,
        qty
      );
      if (!result.ok) {
        try {
          player.runCommand(`give "${player.name}" ${itemType} ${qty} ${aux}`);
        } catch {
          /* ignore */
        }
        status.fail(result.error || "提交失败,物品已返还。");
        return;
      }
      if (result.balance !== undefined) {
        Money.setCached(player, result.balance, result.balanceVersion ?? 0);
      }
      status.ok(`提交成功!获得 ${result.reward ?? 0} ${Money.UNIT}`);
      nav.rebuild("main");
    });
  });
  nav.start("main");
}

void world;

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: false,
  lifecycle: {
    registerPermissions() {
      Permission.register("dailytask.use", Permission.Member);
    },
    registerCommands() {
      Command.register(
        "task",
        "dailytask.use",
        (player: Player | undefined) => {
          if (!player) return;
          showDailyTaskUI(player);
        },
        "每日任务",
        "task"
      );
    },
    async init() {
      debug.i("TASK", "DailyTask.init");
    },
    cleanup() {
      debug.i("TASK", "DailyTask.cleanup");
    },
  },
});