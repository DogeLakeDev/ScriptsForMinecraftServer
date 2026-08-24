/**
 * manifest v2 / v3 schema 与迁移单测。
 * 入口：`npm test` 已经先 `build:js`，从 `./dist/esm/module-loader/index.js` 取。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeSemanticV3,
  migrateV2toV3,
  validateManifestV2,
  validateManifestV3,
} from "./dist/esm/module-loader/index.js";

/** 一个「能过 v3 校验」的完整样本：缺省 semantic 也算合法。 */
const v3Full = {
  schemaVersion: 3,
  id: "feature-economy",
  name: "经济",
  type: "feature",
  configKey: "economy",
  requires: ["feature-land"],
  permissions: ["db:read:wallet", "db:write:wallet", "config:read:economy"],
  services: { provides: [], requires: [] },
  notes: "示例模块",
  semantic: {
    configKeys: ["economy.*", "land.economy.*"],
    dependsOn: ["feature-land"],
    events: {
      emits: ["economy:walletChanged"],
      listens: ["world.afterEvents.playerJoin"],
    },
    dbTables: [
      { name: "wallet", columns: ["playerId", "balance"] },
      { name: "tx_log" },
    ],
    publicApi: [
      {
        symbol: "spend",
        description: "扣除余额",
        params: [
          { name: "playerId", type: "string", required: true },
          { name: "amount", type: "number", required: true },
        ],
        returns: { type: "boolean", description: "成功与否" },
      },
      { symbol: "Player.spend" },
    ],
  },
};

/** 一个标准 v2 manifest，迁移目标。 */
const v2Minimal = {
  schemaVersion: 2,
  id: "feature-land",
  name: "领地",
  type: "core",
  configKey: "land",
  requires: [],
  permissions: ["db:read:lands", "config:read:land"],
  services: { provides: [{ name: "land.byId" }], requires: [] },
  notes: "v2 模块示例",
};

test("validateManifestV3:完整 v3（含 semantic）→ ok", () => {
  const res = validateManifestV3(v3Full);
  assert.equal(res.ok, true);
  if (!res.ok) throw new Error(res.errors.join("; "));
  assert.equal(res.manifest.schemaVersion, 3);
  assert.equal(res.manifest.id, "feature-economy");
  assert.equal(res.manifest.semantic?.configKeys?.length, 2);
  assert.equal(res.manifest.semantic?.dependsOn?.[0], "feature-land");
  assert.equal(res.manifest.semantic?.events?.emits?.[0], "economy:walletChanged");
  assert.equal(res.manifest.semantic?.events?.listens?.[0], "world.afterEvents.playerJoin");
  assert.equal(res.manifest.semantic?.dbTables?.length, 2);
  assert.equal(res.manifest.semantic?.dbTables?.[1].columns, undefined);
  assert.equal(res.manifest.semantic?.publicApi?.length, 2);
});

test("validateManifestV3:v3 缺省 semantic → ok（向后兼容）", () => {
  const res = validateManifestV3({ ...v3Full, semantic: undefined });
  assert.equal(res.ok, true);
  if (!res.ok) throw new Error(res.errors.join("; "));
  assert.equal(res.manifest.semantic, undefined);
});

test("validateManifestV3:schemaVersion=2 → errors（不能混用版本号）", () => {
  const res = validateManifestV3({ ...v3Full, schemaVersion: 2 });
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("应失败");
  assert.ok(
    res.errors.some((e) => e.includes("schemaVersion 必须为 3")),
    `应给出 schemaVersion 错误，实际: ${res.errors.join("; ")}`
  );
});

test("validateManifestV3:semantic 字段类型错 → errors（带 [semantic.*] 定位）", () => {
  const res = validateManifestV3({
    ...v3Full,
    semantic: { configKeys: "not-an-array" },
  });
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("应失败");
  assert.ok(
    res.errors.some((e) => e.includes("[semantic.configKeys]")),
    `应给出 [semantic.configKeys] 错误，实际: ${res.errors.join("; ")}`
  );
});

test("validateManifestV3:dbTables / publicApi 单元素失败 → errors", () => {
  const res = validateManifestV3({
    ...v3Full,
    semantic: {
      dbTables: [{ columns: ["x"] }],
      publicApi: [{ description: "缺少 symbol" }],
    },
  });
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("应失败");
  assert.ok(res.errors.some((e) => e.includes("dbTables[0].name")));
  assert.ok(res.errors.some((e) => e.includes("publicApi[0].symbol")));
});

test("validateManifestV2:v2 完整 → ok", () => {
  const res = validateManifestV2(v2Minimal);
  assert.equal(res.ok, true);
  if (!res.ok) throw new Error(res.errors.join("; "));
  assert.equal(res.manifest.schemaVersion, 2);
});

test("validateManifestV2:缺 id → errors", () => {
  const res = validateManifestV2({ ...v2Minimal, id: "" });
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("应失败");
  assert.ok(res.errors.some((e) => e.includes("id")));
});

test("validateManifestV2:缺 services → errors", () => {
  const res = validateManifestV2({ ...v2Minimal, services: undefined });
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("应失败");
  assert.ok(res.errors.some((e) => e.includes("services")));
});

test("migrateV2toV3:复制 v2 字段 + schemaVersion=3 + 默认 semantic 空", () => {
  const v3 = migrateV2toV3(v2Minimal);
  assert.equal(v3.schemaVersion, 3);
  assert.equal(v3.id, v2Minimal.id);
  assert.equal(v3.name, v2Minimal.name);
  assert.equal(v3.type, v2Minimal.type);
  assert.equal(v3.configKey, v2Minimal.configKey);
  assert.deepEqual(v3.requires, v2Minimal.requires);
  assert.deepEqual(v3.permissions, v2Minimal.permissions);
  assert.deepEqual(v3.services?.provides, v2Minimal.services.provides);
  assert.equal(v3.semantic, undefined);
});

test("migrateV2toV3:输入不被改写（immutable 输入）", () => {
  const copy = structuredClone(v2Minimal);
  const v3 = migrateV2toV3(copy);
  assert.deepEqual(copy, v2Minimal, "migrate 不得修改原 v2");
  // 输出是新对象
  assert.notEqual(v3, copy);
});

test("mergeSemanticV3:数组去重保序 + 对象整体替换", () => {
  const merged = mergeSemanticV3(
    {
      configKeys: ["economy.*", "land.*"],
      dependsOn: ["feature-land"],
      events: { emits: ["a"], listens: ["x"] },
      dbTables: [{ name: "wallet", columns: ["balance"] }],
      publicApi: [{ symbol: "spend" }],
    },
    {
      configKeys: ["land.*", "wallet.*"],
      dependsOn: ["feature-wallet"],
      events: { emits: ["b"], listens: ["y"] },
      dbTables: [{ name: "wallet", columns: ["playerId"] }, { name: "tx_log" }],
      publicApi: [{ symbol: "Player.balance" }],
    }
  );
  assert.deepEqual(merged.configKeys, ["economy.*", "land.*", "wallet.*"]);
  assert.deepEqual(merged.dependsOn, ["feature-land", "feature-wallet"]);
  assert.deepEqual(merged.events?.emits, ["a", "b"]);
  assert.deepEqual(merged.events?.listens, ["x", "y"]);
  assert.equal(merged.dbTables?.length, 2);
  assert.deepEqual(
    merged.dbTables?.find((t) => t.name === "wallet")?.columns,
    ["balance", "playerId"]
  );
  assert.deepEqual(merged.publicApi?.map((a) => a.symbol).sort(), ["Player.balance", "spend"]);
});

test("mergeSemanticV3:undefined / 空 base 与 patch 互不污染", () => {
  const merged = mergeSemanticV3(undefined, undefined);
  assert.deepEqual(merged, {});
  const onlyPatch = mergeSemanticV3(undefined, {
    configKeys: ["a", "b"],
  });
  assert.deepEqual(onlyPatch.configKeys, ["a", "b"]);
  const onlyBase = mergeSemanticV3(
    { dependsOn: ["x"] },
    undefined
  );
  assert.deepEqual(onlyBase.dependsOn, ["x"]);
});

test("validateManifestV3:根非 plain object → errors（边界）", () => {
  const res = validateManifestV3(null);
  assert.equal(res.ok, false);
  if (res.ok) throw new Error("应失败");
  assert.ok(res.errors[0].includes("plain object"));
});
