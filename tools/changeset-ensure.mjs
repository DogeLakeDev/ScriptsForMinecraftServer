#!/usr/bin/env node
/**
 * 若尚无待消费 changeset，则交互式执行 `changeset`；已有则跳过。
 */
import { listPendingChangesetFiles, run } from "./lib/changeset-release.mjs";

const pending = listPendingChangesetFiles();
if (pending.length > 0) {
  console.log(
    `[changeset] 已有 ${pending.length} 个待消费 changeset，跳过交互添加:\n` +
      pending.map((p) => `  - ${p}`).join("\n")
  );
  process.exit(0);
}

console.log("[changeset] 无待消费 changeset，启动交互式 changeset …");
run("npx", ["changeset"]);

const after = listPendingChangesetFiles();
if (after.length === 0) {
  console.error("[changeset] 未创建任何 changeset，已中止发版。");
  process.exit(1);
}
