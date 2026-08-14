/**
 * messages 出站过滤单测
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldForwardChatToQQ } from "../routes/messages.js";

test("shouldForwardChatToQQ：未配 bridge 不出站", () => {
  assert.equal(shouldForwardChatToQQ("", "bridge", "xuid"), false);
});

test("shouldForwardChatToQQ：频道不匹配不出站", () => {
  assert.equal(shouldForwardChatToQQ("bridge", "other", "xuid"), false);
});

test("shouldForwardChatToQQ：qq_ 来源不出站（防回环）", () => {
  assert.equal(shouldForwardChatToQQ("bridge", "bridge", "qq_123"), false);
});

test("shouldForwardChatToQQ：空 fromId 不出站", () => {
  assert.equal(shouldForwardChatToQQ("bridge", "bridge", ""), false);
  assert.equal(shouldForwardChatToQQ("bridge", "bridge", "   "), false);
});

test("shouldForwardChatToQQ：匹配频道的玩家消息出站", () => {
  assert.equal(shouldForwardChatToQQ("bridge", "bridge", "player-1"), true);
});
