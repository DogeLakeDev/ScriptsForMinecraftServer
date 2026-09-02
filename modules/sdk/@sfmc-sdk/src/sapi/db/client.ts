/**
 * client.ts — SAPI 侧数据库 HTTP 客户端门面
 *
 * 业务模块在 SAPI 运行态调用 `db.query(...)`、`db.tx(...)` 等门面方法，经 HttpDB 向 db-server 发起标准化 REST 请求。
 * 平台与模块严格解耦，模块通过本门面完成数据持久化，禁止手写原始 SQL 或直接访问原生文件系统。
 *
 * 鉴权与安全机制：
 * - 模块身份 `moduleId` 统一附加在请求 URL Query 中（`?moduleId=...`）
 * - 模块鉴权 Bearer token 按每次请求独立注入，避免全局静态变量污染（DIP 依赖倒置）
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

/* ── 模块身份上下文（由 ModuleRegistry.bootModule → setDbModuleContext 注入） ── */

let _moduleId = "";
let _authToken = "";
let _currentTxId: string | null = null;

/**
 * 注入当前模块的数据库访问身份（由 ModuleRegistry.bootModule 在模块初始化时调用）。
 *
 * @param moduleId 模块唯一标识符。
 * @param token 模块专属访问 token。
 */
export function setDbModuleContext(moduleId: string, token: string): void {
  _moduleId = moduleId;
  _authToken = token;
}

/**
 * 清理当前模块的数据库身份上下文。
 *
 * @param moduleId 可选的模块 id。若指定，则仅当与当前上下文匹配时才清空（迪米特法则：避免 A 模块操作误清空 B 模块上下文）；若省略则强制全量清空。
 */
export function clearDbModuleContext(moduleId?: string): void {
  if (moduleId && _moduleId !== moduleId) return;
  _moduleId = "";
  _authToken = "";
  _currentTxId = null;
}

/**
 * 供 service 客户端检测当前是否处于 `db.tx` 交互式事务会话中（与常规 `service.get` 互斥，事务内须改用 `tx.call`）。
 */
export function isDbTxRecording(): boolean {
  return _currentTxId != null;
}

/* ── HTTP 辅助 ──────────────────────────────────────────────────── */

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

function withModuleId(path: string): string {
  return HttpDB.withModuleId(path, _moduleId);
}

/** 空串不传 authToken，避免 nullish coalescing 被空字符串挡住 ConfigManager 默认回退。 */
function authOpts(): HttpRequestAuthOpts | undefined {
  const t = (_authToken || "").trim();
  return t ? { authToken: t } : undefined;
}

function requireModuleContext(op: string): void {
  if (!_moduleId) {
    throw new DbError(
      `[db.${op}] 模块上下文未初始化: setDbModuleContext 未调用（host-bootstrap/ModuleRegistry）`,
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
    // 保留服务端 code 与 step 细节，便于上层精细排查
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

/** 规范化事务步骤对象（移除 undefined 字段，避免 JSON 序列化脏键）。 */
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

/** SAPI 侧数据库门面：经 HttpDB 调用 db-server REST 接口，禁止原始 SQL。 */
export const db = {
  /**
   * 在模块初始化时声明所需的数据表结构。db-server schema-registry 收集后自动建表或升级表。
   *
   * @param name 数据表名称。
   * @param columns 列结构定义字典。
   * @param opts 表选项（如是否启用软删除 `softDelete`，默认开启）。
   */
  async defineTable(name: string, columns: Record<string, ColumnDef>, opts?: { softDelete?: boolean }): Promise<void> {
    requireModuleContext("defineTable");
    if (_currentTxId) throw new DbError("defineTable 不可在事务内调用", "forbidden", 0);
    await post("/api/sfmc/db/define-table", {
      name,
      columns,
      softDelete: opts?.softDelete ?? true,
    });
  },

  /**
   * 条件查询表数据行。
   *
   * @template T 返回行数据类型。
   * @param table 数据表名称。
   * @param opts 查询选项（包含过滤条件 where、排序 orderBy、分页 limit/offset 等）。
   * @returns 匹配的行记录数组。
   */
  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    opts?: QueryOptions
  ): Promise<T[]> {
    requireModuleContext("query");
    if (_currentTxId) throw new DbError("query 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<{ rows: T[] }>("/api/sfmc/db/query", { table, opts: opts ?? {} });
    return res.rows;
  },

  /**
   * 按主键查询单行数据；若记录不存在则返回 `null`。
   *
   * @template T 返回行数据类型。
   * @param table 数据表名称。
   * @param id 主键值。
   * @returns 匹配的行记录或 `null`。
   */
  async get<T extends Record<string, unknown> = Record<string, unknown>>(
    table: string,
    id: string | number
  ): Promise<T | null> {
    requireModuleContext("get");
    if (_currentTxId) throw new DbError("get 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<{ row: T | null }>("/api/sfmc/db/get", { table, id: String(id) });
    return res.row;
  },

  /**
   * 向指定数据表插入单行数据并返回插入后的完整数据行。
   *
   * @template T 插入数据类型。
   * @param table 数据表名称。
   * @param row 待插入的行数据对象。
   * @returns 包含自增主键等默认值的完整数据行。
   */
  async insert<T extends Record<string, unknown>>(table: string, row: T): Promise<T> {
    requireModuleContext("insert");
    if (_currentTxId) throw new DbError("insert 不可直接调,请用 db.tx", "use_tx", 0);
    const res = await post<InsertResult>("/api/sfmc/db/insert", { table, row });
    return res.row as T;
  },

  /**
   * 按主键部分更新数据表记录，并返回更新后的完整行。
   *
   * @template T 数据行类型。
   * @param table 数据表名称。
   * @param id 目标行主键值。
   * @param patch 待更新的字段补丁。
   * @returns 更新后的完整行记录。
   */
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

  /**
   * 按主键删除单行记录；默认执行软删除（标记 `is_deleted = 1`），传 `hard: true` 执行物理删除。
   *
   * @param table 数据表名称。
   * @param id 目标行主键值。
   * @param opts 删除选项，指定 `hard: true` 时物理删除。
   */
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
   * 开启数据库事务。事务边界由 db-server 进程统一管理，支持自动回滚与提交。
   *
   * 采用交互式会话协议（begin → step* → commit | rollback）：
   * 在回调函数内，执行 `tx.query`、`tx.get`、`tx.call` 均会实时等待服务端执行结果。
   *
   * @template T 事务回调返回值类型。
   * @param fn 事务执行函数，接收事务上下文 `tx`。
   * @returns 事务执行完成后的返回值。
   * @throws {DbError} 事务执行异常或服务端回滚时抛出。
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

  /**
   * 记录数据行审计日志（由平台统一写入 `_audit` 审计日志表）。
   *
   * @param table 数据表名称。
   * @param rowId 业务数据行主键。
   * @param action 审计操作标识（例如 "create"、"update"、"grant"）。
   * @param data 可选的附加上下文数据。
   */
  async audit(table: string, rowId: string | number, action: string, data?: Record<string, unknown>): Promise<void> {
    requireModuleContext("audit");
    if (_currentTxId) throw new DbError("audit 不可直接调,请用 db.tx", "use_tx", 0);
    if (data) await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action, data });
    else await post("/api/sfmc/db/audit", { table, rowId: String(rowId), action });
  },

  /**
   * 幂等执行异步业务任务。相同的 `action` 与 `key` 组合在成功执行后不会重复执行。
   *
   * @template T 任务执行返回值类型。
   * @param action 业务动作类别命名空间。
   * @param key 幂等去重唯一键（如订单号、请求 ID）。
   * @param fn 待执行的业务逻辑回调。
   * @returns 首次执行时返回执行结果；若已重放则返回 `undefined`。
   */
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
