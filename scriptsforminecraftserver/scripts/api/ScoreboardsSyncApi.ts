import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";
import type { ScoreboardEntry } from "../types";
export type { ScoreboardEntry };

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
