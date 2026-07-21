/**
 * schema-registry.ts — 收集模块 defineTable,统一建表
 *
 * 协议:
 *   - 模块 SAPI 启动时调 db.defineTable(name, columns, {softDelete})
 *     → POST /api/sfmc/db/define-table {moduleId, name, columns, softDelete}
 *   - schema-registry 收集所有调用,CAS 锁
 *   - 等所有"已注册模块"都调过(超时 fallback 或 explicit `finalize()`),
 *     一次性 CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS
 *   - 同一 module 重复 define 同名表 = 幂等(同名 columns 允许)
 *   - 不同 module 抢同名表 = 启动失败
 *   - 平台表(moduleId = "__platform__")由 db-tables.ts 在 initSchema 直接 bootstrap
 *
 * 列类型白名单:
 *   text / integer / real / blob
 *   修饰: primary / notNull / unique / default / index
 *   softDelete = 自动加 _deleted_at INTEGER(列名带下划线) 和 _version INTEGER
 */

import type { DatabaseSync } from "node:sqlite";
import { log } from "./lib/log.js";

export type ColumnType = "text" | "integer" | "real" | "blob";

export interface ColumnDef {
  type: ColumnType;
  primary?: boolean;
  notNull?: boolean;
  unique?: boolean;
  default?: Primitive;
  index?: boolean;
  ref?: string;
}

export type Primitive = string | number | boolean | null;

export interface DefineTableRequest {
  name: string;
  columns: Record<string, ColumnDef>;
  softDelete?: boolean;
}

export interface DefineTableResult {
  table: string;
  created: boolean;
  indices: string[];
}

interface DefinedTable {
  moduleId: string;
  name: string;
  columns: Record<string, ColumnDef>;
  softDelete: boolean;
}

export const PLATFORM_MODULE_ID = "__platform__";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const VALID_TYPES: Set<ColumnType> = new Set(["text", "integer", "real", "blob"]);

function assertValid(req: DefineTableRequest, moduleId: string): void {
  if (!IDENT.test(req.name)) throw new Error(`[schema] ${moduleId}: invalid table name "${req.name}"`);
  if (!req.columns || Object.keys(req.columns).length === 0) {
    throw new Error(`[schema] ${moduleId}: ${req.name} has no columns`);
  }
  let pks = 0;
  for (const [colName, def] of Object.entries(req.columns)) {
    if (!IDENT.test(colName)) throw new Error(`[schema] ${moduleId}: invalid column name "${colName}" in ${req.name}`);
    if (!VALID_TYPES.has(def.type)) {
      throw new Error(`[schema] ${moduleId}: ${req.name}.${colName} bad type "${def.type}"`);
    }
    if (def.primary) pks++;
    if (def.ref) {
      const [t, c] = def.ref.split(".");
      if (!t || !c || !IDENT.test(t) || !IDENT.test(c)) {
        throw new Error(`[schema] ${moduleId}: ${req.name}.${colName} invalid ref "${def.ref}"`);
      }
    }
  }
  if (pks > 1) throw new Error(`[schema] ${moduleId}: ${req.name} has ${pks} primary keys (max 1)`);
}

/**
 * 一次性把 columns 翻译成 CREATE TABLE。
 * 例如 {id:{type:"text",primary:true},name:{type:"text",notNull:true}}
 * → "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL
 */
function buildColumnClause(name: string, def: ColumnDef, withDeletedAt: boolean): string {
  const parts: string[] = [`"${name}"`, def.type.toUpperCase()];
  if (def.primary) parts.push("PRIMARY KEY");
  if (def.notNull && !def.primary) parts.push("NOT NULL");
  if (def.unique) parts.push("UNIQUE");
  if (def.default !== undefined && def.default !== null) {
    if (typeof def.default === "string") parts.push(`DEFAULT '${def.default.replace(/'/g, "''")}'`);
    else parts.push(`DEFAULT ${def.default}`);
  }
  if (def.ref) parts.push(`REFERENCES ${def.ref}`);
  // 隐式 _deleted_at / _version 在列尾追加,不参与 columns 字段
  if (withDeletedAt) {
    parts.push('"_deleted_at" INTEGER', '"_version" INTEGER DEFAULT 0');
  }
  return parts.join(" ");
}

export class SchemaRegistry {
  private readonly db: DatabaseSync;
  private readonly tables = new Map<string, DefinedTable>();
  private finalized = false;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /** 模块 SAPI 启动时调。 */
  define(moduleId: string, req: DefineTableRequest): DefineTableResult {
    if (this.finalized) {
      throw new Error(`[schema] registry 已 finalize,模块 ${moduleId} 不能再 defineTable`);
    }
    assertValid(req, moduleId);

    const existing = this.tables.get(req.name);
    if (existing) {
      if (existing.moduleId === moduleId) {
        // 同模块重复定义:校验 columns 一致
        if (JSON.stringify(existing.columns) !== JSON.stringify(req.columns)) {
          throw new Error(`[schema] ${moduleId} 重复 defineTable "${req.name}",columns 不一致`);
        }
        if (existing.softDelete !== (req.softDelete ?? true)) {
          throw new Error(`[schema] ${moduleId} 重复 defineTable "${req.name}",softDelete 不一致`);
        }
        log.info(`[schema] ${moduleId} 重复 define "${req.name}" 跳过`);
        return { table: req.name, created: false, indices: [] };
      }
      throw new Error(
        `[schema] 表 "${req.name}" 已被模块 ${existing.moduleId} 定义,${moduleId} 不能抢同名表`
      );
    }

    const softDelete = req.softDelete ?? true;
    this.tables.set(req.name, {
      moduleId,
      name: req.name,
      columns: req.columns,
      softDelete,
    });
    return { table: req.name, created: true, indices: [] };
  }

  /**
   * 真正建表的时刻。所有 enabled 模块 init 完成(或明确调)后再 finalize。
   * CREATE TABLE IF NOT EXISTS + CREATE INDEX IF NOT EXISTS,幂等。
   */
  finalize(): { tableNames: string[]; created: string[] } {
    if (this.finalized) return { tableNames: [...this.tables.keys()], created: [] };
    this.finalized = true;
    const created: string[] = [];

    for (const t of this.tables.values()) {
      const cols: string[] = [];
      for (const [n, def] of Object.entries(t.columns)) {
        cols.push(buildColumnClause(n, def, t.softDelete));
      }
      const ddl = `CREATE TABLE IF NOT EXISTS "${t.name}" (${cols.join(", ")})`;
      this.db.exec(ddl);

      for (const [n, def] of Object.entries(t.columns)) {
        if (def.index) {
          const idxName = `idx_${t.name}_${n}`.slice(0, 60);
          this.db.exec(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${t.name}"("${n}")`);
        }
      }

      const exists =
        (this.db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
          .get(t.name) as { name?: string } | undefined)?.name === t.name;
      if (exists) created.push(t.name);
      log.success(`[schema] ${t.moduleId} → ${t.name} (softDelete=${t.softDelete})`);
    }

    return { tableNames: [...this.tables.keys()], created };
  }

  listTables(): string[] {
    return [...this.tables.keys()];
  }

  isRegistered(name: string): boolean {
    return this.tables.has(name);
  }

  getOwner(name: string): string | undefined {
    return this.tables.get(name)?.moduleId;
  }
}
