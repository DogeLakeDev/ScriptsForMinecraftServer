/**
 * Studio 外观偏好解析单测（纯函数，不碰 DOM / localStorage）。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { cycleThemePref, resolveTheme } from "../../ui-studio-web/src/theme.ts";

test("theme: 显式浅色/深色忽略系统偏好", () => {
  assert.equal(resolveTheme("light", true), "light");
  assert.equal(resolveTheme("light", false), "light");
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme("dark", false), "dark");
});

test("theme: 跟随系统时映射 prefers-color-scheme", () => {
  assert.equal(resolveTheme("system", true), "dark");
  assert.equal(resolveTheme("system", false), "light");
});

test("theme: 循环顺序为 跟随系统 → 浅色 → 深色", () => {
  assert.equal(cycleThemePref("system"), "light");
  assert.equal(cycleThemePref("light"), "dark");
  assert.equal(cycleThemePref("dark"), "system");
});
