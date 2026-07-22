#!/usr/bin/env node
/**
 * 解析 npm-publish tag,写出 GitHub Actions outputs。
 * Tag 形如: @sfmc-bds/sdk@v0.1.0
 *
 * 用法(workflow):
 *   node tools/resolve-npm-publish-tag.mjs
 *   依赖 env: PUBLISH_TAG 或 GITHUB_REF_NAME,GITHUB_OUTPUT
 *
 * 另:探测 registry 是否已有同版本,写 already_published=true,
 * 避免 workflow_dispatch 重跑对已发布版本 E403(与 publish 步骤幂等)。
 */
import fs from "node:fs";
import {
  NPM_PUBLISH_PACKAGES,
  resolvePublishPackage,
  assertPublishPackageInWorkspaces,
} from "./lib/npm-publish-packages.mjs";

const tag = process.env.PUBLISH_TAG || process.env.GITHUB_REF_NAME || "";
const outFile = process.env.GITHUB_OUTPUT;

if (!tag) {
  console.error("PUBLISH_TAG / GITHUB_REF_NAME is empty");
  process.exit(1);
}

const atV = tag.lastIndexOf("@v");
if (atV <= 0) {
  console.error(`Invalid npm publish tag (expect @scope/name@vX.Y.Z): ${tag}`);
  process.exit(1);
}

const pkg = tag.slice(0, atV);
const ver = tag.slice(atV + 2); // after "@v"
const resolved = resolvePublishPackage(pkg);
if (!resolved) {
  console.error(`Unknown npm package tag: ${pkg}`);
  console.error(`Known: ${Object.keys(NPM_PUBLISH_PACKAGES).join(", ")}`);
  process.exit(1);
}

// DRY:清单登记的包必须在 root workspaces,否则后续 npm -w 必挂
try {
  assertPublishPackageInWorkspaces(resolved);
} catch (e) {
  console.error(e?.message || e);
  process.exit(1);
}

const pkgPath = NPM_PUBLISH_PACKAGES[resolved];
const actual = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
if (actual !== ver) {
  console.error(`Tag version ${ver} != package.json version ${actual} (${pkgPath})`);
  console.error(
    `修复:先把 ${pkgPath}  bump 到 ${ver} 并合入默认分支,再 workflow_dispatch 本 tag` +
      `(checkout 默认分支),或删除后重打指向含新版本 commit 的 tag。`
  );
  process.exit(1);
}

/** @returns {Promise<boolean>} */
async function isAlreadyPublished(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch (e) {
    console.warn(`[resolve-npm-publish-tag] registry probe failed: ${e?.message || e}`);
    return false;
  }
}

const already = await isAlreadyPublished(resolved, ver);
if (already) {
  console.log(`Already published on npm: ${resolved}@${ver}`);
} else {
  console.log(`Version OK: ${resolved}@${ver} (${pkgPath})`);
}

const lines = [
  `tag=${tag}`,
  `pkg=${resolved}`,
  `workspace=${resolved}`,
  `ver=${ver}`,
  `pkg_path=${pkgPath}`,
  `already_published=${already ? "true" : "false"}`,
];

if (outFile) {
  fs.appendFileSync(outFile, lines.join("\n") + "\n");
}
