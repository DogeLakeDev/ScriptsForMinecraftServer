import { HttpRequestMethod } from "@minecraft/server-net";
import type { EconomyAccountRow } from "@sfmc/types";
import { debug } from "@sfmc/sdk/sapi/runtime";
import { HttpDB } from "@sfmc/sdk/sapi/runtime";

function parseAccount(body: string | null): EconomyAccountRow | null {
  if (!body) return null;
  try {
    return JSON.parse(body).account || null;
  } catch {
    return null;
  }
}

export async function getEconomyAccount(playerId: string, playerName?: string): Promise<EconomyAccountRow | null> {
  debug.i("API", `getEconomyAccount: playerId=${playerId}`);
  const query = `?playerId=${encodeURIComponent(playerId)}${playerName ? `&playerName=${encodeURIComponent(playerName)}` : ""}`;
  return parseAccount(await HttpDB.get(`/api/sfmc/economy/account${query}`));
}

export async function applyEconomyTransaction(data: Record<string, unknown>): Promise<{
  ok: boolean;
  balance?: number;
  balanceBefore?: number;
  balanceAfter?: number;
  version?: number;
  transactionId?: string;
  error?: string;
}> {
  debug.i("API", `applyEconomyTransaction: playerId=${data.playerId} amount=${data.amount}`);
  const result = await HttpDB.typedRequest(HttpRequestMethod.POST, "/api/sfmc/economy/account", data);
  if (!result.ok) {
    debug.e("API", `applyEconomyTransaction failed: ${result.error}`);
    return { ok: false, error: result.error || "request_failed" };
  }
  const account = (result.data as any)?.source ?? (result.data as any)?.target;
  return {
    ok: true,
    balance: account?.balance,
    balanceBefore: account?.balanceBefore,
    balanceAfter: account?.balanceAfter,
    version: account?.version,
    transactionId: (result.data as any)?.transactionId,
  };
}

export async function getDailyTasks(): Promise<{ tasks: any[] } | null> {
  debug.i("API", "getDailyTasks");
  const result = await HttpDB.typedRequest(HttpRequestMethod.GET, "/api/sfmc/economy/daily-tasks");
  return result.ok ? (result.data as any) : null;
}

export async function submitDailyTask(
  taskId: string,
  actorId: string,
  actorName: string,
  quantity: number
): Promise<{
  ok: boolean;
  reward?: number;
  balance?: number;
  balanceVersion?: number;
  error?: string;
}> {
  debug.i("API", `submitDailyTask: taskId=${taskId} actor=${actorName} qty=${quantity}`);
  const result = await HttpDB.typedRequest(
    HttpRequestMethod.POST,
    `/api/sfmc/economy/daily-tasks/${encodeURIComponent(taskId)}/submit`,
    { actorId, actorName, quantity }
  );
  if (!result.ok) return { ok: false, error: result.error || "submit_failed" };
  const d = result.data as any;
  return {
    ok: true,
    reward: d.reward,
    balance: d.balance,
    balanceVersion: d.balanceVersion,
    error: d.error,
  };
}

export async function transferEconomy(
  actorId: string,
  targetPlayerId: string,
  amount: number,
  targetPlayerName?: string
): Promise<{ ok: boolean; error?: string | undefined }> {
  debug.i("API", `transferEconomy: from=${actorId} to=${targetPlayerId} amount=${amount}`);
  const result = await HttpDB.typedRequest(HttpRequestMethod.POST, "/api/sfmc/economy/transfer", {
    actorId,
    targetPlayerId,
    targetPlayerName,
    amount,
  });
  return { ok: result.ok, error: result.error };
}
