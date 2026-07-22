#!/usr/bin/env node
/**
 * 解析 npm-publish tag,写出 GitHub Actions outputs。
 * Tag 形如: @sfmc-bds/sdk@v0.1.0
 *
 * 用法(workflow):
 *   node tools/resolve-npm-publish-tag.mjs
 *   依赖 env: GITHUB_REF_NAME, GITHUB_OUTPUT
 */
import fs from "node:fs";
import { NPM_PUBLISH_PACKAGES, resolvePublishPackage } from "./lib/npm-publish-packages.mjs";

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

const pkgPath = NPM_PUBLISH_PACKAGES[resolved];
const actual = JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
if (actual !== ver) {
  console.error(`Tag version ${ver} != package.json version ${actual} (${pkgPath})`);
  process.exit(1);
}

const lines = [
  `tag=${tag}`,
  `pkg=${resolved}`,
  `workspace=${resolved}`,
  `ver=${ver}`,
  `pkg_path=${pkgPath}`,
];

if (outFile) {
  fs.appendFileSync(outFile, lines.join("\n") + "\n");
}

console.log(`Version OK: ${resolved}@${ver} (${pkgPath})`);
