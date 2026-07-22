/**
 * npm-publish 可发包清单 — 唯一权威来源(DRY)。
 * workflow / docs / pack:verify 应对齐本表,勿在 yaml 里再抄一份 case/map。
 */

/** npm 包名 → 相对仓库根的 package.json 路径 */
export const NPM_PUBLISH_PACKAGES = {
  "@sfmc-bds/sdk": "modules/sdk/@sfmc-sdk/package.json",
  "@sfmc-bds/cli": "sfmc/package.json",
  "@sfmc-bds/db-server": "db-server/package.json",
  "@sfmc-bds/qq-bridge": "qq-bridge/package.json",
  "@sfmc-bds/bds-tools": "bds-tools/package.json",
};

/** @returns {keyof typeof NPM_PUBLISH_PACKAGES | null} */
export function resolvePublishPackage(pkg) {
  if (Object.prototype.hasOwnProperty.call(NPM_PUBLISH_PACKAGES, pkg)) {
    return pkg;
  }
  return null;
}
