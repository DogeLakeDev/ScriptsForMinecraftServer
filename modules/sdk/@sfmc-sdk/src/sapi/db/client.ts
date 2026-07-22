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

import { HttpDB } from "../runtime/httpdb.js";
import { HttpRequestMethod } from "@minecraft/server-net";
import type {
  ColumnDef,
  DeleteResult,
  InsertResult,
  QueryOptions,
  TxResponse,
  TxStep,
  UpdateResult,
} from "./types.js";

/* ── 模块身份(由 installHostBootstrap 注入) ─────────────────────── */

let _moduleId = "";
let _authToken = "";
let _currentTxId: string | null = null;

export function setDbModuleContext(moduleId: string, token: string): void {
  _moduleId = moduleId;
  _authToken = token;
}

export function clearDbModuleContext(): void {
  _moduleId = "";
  _authToken = "";
  _currentTxId = null;
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
  if (!_moduleId) {
    throw new DbError("模块上下文未初始化,setDbModuleContext 未调用", "no_module_context", 0);
  }
  return HttpDB.withModuleId(path, _moduleId);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await HttpDB.typedRequest<T>(
    HttpRequestMethod.POST,
    withModuleId(path),
    body as Record<string, unknown>,
    { authToken: _authToken }
  );
  if (!res.ok) {
    // LSP: db/tx 失败信封带 step/code,勿只抛 generic error(死代码分支曾丢字段)
    const data = res.data as { step?: number; code?: string } | undefined;
    if (typeof data?.step === "number") {
      throw new DbError(
        `事务在 step ${data.step} 失败: ${res.error ?? "tx_failed"}`,
        data.code ?? "internal",
        res.status
      );
    }
    throw new DbError(res.error ?? "db_server_error", "internal", res.status);
  }
  return res.data as T;
}

/** 事务录制期不支持 query/get 读回:返回 []/null stub 会破坏 LSP(误导业务分支)。 */
function txReadNotSupported(op: string): never {
  throw new DbError(
    `db.tx 内暂不支持 ${op} 读回结果(录制后一次性提交,无交互协议);` +
      `请在事务外先 db.${op},再在 tx 内做写操作`,
    "tx_interactive_required",
    0
  );
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

  /**
   * 事务:边界在 db-server 进程。失败自动回滚,成功提交。
   * 录制期:写操作(insert/update/delete/audit/call)可入队;query/get 显式抛错,
   * 避免返回 []/null 假数据破坏 LSP。call 入队返回 void(无服务端 result 可回放)。
   */
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
      query: async () => txReadNotSupported("query"),
      get: async () => txReadNotSupported("get"),
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
        // 录制期无服务端合并行;返回 patch 仅作入队确认,勿当完整行(LSP 残差)
        return patch as U;
      },
      delete: async (table: string, id: string | number, opts?: { hard?: boolean }) => {
        push({ op: "delete", table, id: String(id), hard: opts?.hard ?? false });
      },
      audit: async (table: string, rowId: string | number, action: string, data?: Record<string, unknown>) => {
        if (data) push({ op: "audit", table, rowId: String(rowId), action, data });
        else push({ op: "audit", table, rowId: String(rowId), action });
      },
      call: async (name: string, input: Record<string, unknown>): Promise<void> => {
        push({ op: "service", name, input });
      },
    };

    let userResult: T;
    try {
      userResult = await fn(recorder);
    } catch (e) {
      _currentTxId = null;
      throw e;
    }

    try {
      // post 已在失败信封上抛 DbError(含 step/code);成功即 TxResponse
      await post<TxResponse>("/api/sfmc/db/tx", { steps });
      return userResult;
    } finally {
      _currentTxId = null;
    }
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
  /** 入队跨模块 service;录制期无返回值(两阶段读回另议) */
  call(name: string, input: Record<string, unknown>): Promise<void>;
}
