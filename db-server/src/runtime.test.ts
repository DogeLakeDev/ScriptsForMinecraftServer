import { deepEqual, equal, rejects, throws } from "node:assert/strict";
import test from "node:test";
import { SQL } from "sql-template-strings";
import { assertIdentifier, quoteIdentifier } from "./lib/identifiers.js";
import { parseNodeVersion } from "./lib/runtime.js";
import { raw, sql } from "./lib/sql-helpers.js";
import { DispatchError, ServiceRegistry } from "./service-registry.js";

test("parses Node versions", () => {
  deepEqual(parseNodeVersion("22.5.1"), { major: 22, minor: 5, patch: 1 });
  deepEqual(parseNodeVersion("v22.5.1"), { major: 22, minor: 5, patch: 1 });
});

test("accepts only safe SQL identifiers", () => {
  equal(quoteIdentifier("sfmc_players", "table"), '"sfmc_players"');
  throws(() => assertIdentifier("users; DROP TABLE x"), /Invalid SQL/);
});

test("sql() embeds trusted identifiers and binds values", () => {
  const TABLE = "sfmc_economy_accounts";
  const q = sql(`SELECT * FROM ${TABLE} WHERE player_id = ?`, ["p1"]);
  equal(q.sql, "SELECT * FROM sfmc_economy_accounts WHERE player_id = ?");
  deepEqual(q.values, ["p1"]);
});

test("raw() only works via append — template interpolation still becomes ?", () => {
  const TABLE = "sfmc_economy_accounts";
  const broken = SQL`SELECT * FROM ${raw(TABLE)} WHERE id = ${"p1"}`;
  equal(broken.sql, "SELECT * FROM ? WHERE id = ?");

  const ok = SQL`SELECT * FROM `.append(raw(TABLE)).append(SQL` WHERE id = ${"p1"}`);
  equal(ok.sql, "SELECT * FROM sfmc_economy_accounts WHERE id = ?");
  deepEqual(ok.values, ["p1"]);
});

test("ServiceRegistry: provider self-call skips requires (LSP with tx.call path)", async () => {
  const reg = new ServiceRegistry();
  reg.registerHandler("feature-economy", "economy.stats.monthly", async () => ({ ok: true }));

  const enabled = new Map([
    [
      "feature-economy",
      {
        id: "feature-economy",
        version: "1.0.0",
        permissions: [] as string[],
        services: { provides: [{ name: "economy.stats.monthly" }], requires: [] as Array<{ name: string }> },
        db: { tables: [] as unknown[] },
        config: { key: "economy" },
      } as unknown as import("./manifest-loader.js").ModuleManifestV2,
    ],
  ]);

  const out = await reg.dispatch(enabled, "feature-economy", "economy.stats.monthly", {});
  deepEqual(out, { ok: true, result: { ok: true } });
});

test("ServiceRegistry: missing service → no_such_service (not not_in_requires)", async () => {
  const reg = new ServiceRegistry();
  const enabled = new Map([
    [
      "feature-chat",
      {
        id: "feature-chat",
        version: "1.0.0",
        permissions: [] as string[],
        services: { provides: [], requires: [] },
        db: { tables: [] },
        config: { key: "chat" },
      } as unknown as import("./manifest-loader.js").ModuleManifestV2,
    ],
  ]);

  await rejects(
    () => reg.dispatch(enabled, "feature-chat", "economy.account.get", {}),
    (e: unknown) => e instanceof DispatchError && e.code === "no_such_service"
  );
});

test("jsonV2Fail: ok 方言 + extra(step) 合并(LSP/DRY)", async () => {
  const { jsonV2Fail } = await import("./routes/_shared.js");
  const chunks: Buffer[] = [];
  let statusCode = 0;
  const res = {
    writeHead(code: number) {
      statusCode = code;
    },
    end(body?: string) {
      if (body) chunks.push(Buffer.from(body));
    },
    setHeader() {},
  } as unknown as import("node:http").ServerResponse;

  jsonV2Fail(res, "boom", 400, "bad_step", { step: 2 });
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  equal(statusCode, 400);
  deepEqual(payload, { ok: false, error: "boom", code: "bad_step", step: 2 });
});

test("jsonV2Ok: 与 Fail 对称 ok 方言(LSP/DRY)", async () => {
  const { jsonV2Ok } = await import("./routes/_shared.js");
  const chunks: Buffer[] = [];
  let statusCode = 0;
  const res = {
    writeHead(code: number) {
      statusCode = code;
    },
    end(body?: string) {
      if (body) chunks.push(Buffer.from(body));
    },
    setHeader() {},
  } as unknown as import("node:http").ServerResponse;

  jsonV2Ok(res, { rows: [1] });
  const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  equal(statusCode, 200);
  deepEqual(payload, { ok: true, rows: [1] });
});

test("normalizeOrderBy: SDK field 与遗留 col / 数组互通(LSP)", async () => {
  const { normalizeOrderBy } = await import("./lib/order-by.js");
  deepEqual(normalizeOrderBy(undefined), []);
  deepEqual(normalizeOrderBy({ field: "created_at", dir: "desc" }), [
    { col: "created_at", dir: "desc" },
  ]);
  deepEqual(normalizeOrderBy({ col: "id" }), [{ col: "id", dir: "asc" }]);
  deepEqual(normalizeOrderBy([{ field: "a" }, { col: "b", dir: "desc" }]), [
    { col: "a", dir: "asc" },
    { col: "b", dir: "desc" },
  ]);
  throws(() => normalizeOrderBy({ dir: "asc" }), /field\/col/);
});

test("syncModuleRuntimeState: enable/disable 热更新 token+enabledSet(DIP)", async () => {
  const { mkdtempSync, rmSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { syncModuleRuntimeState } = await import("./module-runtime-sync.js");
  const { deriveToken } = await import("./module-auth.js");
  const { unregisterBuiltinPluginForModule } = await import("./services/builtin-handlers.js");

  const root = mkdtempSync(join(tmpdir(), "sfmc-runtime-sync-"));
  const dbPath = join(root, "data", "sfmc_data.db");
  try {
    const enabledSet = new Set<string>(["feature-a"]);
    const enabledManifests = new Map();
    const moduleAuth = { tokens: { "feature-a": "old" } as Record<string, string>, secret: "test-secret" };
    const registry = new ServiceRegistry();
    const fakeManifest = {
      id: "feature-b",
      version: "1.0.0",
      permissions: [] as string[],
      services: { provides: [], requires: [] },
      db: { tables: [] },
      config: { key: "b" },
    } as unknown as import("./manifest-loader.js").ModuleManifestV2;

    syncModuleRuntimeState({
      moduleId: "feature-b",
      enabled: true,
      dbPath,
      envAuthToken: "fixed-auth",
      enabledSet,
      enabledManifests,
      loadedManifest: { modules: { "feature-b": fakeManifest } },
      moduleAuth,
      serviceRegistry: registry,
      builtinDeps: { query: (() => []) as never, db: {} as never },
    });

    equal(enabledSet.has("feature-b"), true);
    equal(enabledManifests.has("feature-b"), true);
    equal(moduleAuth.tokens["feature-b"], deriveToken("feature-b", "test-secret"));
    const store = JSON.parse(readFileSync(join(root, "data", "module-tokens.json"), "utf8"));
    equal(store.tokens["feature-b"], moduleAuth.tokens["feature-b"]);

    syncModuleRuntimeState({
      moduleId: "feature-b",
      enabled: false,
      dbPath,
      envAuthToken: "fixed-auth",
      enabledSet,
      enabledManifests,
      loadedManifest: { modules: { "feature-b": fakeManifest } },
      moduleAuth,
      serviceRegistry: registry,
      builtinDeps: { query: (() => []) as never, db: {} as never },
    });

    equal(enabledSet.has("feature-b"), false);
    equal(enabledManifests.has("feature-b"), false);
    equal(moduleAuth.tokens["feature-b"], undefined);
    equal(unregisterBuiltinPluginForModule(registry, "feature-b"), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("module-auth: ensureModuleToken / revoke 复用 secret(DRY)", async () => {
  const { deriveToken, ensureModuleToken, revokeModuleToken } = await import("./module-auth.js");
  const secret = "test-secret";
  const auth = { secret, tokens: {} as Record<string, string> };
  equal(ensureModuleToken(auth, "feature-afk"), true);
  equal(auth.tokens["feature-afk"], deriveToken("feature-afk", secret));
  equal(ensureModuleToken(auth, "feature-afk"), false);
  equal(revokeModuleToken(auth, "feature-afk"), true);
  equal(auth.tokens["feature-afk"], undefined);
  equal(revokeModuleToken(auth, "feature-afk"), false);
});

test("builtin-handlers: 热禁用按 moduleId 卸载(DRY/OCP)", async () => {
  const { unregisterBuiltinPluginForModule, registerBuiltinPluginForModule } = await import(
    "./services/builtin-handlers.js"
  );

  const reg = new ServiceRegistry();
  reg.registerHandler("feature-economy", "economy.account.get", async () => ({}));
  reg.registerHandler("feature-economy", "economy.account.debit", async () => ({}));
  reg.registerHandler("other-mod", "other.ping", async () => ({}));
  equal(unregisterBuiltinPluginForModule(reg, "feature-economy"), 2);
  equal(reg.list().length, 1);
  equal(reg.list()[0]?.moduleId, "other-mod");
  equal(unregisterBuiltinPluginForModule(reg, "feature-unknown"), 0);

  // 已有同 moduleId handler 时热启用跳过
  equal(registerBuiltinPluginForModule(reg, { query: (() => []) as never, db: {} as never }, "feature-economy"), true);
  equal(registerBuiltinPluginForModule(reg, { query: (() => []) as never, db: {} as never }, "feature-economy"), false);
});

test("TxRunner 交互会话: step 中途读回 insert/get(PR #31 leftover)", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const { createQuery } = await import("./lib/sqlite.js");
  const { SchemaRegistry } = await import("./schema-registry.js");
  const { TxRunner } = await import("./tx-runner.js");

  const db = new DatabaseSync(":memory:");
  const query = createQuery(db);
  const schema = new SchemaRegistry(db);
  schema.define("feature-demo", {
    name: "demo_items",
    columns: {
      id: { type: "text", primary: true },
      name: { type: "text", notNull: true },
    },
    softDelete: false,
  });

  const enabled = new Map([
    [
      "feature-demo",
      {
        id: "feature-demo",
        version: "1.0.0",
        permissions: ["db:read:demo_items", "db:write:demo_items"],
        services: { provides: [], requires: [] },
        db: { tables: [] },
        config: { key: "demo" },
      } as unknown as import("./manifest-loader.js").ModuleManifestV2,
    ],
  ]);

  const runner = new TxRunner({
    db,
    query,
    schema,
    serviceRegistry: new ServiceRegistry(),
    enabled,
  });

  const begin = runner.beginSession("feature-demo");
  equal(begin.ok, true);
  if (!begin.ok) return;
  const { txId } = begin;

  const ins = await runner.stepSession(txId, "feature-demo", {
    op: "insert",
    table: "demo_items",
    row: { id: "a1", name: "alpha" },
  });
  equal(ins.ok, true);
  if (!ins.ok) return;
  equal((ins.result as { op: string; row: { id: string } }).row.id, "a1");

  const got = await runner.stepSession(txId, "feature-demo", {
    op: "get",
    table: "demo_items",
    id: "a1",
  });
  equal(got.ok, true);
  if (!got.ok) return;
  equal((got.result as { row: { name: string } | null }).row?.name, "alpha");

  const committed = runner.commitSession(txId, "feature-demo");
  equal(committed.ok, true);

  const rows = db.prepare("SELECT name FROM demo_items WHERE id = ?").all("a1") as Array<{ name: string }>;
  equal(rows[0]?.name, "alpha");
  db.close();
});
