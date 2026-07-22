/**
 * land-transfer.ts — 领地转让(走 db.tx)
 *
 * v2 协议:业务逻辑只描述"我想让 db-server 做什么",真实执行在 db-server 进程内。
 * 事务边界由 db.tx() 划定:
 *   - 更新 lands.owner_player_id / owner_name_snapshot
 *   - 写 land_audit_logs(action=transfer)
 *   - 删原 land_members(owner),新增新 owner member 行
 *   - 若新 owner = 当前 player = 自己 = 报错
 *
 * 注:跨模块扣款在 tx 内通过 tx.call('economy.account.debit/credit') 走。
 */

import { db, type TxContext, DbError } from "@sfmc/sdk/sapi/db";

export interface TransferInput {
  landId: string;
  currentOwnerId: string;
  newOwnerId: string;
  newOwnerName: string;
  transferPrice: number;
  requestId: string;
}

export interface TransferResult {
  ok: boolean;
  landId: string;
  newOwnerId: string;
  newBalance?: number;
  error?: string;
  message?: string;
}

export async function transferLand(input: TransferInput): Promise<TransferResult> {
  if (input.currentOwnerId === input.newOwnerId) {
    return { ok: false, landId: input.landId, newOwnerId: input.newOwnerId, error: "self_transfer", message: "不能转让给自己。" };
  }

  try {
    // db.tx 录制器 get→null,必须在事务外读版本/归属(LSP)
    const cur = await db.get<{
      id: string;
      owner_player_id: string;
      version: number;
      status: string;
    }>("lands", input.landId);
    if (!cur) {
      return { ok: false, landId: input.landId, newOwnerId: input.newOwnerId, error: "land_not_found", message: "领地不存在。" };
    }
    if (cur.owner_player_id !== input.currentOwnerId) {
      return { ok: false, landId: input.landId, newOwnerId: input.newOwnerId, error: "not_owner", message: "你不是该领地主人。" };
    }
    if (cur.status && cur.status !== "active") {
      return { ok: false, landId: input.landId, newOwnerId: input.newOwnerId, error: "inactive", message: "领地不可转让。" };
    }

    return await db.tx(async (tx) => {
      return runTransferSteps(tx, input, Number(cur.version ?? 0));
    });
  } catch (e) {
    if (e instanceof DbError) {
      return { ok: false, landId: input.landId, newOwnerId: input.newOwnerId, error: e.code, message: e.message };
    }
    throw e;
  }
}

async function runTransferSteps(tx: TxContext, input: TransferInput, landVersion: number): Promise<TransferResult> {
  const now = Date.now();
  const oldMemberId = synthMemberId(input.landId, input.currentOwnerId);
  const newMemberId = synthMemberId(input.landId, input.newOwnerId);

  // 1. 删原 owner 成员行(读校验已在 tx 外完成;录制器 get 不可用于分支)
  await tx.delete("land_members", oldMemberId);

  // 2. 写新 owner 成员行
  await tx.insert("land_members", {
    id: newMemberId,
    land_id: input.landId,
    player_id: input.newOwnerId,
    player_name_snapshot: input.newOwnerName,
    role: "admin",
    created_at: now,
  });

  // 3. 更新 land owner
  await tx.update("lands", input.landId, {
    owner_player_id: input.newOwnerId,
    owner_name_snapshot: input.newOwnerName,
    version: landVersion + 1,
    updated_at: now,
  });

  // 4. 写审计
  await tx.audit("lands", input.landId, "transfer", {
    from: input.currentOwnerId,
    to: input.newOwnerId,
    price: input.transferPrice,
    requestId: input.requestId,
  });

  // 5. 写 land_operations(idempotency 兜底)
  await tx.insert("land_operations", {
    request_id: input.requestId,
    operation_type: "transfer",
    actor_id: input.currentOwnerId,
    land_id: input.landId,
    status: "pending",
    response_json: JSON.stringify({ to: input.newOwnerId }),
    created_at: now,
  });

  // 6. 跨模块:扣款 + 加款
  if (input.transferPrice > 0) {
    await tx.call("economy.account.debit", {
      playerId: input.currentOwnerId,
      amount: input.transferPrice,
      reason: `land.transfer:${input.landId}`,
    });
    await tx.call("economy.account.credit", {
      playerId: input.newOwnerId,
      amount: input.transferPrice,
      reason: `land.transfer.receive:${input.landId}`,
    });
  }

  return {
    ok: true,
    landId: input.landId,
    newOwnerId: input.newOwnerId,
  };
}

function synthMemberId(landId: string, playerId: string): string {
  // 简单 hash:landId|playerId → 16 字符 (用 djb2)
  let hash = 5381;
  const s = `${landId}|${playerId}`;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `lm_${hex}`;
}