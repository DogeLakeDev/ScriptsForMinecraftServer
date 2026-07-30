// @ts-check
/**
 * gen-mc-fake.test.mjs — 生成器纯函数
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  listValueExports,
  parseEnumMembers,
  emitServerL0Module,
  HAND_WRITTEN_SERVER,
} from "./gen-mc-fake.mjs";

const FIXTURE = `
export enum AimAssistTargetMode {
  Angle = 'Angle',
  Distance = 'Distance',
}
export class BlockVolume {
  constructor() {}
  getBlock() {}
}
export function commandBlockMinecart() {}
export const TicksPerSecond = 20;
export type OnlyType = string;
export interface OnlyIface { x: number }
`;

test("listValueExports 收集 enum/class/function/const，忽略 type/interface", () => {
  const list = listValueExports(FIXTURE);
  const names = list.map((e) => e.name);
  assert.ok(names.includes("AimAssistTargetMode"));
  assert.ok(names.includes("BlockVolume"));
  assert.ok(names.includes("commandBlockMinecart"));
  assert.ok(names.includes("TicksPerSecond"));
  assert.ok(!names.includes("OnlyType"));
  assert.ok(!names.includes("OnlyIface"));
});

test("parseEnumMembers 解析字符串与数字", () => {
  const m = parseEnumMembers(`
    Angle = 'Angle',
    Distance = "Distance",
    N = 2,
  `);
  assert.equal(m.Angle, "Angle");
  assert.equal(m.Distance, "Distance");
  assert.equal(m.N, 2);
});

test("emitServerL0Module 跳过手写名且含硬失败", () => {
  const exports = listValueExports(FIXTURE);
  // 假装 BlockVolume 已手写
  const { code, names } = emitServerL0Module(exports, {
    skip: new Set([...HAND_WRITTEN_SERVER, "BlockVolume"]),
  });
  assert.ok(!names.includes("BlockVolume"));
  assert.ok(names.includes("AimAssistTargetMode"));
  assert.match(code, /UnimplementedMinecraftApiError/);
  assert.match(code, /export const AimAssistTargetMode/);
});
