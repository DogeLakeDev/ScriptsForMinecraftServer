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
  loadOverridesExportNames,
  DEFAULT_OVERRIDES_DIR,
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

test("emitServerL0Module 跳过 overrides 名且含硬失败", () => {
  const exports = listValueExports(FIXTURE);
  const { code, names } = emitServerL0Module(exports, {
    skip: new Set(["BlockVolume"]),
  });
  assert.ok(!names.includes("BlockVolume"));
  assert.ok(names.includes("AimAssistTargetMode"));
  assert.match(code, /UnimplementedMinecraftApiError/);
  assert.match(code, /export const AimAssistTargetMode/);
});

test("loadOverridesExportNames 以 overrides/exports.json 为权威", () => {
  const { server, serverUi, manifestPath } = loadOverridesExportNames(DEFAULT_OVERRIDES_DIR);
  assert.match(manifestPath.replace(/\\/g, "/"), /overrides\/exports\.json$/);
  assert.ok(server.has("ItemStack"));
  assert.ok(server.has("world"));
  assert.ok(serverUi.has("ActionFormData"));
  assert.ok(!server.has("BlockVolume"));
});
