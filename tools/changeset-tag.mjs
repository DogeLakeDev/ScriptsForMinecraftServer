#!/usr/bin/env node
/**
 * 为当前可发包创建 git tag（与 changeset publish 同格式: name@version）。
 * 已存在的 tag 跳过。写入 .sfmc-release-tags.json 供后续 push / gh release 使用。
 *
 *   node tools/changeset-tag.mjs                 # 按 HEAD~1 版本 diff 打 tag
 *   node tools/changeset-tag.mjs --from-existing # 仅收录本地已有 name@version
 *   node tools/changeset-tag.mjs --create        # 显式按 diff 创建（与默认相同，保留兼容）
 *
 * 默认走 HEAD~1 diff（workflow fetch-depth:0）。仅显式 --from-existing / SFMC_TAG_FROM_EXISTING=1
 * 时用「已有 tag」路径；浅克隆无法解析 HEAD~1 时由 resolvePackagesNeedingTags 安全回退。
 * 切勿在 CI 无条件 from-existing：全量拉 tag 后会过收录未在本轮 bump 的包。
 */
import path from "node:path";
import {
  ROOT,
  git,
  gitCapture,
  resolvePackagesNeedingTags,
  writeReleaseTagsState,
  RELEASE_TAGS_STATE,
} from "./lib/changeset-release.mjs";

const fromExisting =
  process.argv.includes("--from-existing") || process.env.SFMC_TAG_FROM_EXISTING === "1";

const needed = resolvePackagesNeedingTags({ fromExisting });
if (needed.length === 0) {
  console.log(
    fromExisting
      ? "[changeset] 无已存在的 name@version tag 可收录，跳过"
      : "[changeset] 无包版本变化，跳过打 tag"
  );
  writeReleaseTagsState([]);
  process.exit(0);
}

const created = [];
for (const p of needed) {
  const exists = Boolean(gitCapture(["tag", "-l", p.tag]));
  if (exists) {
    console.log(`[changeset] tag 已存在，跳过: ${p.tag}`);
    created.push({
      name: p.name,
      version: p.version,
      tag: p.tag,
      pkgPath: p.pkgPath,
      existed: true,
    });
    continue;
  }
  if (fromExisting) {
    /* from-existing 契约：不新建 tag（LSP：与「仅收录」语义一致） */
    continue;
  }
  git(["tag", "-a", p.tag, "-m", `Release ${p.tag}`]);
  console.log(`[changeset] tagged ${p.tag}` + (p.prev ? ` (${p.prev} → ${p.version})` : ""));
  created.push({
    name: p.name,
    version: p.version,
    tag: p.tag,
    pkgPath: p.pkgPath,
    existed: false,
  });
}

writeReleaseTagsState(created);
console.log(
  `[changeset] 写入 ${path.relative(ROOT, RELEASE_TAGS_STATE)} (${created.length} tags)` +
    (fromExisting ? " [from-existing]" : "")
);
