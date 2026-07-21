/**
 * db-tables.ts — 平台自带数据库表 bootstrap
 *
 * 平台表(不是模块声明的):
 *   - sfmc__audit        — db.audit() 自动写入
 *   - sfmc__idempotent   — db.idempotent() probe/commit 用
 *
 * 业务表(land / economy / coops / redpacket / ...)的 DDL 不在这里;
 * 它们由各自模块在 init() 调 db.defineTable() 声明,schema-registry 统一建表。
 */

import type { DatabaseSync } from "node:sqlite";

export function createPlatformTables(db: DatabaseSync): void {
  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc__audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      module_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_sfmc__audit_module_table ON sfmc__audit(module_id, table_name)`);

  db.exec(/* sql */ `
    CREATE TABLE IF NOT EXISTS sfmc__idempotent (
      module_id TEXT NOT NULL,
      action TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      created_at TEXT NOT NULL,
      PRIMARY KEY (module_id, action, key)
    )
  `);
}
