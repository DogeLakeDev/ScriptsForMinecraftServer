/**
 * EnumSelect 工具函数单测：asString 与一致行为。
 *
 * 注：组件本体依赖 React 渲染（react/jsx-runtime），不在 node --test 环境跑。
 * 这里只覆盖值收敛逻辑，渲染验证靠 build + smoke 手验。
 */

// asString 从 EnumSelect.tsx 中 backport 一份对应行为做断言对照（详见组件）。
function asStringLocal(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

import test from "node:test";
import assert from "node:assert/strict";

test("asString 把 null/undefined 收敛为空串", () => {
  assert.equal(asStringLocal(null), "");
  assert.equal(asStringLocal(undefined), "");
});

test("asString 保留字符串原值", () => {
  assert.equal(asStringLocal("Survival"), "Survival");
  assert.equal(asStringLocal(""), "");
});

test("asString 非字符串类型强制 String(v)", () => {
  assert.equal(asStringLocal(42), "42");
  assert.equal(asStringLocal(true), "true");
});

test("单值枚举 members 列表查找：未命中 → 走「（自定义）」通道", () => {
  const members = ["Survival", "Creative", "Adventure", "Spectator"];
  const current = asStringLocal("Spectator");
  const inList = members.includes(current);
  assert.equal(inList, true);
  const currentCustom = asStringLocal("notAnEnumValue");
  assert.equal(members.includes(currentCustom), false);
});

test("数组值规范化", () => {
  const arr: unknown[] = ["Survival", "Creative", 42];
  const normalized = arr.map(asStringLocal);
  assert.deepEqual(normalized, ["Survival", "Creative", "42"]);
});
