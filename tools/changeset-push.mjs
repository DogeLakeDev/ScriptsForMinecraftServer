#!/usr/bin/env node
/**
 * 推送当前分支与发版 tag（优先读 .sfmc-release-tags.json）。
 * CI 下默认只推 tag（SFMC_PUSH_TAGS_ONLY=1 或 CI=true）。
 */
import {
  git,
  gitCapture,
  readReleaseTagsState,
  resolveReleaseTagEntries,
} from "./lib/changeset-release.mjs";

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
const entries = resolveReleaseTagEntries(state, () => {
  /* 回退：仅当状态文件缺失时，推送本机尚未在 origin 的 name@version 风格 tag */
  console.warn("[changeset] 无 .sfmc-release-tags.json，回退扫描本地未推送 tag");
  /** @type {{ tag: string }[]} */
  const out = [];
  const local = gitCapture(["tag", "-l", "@sfmc-bds/*"])
    .split(/\r?\n/)
    .filter(Boolean);
  for (const tag of local) {
    const remote = gitCapture(["ls-remote", "--tags", "origin", `refs/tags/${tag}`]);
    if (!remote) out.push({ tag });
  }
  return out;
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
