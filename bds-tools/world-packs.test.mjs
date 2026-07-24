/**
 * world-packs 原语单测：format / bump / discover / list-installed
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, "dist", "cli-pack-manager.js");

function run(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { status: r.status, out: r.stdout ?? "", err: r.stderr ?? "" };
}

function writeManifest(dir, { name, uuid, version, type }) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(
      {
        format_version: 2,
        header: { name, uuid, version, description: "test" },
        modules: [{ type, uuid: cryptoRandom(), version }],
      },
      null,
      2
    )
  );
}

function cryptoRandom() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

describe("world-packs primitives", () => {
  /** @type {string} */
  let tmp;
  before(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-wp-"));
  });
  after(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("formatWorldPackFolderName 去格式码/后缀并加前缀", async () => {
    const { formatWorldPackFolderName } = await import("./dist/world-packs.js");
    assert.equal(formatWorldPackFolderName("§aCool§l Textures.mcpack", "resource"), "[RP] Cool Textures");
    assert.equal(formatWorldPackFolderName("My BP.zip", "behavior"), "[BP] My BP");
    assert.equal(formatWorldPackFolderName("[RP] Already", "resource"), "[RP] Already");
  });

  it("discoverPackRoots maxDepth=2", async () => {
    const { discoverPackRoots } = await import("./dist/world-packs.js");
    const root = path.join(tmp, "discover");
    const nested = path.join(root, "outer", "inner-pack");
    writeManifest(nested, {
      name: "Inner",
      uuid: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      version: [1, 0, 0],
      type: "resources",
    });
    const found = discoverPackRoots(root, { maxDepth: 2 });
    assert.ok(found.some((p) => path.resolve(p) === path.resolve(nested)));
  });

  it("bumpPackPatchVersion 同步 header 与 modules", async () => {
    const { bumpPackPatchVersion, readPackManifestInfo } = await import("./dist/world-packs.js");
    const dir = path.join(tmp, "bump-rp");
    writeManifest(dir, {
      name: "BumpMe",
      uuid: "11111111-2222-3333-4444-555555555555",
      version: [1, 2, 3],
      type: "resources",
    });
    const next = bumpPackPatchVersion(dir);
    assert.deepEqual(next, [1, 2, 4]);
    const info = readPackManifestInfo(dir);
    assert.deepEqual(info?.version, [1, 2, 4]);
    const raw = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8"));
    assert.deepEqual(raw.modules[0].version, [1, 2, 4]);
  });

  it("list-installed CLI + listInstalledWorldPacks", async () => {
    const { listInstalledWorldPacks } = await import("./dist/world-packs.js");
    const bds = path.join(tmp, "bds");
    const level = "Bedrock level";
    const rpDir = path.join(bds, "worlds", level, "resource_packs", "[RP] Tex");
    writeManifest(rpDir, {
      name: "Tex",
      uuid: "99999999-8888-7777-6666-555555555555",
      version: [0, 1, 0],
      type: "resources",
    });
    fs.mkdirSync(path.join(bds, "worlds", level), { recursive: true });
    fs.writeFileSync(
      path.join(bds, "worlds", level, "world_resource_packs.json"),
      JSON.stringify([{ pack_id: "99999999-8888-7777-6666-555555555555", version: [0, 1, 0] }])
    );

    const list = listInstalledWorldPacks(bds, level);
    assert.equal(list.length, 1);
    assert.equal(list[0].enabled, true);
    assert.equal(list[0].kind, "resource");

    const cli = run(["list-installed", "--bds-root", bds, "--level", level]);
    assert.equal(cli.status, 0, cli.err || cli.out);
    const parsed = JSON.parse(cli.out.trim());
    assert.equal(parsed.length, 1);
  });

  it("bump-version CLI", async () => {
    const dir = path.join(tmp, "cli-bump");
    writeManifest(dir, {
      name: "CliBump",
      uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: [2, 0, 0],
      type: "resources",
    });
    const cli = run(["bump-version", "--pack-dir", dir]);
    assert.equal(cli.status, 0, cli.err || cli.out);
    const { version } = JSON.parse(cli.out.trim());
    assert.deepEqual(version, [2, 0, 1]);
  });

  it("installPackDirectory 同 folderName 即使旧包 kind 不可识别也要 conflict", async () => {
    const { installPackDirectory, formatWorldPackFolderName } = await import("./dist/world-packs.js");
    const dest = path.join(tmp, "conflict-parent");
    const folderName = formatWorldPackFolderName("Broken", "resource");
    const existingDir = path.join(dest, folderName);
    fs.mkdirSync(existingDir, { recursive: true });
    // 无法 detectPackKind 的残缺 manifest（仅 header，无 modules）
    fs.writeFileSync(
      path.join(existingDir, "manifest.json"),
      JSON.stringify({
        format_version: 2,
        header: {
          name: "Broken",
          uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          version: [1, 0, 0],
        },
        modules: [],
      })
    );
    const src = path.join(tmp, "incoming-rp");
    writeManifest(src, {
      name: "Incoming",
      uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      version: [1, 0, 0],
      type: "resources",
    });
    const r = await installPackDirectory({
      srcDir: src,
      destParent: dest,
      folderName: "Broken",
      force: false,
    });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "conflict");
    assert.ok(r.conflict);
    // 未 force 时不得覆盖
    const still = JSON.parse(fs.readFileSync(path.join(existingDir, "manifest.json"), "utf8"));
    assert.equal(still.header.uuid, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  });

  it("uninstallInstalledPack：回收站 / purge / 目录缺失", async () => {
    const { uninstallInstalledPack, listInstalledWorldPacks } = await import("./dist/world-packs.js");
    const bds = path.join(tmp, "uninstall-bds");
    const level = "Bedrock level";
    const folder = "[BP] Gone";
    const uuid = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const packDir = path.join(bds, "worlds", level, "behavior_packs", folder);
    writeManifest(packDir, {
      name: "Gone",
      uuid,
      version: [1, 0, 0],
      type: "data",
    });
    fs.mkdirSync(path.join(bds, "worlds", level), { recursive: true });
    fs.writeFileSync(
      path.join(bds, "worlds", level, "world_behavior_packs.json"),
      JSON.stringify([{ pack_id: uuid, version: [1, 0, 0] }])
    );

    const packs = listInstalledWorldPacks(bds, level);
    assert.equal(packs.length, 1);
    const trash = path.join(tmp, "trash-bin");
    const trashed = await uninstallInstalledPack({
      bdsRoot: bds,
      levelName: level,
      pack: packs[0],
      trashDir: trash,
    });
    assert.equal(trashed.action, "trashed");
    assert.ok(trashed.dest && fs.existsSync(trashed.dest));
    assert.equal(fs.existsSync(packDir), false);
    const enable = JSON.parse(
      fs.readFileSync(path.join(bds, "worlds", level, "world_behavior_packs.json"), "utf8")
    );
    assert.equal(enable.length, 0);

    /* 目录已不在 list 中；构造 missing 场景 */
    const phantom = {
      ...packs[0],
      dir: path.join(bds, "worlds", level, "behavior_packs", "no-such"),
      enabled: false,
    };
    const missing = await uninstallInstalledPack({
      bdsRoot: bds,
      levelName: level,
      pack: phantom,
      trashDir: trash,
    });
    assert.equal(missing.action, "missing");

    /* purge：再装一个直接删 */
    const folder2 = "[BP] PurgeMe";
    const uuid2 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const packDir2 = path.join(bds, "worlds", level, "behavior_packs", folder2);
    writeManifest(packDir2, {
      name: "PurgeMe",
      uuid: uuid2,
      version: [1, 0, 0],
      type: "data",
    });
    fs.writeFileSync(
      path.join(bds, "worlds", level, "world_behavior_packs.json"),
      JSON.stringify([{ pack_id: uuid2, version: [1, 0, 0] }])
    );
    const packs2 = listInstalledWorldPacks(bds, level);
    const purged = await uninstallInstalledPack({
      bdsRoot: bds,
      levelName: level,
      pack: packs2.find((p) => p.uuid === uuid2),
      trashDir: null,
    });
    assert.equal(purged.action, "deleted");
    assert.equal(fs.existsSync(packDir2), false);
  });
});
