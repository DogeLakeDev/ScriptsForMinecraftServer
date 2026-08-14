/**
 * commands/render.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { renderLlbot, renderOfficial } from "./render.js";
import type { CommandResult } from "./types.js";

const menuResult: CommandResult = {
  text: "SFMC QQ 指令\n· menu — 显示指令菜单",
  markdown: "## SFMC QQ 指令\n\n- **menu**：显示指令菜单",
  buttons: [
    { id: "cmd_menu", label: "menu", command: "/menu" },
    { id: "cmd_ping", label: "ping", command: "/ping" },
  ],
};

test("renderOfficial 带键盘用 markdown", () => {
  const p = renderOfficial(menuResult);
  assert.equal(p.msgType, 2);
  assert.equal(p.markdown, menuResult.markdown);
  assert.equal(p.keyboardButtons?.length, 2);
  assert.equal(p.keyboardButtons?.[1]?.data, "/ping");
});

test("renderOfficial 纯文本", () => {
  const p = renderOfficial({ text: "pong · backend=official" });
  assert.equal(p.msgType, 0);
  assert.equal(p.content, "pong · backend=official");
  assert.equal(p.keyboardButtons, undefined);
});

test("renderLlbot 编号行", () => {
  const p = renderLlbot(menuResult);
  assert.match(p.text, /\[1\] menu/);
  assert.match(p.text, /\[2\] ping/);
  assert.match(p.text, /60 秒/);
});

test("renderLlbot 正文已编号时不重复 [n]", () => {
  const r: CommandResult = {
    text: "SFMC 指令\n说明\n\n1. ping — 连通\n2. 状态 — 摘要",
    buttons: [
      { id: "cmd_ping", label: "ping", command: "/ping" },
      { id: "cmd_status", label: "状态", command: "/status" },
    ],
  };
  const p = renderLlbot(r);
  assert.match(p.text, /1\. ping/);
  assert.doesNotMatch(p.text, /\[1\]/);
  assert.match(p.text, /60 秒/);
});
