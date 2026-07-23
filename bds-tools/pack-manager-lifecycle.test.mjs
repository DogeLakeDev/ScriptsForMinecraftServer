/**
 * pack-manager SOLID 回归:modules-json / clear-rp / has-pack / read-manifest
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, before, after } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "dist", "cli-pack-manager.js");

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}

describe("pack-manager CLI extensions", () => {
  /** @type {string} */
  let tmp;
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-pm-"));
  });
  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("assemble-rp --modules-json 只用显式 map(不扫整树)", async () => {
    const { loadModuleResourcePackMap, assembleResourcePack } = await import("./dist/pack-manager.js");
    const modA = path.join(tmp, "mod-a", "resource_pack");
    const modB = path.join(tmp, "mod-b", "resource_pack");
    fs.mkdirSync(modA, { recursive: true });
    fs.mkdirSync(modB, { recursive: true });
    fs.writeFileSync(path.join(modA, "a.txt"), "a");
    fs.writeFileSync(path.join(modB, "b.txt"), "b");
    const mapFile = path.join(tmp, "map.json");
    /* 仅启用 mod-a */
    fs.writeFileSync(mapFile, JSON.stringify({ "mod-a": modA }));
    const map = loadModuleResourcePackMap(mapFile);
    assert.deepEqual(Object.keys(map), ["mod-a"]);

    const out = path.join(tmp, "rp-out");
    await assembleResourcePack({
      moduleResourceDirs: map,
      outDir: out,
      projectName: "test-rp",
      uuid: "11111111-1111-1111-1111-111111111111",
      version: [1, 0, 0],
    });
    assert.ok(fs.existsSync(path.join(out, "mod-a", "a.txt")));
    assert.ok(!fs.existsSync(path.join(out, "mod-b")));

    const cli = run([
      "assemble-rp",
      "--modules-json",
      mapFile,
      "--out",
      path.join(tmp, "rp-cli"),
      "--name",
      "test-rp-cli",
      "--uuid",
      "22222222-2222-2222-2222-222222222222",
    ]);
    assert.equal(cli.status, 0, cli.err || cli.out);
  });

  it("deploy --clear-rp 删除世界内残留 RP 目录", async () => {
    const { deployToBDS } = await import("./dist/pack-manager.js");
    const bds = path.join(tmp, "bds");
    const level = "Bedrock level";
    const worlds = path.join(bds, "worlds", level);
    const bpSrc = path.join(tmp, "bp-src");
    const rpDst = path.join(worlds, "resource_packs", "sfmc-modules-rp");
    fs.mkdirSync(bpSrc, { recursive: true });
    fs.writeFileSync(path.join(bpSrc, "dummy.txt"), "bp");
    fs.mkdirSync(rpDst, { recursive: true });
    fs.writeFileSync(path.join(rpDst, "stale.txt"), "old");

    await deployToBDS({
      bdsRoot: bds,
      levelName: level,
      behaviorPackSrc: bpSrc,
      bpName: "sfmc-modules",
      rpName: "sfmc-modules-rp",
      clearResourcePack: true,
    });
    assert.ok(!fs.existsSync(rpDst));
    assert.ok(fs.existsSync(path.join(worlds, "behavior_packs", "sfmc-modules", "dummy.txt")));
  });

  it("read-manifest / has-pack CLI 契约", async () => {
    const { assembleBehaviorPack, enablePackInWorld, worldPackListHas } = await import("./dist/pack-manager.js");
    const bpOut = path.join(tmp, "bp-assembled");
    const src = path.join(tmp, "bp-empty-src");
    fs.mkdirSync(path.join(src, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(src, "scripts", "main.js"), "//\n");
    const uuid = "33333333-3333-3333-3333-333333333333";
    await assembleBehaviorPack({
      srcDir: src,
      outDir: bpOut,
      projectName: "sfmc-modules",
      uuid,
      version: [1, 2, 3],
    });

    const rm = run(["read-manifest", "--pack-dir", bpOut]);
    assert.equal(rm.status, 0, rm.err);
    const header = JSON.parse(rm.out.trim());
    assert.equal(header.uuid, uuid);
    assert.deepEqual(header.version, [1, 2, 3]);

    const worldsDir = path.join(tmp, "worlds-root");
    await enablePackInWorld({
      worldsDir,
      levelName: "L1",
      kind: "behavior",
      packUuid: uuid,
      version: [1, 2, 3],
    });
    assert.equal(worldPackListHas(worldsDir, "L1", "behavior", uuid), true);
    assert.equal(worldPackListHas(worldsDir, "L1", "behavior", "00000000-0000-0000-0000-000000000000"), false);

    const hp = run([
      "has-pack",
      "--worlds-dir",
      worldsDir,
      "--level",
      "L1",
      "--kind",
      "behavior",
      "--pack-id",
      uuid,
    ]);
    assert.equal(hp.status, 0);
    assert.equal(hp.out.trim(), "1");
  });
});
