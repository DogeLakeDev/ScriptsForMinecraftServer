/**
 * ConfigManager 失败语义与可重试 init。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigManager, type DataAdapter } from "../../dist/esm/module-loader/index.js";

function adapter(opts: {
  body?: string | null;
  health?: () => Promise<void>;
}): DataAdapter {
  return {
    getAllConfigs: async () => (opts.body === undefined ? "{}" : opts.body),
    setAuthToken: () => undefined,
    checkHealth: opts.health ?? (async () => undefined),
  };
}

const okBody = JSON.stringify({
  modules: [{ id: "feature-afk", configKey: "afk", enabled: true, installed: true }],
  module_tokens: { "feature-afk": "tok" },
  settings: { db_auth_token: "secret", n: 1 },
  permissions: [{ player_name: "alice", level: 2 }],
});

test("init 成功 → ready，可读启停/token/settings", async () => {
  ConfigManager.resetForTesting();
  ConfigManager.bindDataAdapter(adapter({ body: okBody }));
  await ConfigManager.init();
  assert.equal(ConfigManager.isReady(), true);
  assert.equal(ConfigManager.isEnabled("feature-afk"), true);
  assert.equal(ConfigManager.isEnabled("afk"), true);
  assert.equal(ConfigManager.getModuleToken("feature-afk"), "tok");
  assert.equal(ConfigManager.getSetting("n"), 1);
  assert.equal(ConfigManager.getPermissions().alice, 2);
  ConfigManager.resetForTesting();
});

test("拉取失败 → 不 ready，可重试成功", async () => {
  ConfigManager.resetForTesting();
  let calls = 0;
  const flaky: DataAdapter = {
    getAllConfigs: async () => {
      calls += 1;
      return calls === 1 ? null : okBody;
    },
    setAuthToken: () => undefined,
    checkHealth: async () => undefined,
  };
  ConfigManager.bindDataAdapter(flaky);
  await assert.rejects(() => ConfigManager.init(), /配置拉取或解析失败/);
  assert.equal(ConfigManager.isReady(), false);
  assert.equal(ConfigManager.isEnabled("feature-afk"), false);

  await ConfigManager.init();
  assert.equal(ConfigManager.isReady(), true);
  assert.equal(ConfigManager.isEnabled("feature-afk"), true);
  ConfigManager.resetForTesting();
});

test("非法 JSON → 不 ready", async () => {
  ConfigManager.resetForTesting();
  ConfigManager.bindDataAdapter(adapter({ body: "{not-json" }));
  await assert.rejects(() => ConfigManager.init(), /配置拉取或解析失败/);
  assert.equal(ConfigManager.isReady(), false);
  ConfigManager.resetForTesting();
});

test("loadAll 失败时保留旧缓存", async () => {
  ConfigManager.resetForTesting();
  let body: string | null = okBody;
  ConfigManager.bindDataAdapter({
    getAllConfigs: async () => body,
    setAuthToken: () => undefined,
    checkHealth: async () => undefined,
  });
  await ConfigManager.init();
  assert.equal(ConfigManager.getModuleToken("feature-afk"), "tok");

  body = null;
  const ok = await ConfigManager.loadAll();
  assert.equal(ok, false);
  assert.equal(ConfigManager.getModuleToken("feature-afk"), "tok");
  ConfigManager.resetForTesting();
});
