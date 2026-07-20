import type { WorldData } from "@sfmc/types";
import { HttpDB } from "@sfmc/sdk/sapi/runtime";

export async function saveWorldData(data: WorldData): Promise<boolean> {
  return HttpDB.post("/api/sfmc/world", { data });
}
