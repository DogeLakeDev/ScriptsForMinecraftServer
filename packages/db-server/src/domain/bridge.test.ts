import assert from "node:assert/strict";
import test from "node:test";
import { makeLLBotConfig, makeOutboundConfig, forwardToQQBridge } from "./bridge.js";

test("makeOutboundConfig：official / llbot 分支", () => {
  const official = makeOutboundConfig({
    QQ_BACKEND: "official",
    LLBOT_HOST: "127.0.0.1",
    LLBOT_PORT: 3004,
    LLBOT_TOKEN: "",
    QQ_GROUP_ID: "123",
    QQ_APP_ID: "app",
    QQ_APP_SECRET: "sec",
    QQ_SANDBOX: true,
    QQ_GROUP_OPENID: "GOPEN",
    MCTOQQ_PREFIX: "[MC]",
  });
  assert.equal(official.backend, "official");
  if (official.backend === "official") {
    assert.equal(official.groupOpenid, "GOPEN");
    assert.equal(official.creds.sandbox, true);
    assert.equal(official.prefix, "[MC]");
  }

  const llbot = makeOutboundConfig({
    QQ_BACKEND: "llbot",
    LLBOT_HOST: "127.0.0.1",
    LLBOT_PORT: 3004,
    LLBOT_TOKEN: "t",
    QQ_GROUP_ID: "99",
    QQ_APP_ID: "",
    QQ_APP_SECRET: "",
    QQ_SANDBOX: false,
    QQ_GROUP_OPENID: "",
    MCTOQQ_PREFIX: "[X]",
  });
  assert.equal(llbot.backend, "llbot");
  if (llbot.backend === "llbot") {
    assert.equal(llbot.llbot.groupId, "99");
    assert.equal(llbot.llbot.prefix, "[X]");
  }
});

test("makeLLBotConfig 使用 mctoqq_prefix", () => {
  const cfg = makeLLBotConfig({
    LLBOT_HOST: "h",
    LLBOT_PORT: 1,
    LLBOT_TOKEN: "",
    QQ_GROUP_ID: "1",
    MCTOQQ_PREFIX: "[P]",
  });
  assert.equal(cfg.prefix, "[P]");
});

test("forwardToQQBridge official：缺 group_openid 不抛错", () => {
  assert.doesNotThrow(() => {
    forwardToQQBridge(
      {
        backend: "official",
        creds: { appId: "a", appSecret: "s" },
        groupOpenid: "",
        prefix: "[MC]",
      },
      "ch",
      "Steve",
      "hi",
      "xuid"
    );
  });
});

test("forwardToQQBridge llbot：缺群号不抛错", () => {
  assert.doesNotThrow(() => {
    forwardToQQBridge(
      {
        backend: "llbot",
        llbot: {
          host: "127.0.0.1",
          port: 3004,
          token: "",
          groupId: "0",
          prefix: "[MC]",
        },
      },
      "ch",
      "Steve",
      "hi",
      "xuid"
    );
  });
});
