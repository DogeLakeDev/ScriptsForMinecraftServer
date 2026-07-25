#!/usr/bin/env node
/**
 * 为发版 tag 创建 GitHub Release / Pre-release。
 *
 *   node tools/changeset-github-release.mjs           # 版本含 - → prerelease
 *   node tools/changeset-github-release.mjs --prerelease
 *   node tools/changeset-github-release.mjs --latest
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  extractChangelogNotes,
  gitCapture,
  listPublishablePackages,
  packageDirFor,
  packageTagName,
  readReleaseTagsState,
  resolveReleaseTagEntries,
  run,
} from "./lib/changeset-release.mjs";

const forcePre = process.argv.includes("--prerelease");
const forceLatest = process.argv.includes("--latest");

function loadTargets() {
  const state = readReleaseTagsState();
  const entries = resolveReleaseTagEntries(state, () => {
    /* 仅状态文件缺失时回退：当前版本对应 tag 已在本地的可发包 */
    console.warn("[changeset] 无 .sfmc-release-tags.json，回退扫描本地 name@version tag");
    const out = [];
    for (const p of listPublishablePackages()) {
      const tag = packageTagName(p.name, p.version);
      if (gitCapture(["tag", "-l", tag])) {
        out.push({ name: p.name, version: p.version, tag });
      }
    }
    return out;
  });
  return entries.map((t) => ({
    name: t.name,
    version: t.version,
    tag: t.tag,
  }));
}

function isPrereleaseVersion(version) {
  if (forceLatest) return false;
  if (forcePre) return true;
  return version.includes("-");
}

function releaseExists(tag) {
  const r = spawnSync("gh", ["release", "view", tag], {
    cwd: ROOT,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  return r.status === 0;
}

const targets = loadTargets();
if (targets.length === 0) {
  console.log("[changeset] 无 tag 可建 GitHub Release，跳过");
  process.exit(0);
}

for (const t of targets) {
  if (releaseExists(t.tag)) {
    console.log(`[changeset] GitHub Release 已存在，跳过: ${t.tag}`);
    continue;
  }

  const pre = isPrereleaseVersion(t.version);
  const pkgDir = packageDirFor(t.name) ?? ROOT;
  const notes = extractChangelogNotes(pkgDir, t.version);
  const notesFile = path.join(
    ROOT,
    `.sfmc-release-notes-${t.name.replace(/[/@]/g, "_")}.md`
  );
  fs.writeFileSync(notesFile, notes + "\n");

  const args = ["release", "create", t.tag, "--title", t.tag, "--notes-file", notesFile];
  if (pre) args.push("--prerelease");

  console.log(`[changeset] gh release create ${t.tag}` + (pre ? " --prerelease" : ""));
  try {
    run("gh", args);
  } finally {
    if (fs.existsSync(notesFile)) fs.unlinkSync(notesFile);
  }
}

console.log(`[changeset] GitHub Release 处理完毕 (${targets.length})`);
