/**
 * db/index.ts — @sfmc-bds/sdk/sapi/db 公开 API
 *
 * 模块作者 import:
 *   import { db, TxContext, DbError } from "@sfmc-bds/sdk/sapi/db";
 *
 * 设计:
 *   - db.query / get / insert / update / delete / audit / idempotent:单 RPC
 *   - db.tx(fn):交互会话 begin→step*→commit,回调内 await query/get/call 可读回真实结果
 *   - 不允许原始 SQL;只能传 WhereExpr 表达式树,平台翻译
 *   - 模块不能 require("fs");只能走这里
 */

export { db, setDbModuleContext, clearDbModuleContext, isDbTxRecording, DbError } from "./client.js";
export type { TxContext } from "./client.js";
export type {
  ColumnDef,
  ColumnType,
  WhereExpr,
  OrderBy,
  QueryOptions,
  Primitive,
  InsertResult,
  UpdateResult,
  DeleteResult,
  TxStep,
  TxStepResult,
  TxResponse,
  TxError,
  DefineTableRequest,
  DefineTableResponse,
} from "./types.js";

export const SFMC_SAPI_DB_VERSION = "0.1.0" as const;
