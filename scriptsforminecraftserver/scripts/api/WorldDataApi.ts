import { HttpDB } from "../libs/HttpDB";
import { WorldData } from "../data/World";

export async function saveWorldData(data: WorldData): Promise<boolean> {
  return HttpDB.post("/api/sfmc/world", { data });
}

export async function getWorldData(): Promise<WorldData | null> {
  const body = await HttpDB.get("/api/sfmc/world");
  if (!body) return null;
  try {
    return JSON.parse(body).world;
  } catch {
    return null;
  }
}
