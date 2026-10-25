/**
 * activity-log.test.ts — 行为日志只读查询 / 统计与微信玩家行为记录路由
 *
 * 用内存 SQLite 模拟 sfmc-module-activity-log 建出的 activities 表（含软删除列），覆盖：
 * 模块未安装、筛选与分页、关键词转义、软删除、参数校验、活跃玩家排除非玩家来源、
 * 只读打开业务库文件，以及微信玩家只能看到自己记录（忽略传入的 actorId）。
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import type http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { codeTakenBy, type BindProvider } from "../src/domain/bind-providers.js";
import {
  ActivityQueryError,
  parseActivityFilter,
  parseActivityPaging,
  queryActivityPage,
  queryActivityStats,
  readActivityPage,
} from "../src/domain/activity-log.js";
import { initSchema } from "../src/domain/schema.js";
import { confirmWechatBind, createWechatBindProvider, requestWechatBindCode } from "../src/domain/wechat-bind.js";
import { createQuery, type QueryFn } from "../src/lib/sqlite.js";
import { createWechatActivityRoutes } from "../src/routes/wechat-activity.js";

/** 与模块 defineTable("activities") 等价的表结构（模块默认启用软删除） */
const CREATE_ACTIVITIES = `CREATE TABLE activities (
  id TEXT PRIMARY KEY, timestamp INTEGER, event_type TEXT, actor_id TEXT, actor_name TEXT, target_id TEXT,
  dimension TEXT, x REAL, y REAL, z REAL, level TEXT, payload_json TEXT, created_at INTEGER, _deleted_at INTEGER
)`;

/** 测试用的一条记录；未给出的字段取默认值 */
interface Row {
  id: string;
  timestamp: number;
  event_type: string;
  actor_id?: string;
  actor_name?: string;
  target_id?: string;
  level?: string;
  payload?: Record<string, unknown>;
  deleted?: boolean;
}

/** 写入若干记录 */
function insert(db: DatabaseSync, rows: Row[]) {
  const statement = db.prepare(
    `INSERT INTO activities (id, timestamp, event_type, actor_id, actor_name, target_id, dimension, x, y, z, level, payload_json, created_at, _deleted_at)
     VALUES (?, ?, ?, ?, ?, ?, 'minecraft:overworld', 1, 64, -2, ?, ?, ?, ?)`
  );
  for (const row of rows) {
    statement.run(
      row.id,
      row.timestamp,
      row.event_type,
      row.actor_id ?? "",
      row.actor_name ?? "",
      row.target_id ?? "",
      row.level ?? "info",
      JSON.stringify(row.payload ?? {}),
      row.timestamp,
      row.deleted ? row.timestamp : null
    );
  }
}

/** 两名玩家 + 一次爆炸（actor_id 为实体类型）+ 一条已软删除的记录 */
const SAMPLE: Row[] = [
  { id: "a1", timestamp: 1000, event_type: "player.join", actor_id: "p-steve", actor_name: "Steve" },
  { id: "a2", timestamp: 2000, event_type: "block.break", actor_id: "p-steve", actor_name: "Steve", target_id: "minecraft:stone" },
  { id: "a3", timestamp: 3000, event_type: "player.chat", actor_id: "p-steve", actor_name: "Steve", payload: { message: "100% 好玩_" } },
  { id: "a4", timestamp: 4000, event_type: "player.join", actor_id: "p-alex", actor_name: "Alex" },
  { id: "a5", timestamp: 5000, event_type: "block.place", actor_id: "p-alex", actor_name: "Alex", target_id: "minecraft:dirt" },
  { id: "a6", timestamp: 6000, event_type: "world.explosion", actor_id: "minecraft:creeper", level: "warn", payload: { impactedBlocks: 12 } },
  { id: "a7", timestamp: 7000, event_type: "player.chat", actor_id: "p-alex", actor_name: "Alex", payload: { message: "已删除" }, deleted: true },
];

/** 新建一份带业务表结构与行为日志表的内存库 */
function setup(withActivities = true) {
  const db = new DatabaseSync(":memory:");
  initSchema(db);
  if (withActivities) {
    db.exec(CREATE_ACTIVITIES);
    insert(db, SAMPLE);
  }
  return { db, query: createQuery(db) };
}

const ids = (records: { id: string }[]) => records.map((record) => record.id);

test("模块未安装（表不存在）：查询与统计都返回 installed: false", () => {
  const { query } = setup(false);
  assert.deepEqual(queryActivityPage(query, {}, { limit: 10, offset: 0 }), { installed: false, records: [], total: 0, limit: 10, offset: 0 });
  assert.equal(queryActivityStats(query, {}).installed, false);
});

test("查询：按时间倒序分页，total 为精确总数且排除软删除", () => {
  const { query } = setup();
  const first = queryActivityPage(query, {}, { limit: 4, offset: 0 });
  assert.equal(first.installed, true);
  assert.equal(first.total, 6);
  assert.deepEqual(ids(first.records), ["a6", "a5", "a4", "a3"]);
  const second = queryActivityPage(query, {}, { limit: 4, offset: 4 });
  assert.deepEqual(ids(second.records), ["a2", "a1"]);
  assert.deepEqual(first.records[1], {
    id: "a5",
    timestamp: 5000,
    eventType: "block.place",
    actorId: "p-alex",
    actorName: "Alex",
    targetId: "minecraft:dirt",
    dimension: "minecraft:overworld",
    x: 1,
    y: 64,
    z: -2,
    level: "info",
    payload: {},
  });
});

test("查询：分类前缀、精确类型、玩家、级别与时间范围组合", () => {
  const { query } = setup();
  const page = (filter: Record<string, unknown>) => ids(queryActivityPage(query, parseActivityFilter(filter), { limit: 50, offset: 0 }).records);
  assert.deepEqual(page({ eventTypePrefix: "block." }), ["a5", "a2"]);
  // 精确类型优先于分类前缀
  assert.deepEqual(page({ eventType: "player.join", eventTypePrefix: "block." }), ["a4", "a1"]);
  assert.deepEqual(page({ actorId: "p-steve", from: 1500, to: 3000 }), ["a3", "a2"]);
  assert.deepEqual(page({ level: "warn" }), ["a6"]);
});

test("查询：关键词匹配聊天内容与目标，% 和 _ 按字面匹配", () => {
  const { query } = setup();
  const page = (keyword: string) => ids(queryActivityPage(query, { keyword }, { limit: 50, offset: 0 }).records);
  assert.deepEqual(page("100%"), ["a3"]);
  assert.deepEqual(page("玩_"), ["a3"]);
  assert.deepEqual(page("%"), ["a3"]);
  assert.deepEqual(page("dirt"), ["a5"]);
  assert.deepEqual(page("已删除"), []);
});

test("参数校验：非法级别、时间倒置、换行报 ActivityQueryError；分页限制在合法范围", () => {
  assert.throws(() => parseActivityFilter({ level: "debug" }), ActivityQueryError);
  assert.throws(() => parseActivityFilter({ from: 10, to: 5 }), ActivityQueryError);
  assert.throws(() => parseActivityFilter({ keyword: "a\nb" }), ActivityQueryError);
  assert.throws(() => parseActivityFilter({ from: "abc" }), ActivityQueryError);
  assert.deepEqual(parseActivityFilter({ from: "100", to: "200", keyword: "  " }), { from: 100, to: 200 });
  assert.deepEqual(parseActivityPaging({}), { limit: 50, offset: 0 });
  assert.deepEqual(parseActivityPaging({ limit: "100000", offset: "-3" }), { limit: 500, offset: 0 });
  assert.deepEqual(parseActivityPaging({ limit: 20.9, offset: 40.2 }), { limit: 20, offset: 40 });
});

test("统计：事件分布降序；活跃玩家只算产生过 player.* 事件的执行者（排除爆炸来源）", () => {
  const { query } = setup();
  const stats = queryActivityStats(query, {});
  assert.equal(stats.total, 6);
  assert.equal(stats.actors, 2);
  assert.deepEqual(stats.byType[0], { eventType: "player.join", count: 2 });
  assert.deepEqual(
    stats.byLevel.sort((a, b) => a.level.localeCompare(b.level)),
    [
      { level: "info", count: 5 },
      { level: "warn", count: 1 },
    ]
  );
  assert.deepEqual(stats.topActors, [
    { actorId: "p-steve", actorName: "Steve", count: 3 },
    { actorId: "p-alex", actorName: "Alex", count: 2 },
  ]);
  // 筛选条件同样作用于统计；时间范围内只有方块事件时，玩家仍按全表的 player.* 判定
  const blocks = queryActivityStats(query, { eventTypePrefix: "block." });
  assert.equal(blocks.total, 2);
  assert.equal(blocks.actors, 2);
});

test("只读打开业务库文件：文件不存在按未安装返回，存在时可查询", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sfmc-activity-"));
  try {
    const file = path.join(dir, "business.db");
    assert.equal(readActivityPage(file, {}, { limit: 10, offset: 0 }).installed, false);
    const db = new DatabaseSync(file);
    db.exec(CREATE_ACTIVITIES);
    insert(db, SAMPLE.slice(0, 2));
    db.close();
    const page = readActivityPage(file, {}, { limit: 10, offset: 0 });
    assert.deepEqual({ installed: page.installed, total: page.total }, { installed: true, total: 2 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** 调用微信行为记录路由，返回响应体与状态码 */
async function callRoute(query: QueryFn, search: string) {
  let captured: { data: Record<string, unknown>; status: number } | null = null;
  const handle = createWechatActivityRoutes({
    query,
    json: (_res, data, status = 200) => {
      captured = { data, status };
    },
  });
  const handled = await handle({
    path: "/api/sfmc/wechat/activity",
    method: "GET",
    params: new URLSearchParams(search),
    req: {} as http.IncomingMessage,
    res: {} as http.ServerResponse,
  });
  assert.equal(handled, true);
  assert.ok(captured);
  return captured as { data: Record<string, unknown>; status: number };
}

/** 把 openid 绑定到游戏账号（走正式的申请 + 确认流程） */
function bind(query: QueryFn, openid: string, xuid: string, name: string) {
  const providers: BindProvider[] = [createWechatBindProvider(query)];
  const requested = requestWechatBindCode(query, openid, codeTakenBy(() => providers), 1000);
  assert.ok(requested.ok);
  if (!requested.ok) return;
  assert.equal(confirmWechatBind(query, { code: requested.code, xuid, name, now: 1100 }).ok, true);
}

test("微信路由：只返回绑定账号自己的记录，传入的 actorId / actorName 被忽略", async () => {
  const { query } = setup();
  bind(query, "wx-steve", "p-steve", "Steve");
  const own = await callRoute(query, "openid=wx-steve&actorId=p-alex&actorName=Alex");
  assert.equal(own.status, 200);
  assert.equal(own.data.bound, true);
  assert.equal(own.data.total, 3);
  assert.deepEqual(ids(own.data.records as { id: string }[]), ["a3", "a2", "a1"]);
  const filtered = await callRoute(query, "openid=wx-steve&eventTypePrefix=player.&limit=1");
  assert.deepEqual({ total: filtered.data.total, limit: filtered.data.limit, records: ids(filtered.data.records as { id: string }[]) }, { total: 2, limit: 1, records: ["a3"] });
});

test("微信路由：未绑定返回 bound: false 且不带记录；缺 openid 或参数非法返回 400", async () => {
  const { query } = setup();
  const unbound = await callRoute(query, "openid=wx-nobody");
  assert.deepEqual({ status: unbound.status, bound: unbound.data.bound, records: unbound.data.records }, { status: 200, bound: false, records: [] });
  assert.equal((await callRoute(query, "")).status, 400);
  bind(query, "wx-steve", "p-steve", "Steve");
  const invalid = await callRoute(query, "openid=wx-steve&level=debug");
  assert.deepEqual({ status: invalid.status, error: invalid.data.error }, { status: 400, error: "invalid_params" });
});
