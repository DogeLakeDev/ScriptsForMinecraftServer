import { HttpDB } from "../libs/HttpDB";

export async function getAllKV(): Promise<{ key: string; value: string }[] | null> {
  const body = await HttpDB.get("/api/kv");
  if (!body) return null;
  try {
    return JSON.parse(body).kv;
  } catch {
    return null;
  }
}

export async function getKV(key: string): Promise<any | null> {
  const body = await HttpDB.get(`/api/kv/${encodeURIComponent(key)}`);
  if (!body) return null;
  try {
    return JSON.parse(body).value;
  } catch {
    return null;
  }
}

export async function setKV(key: string, value: string): Promise<boolean> {
  return HttpDB.post("/api/kv/save", { key, value });
}

export async function deleteKV(key: string): Promise<boolean> {
  return HttpDB.del(`/api/kv/${encodeURIComponent(key)}`);
}
