import { equal } from "node:assert/strict";
import test from "node:test";
import { isSuccessfulHttpEnvelope } from "../../../src/sapi/runtime/http-envelope.js";

test("??:200 + ? ok/success ?? ? ??(??/????)", () => {
  equal(isSuccessfulHttpEnvelope(200, {}), true);
});

test("??:200 + ok:true ? ??", () => {
  equal(isSuccessfulHttpEnvelope(200, { ok: true }), true);
});

test("??:200 + success:true ? ??", () => {
  equal(isSuccessfulHttpEnvelope(200, { success: true }), true);
});

test("??:200 + ok:false ? ??(LSP)", () => {
  equal(isSuccessfulHttpEnvelope(200, { ok: false, error: "x" }), false);
});

test("??:200 + success:false ? ??(LSP,???)", () => {
  equal(isSuccessfulHttpEnvelope(200, { success: false, error: "x" }), false);
});

test("??:? 200 ? ??", () => {
  equal(isSuccessfulHttpEnvelope(400, { ok: true }), false);
  equal(isSuccessfulHttpEnvelope(403, { success: false, error: "denied" }), false);
});
