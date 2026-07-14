import { HttpDB } from "../libs/HttpDB";

export interface EconomyAccount { playerId: string; playerName: string; balance: number; version: number; }

function parseAccount(body: string | null): EconomyAccount | null {
  if (!body) return null;
  try { return JSON.parse(body).account || null; } catch { return null; }
}

export async function getEconomyAccount(playerId: string, playerName?: string): Promise<EconomyAccount | null> {
  const query = `?playerId=${encodeURIComponent(playerId)}${playerName ? `&playerName=${encodeURIComponent(playerName)}` : ""}`;
  return parseAccount(await HttpDB.get(`/api/sfmc/economy/account${query}`));
}

export async function applyEconomyTransaction(data: Record<string, unknown>): Promise<{ ok: boolean; balance?: number; version?: number; transactionId?: string; error?: string }> {
  const result = await HttpDB.requestJSON("Post", "/api/sfmc/economy/account", data);
  try {
    const parsed = JSON.parse(result.body);
    const account = parsed.source ?? parsed.target;
    return { ok: result.status === 200, balance: account?.balance, version: account?.version, transactionId: parsed.transactionId, error: parsed.error };
  } catch { return { ok: false, error: "invalid_response" }; }
}

export async function transferEconomy(actorId: string, targetPlayerId: string, amount: number, targetPlayerName?: string): Promise<boolean> {
  const result = await HttpDB.requestJSON("Post", "/api/sfmc/economy/transfer", { actorId, targetPlayerId, targetPlayerName, amount });
  return result.status === 200;
}
