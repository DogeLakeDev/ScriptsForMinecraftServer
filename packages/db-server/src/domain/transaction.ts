/**
 * domain/transaction.ts — SQLite 事务执行器 + 共享业务结果类型
 *
 * 事务描述:
 *   - withTransaction(db, fn)   IMMEDIATE 事务包裹器
 *                                自动 BEGIN IMMEDIATE / COMMIT / ROLLBACK,
 *                                异常时 ROLLBACK 并重新抛错;支持同步 + async 回调
 *   - withResult(db, fn)        withTransaction 的语义别名(供"业务失败但不抛错"
 *                                的场景,函数返回 TxResult 自己判 ok)
 *
 * 共享类型:
 *   - Transactional   事务执行器所需的最小接口(Pick<DatabaseSync, "exec">),
 *                     让领域函数能接受 node:sqlite DatabaseSync 或 routes 注入的
 *                     窄化包装
 *   - TxResult<T>     领域事务统一结果类型:{ ok:true, data } | { ok:false, error, status, extra? }
 *                     所有领域模块(land / coop / economy / redpacket)都从此处引用,
 *                     避免跨域循环依赖
 *
 * 用法:
 *   const result = withTransaction(db, () => {
 *     const rows = query(SQL`SELECT 1`);
 *     return rows[0];
 *   });
 *
 * 行为约定:
 *   - return value       → COMMIT 后透传给调用方
 *   - throw              → ROLLBACK 后重新抛错
 *   - return Promise     → await 后再 COMMIT / ROLLBACK
 */

import type { DatabaseSync } from "node:sqlite";

/** 事务执行器所需的最小接口 (db.exec)，让领域函数能接受 node:sqlite DatabaseSync
 *  或 routes 注入的窄化包装 */
export type Transactional = Pick<DatabaseSync, "exec">;

/** 领域事务统一结果类型：成功携带 data，失败携带 error + HTTP status。
 *  可选 extra 字段用于携带附加上下文（如当前余额）供 route 层透传。 */
export type TxResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; extra?: Record<string, unknown> };

/**
 * 在 IMMEDIATE 事务包裹下运行回调。回调内任何抛出都会触发 ROLLBACK 并重新抛错。
 *
 * 行为约定：
 *   - return value       → COMMIT 后透传给调用方
 *   - throw              → ROLLBACK 后重新抛错
 *   - return Promise     → await 后再 COMMIT / ROLLBACK
 */
export function withTransaction<T>(
  db: Transactional,
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
  db: Transactional,
  fn: () => T | Promise<T>
): T | Promise<T> {
  return withTransaction(db, fn);
}
