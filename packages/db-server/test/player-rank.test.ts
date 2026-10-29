/**
 * player-rank.test.ts — 财富排行与分页参数解析
 *
 * 使用内存 SQLite 手工建出经济账户表与在线时长表（模块表不在 initSchema 中），覆盖：
 * 同一玩家「xuid 行 + 名字行」合并为一行且余额与账号页同规则、组织账户与 0 余额不上榜、
 * 经济表缺失时返回不可用、limit 缺省时回落默认值而不是被夹成 1。
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { queryWealthRank } from "../src/domain/player-rank.js";
import { createQuery } from "../src/lib/sqlite.js";
import { intParam } from "../src/routes/_shared.js";

/** 建一份只含排行所需模块表的内存库 */
function setup(withEconomy = true) {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE sfmc_online_time (player_id TEXT, player_name TEXT, _deleted_at INTEGER)`);
  if (withEconomy) {
    db.exec(`CREATE TABLE sfmc_economy_accounts (
      account_id TEXT, account_name_snapshot TEXT, balance INTEGER, account_type TEXT, _deleted_at INTEGER)`);
  }
  return { db, query: createQuery(db) };
}

test("财富排行：同一玩家的 xuid 行与名字行合并，余额按 xuid 优先", () => {
  const { db, query } = setup();
  db.exec(`INSERT INTO sfmc_online_time VALUES ('111', 'Alice', NULL), ('222', 'Bob', NULL)`);
  db.exec(`INSERT INTO sfmc_economy_accounts VALUES
    ('111', 'Alice', 300, 'player', NULL),
    ('Alice', 'Alice', 1300, 'player', NULL),
    ('Bob', 'Bob', 500, 'player', NULL),
    ('Carol', 'Carol', 100, 'player', NULL),
    ('commands.scoreboard.players.offlinePlayerName', '', 0, 'player', NULL),
    ('land:1', '领地金库', 99999, 'org', NULL),
    ('Gone', 'Gone', 800, 'player', 1)`);

  const page = queryWealthRank(query, 50, { playerId: "111", playerName: "Alice" }, "金币");
  assert.equal(page.available, true);
  assert.deepEqual(
    page.rows.map((row) => [row.playerName, row.value]),
    [
      ["Bob", 500],
      ["Alice", 300],
      ["Carol", 100],
    ]
  );
  assert.equal(page.myRank?.rank, 2);
  assert.equal(page.unit, "金币");
});

test("财富排行：未绑定 xuid 的玩家按名字找到我的名次", () => {
  const { db, query } = setup();
  db.exec(`INSERT INTO sfmc_economy_accounts VALUES ('Carol', 'Carol', 100, 'player', NULL)`);
  const page = queryWealthRank(query, 50, { playerId: "", playerName: "Carol" }, "");
  assert.equal(page.myRank?.rank, 1);
});

test("财富排行：经济表不存在时标记不可用", () => {
  const { query } = setup(false);
  const page = queryWealthRank(query, 50, { playerId: "", playerName: "" }, "");
  assert.equal(page.available, false);
  assert.deepEqual(page.rows, []);
});

test("intParam：缺省 / 空串 / 非数字回落默认值，越界夹紧", () => {
  const read = (qs: string) => intParam(new URLSearchParams(qs), "limit", 50, 1, 100);
  assert.equal(read(""), 50);
  assert.equal(read("limit="), 50);
  assert.equal(read("limit=abc"), 50);
  assert.equal(read("limit=0"), 1);
  assert.equal(read("limit=500"), 100);
  assert.equal(read("limit=20.7"), 20);
});
