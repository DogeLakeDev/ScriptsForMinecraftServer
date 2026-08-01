/**
 * insertMenu.ts 单元测试：菜单数据按 ctx 现状正确分段、tokens 与 expr 解析器对齐。
 */
import test from "node:test";
import assert from "node:assert/strict";
import { buildInsertMenu, type InsertMenuContext } from "./insertMenu.ts";
import type { SceneSummary } from "../metaForm";

function sceneFixture(overrides: Partial<SceneSummary> = {}): SceneSummary {
  return {
    world: { id: "w1", kind: "World" },
    scoreboard: { id: "s1", kind: "Scoreboard" },
    dimensions: [{ id: "d1", kind: "Dimension", dimensionId: "minecraft:overworld" }],
    players: [
      { id: "p1", kind: "Player", name: "alice" },
      { id: "p2", kind: "Player", name: "bob" },
    ],
    entities: [
      { id: "e1", kind: "Entity", typeId: "minecraft:zombie" },
      { id: "e2", kind: "Entity", typeId: "minecraft:cow" },
    ],
    items: [{ id: "i1", kind: "ItemStack", typeId: "minecraft:apple" }],
    blocks: [{ id: "b1", kind: "Block" }],
    lastEmit: {
      path: "world.afterEvents.playerSpawn",
      payload: { message: "hi" },
      result: 1,
    },
    lastCall: { id: "p1", method: "getLocation", result: { x: 1, y: 2, z: 3 } },
    ...overrides,
  };
}

test("buildInsertMenu 空 ctx：@out / @scene 空；@lastEmit / @lastCall 保留禁用占位", () => {
  const sections = buildInsertMenu({ scene: null, out: undefined });
  assert.equal(sections.length, 4);
  // @out / @scene：真的为空
  assert.deepEqual(sections.find((s) => s.title === "@out")!.items, []);
  assert.deepEqual(sections.find((s) => s.title === "@scene")!.items, []);
  // @lastEmit / @lastCall：保留单条禁用占位，让 UI 一眼区分「无记录」与「有记录」
  const lastE = sections.find((s) => s.title === "@lastEmit")!;
  assert.equal(lastE.items.length, 1);
  assert.equal(lastE.items[0]!.disabled, true);
  const lastC = sections.find((s) => s.title === "@lastCall")!;
  assert.equal(lastC.items.length, 1);
  assert.equal(lastC.items[0]!.disabled, true);
});

test("buildInsertMenu @out：键按字典序、@out.<key> 与 insertMenu 形态对齐", () => {
  const sections = buildInsertMenu({
    scene: null,
    out: {
      alpha: "a-value",
      gamma: 42,
      beta: { nested: true },
    },
  });
  const out = sections.find((s) => s.title === "@out")!;
  assert.equal(out.items.length, 3);
  // 按 key 排序：alpha / beta / gamma
  assert.deepEqual(
    out.items.map((i) => i.insert),
    ["@out.alpha", "@out.beta", "@out.gamma"]
  );
  assert.deepEqual(
    out.items.map((i) => i.label),
    ["alpha", "beta", "gamma"]
  );
  assert.equal(out.items[0]!.preview, "a-value");
  // 嵌套对象走 valueAsString = JSON.stringify
  assert.equal(out.items[1]!.preview, JSON.stringify({ nested: true }));
  assert.equal(out.items[2]!.preview, "42");
});

test("buildInsertMenu @scene：完整场景渲染 World / Scoreboard / Dimension / Player / Entity / Item / Block", () => {
  const sections = buildInsertMenu({ scene: sceneFixture(), out: undefined });
  const sceneSection = sections.find((s) => s.title === "@scene")!;
  const inserts = sceneSection.items.map((i) => i.insert);
  assert.ok(inserts.includes("@scene.world"));
  assert.ok(inserts.includes("@scene.scoreboard"));
  assert.ok(inserts.includes("@scene.minecraft:overworld"));
  assert.ok(inserts.includes("@scene.alice"));
  assert.ok(inserts.includes("@scene.bob"));
  assert.ok(inserts.includes("@scene.minecraft:zombie"));
  assert.ok(inserts.includes("@scene.minecraft:cow"));
  assert.ok(inserts.includes("@scene.minecraft:apple"));
  assert.ok(inserts.includes("@scene.b1"));
});

test("buildInsertMenu @lastEmit：有记录 → 单条且可用", () => {
  const sections = buildInsertMenu({ scene: sceneFixture(), out: undefined });
  const sec = sections.find((s) => s.title === "@lastEmit")!;
  assert.equal(sec.items.length, 1);
  assert.equal(sec.items[0]!.insert, "@lastEmit");
  assert.equal(sec.items[0]!.disabled, undefined);
  assert.match(sec.items[0]!.preview ?? "", /world\.afterEvents\.playerSpawn/);
});

test("buildInsertMenu @lastEmit：null 时单条禁用", () => {
  const sections = buildInsertMenu({
    scene: sceneFixture({ lastEmit: null }),
    out: undefined,
  });
  const sec = sections.find((s) => s.title === "@lastEmit")!;
  assert.equal(sec.items.length, 1);
  assert.equal(sec.items[0]!.insert, "@lastEmit");
  assert.equal(sec.items[0]!.disabled, true);
});

test("buildInsertMenu @lastCall：有记录 → 单条且可用", () => {
  const sections = buildInsertMenu({ scene: sceneFixture(), out: undefined });
  const sec = sections.find((s) => s.title === "@lastCall")!;
  assert.equal(sec.items.length, 1);
  assert.equal(sec.items[0]!.insert, "@lastCall");
  assert.match(sec.items[0]!.preview ?? "", /p1 · getLocation\(\)/);
});

test("buildInsertMenu @lastCall：null 时单条禁用", () => {
  const sections = buildInsertMenu({
    scene: sceneFixture({ lastCall: null }),
    out: undefined,
  });
  const sec = sections.find((s) => s.title === "@lastCall")!;
  assert.equal(sec.items[0]!.disabled, true);
});

test("buildInsertMenu preview 超长截断", () => {
  const long = "x".repeat(200);
  const sections = buildInsertMenu({
    scene: null,
    out: { huge: long },
  });
  const out = sections.find((s) => s.title === "@out")!;
  const preview = out.items[0]!.preview ?? "";
  assert.ok(preview.length <= 64, `preview=${preview.length}`);
  assert.ok(preview.endsWith("…"), "应带省略号");
});

test("buildInsertMenu insert 字段与 expr.ts token 一致", () => {
  // 设计契约：所有 insert 串都应被 expr.ts parseExpr 接受为 token 前缀
  const sections = buildInsertMenu({
    scene: sceneFixture(),
    out: { foo: 1 },
  });
  const tokens = sections.flatMap((s) => s.items.map((i) => i.insert));
  // @out.foo / @scene.world / @scene.alice / @lastEmit / @lastCall
  for (const t of tokens) {
    assert.ok(
      t === "@lastEmit" || t === "@lastCall" || /^@out\.[A-Za-z_][A-Za-z0-9_]*$/.test(t) ||
        /^@scene\.[A-Za-z0-9_:.\-]+$/.test(t),
      `非预期 token: ${t}`
    );
  }
});
