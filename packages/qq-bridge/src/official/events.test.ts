import assert from "node:assert/strict";
import test from "node:test";
import {
  OfficialAtMessageDispatcher,
  attachmentsPlaceholder,
  extractOfficialText,
} from "./events.js";

test("extractOfficialText 去 @ 并拼附件占位", () => {
  assert.equal(
    extractOfficialText({
      content: "<@!botid> hello",
      attachments: [{ content_type: "image/png" }],
    }),
    "hello [图片]"
  );
});

test("attachmentsPlaceholder 按类型分类", () => {
  assert.equal(
    attachmentsPlaceholder([
      { content_type: "image/jpeg" },
      { content_type: "video/mp4" },
      { filename: "a.mp3" },
      { filename: "doc.pdf" },
    ]),
    "[图片][视频][语音][文件]"
  );
});

test("OfficialAtMessageDispatcher 过滤与转发载荷", async () => {
  const forwarded: Array<{ fromId: string; fromName: string; content: string }> = [];
  const forward = async (
    _db: unknown,
    fromId: string,
    fromName: string,
    content: string
  ): Promise<void> => {
    forwarded.push({ fromId, fromName, content });
  };

  const db = { host: "127.0.0.1", port: 3001, channelId: "bridge" };

  const missingOpenid = new OfficialAtMessageDispatcher({
    groupOpenid: "",
    db,
    forward,
  });
  await missingOpenid.handleGroupAtMessage({
    id: "1",
    group_openid: "G1",
    content: "hi",
    author: { member_openid: "M1", username: "U", bot: false },
  });
  assert.equal(forwarded.length, 0);

  const d = new OfficialAtMessageDispatcher({
    groupOpenid: "G1",
    db,
    forward,
  });

  await d.handleGroupAtMessage({
    id: "2",
    group_openid: "G1",
    content: "bot echo",
    author: { member_openid: "BOT", bot: true },
  });
  assert.equal(forwarded.length, 0);

  await d.handleGroupAtMessage({
    id: "3",
    group_openid: "OTHER",
    content: "wrong",
    author: { member_openid: "M2", username: "Bob", bot: false },
  });
  assert.equal(forwarded.length, 0);

  await d.handleGroupAtMessage({
    id: "4",
    group_openid: "G1",
    content: "<@!x> hello world",
    author: { member_openid: "M3", username: "Alice", bot: false },
  });
  assert.equal(forwarded.length, 1);
  assert.deepEqual(forwarded[0], {
    fromId: "qq_M3",
    fromName: "Alice",
    content: "hello world",
  });

  // 去重
  await d.handleGroupAtMessage({
    id: "4",
    group_openid: "G1",
    content: "dup",
    author: { member_openid: "M3", username: "Alice", bot: false },
  });
  assert.equal(forwarded.length, 1);
});

test("OfficialAtMessageDispatcher 指令命中不转发", async () => {
  const forwarded: string[] = [];
  const handled: string[] = [];
  const forward = async (_db: unknown, _a: string, _b: string, content: string): Promise<void> => {
    forwarded.push(content);
  };
  const commandRouter = {
    async handle(inbound: { text: string }): Promise<boolean> {
      if (inbound.text === "ping" || inbound.text === "/ping") {
        handled.push(inbound.text);
        return true;
      }
      return false;
    },
  };

  const d = new OfficialAtMessageDispatcher({
    groupOpenid: "G1",
    db: { host: "127.0.0.1", port: 3001, channelId: "bridge" },
    forward,
    commandRouter: commandRouter as never,
  });

  await d.handleGroupAtMessage({
    id: "c1",
    group_openid: "G1",
    content: "<@!x> /ping",
    author: { member_openid: "M9", username: "Op", bot: false },
  });
  assert.deepEqual(handled, ["/ping"]);
  assert.equal(forwarded.length, 0);

  await d.handleGroupAtMessage({
    id: "c2",
    group_openid: "G1",
    content: "<@!x> chat",
    author: { member_openid: "M9", username: "Op", bot: false },
  });
  assert.equal(forwarded.length, 1);
  assert.equal(forwarded[0], "chat");
});

