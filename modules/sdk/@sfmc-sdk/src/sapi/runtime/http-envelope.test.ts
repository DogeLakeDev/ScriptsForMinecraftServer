import { equal } from "node:assert/strict";
import test from "node:test";
import { isSuccessfulHttpEnvelope } from "./http-envelope.ts";

test("信封:200 + 无 ok/success 字段 → 成功(列表/配置读取)", () => {
  equal(isSuccessfulHttpEnvelope(200, {}), true);
});

test("信封:200 + ok:true → 成功", () => {
  equal(isSuccessfulHttpEnvelope(200, { ok: true }), true);
});

test("信封:200 + success:true → 成功", () => {
  equal(isSuccessfulHttpEnvelope(200, { success: true }), true);
});

test("信封:200 + ok:false → 失败(LSP)", () => {
  equal(isSuccessfulHttpEnvelope(200, { ok: false, error: "x" }), false);
});

test("信封:200 + success:false → 失败(LSP,防误判)", () => {
  equal(isSuccessfulHttpEnvelope(200, { success: false, error: "x" }), false);
});

test("信封:非 200 → 失败", () => {
  equal(isSuccessfulHttpEnvelope(400, { ok: true }), false);
  equal(isSuccessfulHttpEnvelope(403, { success: false, error: "denied" }), false);
});
