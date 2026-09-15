/**
 * 预览模板拆段：{{path}} 必须原样保留，不能被收成空串。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { splitTemplateParts } from "../../src/ui-studio/shared/evaluate.ts";

test("splitTemplateParts: 无绑定则整段为文本", () => {
  assert.deepEqual(splitTemplateParts("暂无合作社"), [{ kind: "text", text: "暂无合作社" }]);
});

test("splitTemplateParts: 混合文案保留 {{path}} 原文", () => {
  const parts = splitTemplateParts(
    "#{{row.rank}} {{row.name}} · 成员 {{row.memberCount}} · 公账 {{row.bankBalance}}",
  );
  assert.deepEqual(parts, [
    { kind: "text", text: "#" },
    { kind: "bind", raw: "{{row.rank}}", path: "row.rank" },
    { kind: "text", text: " " },
    { kind: "bind", raw: "{{row.name}}", path: "row.name" },
    { kind: "text", text: " · 成员 " },
    { kind: "bind", raw: "{{row.memberCount}}", path: "row.memberCount" },
    { kind: "text", text: " · 公账 " },
    { kind: "bind", raw: "{{row.bankBalance}}", path: "row.bankBalance" },
  ]);
});

test("splitTemplateParts: 保留花括号内空白", () => {
  const parts = splitTemplateParts("你好，{{ player.name }}");
  assert.deepEqual(parts, [
    { kind: "text", text: "你好，" },
    { kind: "bind", raw: "{{ player.name }}", path: "player.name" },
  ]);
});
