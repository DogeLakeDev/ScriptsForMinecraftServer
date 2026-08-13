/**
 * QQ 开放平台客户端单测（对 dist 产物，mock fetch）
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  QqAccessTokenManager,
  sendGroupTextMessage,
  sendGroupMessage,
  sendC2cMessage,
  putMenu,
  createPanel,
  updatePanelTarget,
  getGroupInfo,
  getGroupBotState,
  ackInteraction,
  stripOfficialAtMention,
  QQ_TOKEN_URL,
  QQ_API_BASE_PROD,
  QQ_API_BASE_SANDBOX,
  resolveApiBase,
} from "./dist/esm/node/qq-official/index.js";

test("resolveApiBase 沙箱/正式", () => {
  assert.equal(resolveApiBase(false), QQ_API_BASE_PROD);
  assert.equal(resolveApiBase(true), QQ_API_BASE_SANDBOX);
});

test("stripOfficialAtMention 去掉 <@!id>", () => {
  assert.equal(stripOfficialAtMention("<@!12345> hello"), "hello");
  assert.equal(stripOfficialAtMention("  plain  "), "plain");
});

test("AccessToken 缓存命中与过期刷新", async () => {
  let calls = 0;
  const fetchImpl = async (input, init) => {
    calls += 1;
    assert.equal(String(input), QQ_TOKEN_URL);
    assert.equal(init?.method, "POST");
    const body = JSON.parse(String(init?.body ?? "{}"));
    assert.equal(body.appId, "app");
    assert.equal(body.clientSecret, "secret");
    return new Response(JSON.stringify({ access_token: `tok-${calls}`, expires_in: "7200" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const mgr = new QqAccessTokenManager({ appId: "app", appSecret: "secret" }, fetchImpl);
  const t1 = await mgr.getAccessToken();
  const t2 = await mgr.getAccessToken();
  assert.equal(t1, "tok-1");
  assert.equal(t2, "tok-1");
  assert.equal(calls, 1);

  const peek = mgr.peekCache();
  assert.ok(peek);
  peek.expiresAtMs = Date.now() - 1;
  const t3 = await mgr.getAccessToken();
  assert.equal(t3, "tok-2");
  assert.equal(calls, 2);
});

test("sendGroupTextMessage 请求头与 body", async () => {
  const seen = {};
  const fetchImpl = async (input, init) => {
    const url = String(input);
    if (url.includes("getAppAccessToken")) {
      return new Response(JSON.stringify({ access_token: "AT", expires_in: 7200 }), { status: 200 });
    }
    seen.url = url;
    seen.headers = new Headers(init?.headers);
    seen.body = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
  };
  const result = await sendGroupTextMessage(
    { appId: "APP", appSecret: "SEC", sandbox: false },
    { groupOpenid: "GOPEN", content: "[MC] Steve: hi" },
    { fetchImpl }
  );
  assert.equal(result.ok, true);
  assert.equal(seen.url, `${QQ_API_BASE_PROD}/v2/groups/GOPEN/messages`);
  assert.equal(seen.headers?.get("Authorization"), "QQBot AT");
  assert.equal(seen.headers?.get("X-Union-Appid"), "APP");
  const parsed = JSON.parse(seen.body ?? "{}");
  assert.equal(parsed.content, "[MC] Steve: hi");
  assert.equal(parsed.msg_type, 0);
  assert.equal(parsed.msg_id, undefined);
});

test("sendGroupTextMessage 失败不抛错", async () => {
  const fetchImpl = async (input) => {
    if (String(input).includes("getAppAccessToken")) {
      return new Response(JSON.stringify({ access_token: "AT", expires_in: 7200 }), { status: 200 });
    }
    return new Response(JSON.stringify({ err_code: 429, message: "rate" }), { status: 429 });
  };
  const result = await sendGroupTextMessage(
    { appId: "A", appSecret: "S" },
    { groupOpenid: "G", content: "x" },
    { fetchImpl }
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /429/);
});

test("sendGroupMessage markdown + keyboard + msg_id", async () => {
  const seen = {};
  const fetchImpl = async (input, init) => {
    const url = String(input);
    if (url.includes("getAppAccessToken")) {
      return new Response(JSON.stringify({ access_token: "AT", expires_in: 7200 }), { status: 200 });
    }
    seen.url = url;
    seen.body = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "msg-md" }), { status: 200 });
  };
  const result = await sendGroupMessage(
    { appId: "APP", appSecret: "SEC", sandbox: true },
    {
      groupOpenid: "GOPEN",
      markdown: "## 菜单\n- ping",
      keyboardButtons: [
        { id: "b1", label: "ping", data: "/ping" },
        { id: "b2", label: "whoami", data: "/whoami" },
      ],
      msgId: "ROBOT1.0_abc",
      msgSeq: 1,
    },
    { fetchImpl }
  );
  assert.equal(result.ok, true);
  assert.equal(seen.url, `${QQ_API_BASE_SANDBOX}/v2/groups/GOPEN/messages`);
  const parsed = JSON.parse(seen.body ?? "{}");
  assert.equal(parsed.msg_type, 2);
  assert.equal(parsed.content, undefined);
  assert.deepEqual(parsed.markdown, { content: "## 菜单\n- ping" });
  assert.equal(parsed.msg_id, "ROBOT1.0_abc");
  assert.equal(parsed.msg_seq, 1);
  assert.equal(parsed.keyboard.content.rows.length, 1);
  assert.equal(parsed.keyboard.content.rows[0].buttons.length, 2);
  assert.equal(parsed.keyboard.content.rows[0].buttons[0].action.type, 2);
  assert.equal(parsed.keyboard.content.rows[0].buttons[0].action.data, "/ping");
});

function mockTokenFetch(seen) {
  return async (input, init) => {
    const url = String(input);
    if (url.includes("getAppAccessToken")) {
      return new Response(JSON.stringify({ access_token: "AT", expires_in: 7200 }), { status: 200 });
    }
    seen.url = url;
    seen.method = init?.method;
    seen.body = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
  };
}

test("sendC2cMessage 路径与 msg_id", async () => {
  const seen = {};
  const result = await sendC2cMessage(
    { appId: "APP", appSecret: "SEC" },
    { userOpenid: "UOPEN", content: "hi", msgId: "MID", msgSeq: 2 },
    { fetchImpl: mockTokenFetch(seen) }
  );
  assert.equal(result.ok, true);
  assert.equal(seen.url, `${QQ_API_BASE_PROD}/v2/users/UOPEN/messages`);
  const parsed = JSON.parse(seen.body ?? "{}");
  assert.equal(parsed.msg_type, 0);
  assert.equal(parsed.content, "hi");
  assert.equal(parsed.msg_id, "MID");
  assert.equal(parsed.msg_seq, 2);
});

test("putMenu payload 形状", async () => {
  const seen = {};
  const result = await putMenu(
    { appId: "A", appSecret: "S" },
    {
      menu: {
        items: [{ type: "send_message", name: "ping", send_message: "/ping" }],
      },
    },
    { fetchImpl: mockTokenFetch(seen) }
  );
  assert.equal(result.ok, true);
  assert.equal(seen.url, `${QQ_API_BASE_PROD}/v2/menu`);
  assert.equal(seen.method, "PUT");
  const parsed = JSON.parse(seen.body ?? "{}");
  assert.equal(parsed.menu.items[0].type, "send_message");
  assert.equal(parsed.menu.items[0].send_message, "/ping");
});

test("createPanel + updatePanelTarget", async () => {
  const seen = {};
  const create = await createPanel(
    { appId: "A", appSecret: "S" },
    {
      scope: "group",
      target_type: "specific",
      group_openids: ["G1"],
      panel: {
        remark: "SFMC",
        items: [{ type: "command", name: "/menu", desc: "显示指令菜单" }],
      },
    },
    { fetchImpl: mockTokenFetch(seen) }
  );
  assert.equal(create.ok, true);
  assert.equal(seen.url, `${QQ_API_BASE_PROD}/v2/panels`);
  assert.equal(seen.method, "POST");
  const body = JSON.parse(seen.body ?? "{}");
  assert.equal(body.scope, "group");
  assert.deepEqual(body.group_openids, ["G1"]);
  assert.equal(body.panel.items[0].type, "command");
  assert.equal(body.panel.items[0].name, "/menu");
  assert.equal(body.name, undefined);
  assert.equal(body.items, undefined);

  const seen2 = {};
  const target = await updatePanelTarget(
    { appId: "A", appSecret: "S" },
    "PANEL1",
    { op: "add", group_openids: ["G1"] },
    { fetchImpl: mockTokenFetch(seen2) }
  );
  assert.equal(target.ok, true);
  assert.equal(seen2.url, `${QQ_API_BASE_PROD}/v2/panels/PANEL1/target`);
  assert.equal(seen2.method, "PUT");
  assert.deepEqual(JSON.parse(seen2.body ?? "{}"), { op: "add", group_openids: ["G1"] });
});

test("getGroupInfo + getGroupBotState + ackInteraction", async () => {
  const seen = {};
  const info = await getGroupInfo({ appId: "A", appSecret: "S" }, "G1", {
    fetchImpl: mockTokenFetch(seen),
  });
  assert.equal(info.ok, true);
  assert.equal(seen.url, `${QQ_API_BASE_PROD}/v2/groups/G1/info`);
  assert.equal(seen.method, "GET");

  const seen2 = {};
  const state = await getGroupBotState({ appId: "A", appSecret: "S" }, "G1", {
    fetchImpl: mockTokenFetch(seen2),
  });
  assert.equal(state.ok, true);
  assert.equal(seen2.url, `${QQ_API_BASE_PROD}/v2/groups/G1/bot_state`);

  const seen3 = {};
  const ack = await ackInteraction({ appId: "A", appSecret: "S" }, "IX1", {}, {
    fetchImpl: mockTokenFetch(seen3),
  });
  assert.equal(ack.ok, true);
  assert.equal(seen3.url, `${QQ_API_BASE_PROD}/interactions/IX1`);
  assert.equal(seen3.method, "PUT");
});

test("sendGroupMessage 回调按钮 action.type=1", async () => {
  const seen = {};
  const result = await sendGroupMessage(
    { appId: "A", appSecret: "S" },
    {
      groupOpenid: "G1",
      markdown: "审批",
      keyboardButtons: [
        {
          id: "1",
          label: "通过",
          data: "join:approve:x",
          actionType: 1,
          permission: { type: 0, specify_user_ids: ["ADM"] },
        },
      ],
    },
    { fetchImpl: mockTokenFetch(seen) }
  );
  assert.equal(result.ok, true);
  const body = JSON.parse(seen.body ?? "{}");
  const btn = body.keyboard.content.rows[0].buttons[0];
  assert.equal(btn.action.type, 1);
  assert.equal(btn.action.data, "join:approve:x");
  assert.deepEqual(btn.action.permission.specify_user_ids, ["ADM"]);
});

