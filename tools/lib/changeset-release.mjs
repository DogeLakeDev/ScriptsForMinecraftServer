/**
 * changesets 发版编排共用工具。
 * tag 格式与 `changeset publish` 一致: `@scope/name@1.2.3`（无 v 前缀）。
 */
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NPM_PUBLISH_PACKAGES } from "./npm-publish-packages.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PRE_JSON = path.join(ROOT, ".changeset", "pre.json");
export const CHANGESET_DIR = path.join(ROOT, ".changeset");

/** @returns {{ mode: string, tag?: string } | null} */
export function readPreState() {
  if (!fs.existsSync(PRE_JSON)) return null;
  return JSON.parse(fs.readFileSync(PRE_JSON, "utf8"));
}

export function isPreMode() {
  const pre = readPreState();
  return Boolean(pre && pre.mode === "pre");
}

/** 待消费的 changeset 文件（不含 README / config / pre） */
export function listPendingChangesetFiles() {
  if (!fs.existsSync(CHANGESET_DIR)) return [];
  return fs
    .readdirSync(CHANGESET_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => path.join(CHANGESET_DIR, f));
}

/** @returns {{ name: string, version: string, pkgPath: string }[]} */
export function listPublishablePackages() {
  const out = [];
  for (const [name, rel] of Object.entries(NPM_PUBLISH_PACKAGES)) {
    const pkgPath = path.join(ROOT, rel);
    if (!fs.existsSync(pkgPath)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    if (pkg.private) continue;
    out.push({ name, version: String(pkg.version), pkgPath });
  }
  return out;
}

/** changesets 默认 git tag: name@version */
export function packageTagName(name, version) {
  return `${name}@${version}`;
}

export function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...opts,
  });
  if (r.status !== 0) {
    process.exit(r.status === null ? 1 : r.status);
  }
}

export function git(args, opts = {}) {
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: opts.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...opts,
  });
}

export function gitCapture(args) {
  try {
    return git(args, { capture: true }).trim();
  } catch {
    return "";
  }
}

/** 读 CHANGELOG.md 里指定版本的条目（尽力而为） */
export function extractChangelogNotes(pkgDir, version) {
  const changelog = path.join(pkgDir, "CHANGELOG.md");
  if (!fs.existsSync(changelog)) return `Release ${version}`;
  const text = fs.readFileSync(changelog, "utf8");
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    "m"
  );
  const m = text.match(re);
  if (!m) return `Release ${version}`;
  const body = m[1].trim();
  return body || `Release ${version}`;
}
