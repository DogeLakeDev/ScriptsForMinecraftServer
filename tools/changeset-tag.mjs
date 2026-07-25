#!/usr/bin/env node
/**
 * 为当前可发包创建 git tag（与 changeset publish 同格式: name@version）。
 * 已存在的 tag 跳过。写入 .sfmc-release-tags.json 供后续 push / gh release 使用。
 */
import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  git,
  gitCapture,
  listPublishablePackages,
  packageTagName,
} from "./lib/changeset-release.mjs";

const statePath = path.join(ROOT, ".sfmc-release-tags.json");

/** 相对上一提交（或 upstream）版本有变化的包；首次则全部打 tag */
function packagesNeedingTags() {
  const pkgs = listPublishablePackages();
  const headParent = gitCapture(["rev-parse", "HEAD~1"]);
  if (!headParent) {
    return pkgs.map((p) => ({ ...p, tag: packageTagName(p.name, p.version) }));
  }

  const needed = [];
  for (const p of pkgs) {
    const rel = path.relative(ROOT, p.pkgPath).replace(/\\/g, "/");
    let prev = "";
    try {
      const raw = gitCapture(["show", `HEAD~1:${rel}`]);
      if (raw) prev = String(JSON.parse(raw).version ?? "");
    } catch {
      prev = "";
    }
    if (prev !== p.version) {
      needed.push({ ...p, tag: packageTagName(p.name, p.version), prev });
    }
  }
  return needed;
}

const needed = packagesNeedingTags();
if (needed.length === 0) {
  console.log("[changeset] 无包版本变化，跳过打 tag");
  fs.writeFileSync(statePath, JSON.stringify({ tags: [], createdAt: new Date().toISOString() }, null, 2));
  process.exit(0);
}

const created = [];
for (const p of needed) {
  const exists = gitCapture(["tag", "-l", p.tag]);
  if (exists) {
    console.log(`[changeset] tag 已存在，跳过: ${p.tag}`);
    created.push({ name: p.name, version: p.version, tag: p.tag, existed: true });
    continue;
  }
  git(["tag", "-a", p.tag, "-m", `Release ${p.tag}`]);
  console.log(
    `[changeset] tagged ${p.tag}` + (p.prev ? ` (${p.prev} → ${p.version})` : "")
  );
  created.push({ name: p.name, version: p.version, tag: p.tag, existed: false });
}

fs.writeFileSync(
  statePath,
  JSON.stringify({ tags: created, createdAt: new Date().toISOString() }, null, 2) + "\n"
);
console.log(`[changeset] 写入 ${path.relative(ROOT, statePath)} (${created.length} tags)`);
