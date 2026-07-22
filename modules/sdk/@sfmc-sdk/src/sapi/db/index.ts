/**
 * db/index.ts — @sfmc-bds/sdk/sapi/db 公开 API
 *
 * 模块作者 import:
 *   import { db, TxContext, DbError } from "@sfmc-bds/sdk/sapi/db";
 *
 * 设计:
 *   - db.query / get / insert / update / delete / audit / idempotent:单 RPC
 *   - db.tx(fn):把 fn 内写 step 录下来,一次性发 /api/sfmc/db/tx,server 端事务跑
 *     (query/get 在录制期不可用 — 避免 stub 假数据;交互读回需两阶段协议)
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
