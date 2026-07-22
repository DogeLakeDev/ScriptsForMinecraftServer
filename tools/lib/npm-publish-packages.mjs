/**
 * npm-publish 可发包清单 — 唯一权威来源(DRY)。
 * workflow / docs / pack:verify 应对齐本表,勿在 yaml 里再抄一份 case/map。
 */

import fs from "node:fs";
import path from "node:path";

/** npm 包名 → 相对仓库根的 package.json 路径 */
export const NPM_PUBLISH_PACKAGES = {
  "@sfmc-bds/sdk": "modules/sdk/@sfmc-sdk/package.json",
  "@sfmc-bds/cli": "sfmc/package.json",
  "@sfmc-bds/db-server": "db-server/package.json",
  "@sfmc-bds/qq-bridge": "qq-bridge/package.json",
  "@sfmc-bds/bds-tools": "bds-tools/package.json",
  "@sfmc-bds/tools": "tools/package.json",
  "@sfmc-bds/sfmc": "sfmc-meta/package.json",
};

/** @returns {keyof typeof NPM_PUBLISH_PACKAGES | null} */
export function resolvePublishPackage(pkg) {
  if (Object.prototype.hasOwnProperty.call(NPM_PUBLISH_PACKAGES, pkg)) {
    return pkg;
  }
  return null;
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
 * 发包前断言:清单里的包必须在 root workspaces 中,否则
 * `npm run build -w` / `npm publish -w` 会报 No workspaces found
 * (见 @sfmc-bds/tools@v0.1.0 on ba65eb9)。
 * @param {string} pkgName
 * @param {string} [repoRoot=process.cwd()]
 * @returns {{ workspaceDir: string, workspaces: string[] }}
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
  const rootPkgPath = path.join(repoRoot, "package.json");
  const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
  const workspaces = Array.isArray(rootPkg.workspaces) ? rootPkg.workspaces : [];
  if (!workspaceIncludesDir(workspaceDir, workspaces)) {
    throw new Error(
      `${resolved} 路径 ${workspaceDir} 不在 root workspaces 中` +
        ` (当前: ${JSON.stringify(workspaces)});` +
        ` npm -w 会失败。请把该目录写入 package.json#workspaces(DRY)。`
    );
  }
  return { workspaceDir, workspaces, version: pkgJson.version };
}
