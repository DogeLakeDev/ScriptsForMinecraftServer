/**
 * lib/idempotency.ts — db.idempotent() 后端
 *
 * 表:sfmc__idempotent  (db-tables.ts 创建)
 * key: (module_id, action, key) → cached value?
 *
 * probe(module_id, action, key):
 *   - 命中 → {replayed:true, cached}
 *   - 不命中 → {replayed:false}
 *
 * commit(module_id, action, key, value?):
 *   - INSERT … (replace) — 即使没 probe 也允许直接 commit
 *
 * 事务内调用一律走 tx-runner 不行(commit 必须在事务外完成,跨事务持久化);
 * 这里单独端点 POST /api/sfmc/db/idempotent/{probe,commit},不走 tx。
 */

import type { DatabaseSync } from "node:sqlite";
import { isValidIdempotencyKey } from "./idempotency.js";

export interface IdempotencyStore {
  probe(moduleId: string, action: string, key: string): Promise<{ replayed: boolean; cached?: unknown }>;
  commit(moduleId: string, action: string, key: string, value?: unknown): Promise<{ ok: boolean }>;
}

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
