/**
 * lib/idempotency-store.ts — 幂等操作底层持久化存储
 *
 * 底层表：`sfmc__idempotent`
 * 主键复合维度：`module_id` + `action` + `key`
 *
 * 探针机制：
 * - `probe(moduleId, action, key)`：探测是否已执行过；命中则返回 `{ replayed: true, cached }`，未命中返回 `{ replayed: false }`
 * - `commit(moduleId, action, key, value?)`：写入成功执行记录与缓存结果
 *
 * 事务与持久化边界：
 * 幂等提交独立于单次业务事务，确保跨事务持久化去重。
 */

import type { DatabaseSync } from "node:sqlite";
import { isValidIdempotencyKey } from "./idempotency.js";

/** 幂等存储器接口。 */
export interface IdempotencyStore {
  /** 探测指定的动作与幂等键是否已经执行过。 */
  probe(moduleId: string, action: string, key: string): Promise<{ replayed: boolean; cached?: unknown }>;
  /** 提交并持久化已执行的幂等动作与结果数据。 */
  commit(moduleId: string, action: string, key: string, value?: unknown): Promise<{ ok: boolean }>;
}

/**
 * 创建基于 SQLite 的幂等存储操作实例。
 *
 * @param db SQLite 数据库连接。
 * @returns 幂等存储器对象。
 */
export function createIdempotencyStore(db: DatabaseSync): IdempotencyStore {

  const probeStmt = db.prepare(
    "SELECT value FROM sfmc__idempotent WHERE module_id=? AND action=? AND key=?"
  );
  const insertStmt = db.prepare(
    `INSERT OR REPLACE INTO sfmc__idempotent (module_id, action, key, value, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  return {
    async probe(moduleId, action, key) {
      if (!isValidIdempotencyKey(key)) throw new Error("invalid idempotency key");
      const row = probeStmt.get(moduleId, action, key) as { value: string | null } | undefined;
      if (!row) return { replayed: false };
      let cached: unknown = null;
      if (row.value) {
        try {
          cached = JSON.parse(row.value);
        } catch {
          cached = row.value;
        }
      }
      return { replayed: true, cached };
    },

    async commit(moduleId, action, key, value?) {
      if (!isValidIdempotencyKey(key)) throw new Error("invalid idempotency key");
      const json = value === undefined ? null : JSON.stringify(value);
      insertStmt.run(moduleId, action, key, json, new Date().toISOString());
      return { ok: true };
    },
  };
}
