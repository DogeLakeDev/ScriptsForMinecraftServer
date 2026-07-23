/**
 * land-audit.ts — 领地审计日志查询
 *
 * 不走事务(只读),走 db.query。
 */

import { db } from "@sfmc-bds/sdk/sapi/db";
import type { WhereExpr } from "@sfmc-bds/sdk/sapi/db";

export interface AuditRow extends Record<string, unknown> {
  id: number;
  land_id: string;
  actor_id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: number;
}

export async function queryAuditLog(opts: {
  landId?: string;
  actorId?: string;
  action?: string;
  limit?: number;
} = {}): Promise<AuditRow[]> {
  const conditions: WhereExpr[] = [];
  if (opts.landId) conditions.push({ eq: ["land_id", opts.landId] });
  if (opts.actorId) conditions.push({ eq: ["actor_id", opts.actorId] });
  if (opts.action) conditions.push({ eq: ["action", opts.action] });
  const where: WhereExpr | undefined =
    conditions.length === 0
      ? undefined
      : conditions.length === 1
        ? conditions[0]!
        : { and: conditions };
  return db.query<AuditRow>("land_audit_logs", {
    ...(where ? { where } : {}),
    orderBy: { field: "created_at", dir: "desc" },
    limit: opts.limit ?? 50,
  });
}