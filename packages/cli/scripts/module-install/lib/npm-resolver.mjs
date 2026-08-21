// @ts-check
/**
 * npm 包名解析（单一权威）
 *
 * 规则（DRY，避免重复解析逻辑）：
 *   - 已含 scope（@scope/name）→ 原样
 *   - 已含 logical id（feature-land / core-data-backup）→ @sfmc-bds/module-<folder>
 *   - 短 id（land / my-mod）→ @sfmc-bds/module-<folder>
 *
 * @param {string} idOrName  用户传入的模块 id 或包名
 * @param {string} [scope]   显式 scope，默认 @sfmc-bds
 * @returns {string} npm 包名
 */
export const DEFAULT_NPM_SCOPE = "@sfmc-bds";

export function resolveNpmPackageName(idOrName, scope = DEFAULT_NPM_SCOPE) {
  const raw = String(idOrName ?? "").trim();
  if (!raw) throw new Error("empty module id");
  /* 已含 scope（@scope/name）→ 原样 */
  if (raw.startsWith("@")) {
    const m = raw.match(/^@([^/]+)\/(.+)$/);
    if (!m) throw new Error(`invalid scoped package name: ${raw}`);
    return raw;
  }
  /* feature-* / core-* → folder */
  const folder = raw.replace(/^(feature|core)-/, "");
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(folder)) {
    throw new Error(`invalid module id: ${raw}`);
  }
  return `${scope}/module-${folder}`;
}

/**
 * 反向：从 npm 包名解出 folder（packages/<folder> 用）。
 * 接受：
 *   @sfmc-bds/module-land         → land
 *   @<scope>/sfmc-module-land     → land
 *   @<scope>/sfmc-module-my-mod   → my-mod
 */
export function folderFromNpmPackageName(pkgName) {
  const raw = String(pkgName ?? "").trim();
  const m = raw.match(/^@[^/]+\/(?:module-|sfmc-module-)(.+)$/);
  return m ? m[1] : null;
}

/**
 * 规范化 npm 包名（去掉前缀、保证 kebab）—— 给 tarball 内部读到的 name 用。
 */
export function normalizeNpmPackageName(pkgName) {
  const raw = String(pkgName ?? "").trim();
  if (!raw) throw new Error("empty npm package name");
  /* @scope/module-foo → foo；@scope/sfmc-module-foo → foo；module-foo → foo */
  const m = raw.match(/^(?:@[^/]+\/)?(?:sfmc-)?module-(.+)$/);
  return m ? m[1] : raw;
}