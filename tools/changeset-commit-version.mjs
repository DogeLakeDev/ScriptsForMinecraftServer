#!/usr/bin/env node
// @ts-check
/**
 * 在 changeset version 之后提交 package.json / CHANGELOG / .changeset 变更。
 */
import { git, gitCapture } from "./changeset-release-lib.mjs";

const status = gitCapture(["status", "--porcelain"]);
if (!status) {
  console.log("[changeset] 无版本变更可提交，跳过 commit");
  process.exit(0);
}

const files = status
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => line.slice(3).trim().replace(/\\/g, "/"))
  .filter((f) => {
    /* git status 重命名: "old -> new" */
    const name = f.includes(" -> ") ? f.split(" -> ").pop() : f;
    return (
      name.startsWith(".changeset/") ||
      name.endsWith("/package.json") ||
      name === "package.json" ||
      name.endsWith("/CHANGELOG.md") ||
      name === "CHANGELOG.md" ||
      name === "package-lock.json"
    );
  })
  .map((f) => (f.includes(" -> ") ? f.split(" -> ").pop() : f));

if (files.length === 0) {
  console.log("[changeset] 无 version 相关文件，跳过 commit");
  process.exit(0);
}

git(["add", "--", ...files]);
const staged = gitCapture(["diff", "--cached", "--name-only"]);
if (!staged) {
  console.log("[changeset] 暂存区为空，跳过 commit");
  process.exit(0);
}

git(["commit", "-m", "chore(release): version packages"]);
console.log(`[changeset] 已提交 ${files.length} 个文件: chore(release): version packages`);
