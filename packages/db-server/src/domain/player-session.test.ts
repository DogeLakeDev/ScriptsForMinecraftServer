import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createQuery } from "../lib/sqlite.js";
import { syncPlayerSession } from "./player-session.js";
import { initSchema } from "./schema.js";

test("initSchema 为旧玩家表补齐快照字段", () => {
  const db = new DatabaseSync(":memory:");
  db.exec("CREATE TABLE sfmc_players (id TEXT PRIMARY KEY, name TEXT, xuid TEXT)");
  initSchema(db);
  const columns = db.prepare('PRAGMA table_info("sfmc_players")').all() as Array<{ name: string }>;
  const names = new Set(columns.map((column) => column.name));
  for (const name of [
    "spawn_dimension",
    "spawn_x",
    "dimension",
    "game_mode",
    "snapshot_hash",
    "active_channel",
    "subscribed_channels",
  ]) {
    assert.equal(names.has(name), true, name);
  }
});

test("BDS 玩家会话写入并刷新 XUID", () => {
  const db = new DatabaseSync(":memory:");
  initSchema(db);
  const query = createQuery(db);
  syncPlayerSession(query, { playerName: "Steve", xuid: "123" }, 42);
  const row = db.prepare("SELECT id, name, xuid, last_online FROM sfmc_players WHERE id = ?").get("123");
  assert.deepEqual({ ...row }, { id: "123", name: "Steve", xuid: "123", last_online: 42 });
});
