/**
 * packs uninstall 策略契约：受保护平台包识别（DRY 与 CLI 同源）
 * 需先 `npm run build -w @sfmc-bds/cli`
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const { isProtectedSfmcPack } = await import(
  pathToFileURL(path.resolve("dist/world-packs.js")).href
);

describe("packs uninstall protection", () => {
  it("识别 sfmc-modules / sfmc-modules-rp，忽略大小写", () => {
    assert.equal(isProtectedSfmcPack({ folderName: "sfmc-modules" }), true);
    assert.equal(isProtectedSfmcPack({ folderName: "SFMC-Modules" }), true);
    assert.equal(isProtectedSfmcPack({ folderName: "sfmc-modules-rp" }), true);
    assert.equal(isProtectedSfmcPack({ folderName: "[BP] MyAddon" }), false);
  });
});
