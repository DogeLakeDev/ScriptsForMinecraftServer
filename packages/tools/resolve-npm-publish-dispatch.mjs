#!/usr/bin/env node
// @ts-check
/**
 * workflow_dispatch 应急发布：校验包名/版本，写出 GITHUB_OUTPUT。
 * env: PUBLISH_PACKAGE, PUBLISH_VERSION, PUBLISH_DIST_TAG, GITHUB_OUTPUT
 */
import fs from "node:fs";
import {
  NPM_PUBLISH_PACKAGES,
  resolvePublishPackage,
  assertPublishPackageInWorkspaces,
} from "./lib/npm-publish-packages.mjs";

const pkg = process.env.PUBLISH_PACKAGE || "";
const ver = process.env.PUBLISH_VERSION || "";
const distTag = process.env.PUBLISH_DIST_TAG || "beta";
const outFile = process.env.GITHUB_OUTPUT;

if (!pkg || !ver) {
  console.error("PUBLISH_PACKAGE / PUBLISH_VERSION required");
  process.exit(1);
}

const resolved = resolvePublishPackage(pkg);
if (!resolved) {
  console.error(`Unknown npm package: ${pkg}`);
  console.error(`Known: ${Object.keys(NPM_PUBLISH_PACKAGES).join(", ")}`);
  process.exit(1);
}

try {
  assertPublishPackageInWorkspaces(resolved);
} catch (e) {
  // @ts-ignore
  console.error(e?.message || e);
  process.exit(1);
}

const pkgPath = NPM_PUBLISH_PACKAGES[resolved];
const actual = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
if (actual !== ver) {
  console.error(`Input version ${ver} != package.json version ${actual} (${pkgPath})`);
  process.exit(1);
}

/**
 * @param {string | number | boolean} name
 * @param {string | number | boolean} version
 */
async function isAlreadyPublished(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${encodeURIComponent(version)}`;
  try {
    const res = await fetch(url);
    return res.status === 200;
  } catch (e) {
    // @ts-ignore
    console.warn(`[resolve-npm-publish-dispatch] registry probe failed: ${e?.message || e}`);
    return false;
  }
}

const already = await isAlreadyPublished(resolved, ver);
console.log(
  already
    ? `Already published on npm: ${resolved}@${ver}`
    : `Version OK: ${resolved}@${ver} tag=${distTag}`
);

const lines = [
  `pkg=${resolved}`,
  `workspace=${resolved}`,
  `ver=${ver}`,
  `pkg_path=${pkgPath}`,
  `dist_tag=${distTag}`,
  `already_published=${already ? "true" : "false"}`,
];

if (outFile) {
  fs.appendFileSync(outFile, lines.join("\n") + "\n");
}
