/**
 * test/example.test.ts — lifecycle smoke（无 BDS 跑通 register/init/cleanup）
 *
 * 跑法：`sfmc mod test`（CLI 委托到本仓 `npm test`）
 * 或： `npm test`  → `node --test --import tsx test/*.test.ts`
 */
import { test } from "node:test";
import assert from "node:assert/strict";

test("smoke: 模块入口可加载（无 throw）", async () => {
  /* import 模块会调用 ModuleRegistry.register；该函数应幂等可重复。 */
  await import("../sapi/src/index.ts");
  /* 若到达此处说明 register 未抛错。 */
  assert.ok(true, "模块入口加载完成");
});
