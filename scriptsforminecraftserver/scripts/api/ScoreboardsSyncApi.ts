import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
import { ScoreboardIdentityType } from "@minecraft/server";

export interface ScoreboardEntry {
  id: string;
  displayName: string;
  participants?: Participant[];
}

export interface Participant {
  id: number;
  type: ScoreboardIdentityType;
  name: string;
  score: number;
}

export async function backupScoreboards(entries: ScoreboardEntry[]): Promise<boolean> {
  return HttpDB.post("/api/sfmc/scoreboards", { entries });
}

export async function loadScoreboards(filter?: {
  objective?: string;
  name?: string;
  id?: string;
}): Promise<ScoreboardEntry[] | null> {
  const qs = toQueryString({
    objective: filter?.objective,
    name: filter?.name,
    id: filter?.id,
  });
  const body = await HttpDB.get(`/api/sfmc/scoreboards${qs}`);
  if (!body) return null;
  try {
    return JSON.parse(body).entries;
  } catch {
    return null;
  }
}

export async function getScoreboardObjectives(): Promise<any[] | null> {
  const body = await HttpDB.get("/api/sfmc/scoreboards/objectives");
  if (!body) return null;
  try {
    return JSON.parse(body).objectives;
  } catch {
    return null;
  }
}

export async function clearScoreboards(): Promise<boolean> {
  return HttpDB.del("/api/sfmc/scoreboards");
}
