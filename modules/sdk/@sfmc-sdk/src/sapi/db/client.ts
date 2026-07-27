/**
 * client.ts — db 子路径的运行时客户端(走 HttpDB → @minecraft/server-net)
 *
 * 模块在 SAPI 侧调 db.query(...) → 这里发 POST /api/sfmc/db/query 给 db-server。
 * 平台不 import 模块代码:模块只能调这里,不能 require("fs") 等。
 *
 * 鉴权:
 *   - X-SFMC-Module-Id 通过 URL query string 传(?moduleId=...)
 *   - Bearer token 按请求传入(HttpDB typedRequest opts),不写进程级 static
 *     (避免与 ConfigManager / 其它模块互相覆盖 — DIP)
 */

import { HttpDB, type HttpRequestAuthOpts } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";
import type {
  ColumnDef,
  DeleteResult,
  InsertResult,
  QueryOptions,
  TxStep,
  TxStepResult,
  UpdateResult,
} from "./types.js";

/* ── 模块身份(由 ModuleRegistry.bootModule → setDbModuleContext 注入) ── */

let _moduleId = "";
let _authToken = "";
let _currentTxId: string | null = null;

/** 注入当前模块的 db 身份（由 ModuleRegistry.bootModule 调用）。 */
export function setDbModuleContext(moduleId: string, token: string): void {
  _moduleId = moduleId;
  _authToken = token;
}

/**
 * 清理 db 模块身份。
 * - 传入 moduleId:仅当当前身份匹配时清空(Demeter:禁用 A 不误清 B)
 * - 省略 moduleId:强制清空
 */
export function clearDbModuleContext(moduleId?: string): void {
  if (moduleId && _moduleId !== moduleId) return;
  _moduleId = "";
  _authToken = "";
  _currentTxId = null;
}

/** 供 service 客户端判断是否处于 db.tx 交互会话(LSP:与 service.get 互斥)。 */
export function isDbTxRecording(): boolean {
  return _currentTxId != null;
}

/* ── HTTP 辅助 ──────────────────────────────────────────────────── */

/** db 客户端错误（含服务端 code 与 HTTP status）。 */
export class DbError extends Error {
  /** 错误码（如 permission_denied、use_tx）。 */
  code: string;
  /** HTTP 状态码；网络错误时为 0。 */
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function withModuleId(path: string): string {
  return HttpDB.withModuleId(path, _moduleId);
}

/** 空串不传 authToken,避免 ?? 被 "" 挡住 ConfigManager 默认回落(DIP)。 */
function authOpts(): HttpRequestAuthOpts | undefined {
  const t = (_authToken || "").trim();
  return t ? { authToken: t } : undefined;
}

function requireModuleContext(op: string): void {
  if (!_moduleId) {
    throw new DbError(
      `[db.${op}] 模块上下文未初始化:setDbModuleContext 未调用(host-bootstrap/ModuleRegistry)`,
      "unauthorized",
      0
    );
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await HttpDB.typedRequest<T>(
    HttpRequestMethod.POST,
    withModuleId(path),
    body as Record<string, unknown>,
    authOpts()
  );
  if (!res.ok) {
    // LSP:保留服务端 code/step(尤其 /db/tx),勿一律打成 internal
    const data = res.data as { error?: string; code?: string; step?: number } | undefined;
    const code = data?.code || "internal";
    const msg =
      data?.step != null
        ? `事务在 step ${data.step} 失败: ${data.error ?? res.error ?? "db_server_error"}`
        : data?.error || res.error || "db_server_error";
    throw new DbError(msg, code, res.status);
  }
  return res.data as T;
}

/** 规范化 step(去掉 undefined 可选字段,避免 JSON 脏键) */
function normalizeStep(s: TxStep): TxStep {
  if (s.op === "query" && s.opts === undefined) delete (s as { opts?: unknown }).opts;
  if (s.op === "audit" && s.data === undefined) delete (s as { data?: unknown }).data;
  return s;
}

type StepOk = { ok: true; result: TxStepResult };
type SessionBegin = { ok: true; txId: string };

async function txStep(txId: string, step: TxStep): Promise<TxStepResult> {
  const res = await post<StepOk>("/api/sfmc/db/tx/step", { txId, step: normalizeStep(step) });
  return res.result;
}

/* ── 公开 API ──────────────────────────────────────────────────── */

/** SAPI 侧 db facade：经 HttpDB 调 db-server REST，禁止原始 SQL。 */
export const db = {
  /** 模块 init 时调,声明自己要哪些表。db-server schema-registry 收集后建表。 */
  async defineTable(name: string, columns: Record<string, ColumnDef>, opts?: { softDelete?: boolean }): Promise<void> {
    requireModuleContext("defineTable");
    if (_currentTxId) throw new DbError("defineTable 不可在事务内调用", "forbidden", 0);
    await post("/api/sfmc/db/define-table", {
      name,
      columns,
      softDelete: opts?.softDelete ?? true,
    });
  },

  /** 条件查询表行。 */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    opts?: QueryOptions
  ): Promise<T[]> {
    requireModuleContext("query");
    if (_currentTxId) throw new DbError("query 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<{ rows: T[] }>("/api/sfmc/db/query", { table, opts: opts ?? {} });
    return res.rows;
  },

  /** 按主键取单行；不存在返回 null。 */
  async get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string | number
  ): Promise<T | null> {
    requireModuleContext("get");
    if (_currentTxId) throw new DbError("get 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<{ row: T | null }>("/api/sfmc/db/get", { table, id: String(id) });
    return res.row;
  },

  /** 插入一行并返回完整行。 */
  async insert<T extends Record<string, unknown>>(table: string, row: T): Promise<T> {
    requireModuleContext("insert");
    if (_currentTxId) throw new DbError("insert 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<InsertResult>("/api/sfmc/db/insert", { table, row });
    return res.row as T;
  },

  /** 按主键部分更新并返回完整行。 */
  async update<T extends Record<string, unknown>>(
    table: string,
    id: string | number,
    patch: Partial<T>
  ): Promise<T> {
    requireModuleContext("update");
    if (_currentTxId) throw new DbError("update 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<UpdateResult>("/api/sfmc/db/update", { table, id: String(id), patch });
    return res.row as T;
  },

  /** 删除一行；默认软删除，`hard: true` 物理删除。 */
  async delete(table: string, id: string | number, opts?: { hard?: boolean }): Promise<void> {
    requireModuleContext("delete");
    if (_currentTxId) throw new DbError("delete 不可直接调,请用 db.tx", "use_tx", 0);
    await post<DeleteResult>("/api/sfmc/db/delete", {
      table,
      id: String(id),
      hard: opts?.hard ?? false,
    });
  },

  /**
   * 事务:边界在 db-server 进程。失败自动回滚,成功提交。
   * 交互会话协议:begin → step* → commit|rollback。
   * 回调内 await query/get/call 返回真实服务端结果(PR #31 未完成项补齐)。
   * 批量 POST /db/tx 仍保留给工具/测试;模块侧统一走交互路径。
   */
  async tx<T>(fn: (tx: TxContext) => Promise<T>): Promise<T> {
    requireModuleContext("tx");
    if (_currentTxId) throw new DbError("嵌套事务暂不支持", "nested_tx", 0);

    const begin = await post<SessionBegin>("/api/sfmc/db/tx/begin", {});
    const txId = begin.txId;
    _currentTxId = txId;

    const interactive: TxContext = {
      query: async <U extends Record<string, unknown> = Record<string, unknown>>(
        table: string,
        opts?: QueryOptions
      ): Promise<U[]> => {
        const r = await txStep(txId, { op: "query", table, ...(opts ? { opts } : {}) });
        return (r.rows ?? []) as U[];
      },
      get: async <U extends Record<string, unknown> = Record<string, unknown>>(
        table: string,
        id: string | number
      ): Promise<U | null> => {
        const r = await txStep(txId, { op: "get", table, id: String(id) });
        return (r.row ?? null) as U | null;
      },
      insert: async <U extends Record<string, unknown>>(table: string, row: U): Promise<U> => {
        const r = await txStep(txId, { op: "insert", table, row });
        return (r.row ?? row) as U;
      },
      update: async <U extends Record<string, unknown>>(
        table: string,
        id: string | number,
        patch: Partial<U>
      ): Promise<U> => {
        const r = await txStep(txId, { op: "update", table, id: String(id), patch });
        return (r.row ?? ({ ...patch, id } as unknown as U)) as U;
      },
      delete: async (table: string, id: string | number, opts?: { hard?: boolean }) => {
        await txStep(txId, { op: "delete", table, id: String(id), hard: opts?.hard ?? false });
      },
      audit: async (table: string, rowId: string | number, action: string, data?: Record<string, unknown>) => {
        if (data) await txStep(txId, { op: "audit", table, rowId: String(rowId), action, data });
        else await txStep(txId, { op: "audit", table, rowId: String(rowId), action });
      },
      call: async <U = unknown>(name: string, input: Record<string, unknown>): Promise<U> => {
        const r = await txStep(txId, { op: "service", name, input });
        return r.result as U;
      },
    };

    try {
      const userResult = await fn(interactive);
      await post("/api/sfmc/db/tx/commit", { txId });
      return userResult;
    } catch (e) {
      try {
        await post("/api/sfmc/db/tx/rollback", { txId });
      } catch {
        /* best-effort */
      }
      throw e;
    } finally {
      _currentTxId = null;
    }
  },

  /** 平台预置:审计日志(自动写 _audit 表) */
  async audit(table: string, rowId: string | number, action: string, data?: Record<string, unknown>): Promise<void> {
    requireModuleContext("audit");
    if (_currentTxId) throw new DbError("audit 不可直接调,请用 db.tx", "use_tx", 0);
    if (data) await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action, data });
    else await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action });
  },

  /** 平台预置:幂等执行(同 action+key 不会重复) */
  async idempotent<T>(action: string, key: string, fn: () => Promise<T>): Promise<T> {
    requireModuleContext("idempotent");
    const probe = await post<{ replayed: boolean }>("/api/sfmc/db/idempotent/probe", { action, key });
    if (probe.replayed) {
      return undefined as unknown as T;
    }
    const result = await fn();
    await post("/api/sfmc/db/idempotent/commit", { action, key });
    return result;
  },
};

/** 交互式事务上下文（`db.tx` 回调参数）。 */
export interface TxContext {
  /** 事务内条件查询。 */
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    opts?: QueryOptions
  ): Promise<T[]>;
  /** 事务内按主键读取。 */
  get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string | number
  ): Promise<T | null>;
  /** 事务内插入。 */
  insert<T extends Record<string, unknown>>(table: string, row: T): Promise<T>;
  /** 事务内更新。 */
  update<T extends Record<string, unknown>>(
    table: string,
    id: string | number,
    patch: Partial<T>
  ): Promise<T>;
  /** 事务内删除。 */
  delete(table: string, id: string | number, opts?: { hard?: boolean }): Promise<void>;
  /** 事务内写审计日志。 */
  audit(table: string, rowId: string | number, action: string, data?: Record<string, unknown>): Promise<void>;
  /** 交互会话内返回服务端真实 result */
  call<T = unknown>(name: string, input: Record<string, unknown>): Promise<T>;
}
