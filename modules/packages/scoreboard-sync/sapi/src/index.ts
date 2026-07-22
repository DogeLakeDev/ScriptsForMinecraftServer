/**
 * @sfmc/module-scoreboard-sync — v2 入口
 *
 * 计分板备份/恢复:db.tx 读写平台表 sfmc_scoreboards。
 */

import { Player, system, world } from "@minecraft/server";
import { db } from "@sfmc/sdk/sapi/db";
import { Command, debug, Msg, Permission } from "@sfmc/sdk/sapi/runtime";
import { ModuleRegistry } from "@sfmc/sdk/module-loader";

const MODULE_ID = "feature-scoreboard-sync";

interface ScoreboardColumnDef {
  type: "TEXT" | "INTEGER" | "REAL" | "BLOB";
  primary?: boolean;
  notNull?: boolean;
  default?: string | number;
}

async function backupWorldScoreboards(): Promise<void> {
  const entries: Array<Record<string, unknown>> = [];
  for (const obj of world.scoreboard.getObjectives()) {
    for (const info of obj.getScores()) {
      const identity = info.participant;
      entries.push({
        objective_id: obj.id,
        objective_display: obj.displayName,
        participant_id: identity.id,
        participant_type: String(identity.type),
        participant_name: identity.displayName,
        score: info.score,
        updated_at: Date.now(),
      });
    }
  }
  if (entries.length === 0) return;
  const now = Date.now();
  await db.tx(async (tx) => {
    for (const e of entries) {
      await tx.insert("sfmc_scoreboards", { ...e, updated_at: now });
    }
  });
  debug.i("ScoreboardSync", `backed up ${entries.length} score rows`);
}

async function restoreFromDb(): Promise<{ success: number; fail: number }> {
  const rows = await db.query<{
    objective_id: string;
    objective_display: string;
    participant_id: number;
    participant_type: string;
    participant_name: string;
    score: number;
  }>("sfmc_scoreboards", {});
  if (rows.length === 0) {
    return { success: 0, fail: 0 };
  }
  let success = 0;
  let fail = 0;
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = groups.get(r.objective_id) ?? [];
    list.push(r);
    groups.set(r.objective_id, list);
  }
  for (const [objId, objEntries] of groups) {
    let objective = world.scoreboard.getObjective(objId);
    if (!objective) {
      try {
        objective = world.scoreboard.addObjective(objId, objEntries[0]?.objective_display || objId);
      } catch (err) {
        console.warn(`[ScoreboardSync] cannot create objective "${objId}": ${err}`);
        fail += objEntries.length;
        continue;
      }
    }
    for (const e of objEntries) {
      try {
        if (e.participant_type === "Player" && e.participant_id) {
          const player = [...world.getPlayers()].find((p) => p.id === String(e.participant_id));
          if (player?.scoreboardIdentity) {
            objective.setScore(player.scoreboardIdentity, e.score);
            success++;
            continue;
          }
        }
        objective.setScore(e.participant_name || `#${e.participant_id}`, e.score);
        success++;
      } catch {
        fail++;
      }
    }
  }
  return { success, fail };
}

void (null as unknown as ScoreboardColumnDef);

let backupTimer: number | undefined;

ModuleRegistry.register({
  id: MODULE_ID,
  afterWorldLoad: true,
  lifecycle: {
    registerPermissions() {
      Permission.register("scoreboard.restore", Permission.Admin);
    },
    async init() {
      try {
        await backupWorldScoreboards();
        console.info("[ScoreboardSync] initial backup complete");
      } catch (err) {
        console.warn(`[ScoreboardSync] initial backup failed: ${(err as Error).message}`);
      }
      backupTimer = system.runInterval(() => void backupWorldScoreboards(), 6000);
      debug.i("ScoreboardSync", "init");
    },
    registerCommands() {
      Command.register(
        "scoreboard restore",
        "scoreboard.restore",
        async (player: Player | undefined) => {
          const result = await restoreFromDb();
          const message = `§7计分板恢复完成:成功 §a${result.success}§7,失败 §c${result.fail}`;
          if (player) {
            Msg.info(message, player);
          } else {
            world.sendMessage(message);
          }
        },
        "从数据库恢复计分板",
        "scoreboardSync"
      );
    },
    cleanup() {
      if (backupTimer !== undefined) {
        try {
          system.clearRun(backupTimer);
        } catch {
          /* ignore */
        }
        backupTimer = undefined;
      }
      debug.i("ScoreboardSync", "stop");
    },
  },
});