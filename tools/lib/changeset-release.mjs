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
/** 发版编排中间态：tag-packages → push-release / gh-release（DRY 唯一路径） */
export const RELEASE_TAGS_STATE = path.join(ROOT, ".sfmc-release-tags.json");

/** @returns {{ mode: string, tag?: string } | null} */
export function readPreState() {
  if (!fs.existsSync(PRE_JSON)) return null;
  return JSON.parse(fs.readFileSync(PRE_JSON, "utf8"));
}

export function isPreMode() {
  const pre = readPreState();
  return Boolean(pre && pre.mode === "pre");
}

/**
 * 待消费的 changeset 文件（不含 README / config / pre）。
 * pre mode 下 `.md` 会留在磁盘直到 `pre exit`；须排除已写入 `pre.json#changesets` 的 id
 *（与 @changesets getRelevantChangesets 一致，LSP）。
 */
export function listPendingChangesetFiles() {
  if (!fs.existsSync(CHANGESET_DIR)) return [];
  const pre = readPreState();
  const consumed = new Set(
    pre && pre.mode === "pre" && Array.isArray(pre.changesets) ? pre.changesets : []
  );
  return fs
    .readdirSync(CHANGESET_DIR)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .filter((f) => !consumed.has(f.replace(/\.md$/i, "")))
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

/** @returns {string | null} 包目录（package.json 所在目录） */
export function packageDirFor(name) {
  const hit = listPublishablePackages().find((p) => p.name === name);
  return hit ? path.dirname(hit.pkgPath) : null;
}

/** changesets 默认 git tag: name@version */
export function packageTagName(name, version) {
  return `${name}@${version}`;
}

/**
 * @typedef {{ name: string, version: string, tag: string, pkgPath?: string, prev?: string, existed?: boolean }} ReleaseTagEntry
 * @typedef {{ tags: ReleaseTagEntry[], createdAt: string }} ReleaseTagsState
 */

/** @returns {ReleaseTagsState | null} */
export function readReleaseTagsState() {
  if (!fs.existsSync(RELEASE_TAGS_STATE)) return null;
  try {
    const state = JSON.parse(fs.readFileSync(RELEASE_TAGS_STATE, "utf8"));
    if (!state || !Array.isArray(state.tags)) return null;
    return state;
  } catch {
    return null;
  }
}

/**
 * LSP：状态文件存在时一律信任（含 `tags: []` = 本轮无目标）；
 * 仅文件缺失 / 无法解析时调用 fallback（禁止把空数组当成「无状态」再扫全仓 tag）。
 * @template T
 * @param {ReleaseTagsState | null} state
 * @param {() => T[]} fallback
 * @returns {T[] | ReleaseTagEntry[]}
 */
export function resolveReleaseTagEntries(state, fallback) {
  if (state) return state.tags;
  return fallback();
}

/** @param {ReleaseTagEntry[]} tags */
export function writeReleaseTagsState(tags) {
  const state = {
    tags,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(RELEASE_TAGS_STATE, JSON.stringify(state, null, 2) + "\n");
  return state;
}

/**
 * 仅收录「当前版本对应 tag 已在本地存在」的可发包。
 * 用于：changeset publish 之后的 CI（publish 已建 tag），或浅克隆无法 diff 时的安全回退。
 * 切勿在「无历史 + 无 tag」时回退为全部打 tag——会误为未发版包建 GH Release。
 * @param {{ name: string, version: string, pkgPath: string }[]} [pkgs]
 * @returns {ReleaseTagEntry[]}
 */
export function listPackagesWithExistingVersionTags(pkgs = listPublishablePackages()) {
  const out = [];
  for (const p of pkgs) {
    const tag = packageTagName(p.name, p.version);
    if (gitCapture(["tag", "-l", tag])) {
      out.push({ name: p.name, version: p.version, pkgPath: p.pkgPath, tag });
    }
  }
  return out;
}

/**
 * 当前版本 tag 已在本地、且 origin 尚无同名 tag 的可发包。
 * push-release 缺失态回退权威实现：候选集与 gh-release 共用
 * listPackagesWithExistingVersionTags（DRY/LSP），再叠加未推送过滤。
 * @param {{ name: string, version: string, pkgPath: string }[]} [pkgs]
 * @returns {ReleaseTagEntry[]}
 */
export function listUnpushedExistingVersionTags(pkgs = listPublishablePackages()) {
  return listPackagesWithExistingVersionTags(pkgs).filter((e) => {
    const remote = gitCapture(["ls-remote", "--tags", "origin", `refs/tags/${e.tag}`]);
    return !remote;
  });
}

/**
 * 相对 HEAD~1 版本有变化的可发包；无法解析父提交时安全回退到 listPackagesWithExistingVersionTags。
 * @param {{ fromExisting?: boolean }} [opts]
 * @returns {ReleaseTagEntry[]}
 */
export function resolvePackagesNeedingTags(opts = {}) {
  const pkgs = listPublishablePackages();
  if (opts.fromExisting) {
    return listPackagesWithExistingVersionTags(pkgs);
  }

  const headParent = gitCapture(["rev-parse", "--verify", "HEAD~1^{commit}"]);
  if (!headParent) {
    console.warn(
      "[changeset] 无法解析 HEAD~1（浅克隆？），回退为仅收录已存在的 name@version tag，避免误打全量 tag"
    );
    return listPackagesWithExistingVersionTags(pkgs);
  }

  /** @type {ReleaseTagEntry[]} */
  const needed = [];
  for (const p of pkgs) {
    const rel = path.relative(ROOT, p.pkgPath).replace(/\\/g, "/");
    let prev = "";
    const raw = gitCapture(["show", `${headParent}:${rel}`]);
    if (raw) {
      try {
        prev = String(JSON.parse(raw).version ?? "");
      } catch {
        prev = "";
      }
    }
    if (prev !== p.version) {
      needed.push({
        name: p.name,
        version: p.version,
        pkgPath: p.pkgPath,
        tag: packageTagName(p.name, p.version),
        prev,
      });
    }
  }
  return needed;
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

/**
 * @param {string[]} args
 * @param {{ capture?: boolean } & import("node:child_process").ExecFileSyncOptions} [opts]
 */
export function git(args, opts = {}) {
  const { capture = false, ...rest } = opts;
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    ...rest,
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
  /* 勿用 m 标志：否则 $ 会在每一行行尾匹配，非贪婪捕获只拿到首行 */
  const re = new RegExp(`## ${escaped}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`);
  const m = text.match(re);
  if (!m) return `Release ${version}`;
  const body = m[1].trim();
  return body || `Release ${version}`;
}
