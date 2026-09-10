import assert from "node:assert/strict";
import test from "node:test";
import { parseBdsPlayerSession } from "./player-session.js";

test("解析 BDS 玩家连接日志", () => {
  assert.deepEqual(parseBdsPlayerSession("[INFO] Player connected: Steve, xuid: 2535412345678901"), {
    connected: true,
    playerName: "Steve",
    xuid: "2535412345678901",
  });
});

test("解析 BDS 玩家断开日志", () => {
  assert.deepEqual(parseBdsPlayerSession("Player disconnected: Alex, xuid: 42"), {
    connected: false,
    playerName: "Alex",
    xuid: "42",
  });
  assert.equal(parseBdsPlayerSession("Server started."), null);
});
