import { HttpDB } from "../libs/HttpDB";
import type { WorldData } from "../types";

export async function saveWorldData(data: WorldData): Promise<boolean> {
  return HttpDB.post("/api/sfmc/world", { data });
}
