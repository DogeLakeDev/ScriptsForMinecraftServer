#!/usr/bin/env node
// @ts-check
/**
 * 推送当前分支与发版 tag（优先读 .sfmc-release-tags.json）。
 * CI 下默认只推 tag（SFMC_PUSH_TAGS_ONLY=1 或 CI=true）。
 */
import {
  git,
  gitCapture,
  listUnpushedExistingVersionTags,
  readReleaseTagsState,
  resolveReleaseTagEntries,
} from "./changeset-release-lib.mjs";

const tagsOnly =
  process.env.SFMC_PUSH_TAGS_ONLY === "1" ||
  process.env.CI === "true" ||
  process.argv.includes("--tags-only");

if (!tagsOnly) {
  const branch = gitCapture(["rev-parse", "--abbrev-ref", "HEAD"]) || "main";
  if (branch === "HEAD") {
    console.log("[changeset] detached HEAD，跳过分支推送");
  } else {
    console.log(`[changeset] git push origin ${branch}`);
    git(["push", "origin", `HEAD:refs/heads/${branch}`]);
  }
} else {
  console.log("[changeset] CI/tags-only：跳过分支推送");
}

const state = readReleaseTagsState();
/* DRY/LSP：缺失态与 gh-release 共用「当前可发包 + 当前版本 tag」候选，再过滤未推送 */
const entries = resolveReleaseTagEntries(state, () => {
  console.warn("[changeset] 无 .sfmc-release-tags.json，回退为未推送的当前 name@version tag");
  return listUnpushedExistingVersionTags();
});

const tags = entries.map((t) => t.tag).filter(Boolean);

if (tags.length === 0) {
  console.log("[changeset] 无待推送 tag，跳过");
  process.exit(0);
}

for (const tag of tags) {
  console.log(`[changeset] git push origin ${tag}`);
  git(["push", "origin", `refs/tags/${tag}`]);
}

console.log(`[changeset] 已推送 ${tags.length} 个 tag`);
