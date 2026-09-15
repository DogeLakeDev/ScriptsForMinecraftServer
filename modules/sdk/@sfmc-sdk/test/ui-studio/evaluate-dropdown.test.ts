/**
 * 下拉 options 从 load 数据展开。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveDropdownOptions } from "../../src/ui-studio/shared/evaluate.ts";

test("静态下拉 options 保留 value 类型", () => {
  const options = resolveDropdownOptions(
    [{ label: "甲", value: "a" }, { label: "乙", value: 2 }],
    {},
  );
  assert.deepEqual(options, [
    { label: "甲", value: "a" },
    { label: "乙", value: 2 },
  ]);
});

test("数据源下拉按 source 数组展开 label/value 模板", () => {
  const options = resolveDropdownOptions(
    {
      source: "data.players.items",
      as: "player",
      value: "{{player.id}}",
      label: "{{player.name}}",
    },
    {
      data: {
        players: {
          items: [
            { id: "p1", name: "Ada" },
            { id: "p2", name: "Bob" },
          ],
        },
      },
    },
  );
  assert.deepEqual(options, [
    { label: "Ada", value: "p1" },
    { label: "Bob", value: "p2" },
  ]);
});
