/**
 * 夹具：MemoryDataAdapter 可变 + applyFixtureIntent → ConfigManager
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ConfigManager } from "@sfmc-bds/sdk/module-loader";
import {
  applyFixtureIntent,
  configsFromFixtureIntent,
  createMemoryDataAdapter,
  createSandbox,
  FIXTURE_PERMISSION_LEVELS,
} from "./dist/esm/testing/index.js";

test("MemoryDataAdapter patch + ConfigManager.loadAll", async () => {
  ConfigManager.resetForTesting();
  const adapter = createMemoryDataAdapter({
    modules: [],
    settings: { a: 1 },
    permissions: [],
    module_tokens: {},
  });
  ConfigManager.bindDataAdapter(adapter);
  await ConfigManager.init();
  assert.equal(ConfigManager.getSetting("a"), 1);

  adapter.patch({ settings: { b: "x" } });
  await ConfigManager.loadAll();
  assert.equal(ConfigManager.getSetting("a"), 1);
  assert.equal(ConfigManager.getSetting("b"), "x");
  ConfigManager.resetForTesting();
});

test("createSandbox fixture settings + permissions", async () => {
  const sb = await createSandbox({
    fixture: {
      settings: { land_price: 42 },
      permissions: [{ player_name: "alice", level: FIXTURE_PERMISSION_LEVELS.OP }],
    },
  });
  try {
    assert.equal(ConfigManager.getSetting("land_price"), 42);
    const perms = ConfigManager.getPermissions();
    assert.equal(perms.alice, FIXTURE_PERMISSION_LEVELS.OP);

    await sb.applyFixture({
      settings: { land_price: 99 },
      treatPlayersAsOp: true,
    });
    assert.equal(ConfigManager.getSetting("land_price"), 99);

    const p = sb.addPlayer({ name: "bob", op: false });
    await sb.applyFixture({ treatPlayersAsOp: true });
    assert.equal(ConfigManager.getPermissions().bob, FIXTURE_PERMISSION_LEVELS.OP);
    assert.equal(p.playerPermissionLevel, 2);

    sb.clearDb();
    assert.equal(sb.db.calls.length, 0);
  } finally {
    await sb.dispose();
  }
});

test("configsFromFixtureIntent merges settings/enabled", () => {
  const base = {
    modules: [{ id: "feature-demo", configKey: "demo", enabled: true, installed: true }],
    settings: { keep: 1 },
    permissions: [],
    module_tokens: {},
  };
  const out = configsFromFixtureIntent(
    base,
    { settings: { land_price: 7 }, enabled: false },
    "feature-demo"
  );
  assert.equal(out.settings?.keep, 1);
  assert.equal(out.settings?.land_price, 7);
  assert.equal(out.modules?.[0]?.enabled, false);
});

test("applyFixtureIntent clearDb", async () => {
  const sb = await createSandbox({});
  try {
    await sb.db.tx(async (tx) => {
      try {
        await tx.call("missing", {});
      } catch {
        /* expected */
      }
    });
    assert.ok(sb.db.calls.length >= 1);
    await applyFixtureIntent(
      {
        adapter: sb.configAdapter,
        db: sb.db,
        moduleId: null,
        getPlayers: () => [],
      },
      { clearDb: true }
    );
    assert.equal(sb.db.calls.length, 0);
  } finally {
    await sb.dispose();
  }
});
