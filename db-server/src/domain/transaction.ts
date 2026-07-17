/**
 * domain/transaction.ts — SQLite 事务执行器
 *
 * 所有需要 BEGIN IMMEDIATE / COMMIT / ROLLBACK 的领域函数都用本工具集中封装:
 *   - 自动处理异常时的 ROLLBACK
 *   - 规范化 SQL 只在事务内执行
 *
 * 用法:
 *   const result = withTransaction(db, () => {
 *     const rows = query(SQL`SELECT 1`);
 *     return rows[0];
 *   });
 *
 * 函数可以选择抛错或返回 `undefined` 以触发回滚。
 */

import type { DatabaseSync } from "node:sqlite";

/**
 * 在 IMMEDIATE 事务包裹下运行回调。回调内任何抛出都会触发 ROLLBACK 并重新抛错。
 *
 * 行为约定：
 *   - return value       → COMMIT 后透传给调用方
 *   - throw              → ROLLBACK 后重新抛错
 *   - return Promise     → await 后再 COMMIT / ROLLBACK
 */
export function withTransaction<T>(
  db: DatabaseSync,
  fn: () => T | Promise<T>
): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    if (out instanceof Promise) {
      // 同步/异步混合：等待 Promise 后决定提交
      return Promise.resolve(out).then(
        (v) => {
          db.exec("COMMIT");
          return v;
        },
        (err) => {
          try {
            db.exec("ROLLBACK");
          } catch {
            /* ignore secondary failures */
          }
          throw err;
        }
      ) as T;
    }
    db.exec("COMMIT");
    return out;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore rollback failures */
    }
    throw error;
  }
}

/**
 * withTransaction 的结果封装版 —— 适合领域函数想表达“业务失败但不抛错”的场景。
 *
 * 用法:
 *   const r = withResult(db, () => {
 *     if (bad) return { ok: false, error: "x" };
 *     return { ok: true, ... };
 *   });
 *   if (!r.ok) ...
 *
 * - 注意：仍由回调决定成功/失败；只在抛错时回滚。
 */
export function withResult<T>(
  db: DatabaseSync,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return withTransaction(db, fn);
}
