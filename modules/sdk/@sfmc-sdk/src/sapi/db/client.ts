/**
 * client.ts — db 子路径的运行时客户端(走 HttpDB → @minecraft/server-net)
 *
 * 模块在 SAPI 侧调 db.query(...) → 这里发 POST /api/sfmc/db/query 给 db-server。
 * 平台不 import 模块代码:模块只能调这里,不能 require("fs") 等。
 *
 * 鉴权:
 *   - X-SFMC-Module-Id 通过 URL query string 传(?moduleId=...)
 *   - X-SFMC-Module-Token 通过 HttpDB.setAuthToken 走 Authorization: Bearer
 *     (设置时由 installHostBootstrap 在 db 上下文 setup 时调用)
 */

import { HttpDB } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";
import type {
  ColumnDef,
  DeleteResult,
  InsertResult,
  QueryOptions,
  TxError,
  TxResponse,
  TxStep,
  UpdateResult,
} from "./types.js";

/* ── 模块身份(由 installHostBootstrap 注入) ─────────────────────── */

let _moduleId = "";
let _currentTxId: string | null = null;

export function setDbModuleContext(moduleId: string, token: string): void {
  _moduleId = moduleId;
  HttpDB.setAuthToken(token);
}

export function clearDbModuleContext(): void {
  _moduleId = "";
  _currentTxId = null;
  HttpDB.setAuthToken("");
}

/* ── HTTP 辅助 ──────────────────────────────────────────────────── */

export class DbError extends Error {
  code: string;
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

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await HttpDB.typedRequest<T>(HttpRequestMethod.POST, withModuleId(path), body as Record<string, unknown>);
  if (!res.ok) {
    throw new DbError(res.error ?? "db_server_error", "internal", res.status);
  }
  return res.data as T;
}

/* ── 公开 API ──────────────────────────────────────────────────── */

export const db = {
  /** 模块 init 时调,声明自己要哪些表。db-server schema-registry 收集后建表。 */
  async defineTable(name: string, columns: Record<string, ColumnDef>, opts?: { softDelete?: boolean }): Promise<void> {
    if (_currentTxId) throw new DbError("defineTable 不可在事务内调用", "forbidden", 0);
    await post("/api/sfmc/db/define-table", {
      name,
      columns,
      softDelete: opts?.softDelete ?? true,
    });
  },

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    opts?: QueryOptions
  ): Promise<T[]> {
    if (_currentTxId) throw new DbError("query 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<{ rows: T[] }>("/api/sfmc/db/query", { table, opts: opts ?? {} });
    return res.rows;
  },

  async get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string | number
  ): Promise<T | null> {
    if (_currentTxId) throw new DbError("get 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<{ row: T | null }>("/api/sfmc/db/get", { table, id: String(id) });
    return res.row;
  },

  async insert<T extends Record<string, unknown>>(table: string, row: T): Promise<T> {
    if (_currentTxId) throw new DbError("insert 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<InsertResult>("/api/sfmc/db/insert", { table, row });
    return res.row as T;
  },

  async update<T extends Record<string, unknown>>(
    table: string,
    id: string | number,
    patch: Partial<T>
  ): Promise<T> {
    if (_currentTxId) throw new DbError("update 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<UpdateResult>("/api/sfmc/db/update", { table, id: String(id), patch });
    return res.row as T;
  },

  async delete(table: string, id: string | number, opts?: { hard?: boolean }): Promise<void> {
    if (_currentTxId) throw new DbError("delete 不可直接调,请用 db.tx", "use_tx", 0);
    await post<DeleteResult>("/api/sfmc/db/delete", {
      table,
      id: String(id),
      hard: opts?.hard ?? false,
    });
  },

  /** 事务:边界在 db-server 进程。失败自动回滚,成功提交。 */
  async tx<T>(fn: (tx: TxContext) => Promise<T>): Promise<T> {
    if (_currentTxId) throw new DbError("嵌套事务暂不支持", "nested_tx", 0);
    const steps: TxStep[] = [];
    _currentTxId = "pending";

    const push = (s: TxStep) => {
      if (s.op === "query" && s.opts === undefined) delete (s as { opts?: unknown }).opts;
      if (s.op === "audit" && s.data === undefined) delete (s as { data?: unknown }).data;
      steps.push(s);
    };

    const recorder: TxContext = {
      query: async <U extends Record<string, unknown> = Record<string, unknown>>(
        table: string,
        opts?: QueryOptions
      ): Promise<U[]> => {
        if (opts) push({ op: "query", table, opts });
        else push({ op: "query", table });
        return [];
      },
      get: async <U extends Record<string, unknown> = Record<string, unknown>>(
        table: string,
        id: string | number
      ): Promise<U | null> => {
        push({ op: "get", table, id: String(id) });
        return null;
      },
      insert: async <U extends Record<string, unknown>>(table: string, row: U): Promise<U> => {
        push({ op: "insert", table, row });
        return row;
      },
      update: async <U extends Record<string, unknown>>(
        table: string,
        id: string | number,
        patch: Partial<U>
      ): Promise<U> => {
        push({ op: "update", table, id: String(id), patch });
        return patch as U;
      },
      delete: async (table: string, id: string | number, opts?: { hard?: boolean }) => {
        push({ op: "delete", table, id: String(id), hard: opts?.hard ?? false });
      },
      audit: async (table: string, rowId: string | number, action: string, data?: Record<string, unknown>) => {
        if (data) push({ op: "audit", table, rowId: String(rowId), action, data });
        else push({ op: "audit", table, rowId: String(rowId), action });
      },
      call: async <U = unknown>(name: string, input: Record<string, unknown>): Promise<U> => {
        push({ op: "service", name, input });
        return undefined as unknown as U;
      },
    };

    let userResult: T;
    try {
      userResult = await fn(recorder);
    } catch (e) {
      _currentTxId = null;
      throw e;
    }

    const res = await post<TxResponse | TxError>("/api/sfmc/db/tx", { steps });
    _currentTxId = null;
    if (!res.ok) {
      throw new DbError(`事务在 step ${res.step} 失败: ${res.error}`, res.code, 0);
    }
    return userResult;
  },

  /** 平台预置:审计日志(自动写 _audit 表) */
  async audit(table: string, rowId: string | number, action: string, data?: Record<string, unknown>): Promise<void> {
    if (_currentTxId) throw new DbError("audit 不可直接调,请用 db.tx", "use_tx", 0);
    if (data) await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action, data });
    else await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action });
  },

  /** 平台预置:幂等执行(同 action+key 不会重复) */
  async idempotent<T>(action: string, key: string, fn: () => Promise<T>): Promise<T> {
    const probe = await post<{ replayed: boolean }>("/api/sfmc/db/idempotent/probe", { action, key });
    if (probe.replayed) {
      return undefined as unknown as T;
    }
    const result = await fn();
    await post("/api/sfmc/db/idempotent/commit", { action, key });
    return result;
  },
};

export interface TxContext {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    opts?: QueryOptions
  ): Promise<T[]>;
  get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string | number
  ): Promise<T | null>;
  insert<T extends Record<string, unknown>>(table: string, row: T): Promise<T>;
  update<T extends Record<string, unknown>>(
    table: string,
    id: string | number,
    patch: Partial<T>
  ): Promise<T>;
  delete(table: string, id: string | number, opts?: { hard?: boolean }): Promise<void>;
  audit(table: string, rowId: string | number, action: string, data?: Record<string, unknown>): Promise<void>;
  call<T = unknown>(name: string, input: Record<string, unknown>): Promise<T>;
}
