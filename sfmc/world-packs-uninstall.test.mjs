/**
 * packs uninstall 策略契约：受保护平台包识别 + 多 id 解析（DRY/LSP 与 CLI 同源）
 * 需先 `npm run build -w @sfmc-bds/cli`
 */
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const { isProtectedSfmcPack, resolveUninstallTargets } = await import(
  pathToFileURL(path.resolve("dist/world-packs.js")).href
);

function fakePack(folderName, uuid = `uuid-${folderName}`) {
  return {
    folderName,
    uuid,
    name: folderName,
    kind: "behavior",
    version: [1, 0, 0],
    enabled: true,
    dir: `/tmp/${folderName}`,
  };
}

describe("packs uninstall protection", () => {
  it("识别 sfmc-modules / sfmc-modules-rp，忽略大小写", () => {
    assert.equal(isProtectedSfmcPack({ folderName: "sfmc-modules" }), true);
    assert.equal(isProtectedSfmcPack({ folderName: "SFMC-Modules" }), true);
    assert.equal(isProtectedSfmcPack({ folderName: "sfmc-modules-rp" }), true);
    assert.equal(isProtectedSfmcPack({ folderName: "[BP] MyAddon" }), false);
  });
});

describe("resolveUninstallTargets LSP", () => {
  const packs = [
    fakePack("sfmc-modules", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
    fakePack("[BP] Addon", "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
    fakePack("[BP] Other", "cccccccc-cccc-cccc-cccc-cccccccccccc"),
  ];

  it("单 id 受保护 → protected", () => {
    const r = resolveUninstallTargets(packs, ["sfmc-modules"]);
    assert.equal(r.status, "protected");
    assert.equal(r.folder, "sfmc-modules");
  });

  it("多 id 含受保护 → 整体 protected（不返回 ok）", () => {
    const r = resolveUninstallTargets(packs, ["[BP] Addon", "sfmc-modules"]);
    assert.equal(r.status, "protected");
    assert.equal(r.folder, "sfmc-modules");
  });

  it("多 id 均可卸 → ok，按 uuid 去重", () => {
    const r = resolveUninstallTargets(packs, [
      "[BP] Addon",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      "[BP] Other",
    ]);
    assert.equal(r.status, "ok");
    assert.equal(r.selected.length, 2);
  });

  it("缺 id → not_found", () => {
    const r = resolveUninstallTargets(packs, ["nope", "[BP] Addon"]);
    assert.equal(r.status, "not_found");
    assert.deepEqual(r.missing, ["nope"]);
  });
});
