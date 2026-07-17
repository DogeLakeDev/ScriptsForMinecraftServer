import type { WorldData } from "@sfmc-types/world.js";
import { HttpDB } from "../libs/HttpDB.js";

export async function saveWorldData(data: WorldData): Promise<boolean> {
  return HttpDB.post("/api/sfmc/world", { data });
}
