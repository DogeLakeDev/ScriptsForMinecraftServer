/**
 * wechat-bind.test.ts — 微信绑定、统一确认入口与玩家等级计算
 *
 * 使用内存 SQLite + 正式的 initSchema，覆盖：微信短码申请 / 确认 / 解绑、QQ 与微信短码跨渠道不重复、
 * 统一确认按短码归属分派且错误码与 QQ 原接口一致、宿主侧等级计算与游戏内 Permission 规则一致。
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { SQL } from "sql-template-strings";
import { codeTakenBy, confirmWithProviders, generateBindCode, type BindProvider } from "../src/domain/bind-providers.js";
import { resolvePlayerLevel } from "../src/domain/player-level.js";
import { confirmQqBind, createQqBindProvider } from "../src/domain/qq-bind.js";
import { initSchema } from "../src/domain/schema.js";
import {
  confirmWechatBind,
  createWechatBindProvider,
  currentPlayerName,
  findWechatBindingByOpenid,
  requestWechatBindCode,
  unbindWechat,
} from "../src/domain/wechat-bind.js";
import { createQuery, type QueryFn } from "../src/lib/sqlite.js";

/** 新建一份带完整表结构的内存库，并按 index.ts 的方式组装提供方 */
function setup() {
  const db = new DatabaseSync(":memory:");
  initSchema(db);
  const query = createQuery(db);
  const providers: BindProvider[] = [createQqBindProvider(query), createWechatBindProvider(query)];
  return { query, providers, isTaken: codeTakenBy(() => providers) };
}

/** 直接写一条 QQ 待确认短码（模拟 QQ 侧申请） */
function addQqPending(query: QueryFn, code: string, openid: string, expiresAt: number) {
  query(SQL`INSERT INTO sfmc_qq_bind_pending (code, qq_user_openid, qq_backend, created_at, expires_at)
            VALUES (${code}, ${openid}, 'official', ${expiresAt - 300_000}, ${expiresAt})`);
}

test("微信：申请短码 → 游戏内确认 → 查询到绑定", () => {
  const { query, providers, isTaken } = setup();
  const now = 1_000_000;
  const requested = requestWechatBindCode(query, "wx-a", isTaken, now);
  assert.equal(requested.ok, true);
  if (!requested.ok) return;
  assert.match(requested.code, /^\d{6}$/);
  assert.equal(requested.expires_at, now + requested.ttl_ms);

  const result = confirmWithProviders(providers, { code: requested.code, xuid: "x1", name: "Steve", now: now + 1000 });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "wechat");
  const binding = findWechatBindingByOpenid(query, "wx-a");
  assert.equal(binding?.player_xuid, "x1");
  assert.equal(binding?.player_name, "Steve");
});

test("微信：已绑定时再申请返回 409 already_bound 并带玩家名", () => {
  const { query, isTaken } = setup();
  const first = requestWechatBindCode(query, "wx-a", isTaken, 1000);
  assert.ok(first.ok);
  if (!first.ok) return;
  confirmWechatBind(query, { code: first.code, xuid: "x1", name: "Steve", now: 2000 });
  const again = requestWechatBindCode(query, "wx-a", isTaken, 3000);
  assert.deepEqual(again, { ok: false, status: 409, error: "already_bound", player_name: "Steve" });
});

test("微信：同一 openid 重新申请会作废旧短码", () => {
  const { query, providers, isTaken } = setup();
  const first = requestWechatBindCode(query, "wx-a", isTaken, 1000);
  const second = requestWechatBindCode(query, "wx-a", isTaken, 2000);
  assert.ok(first.ok && second.ok);
  if (!first.ok || !second.ok) return;
  if (first.code === second.code) return;
  const stale = confirmWithProviders(providers, { code: first.code, xuid: "x1", name: "Steve", now: 3000 });
  assert.equal(stale.ok, false);
  assert.equal(stale.ok ? "" : stale.error, "invalid_code");
});

test("微信：过期短码返回 code_expired，且短码被清除", () => {
  const { query, providers, isTaken } = setup();
  const requested = requestWechatBindCode(query, "wx-a", isTaken, 1000);
  assert.ok(requested.ok);
  if (!requested.ok) return;
  const late = confirmWithProviders(providers, { code: requested.code, xuid: "x1", name: "Steve", now: requested.expires_at + 1 });
  assert.deepEqual({ ok: late.ok, error: late.ok ? "" : late.error, provider: late.provider }, { ok: false, error: "code_expired", provider: "wechat" });
  const again = confirmWithProviders(providers, { code: requested.code, xuid: "x1", name: "Steve", now: requested.expires_at + 2 });
  assert.equal(again.ok ? "" : again.error, "invalid_code");
});

test("微信：一个游戏账号只能绑定一个微信（player_already_bound_wechat）", () => {
  const { query, isTaken } = setup();
  const a = requestWechatBindCode(query, "wx-a", isTaken, 1000);
  assert.ok(a.ok);
  if (!a.ok) return;
  confirmWechatBind(query, { code: a.code, xuid: "x1", name: "Steve", now: 1100 });
  const b = requestWechatBindCode(query, "wx-b", isTaken, 1200);
  assert.ok(b.ok);
  if (!b.ok) return;
  const result = confirmWechatBind(query, { code: b.code, xuid: "x1", name: "Steve", now: 1300 });
  assert.equal(result.ok ? "" : result.error, "player_already_bound_wechat");
});

test("微信：解绑后可重新申请，返回删除条数", () => {
  const { query, isTaken } = setup();
  const a = requestWechatBindCode(query, "wx-a", isTaken, 1000);
  assert.ok(a.ok);
  if (!a.ok) return;
  confirmWechatBind(query, { code: a.code, xuid: "x1", name: "Steve", now: 1100 });
  assert.equal(unbindWechat(query, "wx-a"), 1);
  assert.equal(unbindWechat(query, "wx-a"), 0);
  assert.equal(findWechatBindingByOpenid(query, "wx-a"), null);
  assert.equal(requestWechatBindCode(query, "wx-a", isTaken, 1200).ok, true);
});

test("统一确认：QQ 短码仍交给 QQ 提供方，结果与旧 QQ 接口一致", () => {
  const { query, providers } = setup();
  addQqPending(query, "111111", "qq-a", 10_000);
  const viaUnified = confirmWithProviders(providers, { code: "111111", xuid: "x9", name: "Alex", now: 5000 });
  assert.equal(viaUnified.ok, true);
  assert.equal(viaUnified.provider, "qq");

  // 同样的数据走旧接口的确认函数，结果字段一致（LSP）
  const second = setup();
  addQqPending(second.query, "111111", "qq-a", 10_000);
  const viaLegacy = confirmQqBind(second.query, { code: "111111", xuid: "x9", name: "Alex", now: 5000 });
  const { provider: _provider, ...unifiedRest } = viaUnified;
  assert.deepEqual(unifiedRest, viaLegacy);
});

test("统一确认：谁都不认识的短码返回 invalid_code（400）", () => {
  const { providers } = setup();
  assert.deepEqual(confirmWithProviders(providers, { code: "999999", xuid: "x1", name: "Steve", now: 1 }), {
    ok: false,
    status: 400,
    error: "invalid_code",
  });
});

test("短码查重：QQ 已占用的短码不会再发给微信", () => {
  const { query, isTaken } = setup();
  addQqPending(query, "222222", "qq-a", 10_000);
  assert.equal(isTaken("222222"), true);
  assert.equal(isTaken("333333"), false);
  // 只剩一个可用候选时，生成器必须避开被占用的短码
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) {
    const code = generateBindCode((candidate) => candidate !== "7", 1);
    if (code) seen.add(code);
  }
  assert.deepEqual([...seen], seen.size ? ["7"] : []);
  assert.equal(generateBindCode(() => true), "");
});

test("currentPlayerName：优先运行期快照中的新名字，否则用绑定时的名字", () => {
  const { query } = setup();
  assert.equal(currentPlayerName(query, "x1", "OldName"), "OldName");
  query(SQL`INSERT INTO sfmc_players (id, name, xuid) VALUES (${"x1"}, ${"NewName"}, ${"x1"})`);
  assert.equal(currentPlayerName(query, "x1", "OldName"), "NewName");
});

test("等级：SFMC 覆盖优先，其次 BDS 原生权限，默认成员（1）", () => {
  const sources = (sfmc: unknown, bds: unknown) => ({ readSfmcPermissions: () => sfmc, readBdsPermissions: () => bds });
  const player = { xuid: "x1", name: "Steve" };
  assert.equal(resolvePlayerLevel(sources(null, null), player), 1);
  assert.equal(resolvePlayerLevel(sources(null, [{ xuid: "x1", permission: "operator" }]), player), 2);
  assert.equal(resolvePlayerLevel(sources(null, [{ xuid: "x1", permission: "visitor" }]), player), 0);
  assert.equal(resolvePlayerLevel(sources([{ player_name: "Steve", level: 3 }], [{ xuid: "x1", permission: "member" }]), player), 3);
  // 同名多条时后者覆盖前者（降级立即生效）
  assert.equal(resolvePlayerLevel(sources([{ player_name: "Steve", level: 3 }, { player_name: "Steve", level: 1 }], null), player), 1);
  // 其他玩家的记录不影响
  assert.equal(resolvePlayerLevel(sources([{ player_name: "Alex", level: 3 }], [{ xuid: "x2", permission: "operator" }]), player), 1);
});
