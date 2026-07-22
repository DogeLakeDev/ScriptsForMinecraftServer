/**
 * routes/db-routes.ts — /api/sfmc/db/* 处理器
 *
 * 端点:
 *   POST /api/sfmc/db/define-table      body {name, columns, softDelete?} → {table, created}
 *   POST /api/sfmc/db/tx                body {steps[]}                   → TxResponse | TxError
 *   POST /api/sfmc/db/query             body {table, opts?}              → {rows}
 *   POST /api/sfmc/db/get               body {table, id}                 → {row}
 *   POST /api/sfmc/db/insert            body {table, row}                → {row}
 *   POST /api/sfmc/db/update            body {table, id, patch}          → {row}
 *   POST /api/sfmc/db/delete            body {table, id, hard?}          → {changes}
 *   POST /api/sfmc/db/audit             body {table, rowId, action, data?} → {ok}
 *   POST /api/sfmc/db/idempotent/probe  body {action, key}               → {replayed, cached?}
 *   POST /api/sfmc/db/idempotent/commit body {action, key, value?}       → {ok}
 *
 * 鉴权:handle() 校验后把 {id, permissions} 写到 ctx.moduleAuth(不挂 req)。
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import { json as defaultJson, type Method } from "../lib/http.js";
import { jsonV2Fail, type ModuleAuth } from "./_shared.js";
import type {
  DefineTableRequest,
  SchemaRegistry,
} from "../schema-registry.js";
import type {
  TxRequest,
  TxRunner,
  TxStep,
} from "../tx-runner.js";
import { PermissionDeniedError } from "../permission-gate.js";
import type { IdempotencyStore } from "../lib/idempotency-store.js";

export interface DbRoutesDeps {
  schemaRegistry: SchemaRegistry;
  txRunner: TxRunner;
  idempotent: IdempotencyStore;
  json?: typeof defaultJson;
}

export function createDbRoutes(depsIn: Partial<DbRoutesDeps>) {
  const deps = depsIn as Partial<DbRoutesDeps>;
  if (!deps.schemaRegistry || !deps.txRunner || !deps.idempotent) {
    throw new Error("createDbRoutes: 缺少 schemaRegistry / txRunner / idempotent");
  }
  const json = deps.json || defaultJson;

  return async (ctx: {
    path: string;
    method: Method | string;
    req: IncomingMessage;
    res: ServerResponse;
    body?: Promise<Record<string, unknown>> | Record<string, unknown>;
    moduleAuth?: ModuleAuth;
  }): Promise<boolean> => {
    const { path, method, res } = ctx;
    if (!path.startsWith("/api/sfmc/db/")) return false;
    if (method !== "POST" && method !== "DELETE") return false;

    const auth = ctx.moduleAuth ?? null;
    if (!auth) {
      jsonV2Fail(res, "unauthorized: module identity missing", 401, "unauthorized");
      return true;
    }

    const body = (await (ctx.body as Promise<Record<string, unknown>> | undefined)) || {};
    const moduleId = auth.id;

    if (path === "/api/sfmc/db/define-table") {
      try {
        const req2 = body as unknown as DefineTableRequest & { moduleId?: string };
        delete (req2 as { moduleId?: string }).moduleId;
        const result = deps.schemaRegistry!.define(moduleId, req2);
        json(res, { success: true, table: result.table, created: result.created }, 200);
      } catch (e) {
        json(res, { success: false, error: (e as Error).message }, 400);
      }
      return true;
    }

    if (path === "/api/sfmc/db/tx") {
      try {
        const txReq = body as unknown as TxRequest;
        // 强制以「鉴权身份」执行事务:忽略 body 里自带的 moduleId,
        // 既防止持 A 的 token 冒用 B 的权限越权,也修复客户端只发 {steps} 时
        // moduleId 缺失导致的事务恒被拒。
        const steps = Array.isArray(txReq.steps) ? txReq.steps : [];
        const result = await deps.txRunner!.run({ moduleId, steps });
        const status = result.ok ? 200 : 400;
        json(res, result as unknown as Record<string, unknown>, status);
      } catch (e) {
        json(res, { success: false, error: (e as Error).message }, 500);
      }
      return true;
    }

    type SingleOp = "query" | "get" | "insert" | "update" | "delete";
    const singles: { match: RegExp; op: SingleOp }[] = [
      { match: /^\/api\/sfmc\/db\/query$/, op: "query" },
      { match: /^\/api\/sfmc\/db\/get$/, op: "get" },
      { match: /^\/api\/sfmc\/db\/insert$/, op: "insert" },
      { match: /^\/api\/sfmc\/db\/update$/, op: "update" },
      { match: /^\/api\/sfmc\/db\/delete$/, op: "delete" },
    ];
    for (const cand of singles) {
      if (cand.match.test(path)) {
        try {
          const step = buildSingleStep(cand.op, body);
          const result = await deps.txRunner!.run({ moduleId, steps: [step] });
          if (!result.ok) {
            const code = result.code === "permission_denied" ? 403 : 400;
            json(res, { success: false, error: result.error, step: result.step, code: result.code }, code);
            return true;
          }
          const first = result.results[0];
          json(res, { success: true, ...unwrapResult(first, cand.op) }, 200);
        } catch (e) {
          if (e instanceof PermissionDeniedError) {
            json(res, { success: false, error: e.message, code: "permission_denied" }, 403);
            return true;
          }
          json(res, { success: false, error: (e as Error).message }, 500);
        }
        return true;
      }
    }

    if (path === "/api/sfmc/db/audit") {
      try {
        const step: TxStep = {
          op: "audit",
          table: String(body.table),
          rowId: String(body.rowId),
          action: String(body.action),
          ...(body.data ? { data: body.data as Record<string, unknown> } : {}),
        };
        const result = await deps.txRunner!.run({ moduleId, steps: [step] });
        if (!result.ok) {
          json(res, { success: false, error: result.error }, 400);
          return true;
        }
        json(res, { success: true });
      } catch (e) {
        json(res, { success: false, error: (e as Error).message }, 500);
      }
      return true;
    }

    const m = path.match(/^\/api\/sfmc\/db\/idempotent\/(probe|commit)$/);
    if (m) {
      try {
        if (m[1] === "probe") {
          const r = await deps.idempotent!.probe(
            moduleId,
            String(body.action),
            String(body.key)
          );
          json(res, r as unknown as Record<string, unknown>);
        } else {
          const r = await deps.idempotent!.commit(
            moduleId,
            String(body.action),
            String(body.key),
            body.value
          );
          json(res, { success: r.ok });
        }
      } catch (e) {
        json(res, { success: false, error: (e as Error).message }, 500);
      }
      return true;
    }

    return false;
  };
}

function buildSingleStep(op: "query" | "get" | "insert" | "update" | "delete", body: Record<string, unknown>): TxStep {
  switch (op) {
    case "query":
      return {
        op: "query",
        table: String(body.table),
        ...(body.opts ? { opts: body.opts as Parameters<typeof JSON.parse>[0] } : {}),
      } as TxStep;
    case "get":
      return { op: "get", table: String(body.table), id: String(body.id) };
    case "insert":
      return {
        op: "insert",
        table: String(body.table),
        row: body.row as Record<string, unknown>,
      };
    case "update":
      return {
        op: "update",
        table: String(body.table),
        id: String(body.id),
        patch: body.patch as Record<string, unknown>,
      };
    case "delete":
      return {
        op: "delete",
        table: String(body.table),
        id: String(body.id),
        hard: Boolean(body.hard),
      };
  }
}

interface UnwrappedRow {
  rows?: unknown[];
  row?: unknown;
  changes?: number;
}

function unwrapResult(r: unknown, op: string): UnwrappedRow {
  const step = r as { op: string; rows?: unknown[]; row?: unknown; changes?: number };
  switch (op) {
    case "query":
      return step.rows ? { rows: step.rows } : {};
    case "get":
    case "insert":
    case "update":
      return step.row !== undefined ? { row: step.row } : {};
    case "delete":
      return typeof step.changes === "number" ? { changes: step.changes } : {};
    default:
      return {};
  }
}
