/* ---------------------------------------- *\
 *  Name        :  ScoreboardsData           *
 *  Description :  世界计分板数据的收集 保存 恢复 *
 *  Version     :  1.0.0                    *
 *  Author      :  Shiroha7z                *
\* ---------------------------------------- */

import { Player, world } from "@minecraft/server";
import { Command, debug, HttpDB, Msg, Permission } from "@sfmc/sdk/sapi/runtime";

export interface ScoreboardEntry {
  id: string;
  displayName: string;
  participants: Array<{ id: number; type: number; name: string; score: number }>;
}

async function backupScoreboards(entries: ScoreboardEntry[]): Promise<void> {
  const payload = entries.map((e) => ({
    objectiveId: e.id,
    objectiveDisplay: e.displayName,
    participantIds: e.participants,
  }));
  await HttpDB.post("/api/sfmc/scoreboards", { entries: payload });
}

async function loadScoreboards(): Promise<unknown[]> {
  const body = await HttpDB.get("/api/sfmc/scoreboards");
  const entries = (body as { entries?: unknown[] })?.entries ?? [];
  return entries;
}

export function ScoreboardsBackup(): void {
  debug.i("DATA", "ScoreboardsBackup");
  const entries: ScoreboardEntry[] = [];
  for (const obj of world.scoreboard.getObjectives()) {
    const entry: ScoreboardEntry = {
      id: obj.id,
      displayName: obj.displayName,
      participants: [],
    };
    for (const info of obj.getScores()) {
      const identity = info.participant;
      const participants = entry.participants ?? [];
      participants.push({
        id: identity.id,
        type: Number(identity.type) || 0,
        name: identity.displayName,
        score: info.score,
      });
      entry.participants = participants;
    }
    entries.push(entry);
  }
  backupScoreboards(entries);
}

export class ScoreboardSync {
  static registerCommands(): void {
    Permission.register("scoreboard.restore", Permission.Admin);
    Command.register(
      "scoreboard restore",
      "scoreboard.restore",
      async (player: Player | undefined) => {
        const result = await this.load();
        const message = `计分板恢复完成：成功 ${result.success}，失败 ${result.fail}`;
        if (player) Msg.info(message, player);
        else world.sendMessage(message);
      },
      "从数据库恢复计分板",
      "scoreboardSync"
    );
  }

  static init(): void {
    debug.i("DATA", "ScoreboardSync.init");
    // 启动时只备份当前世界；恢复必须由管理员显式触发。
    ScoreboardsBackup();
    console.info("[ScoreboardSync] 计分板同步已初始化");
  }

  /** 恢复：db-server → 游戏 */
  static async load(): Promise<{ success: number; fail: number }> {
    debug.i("DATA", "ScoreboardSync.load");
    try {
      const entries = await loadScoreboards();
      if (!entries || entries.length === 0) {
        console.info("[ScoreboardSync] 数据库无计分板数据");
        return { success: 0, fail: 0 };
      }

      let success = 0;
      let fail = 0;

      // 按 objective_id 分组
      const groups = new Map<string, any[]>();
      for (const e of entries as any[]) {
        const list = groups.get(e.objective_id) || [];
        list.push(e);
        groups.set(e.objective_id, list);
      }

      for (const [objId, objEntries] of groups) {
        // 确保记分项存在
        let objective = world.scoreboard.getObjective(objId);
        if (!objective) {
          try {
            objective = world.scoreboard.addObjective(objId, objEntries[0].objective_display || objId);
          } catch (err) {
            console.warn(`[ScoreboardSync] 无法创建记分项 "${objId}"：${err}`);
            fail += objEntries.length;
            continue;
          }
        }

        for (const e of objEntries) {
          try {
            // Player 类型：优先用 id 匹配在线玩家
            if (e.participant_type === "Player" && e.id) {
              const player = [...world.getPlayers()].find((p) => p.id === e.id);
              if (player?.scoreboardIdentity) {
                objective.setScore(player.scoreboardIdentity, e.score);
                success++;
                continue;
              }
            }

            // Fallback：直接用参与者名称字符串（兼容 FakePlayer / 离线玩家）
            objective.setScore(e.participant_name || `#${e.participant_id}`, e.score);
            success++;
          } catch {
            fail++;
          }
        }
      }

      console.info(`[ScoreboardSync] 恢复完成：成功 ${success}，失败 ${fail}`);
      return { success, fail };
    } catch (err) {
      console.error(`[ScoreboardSync] 恢复出错：${err}`);
      return { success: 0, fail: 0 };
    }
  }
}