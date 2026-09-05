/**
 * client.ts — SAPI 侧数据库 HTTP 客户端门面
 *
 * 业务模块在 SAPI 运行态调用 `db.query(...)`、`db.tx(...)` 等门面方法，经 HttpDB 向 db-server 发起标准化 REST 请求。
 * 平台与模块严格解耦，模块通过本门面完成数据持久化，禁止手写原始 SQL 或直接访问原生文件系统。
 *
 * 鉴权与并发模型（方案 A：作用域实例）：
 * - 推荐 `createDbClient(moduleId, token)`：身份与事务状态封闭在闭包内，多模块/多事务互不干扰
 * - `setDbModuleContext` + 单例 `db` 仍可用（兼容旧代码），按 moduleId 登记到注册表，单例转发到「当前激活」实例
 * - 模块冷启动时 ModuleRegistry 将作用域客户端注入 lifecycle（见 ModuleServices）
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

/** 数据库客户端异常（包含服务端返回的业务 code 与 HTTP status）。 */
export class DbError extends Error {
  /** 错误码（例如 "permission_denied"、"use_tx"）。 */
  code: string;
  /** HTTP 状态码；网络异常时为 0。 */
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** 交互式事务上下文（`db.tx` / `DbClient.tx` 回调参数）。 */
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

/**
 * 作用域数据库客户端：moduleId/token 与事务状态均封闭在实例内，
 * 多模块打包进同一 SAPI 运行时可安全并发。
 */
export interface DbClient {
  /** 绑定的模块唯一标识。 */
  readonly moduleId: string;
  /** 更新鉴权 token（不重建实例，保留进行中的事务状态）。 */
  setAuthToken(token: string): void;
  /** 当前实例是否处于 `tx` 交互式事务中。 */
  isTxRecording(): boolean;
  defineTable(name: string, columns: Record<string, ColumnDef>, opts?: { softDelete?: boolean }): Promise<void>;
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
  tx<T>(fn: (tx: TxContext) => Promise<T>): Promise<T>;
  audit(table: string, rowId: string | number, action: string, data?: Record<string, unknown>): Promise<void>;
  idempotent<T>(action: string, key: string, fn: () => Promise<T>): Promise<T>;
}

type StepOk = { ok: true; result: TxStepResult };
type SessionBegin = { ok: true; txId: string };

/** 规范化事务步骤对象（移除 undefined 字段，避免 JSON 序列化脏键）。 */
function normalizeStep(s: TxStep): TxStep {
  if (s.op === "query" && s.opts === undefined) delete (s as { opts?: unknown }).opts;
  if (s.op === "audit" && s.data === undefined) delete (s as { data?: unknown }).data;
  return s;
}

/**
 * 创建绑定到指定模块身份的数据库客户端（推荐路径）。
 * 事务 `_currentTxId` 仅存在于本闭包，不会全局互斥其它模块的 query/tx。
 */
export function createDbClient(moduleId: string, token: string): DbClient {
  if (!moduleId) {
    throw new DbError("[db] createDbClient 需要非空 moduleId", "unauthorized", 0);
  }

  const state = {
    token: token || "",
    currentTxId: null as string | null,
  };

  function authOpts(): HttpRequestAuthOpts | undefined {
    const t = (state.token || "").trim();
    return t ? { authToken: t } : undefined;
  }

  function withModuleId(path: string): string {
    return HttpDB.withModuleId(path, moduleId);
  }

  function requireModuleContext(op: string): void {
    if (!moduleId) {
      throw new DbError(`[db.${op}] 模块上下文未初始化`, "unauthorized", 0);
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

  async function txStep(txId: string, step: TxStep): Promise<TxStepResult> {
    const res = await post<StepOk>("/api/sfmc/db/tx/step", { txId, step: normalizeStep(step) });
    return res.result;
  }

  const client: DbClient = {
    get moduleId() {
      return moduleId;
    },
    setAuthToken(next: string) {
      state.token = next || "";
    },
    isTxRecording() {
      return state.currentTxId != null;
    },

    async defineTable(name, columns, opts) {
      requireModuleContext("defineTable");
      if (state.currentTxId) throw new DbError("defineTable 不可在事务内调用", "forbidden", 0);
      await post("/api/sfmc/db/define-table", {
        name,
        columns,
        softDelete: opts?.softDelete ?? true,
      });
    },

    async query(table, opts) {
      requireModuleContext("query");
      if (state.currentTxId) throw new DbError("query 不可直接调,请用 db.tx", "use_tx", 0);
      const res = await post<{ rows: Record<string, unknown>[] }>("/api/sfmc/db/query", {
        table,
        opts: opts ?? {},
      });
      return res.rows as never;
    },

    async get(table, id) {
      requireModuleContext("get");
      if (state.currentTxId) throw new DbError("get 不可直接调,请用 db.tx", "use_tx", 0);
      const res = await post<{ row: Record<string, unknown> | null }>("/api/sfmc/db/get", {
        table,
        id: String(id),
      });
      return res.row as never;
    },

    async insert(table, row) {
      requireModuleContext("insert");
      if (state.currentTxId) throw new DbError("insert 不可直接调,请用 db.tx", "use_tx", 0);
      const res = await post<InsertResult>("/api/sfmc/db/insert", { table, row });
      return res.row as never;
    },

    async update(table, id, patch) {
      requireModuleContext("update");
      if (state.currentTxId) throw new DbError("update 不可直接调,请用 db.tx", "use_tx", 0);
      const res = await post<UpdateResult>("/api/sfmc/db/update", {
        table,
        id: String(id),
        patch,
      });
      return res.row as never;
    },

    async delete(table, id, opts) {
      requireModuleContext("delete");
      if (state.currentTxId) throw new DbError("delete 不可直接调,请用 db.tx", "use_tx", 0);
      await post<DeleteResult>("/api/sfmc/db/delete", {
        table,
        id: String(id),
        hard: opts?.hard ?? false,
      });
    },

    async tx(fn) {
      requireModuleContext("tx");
      if (state.currentTxId) throw new DbError("嵌套事务暂不支持", "nested_tx", 0);

      const begin = await post<SessionBegin>("/api/sfmc/db/tx/begin", {});
      const txId = begin.txId;
      state.currentTxId = txId;

      const interactive: TxContext = {
        query: async (table, opts) => {
          const r = await txStep(txId, { op: "query", table, ...(opts ? { opts } : {}) });
          return (r.rows ?? []) as never;
        },
        get: async (table, id) => {
          const r = await txStep(txId, { op: "get", table, id: String(id) });
          return (r.row ?? null) as never;
        },
        insert: async (table, row) => {
          const r = await txStep(txId, { op: "insert", table, row });
          return (r.row ?? row) as never;
        },
        update: async (table, id, patch) => {
          const r = await txStep(txId, { op: "update", table, id: String(id), patch });
          return (r.row ?? ({ ...patch, id } as unknown)) as never;
        },
        delete: async (table, id, opts) => {
          await txStep(txId, { op: "delete", table, id: String(id), hard: opts?.hard ?? false });
        },
        audit: async (table, rowId, action, data) => {
          if (data) await txStep(txId, { op: "audit", table, rowId: String(rowId), action, data });
          else await txStep(txId, { op: "audit", table, rowId: String(rowId), action });
        },
        call: async (name, input) => {
          const r = await txStep(txId, { op: "service", name, input });
          return r.result as never;
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
        state.currentTxId = null;
      }
    },

    async audit(table, rowId, action, data) {
      requireModuleContext("audit");
      if (state.currentTxId) throw new DbError("audit 不可直接调,请用 db.tx", "use_tx", 0);
      if (data) await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action, data });
      else await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action });
    },

    async idempotent(action, key, fn) {
      requireModuleContext("idempotent");
      const probe = await post<{ replayed: boolean }>("/api/sfmc/db/idempotent/probe", { action, key });
      if (probe.replayed) {
        return undefined as never;
      }
      const result = await fn();
      await post("/api/sfmc/db/idempotent/commit", { action, key });
      return result;
    },
  };

  return client;
}

/* ── 兼容层：按 moduleId 登记 + 单例转发到「当前激活」实例 ── */

const _clients = new Map<string, DbClient>();
let _activeModuleId = "";

/**
 * 登记/刷新模块数据库身份，并激活为单例 `db` 的转发目标。
 * 同一 moduleId 重复调用时复用实例并更新 token（保留进行中的事务）。
 */
export function setDbModuleContext(moduleId: string, token: string): void {
  const existing = _clients.get(moduleId);
  if (existing) {
    existing.setAuthToken(token);
    _activeModuleId = moduleId;
    return;
  }
  _clients.set(moduleId, createDbClient(moduleId, token));
  _activeModuleId = moduleId;
}

/**
 * 按 moduleId 取出已登记的作用域客户端。
 * @throws {DbError} 尚未 setDbModuleContext / create 登记时抛出。
 */
export function getDbClient(moduleId: string): DbClient {
  const c = _clients.get(moduleId);
  if (!c) {
    throw new DbError(
      `[db] 未找到 moduleId=${moduleId} 的客户端（须先 setDbModuleContext / createDbClient 登记）`,
      "unauthorized",
      0
    );
  }
  return c;
}

/**
 * 清理模块数据库身份上下文。
 * @param moduleId 若指定则仅删除该模块；省略则清空全部。
 */
export function clearDbModuleContext(moduleId?: string): void {
  if (!moduleId) {
    _clients.clear();
    _activeModuleId = "";
    return;
  }
  _clients.delete(moduleId);
  if (_activeModuleId === moduleId) _activeModuleId = "";
}

function activeClient(): DbClient {
  if (!_activeModuleId) {
    throw new DbError(
      `[db] 模块上下文未初始化: setDbModuleContext 未调用（host-bootstrap/ModuleRegistry）`,
      "unauthorized",
      0
    );
  }
  const c = _clients.get(_activeModuleId);
  if (!c) {
    throw new DbError(
      `[db] 找不到已激活 moduleId=${_activeModuleId} 的客户端`,
      "unauthorized",
      0
    );
  }
  return c;
}

/**
 * 供 service 客户端检测「当前激活模块」是否处于 `db.tx` 中。
 * 作用域路径应改用配对 DbClient.isTxRecording()，避免跨模块误伤。
 */
export function isDbTxRecording(): boolean {
  if (!_activeModuleId) return false;
  const c = _clients.get(_activeModuleId);
  return c?.isTxRecording() ?? false;
}

/** SAPI 侧数据库门面（兼容单例）：转发到当前激活的作用域客户端。 */
export const db: Omit<DbClient, "moduleId" | "setAuthToken" | "isTxRecording"> = {
  defineTable(name, columns, opts) {
    return activeClient().defineTable(name, columns, opts);
  },
  query(table, opts) {
    return activeClient().query(table, opts);
  },
  get(table, id) {
    return activeClient().get(table, id);
  },
  insert(table, row) {
    return activeClient().insert(table, row);
  },
  update(table, id, patch) {
    return activeClient().update(table, id, patch);
  },
  delete(table, id, opts) {
    return activeClient().delete(table, id, opts);
  },
  tx(fn) {
    return activeClient().tx(fn);
  },
  audit(table, rowId, action, data) {
    return activeClient().audit(table, rowId, action, data);
  },
  idempotent(action, key, fn) {
    return activeClient().idempotent(action, key, fn);
  },
};
