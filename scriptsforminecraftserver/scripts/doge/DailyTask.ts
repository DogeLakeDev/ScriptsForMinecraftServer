/* ---------------------------------------- *\
 *  Name        :  ActivityLog              *
 *  Description :  行为日志                  *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { Player } from "@minecraft/server";
import { getDailyTasks, submitDailyTask } from "../api/EconomyApi.js";
import { Command } from "../libs/Command.js";
import { debug } from "../libs/DebugLog.js";
import { Money } from "../libs/Economy.js";
import { FormStatus, MenuNavigator, obsNum } from "../libs/MenuNavigator.js";
import { Permission } from "../libs/Permission.js";
import { ListFormInfo } from "../libs/Tools.js";

export class DailyTask {
  static registerCommand() {
    debug.i("TASK", "DailyTask.registerCommand");
    Permission.register("dailytask.use", Permission.Member);
    Command.register(
      "task",
      "dailytask.use",
      (player: Player | undefined) => {
        if (!player) return;
        new DailyTask().show(player);
      },
      "每日任务",
      "task"
    );
  }

  private show(player: Player): void {
    debug.i("TASK", `DailyTask.show: player=${player.name}`);
    const nav = new MenuNavigator(player);
    nav.section("main", "每日任务", async (page) => {
      const status = new FormStatus(page);
      page.label(ListFormInfo(["完成每日任务获得节操奖励！"]));
      page.button("刷新任务列表", () => nav.rebuild("main"));
      const result = await getDailyTasks();
      const tasks = result?.tasks || [];
      if (tasks.length === 0) {
        page.label("§7当前没有可用任务。");
      } else {
        for (const t of tasks) {
          const remaining = t.target_qty - t.filled_qty;
          if (remaining <= 0) continue;
          page.button(`${t.item_type}\n进度: ${t.filled_qty}/${t.target_qty}  奖励: ${t.unit_reward}§r/个`, () => {
            nav.state.taskId = t.id;
            nav.state.taskItemType = t.item_type;
            nav.state.taskItemAux = t.item_aux || 0;
            nav.state.maxQty = remaining;
            nav.state.unitReward = t.unit_reward;
            nav.go("submit");
          });
        }
      }
    });
    nav.section("submit", "提交任务物品", (page) => {
      const status = new FormStatus(page);
      const taskId = nav.state.taskId as string;
      const maxQty = nav.state.maxQty as number;
      const unitReward = nav.state.unitReward as number;
      const itemType = nav.state.taskItemType as string;
      if (!taskId || maxQty <= 0) {
        page.label("任务数据丢失。");
        return;
      }
      const obsQty = obsNum(Math.min(1, maxQty));
      page.label(`物品: ${itemType}\n可提交: ${maxQty}个\n奖励: ${unitReward} §r/个`);
      page.slider("数量", obsQty, 1, maxQty, { step: 1 });
      page.button("提交", async () => {
        const qty = obsQty.getData();
        if (qty <= 0 || qty > maxQty) {
          status.fail("数量无效");
          return;
        }
        try {
          player.runCommand(`clear "${player.name}" ${itemType} ${nav.state.taskItemAux || 0} ${qty}`);
        } catch {
          status.fail("从背包扣除物品失败。");
          return;
        }
        const result = await submitDailyTask(taskId, player.id, player.name, qty);
        if (!result.ok) {
          try {
            player.runCommand(`give "${player.name}" ${itemType} ${qty} ${nav.state.taskItemAux || 0}`);
          } catch {}
          status.fail(result.error || "提交失败，物品已返还。");
          return;
        }
        if (result.balance !== undefined) Money.setCached(player, result.balance, result.balanceVersion);
        status.ok(`提交成功！获得 ${result.reward} ${Money.UNIT}`);
        nav.rebuild("main");
      });
    });
    nav.start("main");
  }
}
