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

  it("read-manifest / has-pack / list-packs CLI 契约", async () => {
    const { assembleBehaviorPack, enablePackInWorld, worldPackListHas, readWorldPackList } =
      await import("./dist/pack-manager.js");
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

    const lp = run(["list-packs", "--worlds-dir", worldsDir, "--level", "L1", "--kind", "behavior"]);
    assert.equal(lp.status, 0, lp.err);
    const listed = JSON.parse(lp.out.trim());
    assert.equal(listed.length, 1);
    assert.equal(listed[0].pack_id, uuid);
    assert.deepEqual(readWorldPackList(worldsDir, "L1", "behavior"), listed);
  });

  it("readLevelNameSync 与 async 同契约（供 sfmc resolveBdsContext）", async () => {
    const { readLevelName, readLevelNameSync } = await import("./dist/pack-manager.js");
    const bds = path.join(tmp, "bds-level");
    fs.mkdirSync(bds, { recursive: true });
    assert.equal(readLevelNameSync(bds), "Bedrock level");
    assert.equal(await readLevelName(bds), "Bedrock level");
    fs.writeFileSync(path.join(bds, "server.properties"), "level-name=My World\n", "utf8");
    assert.equal(readLevelNameSync(bds), "My World");
    assert.equal(await readLevelName(bds), "My World");
  });

  it("BDS 路径 helpers 单一权威（Demeter/DRY）", async () => {
    const {
      bdsWorldsDir,
      bdsWorldLevelDir,
      worldPackListFile,
      configPermissionPath,
      hasConfigPermission,
      serverPropertiesPath,
      ensureConfigPermission,
    } = await import("./dist/pack-manager.js");
    const bds = path.join(tmp, "bds-paths");
    fs.mkdirSync(bds, { recursive: true });
    assert.equal(bdsWorldsDir(bds), path.join(bds, "worlds"));
    assert.equal(bdsWorldLevelDir(bds, "L1"), path.join(bds, "worlds", "L1"));
    assert.equal(
      worldPackListFile(bdsWorldsDir(bds), "L1", "behavior"),
      path.join(bds, "worlds", "L1", "world_behavior_packs.json")
    );
    assert.equal(
      worldPackListFile(bdsWorldsDir(bds), "L1", "resource"),
      path.join(bds, "worlds", "L1", "world_resource_packs.json")
    );
    assert.equal(serverPropertiesPath(bds), path.join(bds, "server.properties"));
    const uuid = "00000000-0000-4000-8000-000000000099";
    assert.equal(configPermissionPath(bds, uuid), path.join(bds, "config", uuid, "permission.json"));
    assert.equal(hasConfigPermission(bds, uuid), false);
    assert.equal(await ensureConfigPermission(bds, uuid), true);
    assert.equal(hasConfigPermission(bds, uuid), true);
    assert.equal(await ensureConfigPermission(bds, uuid), false);
  });

  it("readWorldPackListResult 区分缺失与 JSON 损坏（doctor parseFail）", async () => {
    const { readWorldPackListResult } = await import("./dist/pack-manager.js");
    const worldsDir = path.join(tmp, "worlds-parse");
    const levelDir = path.join(worldsDir, "Lbad");
    fs.mkdirSync(levelDir, { recursive: true });

    const missing = readWorldPackListResult(worldsDir, "Lbad", "behavior");
    assert.deepEqual(missing.entries, []);
    assert.equal(missing.parseFailedFile, undefined);

    const badFile = path.join(levelDir, "world_behavior_packs.json");
    fs.writeFileSync(badFile, "{not-json", "utf8");
    const bad = readWorldPackListResult(worldsDir, "Lbad", "behavior");
    assert.deepEqual(bad.entries, []);
    assert.equal(bad.parseFailedFile, badFile);

    fs.writeFileSync(badFile, '{"not":"array"}', "utf8");
    const notArr = readWorldPackListResult(worldsDir, "Lbad", "behavior");
    assert.deepEqual(notArr.entries, []);
    assert.equal(notArr.parseFailedFile, badFile);
  });

  it("无 deploy-catalog 时仍可凭磁盘 RP manifest 卸世界清单(BLOCKER 回归)", async () => {
    const {
      assembleResourcePack,
      deployToBDS,
      enablePackInWorld,
      disablePackInWorld,
      readPackManifestHeader,
      worldPackListHas,
    } = await import("./dist/pack-manager.js");

    const bds = path.join(tmp, "bds-stale");
    const level = "Bedrock level";
    const worlds = path.join(bds, "worlds", level);
    const worldsDir = path.join(bds, "worlds");
    const bpSrc = path.join(tmp, "bp-stale-src");
    const rpMod = path.join(tmp, "mod-stale", "resource_pack");
    fs.mkdirSync(path.join(bpSrc, "scripts"), { recursive: true });
    fs.writeFileSync(path.join(bpSrc, "scripts", "main.js"), "//\n");
    fs.mkdirSync(rpMod, { recursive: true });
    fs.writeFileSync(path.join(rpMod, "x.txt"), "x");

    const staleUuid = "44444444-4444-4444-4444-444444444444";
    const rpAssembled = path.join(tmp, "rp-stale-assembled");
    await assembleResourcePack({
      moduleResourceDirs: { stale: rpMod },
      outDir: rpAssembled,
      projectName: "sfmc-modules-rp",
      uuid: staleUuid,
      version: [1, 0, 0],
    });

    await deployToBDS({
      bdsRoot: bds,
      levelName: level,
      behaviorPackSrc: bpSrc,
      resourcePackSrc: rpAssembled,
      bpName: "sfmc-modules",
      rpName: "sfmc-modules-rp",
    });
    await enablePackInWorld({
      worldsDir,
      levelName: level,
      kind: "resource",
      packUuid: staleUuid,
      version: [1, 0, 0],
    });
    assert.equal(worldPackListHas(worldsDir, level, "resource", staleUuid), true);

    /* 模拟 catalog 缺失:只留磁盘 RP,lifecycle 应在 clear 前读 manifest */
    const rpDst = path.join(worlds, "resource_packs", "sfmc-modules-rp");
    const header = readPackManifestHeader(rpDst);
    assert.equal(header?.uuid, staleUuid);
    assert.ok(header);

    await deployToBDS({
      bdsRoot: bds,
      levelName: level,
      behaviorPackSrc: bpSrc,
      bpName: "sfmc-modules",
      rpName: "sfmc-modules-rp",
      clearResourcePack: true,
    });
    assert.ok(!fs.existsSync(rpDst));

    await disablePackInWorld({
      worldsDir,
      levelName: level,
      kind: "resource",
      packUuid: header.uuid,
      version: [1, 0, 0],
    });
    assert.equal(worldPackListHas(worldsDir, level, "resource", staleUuid), false);
  });
});
