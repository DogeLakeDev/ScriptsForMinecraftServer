/**
 * detect.ts 单元测试：字段类型 → 控件路由判定。
 *
 * 注：detect 依赖 enums.generated.ts 与 interfaces.generated.ts 的运行时常量；
 * 该测试与生成物一同打包，运行期与构建期产物一致。
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  arrayElementType,
  enumMembers,
  isArrayType,
  isEnumType,
  isObjectType,
  objectProps,
  splitTypeUnion,
  stripArraySuffix,
  stripNullability,
} from "./detect.ts";

test("splitTypeUnion 拆分顶层联合并忽略嵌套", () => {
  assert.deepEqual(splitTypeUnion("Foo | Bar"), ["Foo", "Bar"]);
  assert.deepEqual(splitTypeUnion("Foo"), ["Foo"]);
  assert.deepEqual(splitTypeUnion(""), []);
  assert.deepEqual(splitTypeUnion("Foo<string> | Bar<x, y>"), [
    "Foo<string>",
    "Bar<x, y>",
  ]);
  assert.deepEqual(splitTypeUnion("Map<string, string | number>"), [
    "Map<string, string | number>",
  ]);
});

test("stripArraySuffix / stripNullability / isArrayType", () => {
  assert.equal(stripArraySuffix("Foo[]"), "Foo");
  assert.equal(stripArraySuffix("Foo"), "Foo");
  assert.equal(stripNullability("Foo | null"), "Foo");
  assert.equal(stripNullability("Foo | undefined"), "Foo");
  assert.equal(stripNullability("Foo"), "Foo");
  assert.equal(isArrayType("Foo[]"), true);
  assert.equal(isArrayType("Foo"), false);
  assert.equal(arrayElementType("Foo[]"), "Foo");
  assert.equal(arrayElementType("Foo"), null);
});

test("isEnumType 命中 ENUM_MEMBERS", () => {
  assert.equal(isEnumType("GameMode"), true);
  assert.equal(isEnumType("GameMode[]"), true);
  assert.equal(isEnumType("GameMode | string"), true);
  // 联合里第二项是 enum
  assert.equal(isEnumType("string | CloneMode"), true);
  assert.equal(isEnumType("boolean"), false);
  assert.equal(isEnumType("EntityApplyDamageByProjectileOptions"), false);
});

test("isObjectType 命中 INTERFACE_MEMBERS", () => {
  assert.equal(isObjectType("TeleportOptions"), true);
  assert.equal(isObjectType("EntityApplyDamageByProjectileOptions"), true);
  assert.equal(isObjectType("TeleportOptions | null"), true);
  // 类（class）不会被 INTERFACE_MEMBERS 收录；视作非对象（保留旧 textarea 路径）
  assert.equal(isObjectType("Player"), false);
  assert.equal(isObjectType("GameMode"), false);
});

test("enumMembers 返回首个命中联合项", () => {
  const m1 = enumMembers("GameMode");
  assert.ok(m1);
  assert.ok(m1!.includes("Survival"));
  assert.equal(enumMembers("boolean"), null);
  // 联合里第二个才是 enum
  const m2 = enumMembers("string | CloneMode");
  assert.ok(m2);
  assert.ok(m2!.includes("Move"));
});

test("objectProps 返回字段列表并展开成可变副本", () => {
  const p = objectProps("TeleportOptions");
  assert.ok(p);
  assert.ok(p!.some((x) => x.name === "checkForBlocks"));
  assert.ok(p!.some((x) => x.name === "rotation"));
  assert.ok(p!.some((x) => x.name === "dimension"));
  // 修改副本不污染原表
  p!.push({ name: "x", type: "y", readonly: false, optional: false } as never);
  const p2 = objectProps("TeleportOptions");
  assert.equal(p2!.length, p!.length - 1);
});
