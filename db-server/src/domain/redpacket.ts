/**
 * domain/redpacket.ts — 红包业务核心
 *
 * 把 routes/redpacket.ts 中的 BEGIN IMMEDIATE 块全部搬到本文件。
 * 所有 SQL 走 SQL`` 模板字符串;事务由 withTransaction 包裹。
 * 路由文件只负责请求 → 调领域函数 → 序列化响应,不再直接接触 db / SQL。
 *
 * 事务描述 (Tx*):
 *   - createRedpacketTx  创建红包
 *                        流程:校验 sender/amount → 扣 sender 余额(带余额守护) →
 *                              INSERT redpacket → INSERT economy tx log (dr) →
 *                              返回 transactionId + 更新后账户视图
 *   - claimRedpacketTx   领取红包
 *                        流程:校验存在/未过期/未领完/未重复 → computeClaimAmount
 *                              (剩余 1 全分,否则在 [min, max] 随机) →
 *                              乐观锁 UPDATE redpacket(remaining_amount/count) →
 *                              增领取者余额 → INSERT economy tx log (cr)
 *
 * 领域辅助 (查询 / 删除,不走事务):
 *   - listRedpackets         列出所有红包(按 created_at DESC)
 *   - findRedpacketById      按 id 查单条
 *   - deleteRedpacket        DELETE 单条
 *   - computeClaimAmount     分配算法(纯函数)
 *   - buildPacketInsert      构造 INSERT SQL(校验失败返回 { error })
 *
 * 依赖:
 *   - economy.ts:ensureEconomyAccount / economyResult(账户 upsert + 视图转换)
 *   - transaction.ts:withTransaction / TxResult(事务执行器 + 统一返回类型)
 */

import type { DatabaseSync } from "node:sqlite";
import { SQL, type SQLStatement } from "sql-template-strings";

import type { AnyQuery, EconomyAccountView } from "./economy.js";
import { ensureEconomyAccount, economyResult } from "./economy.js";
import { withTransaction } from "./transaction.js";
import type { TxResult } from "./transaction.js";

const TABLE_PACKETS = "sfmc_chat_redpackets";
const TABLE_ACCOUNTS = "sfmc_economy_accounts";
const TABLE_TX = "sfmc_economy_transactions";

// TxResult 已移至 transaction.ts（避免跨域循环依赖），此处 re-export 保持向后兼容。
export type { TxResult };

function newTxId(now: number): string {
  return `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// ensureEconomyAccount / economyResult 直接用 economy 层定义；这里不再 re-export

/** 构造 INSERT 红包行的 SQL；失败的字段拼装返回 invalid 错误 */
function buildPacketInsert(rp: Record<string, unknown>): SQLStatement | { error: string } {
  const totalAmount = Number(rp.totalAmount);
  const remainingAmount = Number(rp.remainingAmount ?? totalAmount);
  const totalCount = Number(rp.totalCount);
  const remainingCount = Number(rp.remainingCount ?? totalCount);
  const createdAt = Number(rp.createdAt ?? Date.now());
  const expiresAt = Number(rp.expiresAt ?? Date.now() + 24 * 3600_000);

  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) return { error: "invalid" };
  if (!rp.senderid || String(rp.senderid) !== String(rp.actorId ?? rp.senderid)) return { error: "invalid" };
  if (!rp.id) return { error: "invalid" };

  return SQL`
    INSERT INTO ${TABLE_PACKETS} (
      id, sender_id, sender_name, total_amount, remaining_amount,
      total_count, remaining_count, receivers, target_type, target_id, created_at, expires_at
    ) VALUES (
      ${String(rp.id)}, ${String(rp.senderid)}, ${String(rp.senderName ?? "")},
      ${totalAmount}, ${remainingAmount},
      ${totalCount}, ${remainingCount},
      ${JSON.stringify(rp.receivers ?? [])}, ${String(rp.targetType ?? "")}, ${String(rp.targetId ?? "")},
      ${createdAt}, ${expiresAt}
    )
  `;
}

/**
 * 创建一个红包（事务域）
 *  - 校验 sender / amount
 *  - 扣 sender 余额（带余额守护）
 *  - INSERT 红包
 *  - INSERT economy transaction log (dr)
 */
export function createRedpacketTx(
  query: AnyQuery,
  db: DatabaseSync,
  rp: Record<string, unknown>
): TxResult<{ transactionId: string; account: EconomyAccountView | undefined }> {
  const insertOrError = buildPacketInsert(rp);
  if ("error" in insertOrError) {
    return { ok: false, error: insertOrError.error, status: 400 };
  }
  const senderId = String(rp.senderid);
  const senderName = String(rp.senderName ?? "");
  const totalAmount = Number(rp.totalAmount);

  return withTransaction(db, () => {
    const account = ensureEconomyAccount(query, senderId, senderName);
    if (!account) {
      return { ok: false, error: "ensure_account_failed", status: 500 };
    }
    if (account.balance < totalAmount) {
      return {
        ok: false,
        error: "insufficient_funds",
        status: 409,
        extra: { balance: account.balance },
      };
    }
    const now = Date.now();
    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
          SET balance = balance - ${totalAmount},
              version = version + 1,
              updated_at = ${now}
          WHERE player_id = ${senderId} AND balance >= ${totalAmount}`
    );
    query(insertOrError);
    const tx = newTxId(now);
    query(
      SQL`INSERT INTO ${TABLE_TX}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
          VALUES (${tx}, ${"redpacket.create"}, ${senderId}, ${senderId}, ${null},
                  ${totalAmount}, ${account.balance}, ${account.balance - totalAmount},
                  ${"redpacket"}, ${String(rp.id)}, ${"发送红包"}, ${now})`
    );
    const refreshed = economyResult(ensureEconomyAccount(query, senderId, senderName));
    return { ok: true, data: { transactionId: tx, account: refreshed } };
  });
}

/** 分配领取金额：剩余 1 → 全部分配；否则剩余/未分配范围内的随机 */
function computeClaimAmount(remainingAmount: number, remainingCount: number): number {
  if (remainingCount <= 1) return remainingAmount;
  const base = Math.floor(remainingAmount / remainingCount);
  const min = Math.max(1, remainingAmount - (remainingCount - 1));
  const max = Math.max(min, base * 2);
  return Math.max(min, Math.min(max, Math.floor(Math.random() * (max + 1))));
}

/**
 * 领取一个红包（事务域）
 *  - 校验存在性 / 未过期 / 未领完 / 未重复
 *  - 计算 amount
 *  - UPDATE 红包剩余数 + 收件人列表
 *  - UPDATE 领取者余额
 *  - INSERT economy tx log (cr)
 */
export function claimRedpacketTx(
  query: AnyQuery,
  db: DatabaseSync,
  packetId: string,
  actorId: string,
  actorName: string
): TxResult<{ amount: number; transactionId: string; account: EconomyAccountView | undefined }> {
  return withTransaction(db, () => {
    const rows = query(SQL`SELECT * FROM ${TABLE_PACKETS} WHERE id = ${packetId}`) as Array<
      Record<string, unknown>
    >;
    const packet = rows[0];
    if (!packet) return { ok: false, error: "redpacket_not_found", status: 404 };

    const remainingCount = Number(packet.remaining_count ?? 0);
    const remainingAmount = Number(packet.remaining_amount ?? 0);
    const expiresAt = Number(packet.expires_at ?? 0);
    if (remainingCount <= 0) return { ok: false, error: "redpacket_empty", status: 409 };
    if (Date.now() > expiresAt) return { ok: false, error: "redpacket_expired", status: 409 };

    const receivers: string[] = (() => {
      try {
        const parsed = JSON.parse(String(packet.receivers ?? "[]"));
        return Array.isArray(parsed) ? (parsed as string[]) : [];
      } catch {
        return [];
      }
    })();
    if (receivers.includes(actorId)) {
      return { ok: false, error: "already_claimed", status: 409 };
    }
    const amount = computeClaimAmount(remainingAmount, remainingCount);

    const now = Date.now();
    query(
      SQL`UPDATE ${TABLE_PACKETS}
          SET remaining_amount = ${remainingAmount - amount},
              remaining_count = ${remainingCount - 1},
              receivers = ${JSON.stringify([...receivers, actorId])},
              updated_at = ${now}
          WHERE id = ${packetId} AND remaining_count = ${remainingCount}`
    );
    const account = ensureEconomyAccount(query, actorId, actorName);
    if (!account) return { ok: false, error: "ensure_account_failed", status: 500 };

    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
          SET balance = balance + ${amount},
              version = version + 1,
              updated_at = ${now}
          WHERE player_id = ${actorId}`
    );
    const tx = newTxId(now);
    query(
      SQL`INSERT INTO ${TABLE_TX}
          (id, transaction_type, actor_id, source_player_id, target_player_id,
           amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
          VALUES (${tx}, ${"redpacket.claim"}, ${actorId}, ${null}, ${actorId},
                  ${amount}, ${account.balance}, ${account.balance + amount},
                  ${"redpacket"}, ${packetId}, ${"领取红包"}, ${now})`
    );
    const refreshed = economyResult(ensureEconomyAccount(query, actorId, actorName));
    return { ok: true, data: { amount, transactionId: tx, account: refreshed } };
  });
}

/** 单条 SQL 读取：列出所有红包 */
export function listRedpackets(query: AnyQuery): unknown[] {
  const rows = query(SQL`SELECT * FROM ${TABLE_PACKETS} ORDER BY created_at DESC`);
  return Array.isArray(rows) ? rows : [];
}

/** 单条 SQL 读取：按 id 查一个红包 */
export function findRedpacketById(query: AnyQuery, id: string): unknown | null {
  const rows = query(SQL`SELECT * FROM ${TABLE_PACKETS} WHERE id = ${id}`);
  const list = Array.isArray(rows) ? (rows as unknown[]) : [];
  return list[0] ?? null;
}

/** 单条 SQL 写入：删除一个红包 */
export function deleteRedpacket(query: AnyQuery, id: string): void {
  query(SQL`DELETE FROM ${TABLE_PACKETS} WHERE id = ${id}`);
}
