/**
 * economy.ts — 经济系统 共享数据模型
 */

export interface EconomyAccountRow {
  player_id: string;
  player_name_snapshot: string;
  balance: number;
  version: number;
  created_at: number;
  updated_at: number;
}

export interface EconomyIdempotencyRow {
  actor_id: string;
  idempotency_key: string;
  transaction_id: string;
  response_json: string;
  created_at: number;
}

export interface EconomyTransactionRow {
  id: string;
  transaction_type: string;
  actor_id: string;
  source_player_id?: string;
  target_player_id?: string;
  amount: number;
  balance_before?: number;
  balance_after?: number;
  reference_type: string;
  reference_id: string;
  reason: string;
  created_at: number;
  idempotency_key: string;

  /** JS-side alias fields used by domain/economy.ts */
  actorId?: string;
  type?: string;
  referenceType?: string;
  referenceId?: string;
  sourcePlayerName?: string;
  targetPlayerName?: string;
}
