import { HttpDB } from "../libs/HttpDB";
import { toQueryString } from "../libs/Tools";

export async function batchActivities(entries: any[]): Promise<boolean> {
  return HttpDB.post("/api/sfmc/activities/batch", { entries });
}

export async function queryActivities(filter?: {
  id?: string;
  event?: string;
  from?: number;
  to?: number;
  name?: string;
  limit?: number;
  offset?: number;
}): Promise<any[] | null> {
  const qs = toQueryString({
    id: filter?.id,
    event: filter?.event,
    from: filter?.from,
    to: filter?.to,
    name: filter?.name,
    limit: filter?.limit,
    offset: filter?.offset,
  });
  const body = await HttpDB.get(`/api/sfmc/activities${qs}`);
  if (!body) return null;
  try {
    return JSON.parse(body).entries;
  } catch {
    return null;
  }
}

export async function getActivityStats(filter?: { id?: string; from?: number; to?: number }): Promise<any | null> {
  const qs = toQueryString({
    id: filter?.id,
    from: filter?.from,
    to: filter?.to,
  });
  const body = await HttpDB.get(`/api/sfmc/activities/stats${qs}`);
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export async function cleanupActivities(keepDays: number = 30, keepAdmin: boolean = true): Promise<boolean> {
  return HttpDB.post("/api/sfmc/activities/cleanup", { keepDays, keepAdmin });
}
