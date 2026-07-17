/**
 * domain/land.ts — 领地业务逻辑
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SQL } from "sql-template-strings";
import type { QueryFn } from "../lib/sqlite.js";
import type { TxResult } from "./redpacket.js";

type Query = QueryFn;
type QueryAny = QueryFn;
type DBExec = { exec: (sql: string) => void };

function loadLandJson(projectRoot: string): Record<string, unknown> {
  try {
    const raw = JSON.parse(readFileSync(join(projectRoot, "configs", "land.json"), "utf-8")) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (String(k).startsWith("_comment") || k === "_comment") continue;
      out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function defaultLandPermissions(): Record<string, unknown> {
  return {
    allow_place: true,
    allow_destroy: true,
    attack_entity: false,
    open_container: false,
    use_door: true,
    use_button: true,
    use_redstone: true,
    interact_entity: true,
    pickup_item: true,
  };
}

function mapLandRow(query: Query, row: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!row) return {} as Record<string, unknown>;
  const members = query(
    "SELECT player_id, player_name_snapshot, role, expires_at FROM sfmc_land_members WHERE land_id=? ORDER BY created_at ASC",
    [row.id]
  ) as Array<Record<string, unknown>>;
  return {
    id: row.id,
    ownerplid: row.owner_player_id,
    ownerName: row.owner_name_snapshot,
    managers: members.filter((m) => m.role === "admin").map((m) => m.player_id),
    members,
    dimid: row.dimension,
    posA: { x: row.min_x, y: row.min_y, z: row.min_z },
    posB: { x: row.max_x, y: row.max_y, z: row.max_z },
    permissions: { ...defaultLandPermissions(), ...JSON.parse((row.protection_profile as string) ?? "{}") },
    nickname: row.name,
    createdAt: row.created_at,
    status: row.status,
    version: row.version,
    purchasePrice: row.purchase_price ?? 0,
    refundRate: row.refund_rate ?? 0.7,
  };
}

function auditLand(
  query: Query,
  landId: string,
  actorId: string,
  action: string,
  payload: Record<string, unknown> = {}
): void {
  query("INSERT INTO sfmc_land_audit_logs (land_id, actor_id, action, payload, created_at) VALUES (?,?,?,?,?)", [
    landId,
    actorId,
    action,
    JSON.stringify(payload),
    Date.now(),
  ]);
}

function canManageLand(query: Query, landId: string, actorId: string): boolean {
  const rows = query("SELECT owner_player_id FROM sfmc_lands WHERE id=? AND status='active'", [landId]) as Array<Record<string, unknown>>;
  const land = rows[0];
  if (!land || !actorId) return false;
  if (land.owner_player_id === String(actorId)) return true;
  const member = (
    query(
      "SELECT role FROM sfmc_land_members WHERE land_id=? AND player_id=? AND role IN ('owner','admin') AND (expires_at IS NULL OR expires_at>?)",
      [landId, String(actorId), Date.now()]
    ) as Array<Record<string, unknown>>
  )[0];
  return !!member;
}

function landMemberRole(query: Query, landId: string, actorId: string): string | null {
  const land = (
    query("SELECT owner_player_id FROM sfmc_lands WHERE id=?", [landId]) as Array<Record<string, unknown>>
  )[0];
  if (!land || !actorId) return null;
  if (land.owner_player_id === String(actorId)) return "owner";
  const member = (
    query("SELECT role FROM sfmc_land_members WHERE land_id=? AND player_id=? AND expires_at IS NULL", [
      landId,
      String(actorId),
    ]) as Array<Record<string, unknown>>
  )[0];
  return member ? (member.role as string) : null;
}

function canManageMember(query: Query, landId: string, actorId: string, targetRole: string | null = null): boolean {
  const actorRole = landMemberRole(query, landId, actorId);
  if (actorRole === "owner") return true;
  return actorRole === "admin" && targetRole !== "owner" && targetRole !== "admin";
}

function normalizeLandInput(
  data: Record<string, unknown>
): { dimid: number; minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number } | null {
  const a = (data.posA as Record<string, number>) ?? {};
  const b = (data.posB as Record<string, number>) ?? {};
  const values = [data.dimid, a.x, a.y, a.z, b.x, b.y, b.z];
  if (!values.every((v) => Number.isInteger(Number(v)))) return null;
  return {
    dimid: Number(data.dimid),
    minX: Math.min(Number(a.x), Number(b.x)),
    minY: Math.min(Number(a.y), Number(b.y)),
    minZ: Math.min(Number(a.z), Number(b.z)),
    maxX: Math.max(Number(a.x), Number(b.x)),
    maxY: Math.max(Number(a.y), Number(b.y)),
    maxZ: Math.max(Number(a.z), Number(b.z)),
  };
}

function validateLandInput(
  query: Query,
  data: Record<string, unknown>,
  projectRoot: string
):
  | {
      ok: false;
      error: string;
      status: number;
    }
  | {
      ok: true;
      price: number;
      square: number;
      volume: number;
      refundRate: number;
      normalized: { dimid: number; minX: number; minY: number; minZ: number; maxX: number; maxY: number; maxZ: number };
    } {
  const n = normalizeLandInput(data);
  if (!n || !data.ownerId) return { ok: false, error: "invalid", status: 400 };
  const width = n.maxX - n.minX + 1;
  const length = n.maxZ - n.minZ + 1;
  const height = n.maxY - n.minY + 1;
  const square = width * length;
  const volume = square * height;
  const settings = loadLandJson(projectRoot);
  let cfg: Record<string, unknown> = {
    priceFormula: "{square}*8+{height}*20",
    maxLandsPerPlayer: 5,
    minSquare: 4,
    maxSquare: 50000,
    discount: 1,
    refundRate: 0.7,
  };
  try {
    const landCfg = settings["land:config"];
    if (landCfg) cfg = { ...cfg, ...(landCfg as Record<string, unknown>) };
  } catch {}
  if (square < (cfg.minSquare as number) || square > (cfg.maxSquare as number)) {
    return { ok: false, error: "area_out_of_range", status: 400 };
  }
  const count = (
    query("SELECT COUNT(*) AS count FROM sfmc_lands WHERE owner_player_id=? AND status='active'", [
      String(data.ownerId),
    ]) as Array<{ count: number }>
  )[0]?.count;
  if ((count ?? 0) >= (cfg.maxLandsPerPlayer as number)) return { ok: false, error: "land_limit", status: 409 };
  const overlap = query(
    "SELECT id FROM sfmc_lands WHERE dimension=? AND status='active' AND min_x<=? AND max_x>=? AND min_y<=? AND max_y>=? AND min_z<=? AND max_z>=? LIMIT 1",
    [n.dimid, n.maxX, n.minX, n.maxY, n.minY, n.maxZ, n.minZ]
  ) as unknown[];
  if (overlap.length) return { ok: false, error: "overlap", status: 409 };
  const basePrice = evaluateLandFormula(String(cfg.priceFormula ?? "{square}*8+{height}*20"), {
    square,
    volume,
    height,
    width,
    length,
  });
  const price = Math.max(0, Math.floor(basePrice * Number(cfg.discount ?? 1)));
  const refundRate = Number(cfg.refundRate ?? 0.7);
  return { ok: true, price, square, volume, refundRate, normalized: n };
}

function evaluateLandFormula(
  formula: string,
  values: { square: number; volume: number; height: number; width: number; length: number }
): number {
  const expression = formula.replace(/\{(square|volume|height|width|length)\}/g, (_, key: string) =>
    String(Number((values as unknown as Record<string, number>)[key]) || 0)
  );
  if (!/^[0-9+\-*/().\s]+$/.test(expression)) return values.square * 8 + values.height * 20;
  const tokens: string[] = expression.match(/\d+(?:\.\d+)?|[()+\-*/]/g) ?? [];
  let index = 0;
  const primary = (): number => {
    const token = tokens[index++];
    if (token === "(") {
      const value = additive();
      index++;
      return value;
    }
    if (token === "-") return -primary();
    return Number(token);
  };
  const multiplicative = (): number => {
    let value = primary();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const op = tokens[index++];
      const rhs = primary();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  };
  const additive = (): number => {
    let value = multiplicative();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++];
      const rhs = multiplicative();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };
  try {
    const result = additive();
    return Number.isFinite(result) && result >= 0 ? result : values.square * 8 + values.height * 20;
  } catch {
    return values.square * 8 + values.height * 20;
  }
}

function landPrice(row: Record<string, unknown>): number {
  const purchasePrice = Number(row.purchase_price ?? 0);
  if (purchasePrice > 0) return Math.floor(purchasePrice * Math.max(0, Math.min(1, Number(row.refund_rate ?? 0.7))));
  const width = Number(row.max_x) - Number(row.min_x) + 1;
  const length = Number(row.max_z) - Number(row.min_z) + 1;
  const height = Number(row.max_y) - Number(row.min_y) + 1;
  const price = Math.max(0, Math.floor(width * length * 8 + height * 20));
  return Math.floor(price * 0.7);
}

function landRequestId(data: Record<string, unknown>): string {
  const requestId = (data.requestId as string | undefined)?.trim() ?? "";
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(requestId) ? requestId : "";
}

function replayLandOperation(
  query: Query,
  requestId: string,
  operationType: string,
  actorId: string
): { ok: boolean; error?: string; [k: string]: unknown } | null {
  if (!requestId) return null;
  const previous = (
    query("SELECT operation_type, actor_id, response_json FROM sfmc_land_operations WHERE request_id=?", [
      requestId,
    ]) as Array<Record<string, unknown>>
  )[0];
  if (!previous) return null;
  if (previous.operation_type !== operationType || String(previous.actor_id) !== String(actorId)) {
    return { ok: false, error: "request_id_conflict", message: "requestId 已用于其他领地操作。", status: 409 };
  }
  return { ...JSON.parse(previous.response_json as string), replayed: true };
}

function saveLandOperation(
  query: Query,
  requestId: string,
  operationType: string,
  actorId: string,
  landId: string | null,
  response: Record<string, unknown>
): void {
  if (!requestId) return;
  query(
    "INSERT INTO sfmc_land_operations (request_id, operation_type, actor_id, land_id, status, response_json, created_at) VALUES (?,?,?,?,?,?,?)",
    [
      requestId,
      operationType,
      String(actorId),
      landId ?? null,
      response.ok ? "completed" : "failed",
      JSON.stringify(response),
      Date.now(),
    ]
  );
}

function ensurePublicPlaza(query: Query, projectRoot: string): void {
  const existing = (query("SELECT id FROM sfmc_lands WHERE id='PUBLIC-PLAZA'") as Array<Record<string, unknown>>)[0];
  if (existing) return;
  let cfg: Record<string, unknown> = {
    dimid: 0,
    range: 32,
    name: "公共广场",
    welcome: "欢迎来到服务器！这里是公共领地，所有人都可以建造。",
  };
  try {
    const landCfg = loadLandJson(projectRoot);
    const plaza = landCfg["land:plaza"];
    if (plaza) cfg = { ...cfg, ...(plaza as Record<string, unknown>) };
  } catch {}
  const r = cfg.range as number;
  const minX = -r,
    minY = -64,
    minZ = -r,
    maxX = r,
    maxY = 320,
    maxZ = r;
  const id = "PUBLIC-PLAZA";
  const now = Date.now();
  query(
    "INSERT OR IGNORE INTO sfmc_lands (id, owner_player_id, owner_name_snapshot, dimension, min_x, min_y, min_z, max_x, max_y, max_z, name, status, created_at, updated_at, protection_profile) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [
      id,
      "system",
      "服务器",
      cfg.dimid,
      minX,
      minY,
      minZ,
      maxX,
      maxY,
      maxZ,
      cfg.name,
      "public",
      now,
      now,
      JSON.stringify({ allow_place: true, allow_destroy: true, open_container: true }),
    ]
  );
  query(
    "INSERT OR IGNORE INTO sfmc_land_members (land_id, player_id, player_name_snapshot, role, created_at) VALUES (?,?,?,?,?)",
    [id, "system", "服务器", "owner", now]
  );
  console.info("[DogeDB] 公共广场已初始化 (PUBLIC-PLAZA)。");
}

function createLandTransaction(
  query: Query,
  db: DBExec,
  data: Record<string, unknown>,
  projectRoot: string,
  ensureEconomyAccount: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number; [k: string]: unknown }
): Record<string, unknown> {
  const requestId = landRequestId(data);
  if (data.requestId && !requestId)
    return { ok: false, error: "invalid_request", message: "requestId 格式无效。", status: 400 };
  const now = Date.now();
  const id = `L${now.toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const ownerId = String(data.ownerId ?? "");
  if (!ownerId) return { ok: false, error: "invalid_request", message: "缺少 ownerId。", status: 400 };
  db.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayLandOperation(query, requestId, "land.create", ownerId);
    if (replay) {
      db.exec("COMMIT");
      return replay;
    }
    const check = validateLandInput(query, data, projectRoot);
    if (!check.ok) {
      db.exec("ROLLBACK");
      return check;
    }
    const n = check.normalized;
    const locked = validateLandInput(query, data, projectRoot);
    if (!locked.ok) {
      db.exec("ROLLBACK");
      return locked;
    }
    const account = ensureEconomyAccount(String(data.ownerId), String(data.ownerName ?? "")) as {
      balance: number;
      player_id: string;
      version: number;
    };
    if (account.balance < locked.price) {
      db.exec("ROLLBACK");
      return { ok: false, error: "insufficient_funds", balance: account.balance, price: locked.price, status: 409 };
    }
    query(
      "UPDATE sfmc_economy_accounts SET balance=balance-?, version=version+1, updated_at=? WHERE player_id=? AND balance>=?",
      [locked.price, now, account.player_id, locked.price]
    );
    const refundRate = Math.max(0, Math.min(1, Number(check.refundRate ?? 0.7)));
    const taxCfgFile = loadLandJson(projectRoot);
    let taxCfg: Record<string, unknown> = { enabled: false, defaultRate: 0 };
    try {
      const tax = taxCfgFile["land:tax"];
      if (tax) taxCfg = { ...taxCfg, ...(tax as Record<string, unknown>) };
    } catch {}
    const taxRate = taxCfg.enabled ? Number(taxCfg.defaultRate) || 0 : 0;
    query(
      "INSERT INTO sfmc_lands (id, owner_player_id, owner_name_snapshot, dimension, min_x, min_y, min_z, max_x, max_y, max_z, created_at, updated_at, purchase_price, refund_rate, tax_rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        String(data.ownerId),
        String(data.ownerName ?? ""),
        n.dimid,
        n.minX,
        n.minY,
        n.minZ,
        n.maxX,
        n.maxY,
        n.maxZ,
        now,
        now,
        locked.price,
        refundRate,
        taxRate,
      ]
    );
    query(
      "INSERT INTO sfmc_land_members (land_id, player_id, player_name_snapshot, role, created_at) VALUES (?,?,?,?,?)",
      [id, String(data.ownerId), String(data.ownerName ?? ""), "owner", now]
    );
    query(
      "INSERT INTO sfmc_economy_transactions (id, transaction_type, actor_id, source_player_id, target_player_id, amount, balance_before, balance_after, reference_type, reference_id, reason, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
        "land.purchase",
        String(data.ownerId),
        String(data.ownerId),
        null,
        locked.price,
        account.balance,
        account.balance - locked.price,
        "land",
        id,
        "购买土地",
        now,
      ]
    );
    auditLand(query, id, String(data.ownerId), "land.create", { price: locked.price });
    const row = (query("SELECT * FROM sfmc_lands WHERE id=?", [id]) as Array<Record<string, unknown>>)[0];
    const finalAccount = ensureEconomyAccount(account.player_id, "");
    const response: Record<string, unknown> = {
      ok: true,
      land: row ? mapLandRow(query, row) : null,
      price: locked.price,
      balance: finalAccount.balance,
      balanceBefore: account.balance,
      balanceAfter: finalAccount.balance,
      balanceVersion: finalAccount.version,
      transactionId: `LTX${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    };
    saveLandOperation(query, requestId, "land.create", ownerId, id, response);
    db.exec("COMMIT");
    return response;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    return { ok: false, error: (error as Error).message || "create_failed", status: 500 };
  }
}

export {
  auditLand,
  canManageLand,
  canManageMember,
  createLandTransaction,
  defaultLandPermissions,
  ensurePublicPlaza,
  evaluateLandFormula,
  landMemberRole,
  landPrice,
  landRequestId,
  loadLandJson,
  mapLandRow,
  normalizeLandInput,
  replayLandOperation,
  saveLandOperation,
  validateLandInput,
};

export type { DBExec as LandDB, Query as LandQuery, QueryAny as LandQueryAny };

// ────────────────────────────────────────────────────────────────────────────────
// 以下是新增的事务域与查询 —— 由 routes/lands.ts 迁出
// ────────────────────────────────────────────────────────────────────────────────

/** 兼容 lib/sqlite QueryFn —— any 类型允许 routes 层任意 query 调用 */
type AnyLandQuery = QueryAny;

const TABLE_LANDS = "sfmc_lands";
const TABLE_LAND_MEMBERS = "sfmc_land_members";
const TABLE_LAND_INVITES = "sfmc_land_invites";
const TABLE_LAND_AUDIT = "sfmc_land_audit_logs";
const TABLE_ACCOUNTS = "sfmc_economy_accounts";
const TABLE_TX = "sfmc_economy_transactions";

function newTxId(now: number): string {
  return `E${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function nowMs(): number {
  return Date.now();
}

// ── 读取函数 ────────────────────────────────────────────────────────────

export function listActiveLands(query: AnyLandQuery): Array<Record<string, unknown>> {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LANDS} WHERE status = 'active' ORDER BY created_at ASC`
  );
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

export function listActiveLandsByOwner(
  query: AnyLandQuery,
  ownerPlayerId: string
): Array<Record<string, unknown>> {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LANDS}
           WHERE owner_player_id = ${ownerPlayerId} AND status = 'active'
           ORDER BY created_at ASC`
  );
  return Array.isArray(rows) ? (rows as Array<Record<string, unknown>>) : [];
}

export function findLandById(query: AnyLandQuery, id: string): Record<string, unknown> | null {
  const rows = query(SQL`SELECT * FROM ${TABLE_LANDS} WHERE id = ${id}`) as Array<
    Record<string, unknown>
  >;
  return rows[0] ?? null;
}

export function findLandAt(
  query: AnyLandQuery,
  dim: number,
  x: number,
  y: number,
  z: number
): Record<string, unknown> | null {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LANDS}
           WHERE dimension = ${dim} AND status = 'active'
             AND min_x <= ${x} AND max_x >= ${x}
             AND min_y <= ${y} AND max_y >= ${y}
             AND min_z <= ${z} AND max_z >= ${z}
           LIMIT 1`
  ) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function listLandAudit(query: AnyLandQuery, id: string): unknown[] {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LAND_AUDIT}
           WHERE land_id = ${id} ORDER BY created_at DESC LIMIT 100`
  );
  return Array.isArray(rows) ? rows : [];
}

export function expirePendingInvitesForInvitee(
  query: AnyLandQuery,
  inviteeId: string,
  now: number = nowMs()
): void {
  query(
    SQL`UPDATE ${TABLE_LAND_INVITES}
            SET status = 'expired'
            WHERE invitee_id = ${inviteeId} AND status = 'pending' AND expires_at <= ${now}`
  );
}

export function listActiveInvitesForInvitee(
  query: AnyLandQuery,
  inviteeId: string,
  now: number = nowMs()
): unknown[] {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LAND_INVITES}
            WHERE invitee_id = ${inviteeId} AND status = 'pending' AND expires_at > ${now}
            ORDER BY created_at ASC`
  );
  return Array.isArray(rows) ? rows : [];
}

export function findInviteById(
  query: AnyLandQuery,
  inviteId: string,
  inviteeId: string
): Record<string, unknown> | null {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LAND_INVITES}
            WHERE id = ${inviteId} AND invitee_id = ${inviteeId} AND status = 'pending'
              AND expires_at > ${nowMs()}`
  ) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function findInviteByIdAnyStatus(
  query: AnyLandQuery,
  inviteId: string,
  inviteeId: string
): Record<string, unknown> | null {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LAND_INVITES}
            WHERE id = ${inviteId} AND invitee_id = ${inviteeId} AND status = 'pending'`
  ) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function findInviteByIdForLand(
  query: AnyLandQuery,
  inviteId: string,
  landId: string
): Record<string, unknown> | null {
  const rows = query(
    SQL`SELECT * FROM ${TABLE_LAND_INVITES}
            WHERE id = ${inviteId} AND land_id = ${landId} AND status = 'pending'`
  ) as Array<Record<string, unknown>>;
  return rows[0] ?? null;
}

export function revokeLandInvite(query: AnyLandQuery, landId: string, inviteId: string): void {
  query(
    SQL`UPDATE ${TABLE_LAND_INVITES} SET status = 'revoked' WHERE id = ${inviteId} AND land_id = ${landId}`
  );
}

export function declineLandInvite(
  query: AnyLandQuery,
  inviteeId: string,
  inviteId: string
): void {
  query(
    SQL`UPDATE ${TABLE_LAND_INVITES}
            SET status = 'declined'
            WHERE id = ${inviteId} AND invitee_id = ${inviteeId} AND status = 'pending'`
  );
}

/** 创建邀请 (POST /api/sfmc/lands/{id}/members 等) */
export function createLandInvite(
  query: AnyLandQuery,
  landId: string,
  inviterId: string,
  inviteeId: string,
  role: string,
  expiresAt: number,
  now: number = nowMs()
): string {
  const inviteId = `I${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  query(
    SQL`INSERT INTO ${TABLE_LAND_INVITES}
            (id, land_id, inviter_id, invitee_id, role, expires_at, created_at)
            VALUES (${inviteId}, ${landId}, ${inviterId}, ${inviteeId},
                    ${role}, ${expiresAt}, ${now})`
  );
  return inviteId;
}

/** 接受一个领地的邀请 */
export function acceptLandInvite(
  query: AnyLandQuery,
  invite: Record<string, unknown>,
  inviteeId: string,
  playerName: string
): Record<string, unknown> | null {
  const landId = String(invite.land_id ?? "");
  const role = String(invite.role ?? "builder");
  query(
    SQL`INSERT INTO ${TABLE_LAND_MEMBERS}
            (land_id, player_id, player_name_snapshot, role, created_at, expires_at)
            VALUES (${landId}, ${inviteeId}, ${String(playerName || inviteeId)},
                    ${role}, ${nowMs()}, ${null})
            ON CONFLICT(land_id, player_id) DO UPDATE SET
              player_name_snapshot = excluded.player_name_snapshot,
              role = excluded.role,
              expires_at = excluded.expires_at`
  );
  query(SQL`UPDATE ${TABLE_LAND_INVITES} SET status = 'accepted' WHERE id = ${invite.id}`);
  query(
    SQL`UPDATE ${TABLE_LANDS}
            SET updated_at = ${nowMs()}, version = version + 1
            WHERE id = ${landId}`
  );
  return findLandById(query, landId);
}

/** 列出 land 成员当前 role（用于 actor 权限校验） */
export function getMemberRole(
  query: AnyLandQuery,
  landId: string,
  playerId: string,
  now: number = nowMs()
): string | null {
  const rows = query(
    SQL`SELECT role FROM ${TABLE_LAND_MEMBERS}
           WHERE land_id = ${landId} AND player_id = ${playerId}
             AND (expires_at IS NULL OR expires_at > ${now})`
  ) as Array<{ role: string }>;
  return rows[0]?.role ?? null;
}

/** 简单地更新 land 成员 role */
export function setLandMemberRole(
  query: AnyLandQuery,
  landId: string,
  playerId: string,
  role: string
): void {
  query(
    SQL`UPDATE ${TABLE_LAND_MEMBERS}
            SET role = ${role}
            WHERE land_id = ${landId} AND player_id = ${playerId}`
  );
  query(
    SQL`UPDATE ${TABLE_LANDS}
            SET updated_at = ${nowMs()}, version = version + 1
            WHERE id = ${landId}`
  );
}

/** 移除 land 成员 */
export function removeLandMember(
  query: AnyLandQuery,
  landId: string,
  playerId: string
): void {
  query(
    SQL`DELETE FROM ${TABLE_LAND_MEMBERS}
            WHERE land_id = ${landId} AND player_id = ${playerId}
              AND player_id <> (SELECT owner_player_id FROM ${TABLE_LANDS} WHERE id = ${landId})`
  );
  query(
    SQL`UPDATE ${TABLE_LANDS}
            SET updated_at = ${nowMs()}, version = version + 1
            WHERE id = ${landId}`
  );
}

/** 更新 land nickname / permissions (version + 1) */
export function updateLandMeta(
  query: AnyLandQuery,
  landId: string,
  patch: { nickname?: string; permissions?: Record<string, unknown> }
): { ok: boolean } {
  const stmt = SQL`UPDATE ${TABLE_LANDS} SET version = version + 1, updated_at = ${nowMs()}`;
  if (patch.nickname !== undefined) {
    stmt.append(SQL`, name = ${patch.nickname}`);
  }
  if (patch.permissions !== undefined) {
    stmt.append(SQL`, protection_profile = ${JSON.stringify(patch.permissions)}`);
  }
  stmt.append(SQL` WHERE id = ${landId} AND status = 'active'`);
  const result = query(stmt) as { changes?: number };
  return { ok: (result.changes ?? 0) > 0 };
}

// ── 事务域 ─────────────────────────────────────────────────────────────

/** 土地转让 */
export function transferLandTx(
  query: AnyLandQuery,
  db: DBExec,
  data: Record<string, unknown>
): TxResult<{ transactionId: string; land: Record<string, unknown> | null }> {
  const id = String(data.id ?? "");
  const requestId = landRequestId(data);
  if (data.requestId && !requestId) {
    return { ok: false, error: "invalid_request", status: 400 };
  }
  const actorId = String(data.actorId ?? "");
  const targetId = String(data.targetId ?? "");

  db.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayLandOperation(query, requestId, "land.transfer", actorId);
    if (replay) {
      db.exec("COMMIT");
      return {
        ok: true,
        data: replay as unknown as {
          transactionId: string;
          land: Record<string, unknown> | null;
        },
      };
    }
    const landRow = findLandById(query, id) as Record<string, unknown> | null;
    if (!landRow || landRow.status !== "active") {
      db.exec("ROLLBACK");
      return { ok: false, error: "not_found", status: 404 };
    }
    if (String(landRow.owner_player_id) !== actorId) {
      db.exec("ROLLBACK");
      return { ok: false, error: "forbidden", status: 403 };
    }
    if (targetId === actorId) {
      db.exec("ROLLBACK");
      return { ok: false, error: "invalid_target", status: 400 };
    }
    const expectedVersion = data.expectedVersion;
    if (expectedVersion !== undefined && Number(expectedVersion) !== Number(landRow.version)) {
      db.exec("ROLLBACK");
      return { ok: false, error: "version_conflict", status: 409 };
    }
    const upd = query(
      SQL`UPDATE ${TABLE_LANDS}
              SET owner_player_id = ${targetId},
                  owner_name_snapshot = ${String(data.targetName ?? "")},
                  updated_at = ${nowMs()}, version = version + 1
              WHERE id = ${id} AND status = 'active'
                AND owner_player_id = ${actorId}
                AND version = ${Number(landRow.version ?? 0)}`
    ) as { changes?: number };
    if (!upd.changes) {
      db.exec("ROLLBACK");
      return { ok: false, error: "version_conflict", status: 409 };
    }
    query(
      SQL`UPDATE ${TABLE_LAND_MEMBERS}
              SET role = 'admin'
              WHERE land_id = ${id} AND role = 'owner'`
    );
    query(
      SQL`INSERT INTO ${TABLE_LAND_MEMBERS}
              (land_id, player_id, player_name_snapshot, role, created_at)
              VALUES (${id}, ${targetId}, ${String(data.targetName ?? "")},
                      ${"owner"}, ${nowMs()})
              ON CONFLICT(land_id, player_id) DO UPDATE SET
                player_name_snapshot = excluded.player_name_snapshot,
                role = excluded.role,
                expires_at = NULL`
    );
    auditLand(query, id, actorId, "land.transfer", { targetId });
    const finalLand = findLandById(query, id);
    const transactionId = `LTX${nowMs().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const response: Record<string, unknown> = {
      ok: true,
      transactionId,
      land: finalLand ? mapLandRow(query, finalLand) : null,
    };
    saveLandOperation(query, requestId, "land.transfer", actorId, id, response);
    db.exec("COMMIT");
    return { ok: true, data: { transactionId, land: finalLand } };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: (error as Error).message || "transaction_failed",
      status: 500,
    };
  }
}

/** 收地皮税 */
export function collectLandTaxTx(
  query: AnyLandQuery,
  db: DBExec,
  data: Record<string, unknown>,
  projectRoot: string,
  ensureEconomyAccount: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number } | undefined
): TxResult<{ taxCollected: number; balance: number; frozen: boolean } | { taxCollected: 0 }> {
  const tid = String(data.landId ?? data.id ?? "");
  const cfg = loadLandJson(projectRoot);
  const taxCfg: Record<string, unknown> = { periodDays: 7, fallbackPurchasePrice: 100, freezeOnInsufficient: true };
  try {
    const t = cfg["land:tax"];
    if (t) Object.assign(taxCfg, t as Record<string, unknown>);
  } catch {
    /* ignore */
  }

  const land = findLandById(query, tid);
  if (!land || land.status !== "active") {
    return { ok: false, error: "not_found", status: 404 };
  }
  const taxRate = Number(land.tax_rate ?? 0);
  if (taxRate <= 0) {
    return {
      ok: true,
      data: { taxCollected: 0, balance: 0, frozen: false, message: "免税" } as never,
    };
  }
  const periodMs = (Number(taxCfg.periodDays) || 7) * 86400000;
  const fallbackPrice = Number(taxCfg.fallbackPurchasePrice) || 100;
  const taxAmount = Math.floor(
    ((Number(land.purchase_price) || fallbackPrice) * taxRate) / 10000
  );
  if (taxAmount <= 0) {
    return { ok: true, data: { taxCollected: 0, balance: 0, frozen: false } as never };
  }

  const actorId = String(data.actorId ?? "");
  const freezeOnInsufficient = taxCfg.freezeOnInsufficient === true;
  db.exec("BEGIN IMMEDIATE");
  try {
    const account = ensureEconomyAccount(
      String(land.owner_player_id),
      String(land.owner_name_snapshot ?? "")
    );
    if (!account) {
      db.exec("ROLLBACK");
      return { ok: false, error: "ensure_account_failed", status: 500 };
    }
    if (account.balance < taxAmount) {
      if (freezeOnInsufficient) {
        query(
          SQL`UPDATE ${TABLE_LANDS}
                  SET tax_frozen = 1, updated_at = ${nowMs()}
                  WHERE id = ${tid}`
        );
      }
      db.exec("COMMIT");
      return {
        ok: true,
        data: { taxCollected: 0, balance: account.balance, frozen: freezeOnInsufficient } as never,
      };
    }
    query(
      SQL`UPDATE ${TABLE_ACCOUNTS}
              SET balance = balance - ${taxAmount},
                  version = version + 1,
                  updated_at = ${nowMs()}
              WHERE player_id = ${String(land.owner_player_id)} AND balance >= ${taxAmount}`
    );
    const taxNow = nowMs();
    const tx = newTxId(taxNow);
    query(
      SQL`INSERT INTO ${TABLE_TX}
              (id, transaction_type, actor_id, source_player_id, target_player_id,
               amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
              VALUES (${tx}, ${"land.tax"}, ${actorId},
                      ${String(land.owner_player_id)}, ${null},
                      ${taxAmount}, ${account.balance}, ${account.balance - taxAmount},
                      ${"land"}, ${tid}, ${"地皮税"}, ${taxNow})`
    );
    query(
      SQL`UPDATE ${TABLE_LANDS}
              SET tax_due_at = ${taxNow + periodMs},
                  tax_frozen = 0,
                  updated_at = ${taxNow}
              WHERE id = ${tid}`
    );
    auditLand(query, tid, actorId, "land.tax", { collected: taxAmount });
    db.exec("COMMIT");
    return {
      ok: true,
      data: { taxCollected: taxAmount, balance: account.balance - taxAmount, frozen: false } as never,
    };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: (error as Error).message || "tax_collect_failed",
      status: 500,
    };
  }
}

/** 删除领地（含退款 + 经济事务） */
export function deleteLandTx(
  query: AnyLandQuery,
  db: DBExec,
  data: Record<string, unknown>,
  ensureEconomyAccount: (
    playerId: string,
    playerName: string
  ) => { balance: number; player_id: string; version: number } | undefined
): TxResult<{
  refund: number;
  balance: number;
  balanceBefore: number;
  balanceAfter: number;
  balanceVersion: number;
  transactionId: string;
  version: number;
}> {
  const id = String(data.id ?? "");
  const requestId = landRequestId(data);
  if (data.requestId && !requestId) {
    return { ok: false, error: "invalid_request", status: 400 };
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const replay = replayLandOperation(query, requestId, "land.delete", String(data.actorId));
    if (replay) {
      db.exec("COMMIT");
      return { ok: true, data: replay as never };
    }
    const land = findLandById(query, id);
    if (!land) {
      db.exec("ROLLBACK");
      return { ok: false, error: "not_found", status: 404 };
    }
    if (land.status !== "active") {
      db.exec("ROLLBACK");
      return { ok: false, error: "already_deleted", status: 409 };
    }
    if (String(data.actorId) !== String(land.owner_player_id)) {
      db.exec("ROLLBACK");
      return { ok: false, error: "forbidden", status: 403 };
    }
    if (data.expectedVersion !== undefined && Number(data.expectedVersion) !== Number(land.version)) {
      db.exec("ROLLBACK");
      return { ok: false, error: "version_conflict", status: 409 };
    }
    const refund = landPrice(land);
    const account = ensureEconomyAccount(
      String(land.owner_player_id),
      String(land.owner_name_snapshot ?? "")
    );
    if (!account) {
      db.exec("ROLLBACK");
      return { ok: false, error: "ensure_account_failed", status: 500 };
    }
    const del = query(
      SQL`UPDATE ${TABLE_LANDS}
              SET status = 'deleted', updated_at = ${nowMs()}, version = version + 1
              WHERE id = ${id} AND status = 'active'
                AND owner_player_id = ${String(data.actorId)}
                AND version = ${Number(land.version ?? 0)}`
    ) as { changes?: number };
    if (!del.changes) {
      db.exec("ROLLBACK");
      return { ok: false, error: "version_conflict", status: 409 };
    }
    if (refund > 0) {
      query(
        SQL`UPDATE ${TABLE_ACCOUNTS}
                SET balance = balance + ${refund},
                    version = version + 1,
                    updated_at = ${nowMs()}
                WHERE player_id = ${String(land.owner_player_id)}`
      );
      const tx = newTxId(nowMs());
      query(
        SQL`INSERT INTO ${TABLE_TX}
                (id, transaction_type, actor_id, source_player_id, target_player_id,
                 amount, balance_before, balance_after, reference_type, reference_id, reason, created_at)
                VALUES (${tx}, ${"land.refund"}, ${String(data.actorId)},
                        ${null}, ${String(land.owner_player_id)},
                        ${refund}, ${account.balance}, ${account.balance + refund},
                        ${"land"}, ${id}, ${"删除土地退款"}, ${nowMs()})`
      );
    }
    const finalAccount = ensureEconomyAccount(String(land.owner_player_id), "");
    const balance = finalAccount?.balance ?? 0;
    const transactionId = `LTX${nowMs().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    auditLand(query, id, String(data.actorId), "land.delete", { refund, transactionId });
    const response: Record<string, unknown> = {
      ok: true,
      refund,
      balance,
      balanceBefore: account.balance,
      balanceAfter: balance,
      balanceVersion: finalAccount?.version ?? 0,
      transactionId,
      version: Number(land.version ?? 0) + 1,
    };
    saveLandOperation(query, requestId, "land.delete", String(data.actorId), id, response);
    db.exec("COMMIT");
    return { ok: true, data: response as never };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      error: (error as Error).message || "transaction_failed",
      status: 500,
    };
  }
}