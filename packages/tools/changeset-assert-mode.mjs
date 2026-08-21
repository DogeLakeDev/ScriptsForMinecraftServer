#!/usr/bin/env node
// @ts-check
/**
 * 发版模式门禁。
 *   node tools/changeset-assert-mode.mjs --pre      # 要求处于 pre mode
 *   node tools/changeset-assert-mode.mjs --stable   # 要求已退出 pre mode
 */
import { isPreMode, readPreState } from "./changeset-release-lib.mjs";

const mode = process.argv.includes("--stable")
  ? "stable"
  : process.argv.includes("--pre")
    ? "pre"
    : null;

if (!mode) {
  console.error("用法: changeset-assert-mode.mjs --pre | --stable");
  process.exit(2);
}

const pre = isPreMode();
const state = readPreState();

if (mode === "pre" && !pre) {
  console.error(
    "[changeset] 当前不在 pre mode。正式通道请先 `npx changeset pre exit`；" +
      "日常发版走 CI（push main → Version PR）。若要重新进入 beta: npx changeset pre enter beta"
  );
  process.exit(1);
}

if (mode === "stable" && pre) {
  console.error(
    `[changeset] 仓库仍处于 pre mode (tag=${state?.tag ?? "beta"})。` +
      `达标后执行 npx changeset pre exit；日常发版走 CI Version PR。`
  );
  process.exit(1);
}

console.log(
  mode === "pre"
    ? `[changeset] pre mode OK (npm tag ${state?.tag ?? "beta"})`
    : "[changeset] stable mode OK (not in pre)"
);
