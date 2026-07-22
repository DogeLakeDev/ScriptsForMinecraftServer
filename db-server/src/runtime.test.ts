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
