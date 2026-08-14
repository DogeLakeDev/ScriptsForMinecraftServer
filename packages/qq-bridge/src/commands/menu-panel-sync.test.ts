/**
 * commands/menu-panel-sync.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CommandRegistry } from "./registry.js";
import { registerBuiltinCommands } from "./handlers.js";
import { buildMenuItems, buildPanelItems } from "./menu-panel-sync.js";

test("buildMenuItems / buildPanelItems 与 registry 对齐且 ≤10/20", () => {
  const registry = new CommandRegistry();
  registerBuiltinCommands(registry);
  const userCount = registry.userMenu().length;
  const total = registry.all().length;
  const menu = buildMenuItems(registry);
  const panel = buildPanelItems(registry);
  assert.ok(menu.length >= 5);
  assert.ok(menu.length <= 10);
  assert.equal(menu.length, Math.min(10, userCount));
  assert.equal(panel.length, Math.min(20, total));
  assert.equal(menu[0]?.type, "send_message");
  assert.equal(panel[0]?.type, "command");
  assert.ok(menu.some((i) => i.send_message === "/ping"));
  assert.ok(menu.some((i) => i.send_message === "/admin"));
  // 管理项不进 C2C 主菜单
  assert.ok(!menu.some((i) => i.send_message === "/kick"));
  // 面板无独立 command 字段：name 即填入输入框内容；可含管理项
  assert.ok(panel.some((i) => i.name === "/bind"));
  assert.ok(panel.some((i) => i.name === "/kick"));
  assert.ok(panel.every((i) => (i.name?.length ?? 0) <= 14));
  assert.ok(menu.every((i) => (i.name?.length ?? 0) <= 10));
});
