/**
 * tx-runner.ts — 事务 RPC 处理器
 *
 * 协议:
 *   POST /api/sfmc/db/tx
 *   body = { moduleId, steps: TxStep[] }
 *   reply: { ok: true } | { ok: false, step: <index>, error, code }
 *
 * 流程:
 *   1. 校验 moduleId in enabled + permission "db:write:*"
 *   2. BEGIN IMMEDIATE
 *   3. 顺序跑 steps — 任一抛错 → ROLLBACK + reply { ok:false, step:<i>, ... }
 *   4. 全过 → COMMIT + reply { ok:true }
 *
 * step.op:
 *   - query      { table, opts? }
 *   - get        { table, id }
 *   - insert     { table, row }
 *   - update     { table, id, patch }
 *   - delete     { table, id, hard }
 *   - audit      { table, rowId, action, data? }  → 平台 sfmc__audit 表
 *   - service    { name, input }                  → 派发;失败抛错回退整事务
 *
 * 事务内 service call:不持有 db handle 给 handler(避免并发写) —
 *   实现:handler 是"同步纯函数",返回 result 写回 step 的输出。
 *   若 handler 自己也想写 db,应通过其它接口在事务外做(避免嵌套)。
 */

import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { SchemaRegistry } from "./schema-registry.js";
import type { WhereExpr } from "./where.js";
import { compile } from "./where.js";
import { log } from "./lib/log.js";
import { DispatchError, type ServiceRegistry } from "./service-registry.js";
import type { ModuleManifestV2 } from "./manifest-loader.js";
import {
  PermissionDeniedError,
  Perm,
  assertModulePermission,
} from "./permission-gate.js";
import { normalizeOrderBy } from "./lib/order-by.js";

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function identOk(t: string): void {
  if (!IDENT.test(t)) throw new Error(`[tx] invalid table name "${t}"`);
}

export interface TxStepQuery {
  op: "query";
  table: string;
  opts?: {
    where?: WhereExpr;
    /** SDK 用 field;历史 col 仍接受(normalizeOrderBy) */
    orderBy?:
      | { field?: string; col?: string; dir?: "asc" | "desc" }
      | Array<{ field?: string; col?: string; dir?: "asc" | "desc" }>;
    limit?: number;
    offset?: number;
  };
}

export interface TxStepGet {
  op: "get";
  table: string;
  id: string;
}

export interface TxStepInsert {
  op: "insert";
  table: string;
  row: Record<string, unknown>;
}

export interface TxStepUpdate {
  op: "update";
  table: string;
  id: string;
  patch: Record<string, unknown>;
}

export interface TxStepDelete {
  op: "delete";
  table: string;
  id: string;
  hard: boolean;
}

export interface TxStepAudit {
  op: "audit";
  table: string;
  rowId: string;
  action: string;
  data?: Record<string, unknown>;
}

export interface TxStepService {
  op: "service";
  name: string;
  input: Record<string, unknown>;
}

export type TxStep =
  | TxStepQuery
  | TxStepGet
  | TxStepInsert
  | TxStepUpdate
  | TxStepDelete
  | TxStepAudit
  | TxStepService;

export type TxStepResult =
  | { op: "query"; rows: Record<string, unknown>[] }
  | { op: "get"; row: Record<string, unknown> | null }
  | { op: "insert"; row: Record<string, unknown> }
  | { op: "update"; row: Record<string, unknown> }
  | { op: "delete"; changes: number }
  | { op: "audit"; changes: number }
  | { op: "service"; result: unknown };

export interface TxResponse {
  ok: true;
  results: TxStepResult[];
}

export type TxError = {
  ok: false;
  step: number;
  error: string;
  code:
    | "permission_denied"
    | "forbidden"
    | "no_such_service"
    | "not_in_requires"
    | "domain_error"
    | "internal"
    | "no_such_table";
};

export interface TxRequest {
  moduleId: string;
  steps: TxStep[];
}

export interface TxRunnerDeps {
  db: DatabaseSync;
  query: import("./lib/sqlite.js").QueryFn;
  schema: SchemaRegistry;
  serviceRegistry: ServiceRegistry;
  enabled: Map<string, ModuleManifestV2>;
}

export class TxRunner {
  constructor(private readonly deps: TxRunnerDeps) {}

  async run(req: TxRequest): Promise<TxResponse | TxError> {
    const { moduleId, steps } = req;
    const manifest = this.deps.enabled.get(moduleId);
    if (!manifest) return { ok: false, step: -1, error: "模块未 enabled", code: "forbidden" };
    // 注意:不在此处做「整体 db:write:*」断言。
    // 通配 `db:write:*` 无法通过 permission-gate 的 validPermissionKey 校验(模块声明它会启动失败),
    // 因此该断言会让所有事务(含只读事务)恒被拒。真正的读写权限由每个 step 的
    // requireTableRead / requireTableWrite 按具体表精确 gate。

    const traceId = randomUUID().slice(0, 8);
    const results: TxStepResult[] = [];

    try {
      this.deps.db.exec("BEGIN IMMEDIATE");
    } catch (e) {
      return { ok: false, step: -1, error: `BEGIN 失败: ${(e as Error).message}`, code: "internal" };
    }

    for (let i = 0; i < steps.length; i++) {
      const step: TxStep = steps[i]!;
      try {
        const r = await this.runOne(moduleId, manifest, step);
        results.push(r);
      } catch (err) {
        this.rollback();
        const code: TxError["code"] =
          err instanceof PermissionDeniedError
            ? "permission_denied"
            : err instanceof DispatchError &&
                (err.code === "no_such_service" ||
                  err.code === "not_in_requires" ||
                  err.code === "forbidden" ||
                  err.code === "domain_error")
              ? err.code
              : (err as { code?: string }).code === "no_such_service"
                ? "no_such_service"
                : (err as { code?: string }).code === "not_in_requires"
                  ? "not_in_requires"
                  : (err as { code?: string }).code === "no_such_table"
                    ? "no_such_table"
                    : "internal";
        log.warn(`[tx ${traceId}] step=${i} failed: ${(err as Error).message}`);
        return { ok: false, step: i, error: (err as Error).message, code };
      }
    }

    try {
      this.deps.db.exec("COMMIT");
    } catch (e) {
      this.rollback();
      return { ok: false, step: -1, error: `COMMIT 失败: ${(e as Error).message}`, code: "internal" };
    }

    log.info(`[tx ${traceId}] module=${moduleId} ${steps.length} steps OK`);
    return { ok: true, results };
  }

  private rollback(): void {
    try {
      this.deps.db.exec("ROLLBACK");
    } catch {
      // best-effort; fall through
    }
  }

  /** 单 step 由对应权限检查 + SQL 路径执行 */
  private async runOne(
    moduleId: string,
    manifest: ModuleManifestV2,
    step: TxStep
  ): Promise<TxStepResult> {
    switch (step.op) {
      case "query":
        return this.doQuery(moduleId, manifest, step);
      case "get":
        return this.doGet(moduleId, manifest, step);
      case "insert":
        return this.doInsert(moduleId, manifest, step);
      case "update":
        return this.doUpdate(moduleId, manifest, step);
      case "delete":
        return this.doDelete(moduleId, manifest, step);
      case "audit":
        return this.doAudit(moduleId, manifest, step);
      case "service":
        return this.doService(moduleId, manifest, step);
    }
  }

  private requireTableRead(mod: ModuleManifestV2, table: string): void {
    identOk(table);
    this.assertTableRegistered(table);
    assertModulePermission(mod.id, mod.permissions, Perm.dbRead(table));
  }
  private requireTableWrite(mod: ModuleManifestV2, table: string): void {
    identOk(table);
    this.assertTableRegistered(table);
    assertModulePermission(mod.id, mod.permissions, Perm.dbWrite(table));
  }
  private assertTableRegistered(table: string): void {
    if (table.startsWith("sfmc_")) return; // 平台表 — 始终可读写(平台层)
    if (!this.deps.schema.isRegistered(table)) {
      const err = new Error(`表 "${table}" 未注册到 schema-registry`);
      (err as { code?: string }).code = "no_such_table";
      throw err;
    }
  }

  private doQuery(_mid: string, mod: ModuleManifestV2, step: TxStepQuery): TxStepResult {
    this.requireTableRead(mod, step.table);
    const where = compile(step.opts?.where);
    // LSP:与 SDK QueryOptions.orderBy({field}|[]) 对齐,兼收遗留 {col}
    const orders = normalizeOrderBy(step.opts?.orderBy);
    const limit = typeof step.opts?.limit === "number" ? step.opts?.limit : undefined;
    const offset = typeof step.opts?.offset === "number" ? step.opts?.offset : undefined;

    const whereClause = where.sql;
    const params = [...where.values];
    let extra = "";
    if (orders.length > 0) {
      const parts: string[] = [];
      for (const o of orders) {
        if (!IDENT.test(o.col)) throw new Error(`[tx] orderBy bad column "${o.col}"`);
        parts.push(`"${o.col}" ${o.dir === "desc" ? "DESC" : "ASC"}`);
      }
      extra += ` ORDER BY ${parts.join(", ")}`;
    }
    if (typeof limit === "number") {
      extra += " LIMIT " + Math.max(0, Math.floor(limit));
    }
    if (typeof offset === "number") {
      extra += " OFFSET " + Math.max(0, Math.floor(offset));
    }

    const sql = `SELECT * FROM "${step.table}" WHERE ${whereClause}${extra}`;
    const rows = this.deps.db.prepare(sql).all(...(params as never[])) as Record<string, unknown>[];
    return { op: "query", rows };
  }

  /** 解析主键 WHERE。单列直接等值;联合主键支持 `a|b|c`(与 data-backup 约定一致)。 */
  private pkWhere(table: string, id: string | number): { clause: string; values: unknown[] } {
    const cols = this.deps.db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{
      name: string;
      pk: number;
    }>;
    const pkCols = cols
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);
    if (pkCols.length === 0) {
      throw new Error(`[tx] ${table} 没有 primary key`);
    }
    if (pkCols.length === 1) {
      return { clause: `"${pkCols[0]}" = ?`, values: [id] };
    }
    const parts = String(id).split("|");
    if (parts.length === pkCols.length) {
      return {
        clause: pkCols.map((c) => `"${c}" = ?`).join(" AND "),
        values: parts,
      };
    }
    // 联合主键但只传了首列(频道 id 等):按第一主键列匹配
    return { clause: `"${pkCols[0]}" = ?`, values: [id] };
  }

  private doGet(_mid: string, mod: ModuleManifestV2, step: TxStepGet): TxStepResult {
    this.requireTableRead(mod, step.table);
    const where = this.pkWhere(step.table, step.id);
    const row = this.deps.db
      .prepare(`SELECT * FROM "${step.table}" WHERE ${where.clause}`)
      .get(...(where.values as never[])) as Record<string, unknown> | undefined;
    return { op: "get", row: row ?? null };
  }

  private doInsert(_mid: string, mod: ModuleManifestV2, step: TxStepInsert): TxStepResult {
    this.requireTableWrite(mod, step.table);
    const cols = Object.keys(step.row);
    if (cols.length === 0) throw new Error("[tx] insert row 必须至少一个字段");
    for (const c of cols) {
      if (!IDENT.test(c)) throw new Error(`[tx] invalid column name "${c}"`);
    }
    const placeholders = cols.map(() => "?").join(",");
    const quoted = cols.map((c) => `"${c}"`).join(",");
    const values = cols.map((c) => step.row[c]);
    const sql = `INSERT INTO "${step.table}" (${quoted}) VALUES (${placeholders})`;
    try {
      this.deps.db.prepare(sql).run(...(values as never[]));
    } catch (e) {
      throw new Error(`INSERT ${step.table} 失败: ${(e as Error).message}`);
    }
    return { op: "insert", row: { ...step.row } };
  }

  private doUpdate(_mid: string, mod: ModuleManifestV2, step: TxStepUpdate): TxStepResult {
    this.requireTableWrite(mod, step.table);
    const cols = Object.keys(step.patch);
    if (cols.length === 0) throw new Error("[tx] update patch 不能为空");
    for (const c of cols) {
      if (!IDENT.test(c)) throw new Error(`[tx] invalid column name "${c}"`);
    }
    const where = this.pkWhere(step.table, step.id);
    const sets = cols.map((c) => `"${c}" = ?`).join(",");
    const params = [...cols.map((c) => step.patch[c]), ...where.values];
    const sql = `UPDATE "${step.table}" SET ${sets} WHERE ${where.clause}`;
    const result = this.deps.db.prepare(sql).run(...(params as never[]));
    if (result.changes === 0) {
      throw new Error(`UPDATE ${step.table} id=${step.id} 影响 0 行(找不到 / 已删?)`);
    }
    return { op: "update", row: { ...step.patch, id: step.id } as unknown as Record<string, unknown> };
  }

  private doDelete(_mid: string, mod: ModuleManifestV2, step: TxStepDelete): TxStepResult {
    this.requireTableWrite(mod, step.table);
    const where = this.pkWhere(step.table, step.id);
    if (step.hard) {
      const sql = `DELETE FROM "${step.table}" WHERE ${where.clause}`;
      const r = this.deps.db.prepare(sql).run(...(where.values as never[]));
      return { op: "delete", changes: Number(r.changes) };
    }
    const cols = this.deps.db.prepare(`PRAGMA table_info("${step.table}")`).all() as Array<{
      name: string;
    }>;
    const hasDeletedAt = cols.find((c) => c.name === "_deleted_at");
    if (!hasDeletedAt) {
      throw new Error(
        `[tx] ${step.table} 没启用 softDelete,删不掉;请 hard=true 或 schema 设 softDelete=true`
      );
    }
    const sql = `UPDATE "${step.table}" SET "_deleted_at" = ?, "_version" = COALESCE("_version",0)+1 WHERE ${where.clause}`;
    const r = this.deps.db.prepare(sql).run(Date.now() as never, ...(where.values as never[]));
    return { op: "delete", changes: Number(r.changes) };
  }

  private doAudit(_mid: string, mod: ModuleManifestV2, step: TxStepAudit): TxStepResult {
    this.requireTableWrite(mod, step.table);
    const dataJson = step.data ? JSON.stringify(step.data) : null;
    const r = this.deps.db
      .prepare(
        `INSERT INTO sfmc__audit (module_id, table_name, row_id, action, data, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(mod.id, step.table, step.rowId, step.action, dataJson, new Date().toISOString());
    return { op: "audit", changes: Number(r.changes) };
  }

  private async doService(
    _mid: string,
    mod: ModuleManifestV2,
    step: TxStepService
  ): Promise<TxStepResult> {
    // requires / 自调用豁免的唯一权威在 ServiceRegistry.dispatch(DRY/LSP);
    // 此处只补 dispatch 不做的 service:<name> 权限门(与 HTTP service-routes 对齐)。
    assertModulePermission(mod.id, mod.permissions, Perm.service(step.name));
    const result = await this.deps.serviceRegistry.dispatch(
      this.deps.enabled,
      mod.id,
      step.name,
      step.input,
      { query: this.deps.query, db: this.deps.db }
    );
    return { op: "service", result: result.result };
  }
}
