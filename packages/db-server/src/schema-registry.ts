/**
 * schema-registry.ts — 动态数据表结构注册与创建管理器
 *
 * 协议与流程：
 * 1. 模块启动时调用 `db.defineTable(name, columns, { softDelete })` 向服务端注册表结构定义。
 * 2. `SchemaRegistry` 校验列定义合法性、外键引用与主键唯一性。
 * 3. 校验通过后自动执行 `CREATE TABLE IF NOT EXISTS` 及索引创建语句。
 *
 * 冲突与隔离控制：
 * - 相同模块重复定义同名表：具备幂等性（要求列结构完全一致）
 * - 不同模块定义相同表名：抛出冲突异常拒绝注册
 * - 软删除支持：开启 `softDelete`（默认开启）时自动在末尾统一追加 `_deleted_at` 与乐观锁 `_version`
 */

import type { DatabaseSync } from "node:sqlite";
import { log } from "./lib/log.js";

export type ColumnType =
  | "text"
  | "integer"
  | "real"
  | "blob"
  | "TEXT"
  | "INTEGER"
  | "REAL"
  | "BLOB";

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
const VALID_TYPES: Set<string> = new Set([
  "text",
  "integer",
  "real",
  "blob",
  "TEXT",
  "INTEGER",
  "REAL",
  "BLOB",
]);

function assertValid(req: DefineTableRequest, moduleId: string): void {
  if (!IDENT.test(req.name)) throw new Error(`[schema] ${moduleId}: invalid table name "${req.name}"`);
  if (!req.columns || Object.keys(req.columns).length === 0) {
    throw new Error(`[schema] ${moduleId}: ${req.name} has no columns`);
  }
  let pks = 0;
  for (const [colName, def] of Object.entries(req.columns)) {
    if (!IDENT.test(colName)) throw new Error(`[schema] ${moduleId}: invalid column name "${colName}" in ${req.name}`);
    const rawType = String(def.type || "");
    if (!VALID_TYPES.has(rawType)) {
      throw new Error(`[schema] ${moduleId}: ${req.name}.${colName} bad type "${def.type}"`);
    }
    def.type = rawType.toLowerCase() as ColumnType;
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
 * 将单列定义编译为 SQL 列定义子句（如 `"id" TEXT PRIMARY KEY`）。
 *
 * @param name 列名。
 * @param def 列属性定义。
 * @returns 编译后的 SQL 片段。
 */
function buildColumnClause(name: string, def: ColumnDef): string {
  const parts: string[] = [`"${name}"`, def.type.toUpperCase()];
  if (def.primary) parts.push("PRIMARY KEY");
  if (def.notNull && !def.primary) parts.push("NOT NULL");
  if (def.unique) parts.push("UNIQUE");
  if (def.default !== undefined && def.default !== null) {
    if (typeof def.default === "string") parts.push(`DEFAULT '${def.default.replace(/'/g, "''")}'`);
    else parts.push(`DEFAULT ${def.default}`);
  }
  if (def.ref) parts.push(`REFERENCES ${def.ref}`);
  return parts.join(" ");
}

/**
 * 将整张表的所有列定义（包含 softDelete 隐式列）编译为列定义字符串数组。
 * 软删除列 `_deleted_at` 与乐观锁版本号 `_version` 作为独立列在末尾统一追加。
 *
 * @param columns 列结构定义字典。
 * @param softDelete 是否启用软删除扩展列。
 * @returns 编译后的列定义子句数组。
 */
function buildColumnList(columns: Record<string, ColumnDef>, softDelete: boolean): string[] {
  const cols: string[] = [];
  for (const [n, def] of Object.entries(columns)) {
    cols.push(buildColumnClause(n, def));
  }
  if (softDelete) {
    cols.push('"_deleted_at" INTEGER', '"_version" INTEGER DEFAULT 0');
  }
  return cols;
}

export class SchemaRegistry {
  private readonly db: DatabaseSync;
  private readonly tables = new Map<string, DefinedTable>();
  private finalized = false;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /**
   * 注册并创建模块数据表结构。
   *
   * @param moduleId 注册模块唯一标识符。
   * @param req 表结构定义请求对象。
   * @returns 建表结果与创建的索引列表。
   */
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
    const defined: DefinedTable = {
      moduleId,
      name: req.name,
      columns: req.columns,
      softDelete,
    };
    this.tables.set(req.name, defined);
    // 立即物理建表(幂等 CREATE TABLE IF NOT EXISTS)。
    // 原设计是「define 收集 → finalize 统一建表」,但 finalize() 从未被调用,
    // 导致模块表永远不会落地、后续 insert/query 全部 no such table。
    // 采用 define 即建表:碰撞检测已在上方按内存表完成,不影响单一 owner 保证。
    this.createPhysical(defined);
    return { table: req.name, created: true, indices: [] };
  }

  /** 幂等地物理建表 + 建索引(供 define / finalize 共用)。 */
  private createPhysical(t: DefinedTable): void {
    const existingTableInfo = this.db.prepare(`PRAGMA table_info("${t.name}")`).all() as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: unknown;
      pk: number;
    }>;

    if (existingTableInfo.length > 0) {
      let rowCount = 0;
      try {
        const countRes = this.db.prepare(`SELECT COUNT(*) AS c FROM "${t.name}"`).get() as { c: number } | undefined;
        rowCount = countRes?.c ?? 0;
      } catch {
        rowCount = 0;
      }
      const existingColNames = new Set(existingTableInfo.map((c) => c.name));
      const requiredCols = Object.keys(t.columns);
      const hasMissingRequiredCol = requiredCols.some((c) => !existingColNames.has(c));
      const pkDef = Object.entries(t.columns).find(([_, c]) => c.primary);
      const pkMatches = !pkDef || existingTableInfo.some((c) => c.pk === 1 && c.name === pkDef[0]);

      if (rowCount === 0 && (hasMissingRequiredCol || !pkMatches)) {
        // 空表且结构与当前定义不兼容（如旧版本遗留空表）：安全删除并以新结构重建
        try {
          this.db.exec(`DROP TABLE "${t.name}"`);
        } catch {}
        const cols = buildColumnList(t.columns, t.softDelete);
        this.db.exec(`CREATE TABLE "${t.name}" (${cols.join(", ")})`);
      } else {
        // 表中有数据或结构兼容：通过 ALTER TABLE ADD COLUMN 增量补齐缺失列
        for (const [colName, colDef] of Object.entries(t.columns)) {
          if (!existingColNames.has(colName)) {
            const clause = buildColumnClause(colName, colDef);
            try {
              this.db.exec(`ALTER TABLE "${t.name}" ADD COLUMN ${clause};`);
            } catch (e) {
              log.warn(`[schema] ${t.moduleId}: ALTER TABLE "${t.name}" ADD COLUMN "${colName}" 异常: ${(e as Error).message}`);
            }
          }
        }
        if (t.softDelete) {
          if (!existingColNames.has("_deleted_at")) {
            try {
              this.db.exec(`ALTER TABLE "${t.name}" ADD COLUMN "_deleted_at" INTEGER;`);
            } catch {}
          }
          if (!existingColNames.has("_version")) {
            try {
              this.db.exec(`ALTER TABLE "${t.name}" ADD COLUMN "_version" INTEGER DEFAULT 0;`);
            } catch {}
          }
        }
      }
    } else {
      const cols = buildColumnList(t.columns, t.softDelete);
      this.db.exec(`CREATE TABLE IF NOT EXISTS "${t.name}" (${cols.join(", ")})`);
    }

    for (const [n, def] of Object.entries(t.columns)) {
      if (def.index) {
        const idxName = `idx_${t.name}_${n}`.slice(0, 60);
        try {
          this.db.exec(`CREATE INDEX IF NOT EXISTS "${idxName}" ON "${t.name}"("${n}")`);
        } catch (e) {
          log.warn(`[schema] ${t.moduleId}: 创建索引 "${idxName}" 失败: ${(e as Error).message}`);
        }
      }
    }
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
      const cols = buildColumnList(t.columns, t.softDelete);
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
