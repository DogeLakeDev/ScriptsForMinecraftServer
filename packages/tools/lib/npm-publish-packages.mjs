// @ts-check
/**
 * npm-publish 可发包清单 — 唯一权威来源(DRY)。
 * workflow / docs / pack:verify 应对齐本表,勿在 yaml 里再抄一份 case/map。
 */

import fs from "node:fs";
import path from "node:path";

/** npm 包名 → 相对仓库根的 package.json 路径 */
export const NPM_PUBLISH_PACKAGES = {
  "@sfmc-bds/sdk": "modules/sdk/@sfmc-sdk/package.json",
  "@sfmc-bds/eslint-plugin": "modules/sdk/@sfmc-eslint-plugin/package.json",
  "@sfmc-bds/cli": "packages/cli/package.json",
  "@sfmc-bds/db-server": "packages/db-server/package.json",
  "@sfmc-bds/qq-bridge": "packages/qq-bridge/package.json",
  "@sfmc-bds/bds-tools": "packages/bds-tools/package.json",
  "@sfmc-bds/devkit": "packages/devkit/package.json",
  "@sfmc-bds/sfmc": "packages/meta/package.json",
};

/** @returns {keyof typeof NPM_PUBLISH_PACKAGES | null} */
export function resolvePublishPackage(pkg) {
  if (Object.prototype.hasOwnProperty.call(NPM_PUBLISH_PACKAGES, pkg)) {
    return pkg;
  }
  return null;
}

/**
 * 读取可发包 package.json 中落在 NPM_PUBLISH_PACKAGES 的直接依赖名。
 * @param {keyof typeof NPM_PUBLISH_PACKAGES} pkg
 * @param {string} [repoRoot]
 * @returns {(keyof typeof NPM_PUBLISH_PACKAGES)[]}
 */
function listDirectPublishableDeps(pkg, repoRoot = process.cwd()) {
  const pkgPath = path.join(repoRoot, NPM_PUBLISH_PACKAGES[pkg]);
  const pkgJson = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  const deps = { ...(pkgJson.dependencies || {}), ...(pkgJson.peerDependencies || {}) };
  /** @type {(keyof typeof NPM_PUBLISH_PACKAGES)[]} */
  const out = [];
  for (const name of Object.keys(deps)) {
    if (Object.prototype.hasOwnProperty.call(NPM_PUBLISH_PACKAGES, name) && name !== pkg) {
      out.push(/** @type {keyof typeof NPM_PUBLISH_PACKAGES} */ (name));
    }
  }
  return out;
}

/**
 * 可发包全量 build 顺序：按 dependencies ∩ NPM_PUBLISH_PACKAGES 拓扑排序。
 * OCP：扩包只改清单 + 各包 deps，勿在 workflow 手抄优先级。
 * @param {string} [repoRoot]
 * @returns {(keyof typeof NPM_PUBLISH_PACKAGES)[]}
 */
export function listPublishableBuildOrder(repoRoot = process.cwd()) {
  const all = /** @type {(keyof typeof NPM_PUBLISH_PACKAGES)[]} */ (Object.keys(NPM_PUBLISH_PACKAGES));
  /** @type {Map<string, string[]>} */
  const dependents = new Map(all.map((n) => [n, []]));
  /** @type {Map<string, number>} */
  const indeg = new Map(all.map((n) => [n, 0]));

  for (const name of all) {
    for (const d of listDirectPublishableDeps(name, repoRoot)) {
      dependents.get(d).push(name);
      indeg.set(name, /** @type {number} */ (indeg.get(name)) + 1);
    }
  }

  /** @type {(keyof typeof NPM_PUBLISH_PACKAGES)[]} */
  const queue = all.filter((n) => indeg.get(n) === 0);
  /** @type {(keyof typeof NPM_PUBLISH_PACKAGES)[]} */
  const out = [];
  while (queue.length) {
    const n = /** @type {keyof typeof NPM_PUBLISH_PACKAGES} */ (queue.shift());
    out.push(n);
    for (const m of dependents.get(n) || []) {
      const next = /** @type {number} */ (indeg.get(m)) - 1;
      indeg.set(m, next);
      if (next === 0) queue.push(/** @type {keyof typeof NPM_PUBLISH_PACKAGES} */ (m));
    }
  }
  if (out.length !== all.length) {
    const leftover = all.filter((n) => !out.includes(n));
    throw new Error(`Publishable package dependency cycle: ${leftover.join(", ")}`);
  }
  return out;
}

/**
 * 构建目标包前必须先 build 的可发包依赖（拓扑序，不含自身）。
 * 权威：package.json dependencies ∩ NPM_PUBLISH_PACKAGES（DRY/DIP，勿硬编码 sdk）。
 * @param {string} pkg
 * @param {string} [repoRoot]
 * @returns {(keyof typeof NPM_PUBLISH_PACKAGES)[]}
 */
export function listPublishableBuildDeps(pkg, repoRoot = process.cwd()) {
  const resolved = resolvePublishPackage(pkg);
  if (!resolved) {
    throw new Error(`Unknown publish package: ${pkg}`);
  }
  /** @type {Set<string>} */
  const needed = new Set();
  /** @type {string[]} */
  const stack = [resolved];
  /** @type {Set<string>} */
  const seen = new Set();
  while (stack.length) {
    const cur = /** @type {keyof typeof NPM_PUBLISH_PACKAGES} */ (stack.pop());
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const d of listDirectPublishableDeps(cur, repoRoot)) {
      if (d === resolved) continue;
      needed.add(d);
      stack.push(d);
    }
  }
  return listPublishableBuildOrder(repoRoot).filter((n) => needed.has(n));
}

/**
 * 判断相对仓根的目录是否落在 root workspaces 声明内。
 * 支持精确项与末尾 `/*` 一层通配(与 npm workspaces 常见写法一致)。
 * @param {string} dirPosix  正斜杠相对路径,如 "tools" / "modules/packages/afk"
 * @param {string[]} workspaces
 */
export function workspaceIncludesDir(dirPosix, workspaces) {
  const dir = dirPosix.replace(/\\/g, "/").replace(/\/+$/, "");
  for (const raw of workspaces) {
    const w = String(raw).replace(/\\/g, "/").replace(/\/+$/, "");
    if (w === dir) return true;
    if (w.endsWith("/*")) {
      const prefix = w.slice(0, -1); // "modules/packages/"
      if (!dir.startsWith(prefix)) continue;
      const rest = dir.slice(prefix.length);
      if (rest && !rest.includes("/")) return true;
    }
  }
  return false;
}

/**
 * 读取 monorepo workspace 包路径模式（pnpm-workspace.yaml 优先，回退 package.json#workspaces）。
 * @param {string} [repoRoot=process.cwd()]
 * @returns {string[]}
 */
export function readWorkspacePackagePatterns(repoRoot = process.cwd()) {
  const pnpmWsPath = path.join(repoRoot, "pnpm-workspace.yaml");
  if (fs.existsSync(pnpmWsPath)) {
    const text = fs.readFileSync(pnpmWsPath, "utf8");
    /** @type {string[]} */
    const patterns = [];
    let inPackages = false;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (trimmed === "packages:") {
        inPackages = true;
        continue;
      }
      if (!inPackages) continue;
      const item = trimmed.match(/^- ["']?([^"']+)["']?/);
      if (item) {
        patterns.push(item[1]);
        continue;
      }
      if (trimmed && !trimmed.startsWith("#")) {
        inPackages = false;
      }
    }
    if (patterns.length > 0) return patterns;
  }
  const rootPkgPath = path.join(repoRoot, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  return Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
}

/**
 * 发包前断言:清单里的包必须在 root workspace 中,否则
 * `pnpm --filter` / `npm publish -w` 会找不到工作区包。
 * @param {string} pkgName
 * @param {string} [repoRoot=process.cwd()]
 * @returns {{ workspaceDir: string, workspaces: string[], version: string }}
 */
export function assertPublishPackageInWorkspaces(pkgName, repoRoot = process.cwd()) {
  const resolved = resolvePublishPackage(pkgName);
  if (!resolved) {
    throw new Error(`Unknown publish package: ${pkgName}`);
  }
  const pkgPath = NPM_PUBLISH_PACKAGES[resolved];
  const absPkg = path.join(repoRoot, pkgPath);
  // DRY:清单路径须真实存在且 name 与键一致(防路径漂移 / 漏建包)
  if (!fs.existsSync(absPkg)) {
    throw new Error(`${resolved} 清单路径不存在: ${pkgPath}`);
  }
  const pkgJson = JSON.parse(fs.readFileSync(absPkg, "utf8"));
  if (pkgJson.name !== resolved) {
    throw new Error(
      `${resolved} 清单路径 ${pkgPath} 的 name 为 ${JSON.stringify(pkgJson.name)},不一致(DRY)`
    );
  }
  const workspaceDir = path.posix.dirname(pkgPath.replace(/\\/g, "/"));
  const workspaces = readWorkspacePackagePatterns(repoRoot);
  if (!workspaceIncludesDir(workspaceDir, workspaces)) {
    throw new Error(
      `${resolved} 路径 ${workspaceDir} 不在 workspace 中` +
        ` (当前: ${JSON.stringify(workspaces)});` +
        ` 请写入 pnpm-workspace.yaml#packages(DRY)。`
    );
  }
  return { workspaceDir, workspaces, version: pkgJson.version };
}
