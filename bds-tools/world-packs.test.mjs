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
    const { formatWorldPackFolderName, isGenericPackFolderStem } = await import("./dist/world-packs.js");
    assert.equal(formatWorldPackFolderName("§aCool§l Textures.mcpack", "resource"), "[RP] Cool Textures");
    assert.equal(formatWorldPackFolderName("My BP.zip", "behavior"), "[BP] My BP");
    assert.equal(formatWorldPackFolderName("[RP] Already", "resource"), "[RP] Already");
    assert.equal(isGenericPackFolderStem("B"), true);
    assert.equal(isGenericPackFolderStem("[RP] R"), true);
    assert.equal(isGenericPackFolderStem("Slash Blade"), false);
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

  it("resolvePackRoots：扁平目录 / 子目录 BP+RP", async () => {
    const { resolvePackRoots, readPackManifestInfo } = await import("./dist/world-packs.js");
    const flat = path.join(tmp, "flat-pack");
    writeManifest(flat, {
      name: "FlatBP",
      uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      version: [1, 0, 0],
      type: "data",
    });
    const flatRes = await resolvePackRoots(flat);
    try {
      assert.equal(flatRes.roots.length, 1);
      assert.equal(readPackManifestInfo(flatRes.roots[0])?.name, "FlatBP");
    } finally {
      flatRes.dispose();
    }

    const nest = path.join(tmp, "nest-dir");
    writeManifest(path.join(nest, "BP"), {
      name: "NestBP",
      uuid: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      version: [1, 0, 0],
      type: "data",
    });
    writeManifest(path.join(nest, "RP"), {
      name: "NestRP",
      uuid: "dddddddd-dddd-dddd-dddd-dddddddddddd",
      version: [1, 0, 0],
      type: "resources",
    });
    const nestRes = await resolvePackRoots(nest);
    try {
      assert.equal(nestRes.roots.length, 2);
      const kinds = nestRes.roots.map((r) => readPackManifestInfo(r)?.kind).sort();
      assert.deepEqual(kinds, ["behavior", "resource"]);
    } finally {
      nestRes.dispose();
    }
  });

  it("resolvePackRoots：mcaddon 内嵌 mcpack + zip 套娃", async () => {
    const JSZip = (await import("jszip")).default;
    const { resolvePackRoots, readPackManifestInfo } = await import("./dist/world-packs.js");

    async function zipDirAsArchive(entries, outFile) {
      const zip = new JSZip();
      for (const [name, content] of entries) {
        zip.file(name, content);
      }
      const buf = await zip.generateAsync({ type: "nodebuffer" });
      fs.mkdirSync(path.dirname(outFile), { recursive: true });
      fs.writeFileSync(outFile, buf);
    }

    function manifestJson({ name, uuid, version, type }) {
      return JSON.stringify({
        format_version: 2,
        header: { name, uuid, version, description: "test" },
        modules: [{ type, uuid: cryptoRandom(), version }],
      });
    }

    /* 内层 RP 作为 .mcpack */
    const rpMcpack = path.join(tmp, "nested-build", "inner-rp.mcpack");
    await zipDirAsArchive(
      [
        [
          "manifest.json",
          manifestJson({
            name: "InnerRP",
            uuid: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
            version: [1, 0, 0],
            type: "resources",
          }),
        ],
      ],
      rpMcpack
    );

    /* 外层 .mcaddon：文件夹 BP + 嵌套 .mcpack */
    const bpManifest = manifestJson({
      name: "OuterBP",
      uuid: "ffffffff-ffff-ffff-ffff-ffffffffffff",
      version: [1, 0, 0],
      type: "data",
    });
    const addon = path.join(tmp, "nested-build", "bundle.mcaddon");
    const zip = new JSZip();
    zip.file("BP/manifest.json", bpManifest);
    zip.file("inner-rp.mcpack", fs.readFileSync(rpMcpack));
    fs.writeFileSync(addon, await zip.generateAsync({ type: "nodebuffer" }));

    const addonRes = await resolvePackRoots(addon);
    try {
      assert.equal(addonRes.roots.length, 2, `roots=${JSON.stringify(addonRes.roots)}`);
      const names = addonRes.roots.map((r) => readPackManifestInfo(r)?.name).sort();
      assert.deepEqual(names, ["InnerRP", "OuterBP"]);
    } finally {
      addonRes.dispose();
    }

    /* zip → mcpack → pack（双层套娃） */
    const leafMcpack = path.join(tmp, "nested-build", "leaf.mcpack");
    await zipDirAsArchive(
      [
        [
          "manifest.json",
          manifestJson({
            name: "LeafPack",
            uuid: "12121212-1212-1212-1212-121212121212",
            version: [2, 0, 0],
            type: "data",
          }),
        ],
      ],
      leafMcpack
    );
    const outerZip = path.join(tmp, "nested-build", "outer.zip");
    const z2 = new JSZip();
    z2.file("leaf.mcpack", fs.readFileSync(leafMcpack));
    fs.writeFileSync(outerZip, await z2.generateAsync({ type: "nodebuffer" }));

    const zipRes = await resolvePackRoots(outerZip);
    try {
      assert.equal(zipRes.roots.length, 1);
      assert.equal(readPackManifestInfo(zipRes.roots[0])?.name, "LeafPack");
    } finally {
      zipRes.dispose();
    }
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

  it("ensureVersionGreaterThan / nextEnabledVersion：bump(max(新包, 旧版))", async () => {
    const { ensureVersionGreaterThan, nextEnabledVersion, readPackManifestInfo } = await import(
      "./dist/world-packs.js"
    );
    assert.deepEqual(nextEnabledVersion([1, 0, 0], [1, 21, 100], "patch"), [1, 21, 101]);
    /* 复现：旧 Slash Blade RP=[1,21,100]，远程新包=[1,0,0] */
    const dir = path.join(tmp, "bump-floor");
    writeManifest(dir, {
      name: "SlashRp",
      uuid: "8b450660-c968-3d5e-696e-b7f14c03388a",
      version: [1, 0, 0],
      type: "resources",
    });
    const next = ensureVersionGreaterThan(dir, [1, 21, 100], "patch");
    assert.deepEqual(next, [1, 21, 101]);
    assert.deepEqual(readPackManifestInfo(dir)?.version, [1, 21, 101]);
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

  it("scanDestOccupancy 走 readPackDirOccupancy（完整 + 残缺 header）", async () => {
    const { scanDestOccupancy, readPackDirOccupancy } = await import("./dist/world-packs.js");
    const dest = path.join(tmp, "occupancy-dry");
    const fullDir = path.join(dest, "[RP] Full");
    writeManifest(fullDir, {
      name: "Full Pack",
      uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: [2, 1, 0],
      type: "resources",
    });
    const partialDir = path.join(dest, "[RP] Partial");
    fs.mkdirSync(partialDir, { recursive: true });
    fs.writeFileSync(
      path.join(partialDir, "manifest.json"),
      JSON.stringify({
        format_version: 2,
        header: {
          name: "Partial",
          uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          version: [3, 0, 0],
        },
        modules: [],
      })
    );

    const fullFacts = readPackDirOccupancy(fullDir);
    assert.equal(fullFacts?.uuid, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    assert.deepEqual(fullFacts?.version, [2, 1, 0]);
    assert.equal(fullFacts?.name, "Full Pack");
    assert.equal(fullFacts?.kind, "resource");

    const partialFacts = readPackDirOccupancy(partialDir);
    assert.equal(partialFacts?.uuid, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    assert.deepEqual(partialFacts?.version, [3, 0, 0]);
    assert.equal(partialFacts?.kind, undefined);

    const occ = scanDestOccupancy(dest);
    assert.equal(occ.length, 2);
    const byUuid = new Map(occ.map((o) => [o.uuid, o]));
    assert.equal(byUuid.get("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")?.name, "Full Pack");
    assert.equal(byUuid.get("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")?.kind, "resource");
    assert.equal(byUuid.get("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")?.version?.[0], 3);
    assert.equal(byUuid.get("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")?.name, undefined);
  });

  it("decidePackInstallPlan 表驱动", async () => {
    const { decidePackInstallPlan, formatWorldPackFolderName } = await import("./dist/world-packs.js");
    const uuidA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const uuidB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const mk = (over) => ({
      name: "Foo",
      uuid: uuidB,
      version: [1, 0, 0],
      kind: "behavior",
      ...over,
    });

    const cases = [
      {
        title: "空占用 + hint B → fresh 用 manifest 名",
        incoming: mk({ name: "Foo", uuid: uuidB }),
        hint: "B",
        occupancy: [],
        force: false,
        expectKind: "fresh",
        expectFolder: "[BP] Foo",
      },
      {
        title: "已有 [BP] B uuidA + 新 uuidB hint B → fresh 且不占用 B",
        incoming: mk({ name: "pack.name", uuid: uuidB, version: [5, 0, 4] }),
        hint: "B",
        occupancy: [
          {
            folderName: "[BP] B",
            dir: "/x/[BP] B",
            uuid: uuidA,
            version: [1, 0, 0],
            name: "Slash",
          },
        ],
        force: false,
        expectKind: "fresh",
        expectFolderNot: "[BP] B",
      },
      {
        title: "同 uuid 版本更高 !force → overwriteInPlace",
        incoming: mk({ name: "Slash v2", uuid: uuidA, version: [1, 2, 0] }),
        hint: "Other",
        occupancy: [
          {
            folderName: "[BP] B",
            dir: "/x/[BP] B",
            uuid: uuidA,
            version: [1, 1, 0],
            name: "Slash",
          },
        ],
        force: false,
        expectKind: "overwriteInPlace",
        expectFolder: "[BP] B",
      },
      {
        title: "同 uuid 版本相等 !force → needConfirm",
        incoming: mk({ name: "Slash", uuid: uuidA, version: [1, 1, 0] }),
        hint: "Other",
        occupancy: [
          {
            folderName: "[BP] B",
            dir: "/x/[BP] B",
            uuid: uuidA,
            version: [1, 1, 0],
            name: "Slash",
          },
        ],
        force: false,
        expectKind: "needConfirm",
        expectFolder: "[BP] B",
      },
      {
        title: "同 uuid 版本更低 !force → needConfirm",
        incoming: mk({ name: "Slash", uuid: uuidA, version: [1, 0, 0] }),
        hint: "Other",
        occupancy: [
          {
            folderName: "[BP] B",
            dir: "/x/[BP] B",
            uuid: uuidA,
            version: [1, 1, 0],
            name: "Slash",
          },
        ],
        force: false,
        expectKind: "needConfirm",
        expectFolder: "[BP] B",
      },
      {
        title: "同 uuid 降级 + force → overwriteInPlace",
        incoming: mk({ name: "Slash old", uuid: uuidA, version: [1, 0, 0] }),
        hint: "Other",
        occupancy: [
          {
            folderName: "[BP] B",
            dir: "/x/[BP] B",
            uuid: uuidA,
            version: [1, 1, 0],
            name: "Slash",
          },
        ],
        force: true,
        expectKind: "overwriteInPlace",
        expectFolder: "[BP] B",
      },
      {
        title: "两人名撞车 → fresh 带 uuid 后缀",
        incoming: mk({ name: "Cool", uuid: uuidB, version: [1, 0, 0] }),
        hint: "Cool",
        occupancy: [
          {
            folderName: formatWorldPackFolderName("Cool", "behavior"),
            dir: "/x/a",
            uuid: uuidA,
            version: [1, 0, 0],
          },
        ],
        force: false,
        expectKind: "fresh",
        expectFolder: formatWorldPackFolderName(`Cool ${uuidB.slice(0, 8)}`, "behavior"),
      },
    ];

    for (const c of cases) {
      const plan = decidePackInstallPlan({
        incoming: c.incoming,
        hint: c.hint,
        occupancy: c.occupancy,
        force: c.force,
      });
      assert.equal(plan.kind, c.expectKind, c.title);
      if (c.expectFolder) assert.equal(plan.folderName, c.expectFolder, c.title);
      if (c.expectFolderNot) assert.notEqual(plan.folderName, c.expectFolderNot, c.title);
      if (plan.kind === "overwriteInPlace" || plan.kind === "needConfirm") {
        assert.equal(plan.folderName, c.occupancy[0].folderName, `${c.title}: 必须原地`);
      }
    }
  });

  it("installPackDirectory FS：异 uuid 换名；版本升级静默覆盖；同版需 force", async () => {
    const { installPackDirectory, formatWorldPackFolderName, readPackManifestInfo } = await import(
      "./dist/world-packs.js"
    );
    const dest = path.join(tmp, "conflict-parent");

    const existingB = path.join(dest, formatWorldPackFolderName("B", "behavior"));
    writeManifest(existingB, {
      name: "Slash Blade",
      uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: [1, 0, 0],
      type: "data",
    });

    /* 异 uuid + hint B → 换名，不碰旧包 */
    const src = path.join(tmp, "incoming-bp");
    writeManifest(src, {
      name: "pack.name",
      uuid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      version: [5, 0, 4],
      type: "data",
    });
    const r = await installPackDirectory({
      srcDir: src,
      destParent: dest,
      folderName: "B",
      force: false,
    });
    assert.equal(r.ok, true, r.reason);
    assert.notEqual(path.basename(r.destDir), path.basename(existingB));
    assert.equal(readPackManifestInfo(existingB)?.uuid, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");

    /* 同 uuid 版本更高 → 静默原地覆盖（无需 force） */
    const srcUp = path.join(tmp, "incoming-upgrade");
    writeManifest(srcUp, {
      name: "Slash Blade v2",
      uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: [2, 0, 0],
      type: "data",
    });
    const up = await installPackDirectory({
      srcDir: srcUp,
      destParent: dest,
      folderName: "Totally Different Hint",
      force: false,
    });
    assert.equal(up.ok, true, up.reason);
    assert.equal(up.conflict, undefined);
    assert.equal(up.destDir && path.basename(up.destDir), path.basename(existingB));
    assert.equal(readPackManifestInfo(existingB)?.version.join("."), "2.0.0");
    assert.equal(fs.readdirSync(dest).filter((n) => n.startsWith("[BP]")).length, 2);

    /* 同版 → needConfirm；force 后原地 */
    const srcSame = path.join(tmp, "incoming-same-ver");
    writeManifest(srcSame, {
      name: "Slash Blade v2b",
      uuid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      version: [2, 0, 0],
      type: "data",
    });
    const c = await installPackDirectory({
      srcDir: srcSame,
      destParent: dest,
      force: false,
    });
    assert.equal(c.ok, false);
    assert.equal(c.reason, "conflict");

    const forced = await installPackDirectory({
      srcDir: srcSame,
      destParent: dest,
      force: true,
    });
    assert.equal(forced.ok, true, forced.reason);
    assert.equal(forced.destDir && path.basename(forced.destDir), path.basename(existingB));
    assert.equal(readPackManifestInfo(existingB)?.name, "Slash Blade v2b");
  });

  it("installPackDirectory：残缺 manifest 占用目录时换名而非覆盖", async () => {
    const { installPackDirectory, formatWorldPackFolderName } = await import("./dist/world-packs.js");
    const dest = path.join(tmp, "broken-parent");
    const folderName = formatWorldPackFolderName("Broken", "resource");
    const existingDir = path.join(dest, folderName);
    fs.mkdirSync(existingDir, { recursive: true });
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
    assert.equal(r.ok, true, r.reason);
    assert.notEqual(r.destDir && path.basename(r.destDir), folderName);
    const still = JSON.parse(fs.readFileSync(path.join(existingDir, "manifest.json"), "utf8"));
    assert.equal(still.header.uuid, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  });

  it("installPackDirectory：残缺 manifest 同 uuid → 按版本决策（非旁路新目录）", async () => {
    const { installPackDirectory, formatWorldPackFolderName, readPackManifestInfo } = await import(
      "./dist/world-packs.js"
    );
    const dest = path.join(tmp, "broken-same-uuid");
    const folderName = formatWorldPackFolderName("Legacy", "behavior");
    const existingDir = path.join(dest, folderName);
    fs.mkdirSync(existingDir, { recursive: true });
    const uuid = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    fs.writeFileSync(
      path.join(existingDir, "manifest.json"),
      JSON.stringify({
        format_version: 2,
        header: { name: "Legacy", uuid, version: [1, 0, 0] },
        modules: [],
      })
    );
    const srcSame = path.join(tmp, "incoming-same-broken");
    writeManifest(srcSame, {
      name: "Fixed",
      uuid,
      version: [1, 0, 0],
      type: "data",
    });
    const c = await installPackDirectory({
      srcDir: srcSame,
      destParent: dest,
      folderName: "OtherHint",
      force: false,
    });
    assert.equal(c.ok, false);
    assert.equal(c.reason, "conflict");
    assert.equal(c.conflict?.existing.dir, existingDir);

    const srcUp = path.join(tmp, "incoming-up-broken");
    writeManifest(srcUp, {
      name: "Fixed v2",
      uuid,
      version: [1, 1, 0],
      type: "data",
    });
    const up = await installPackDirectory({
      srcDir: srcUp,
      destParent: dest,
      folderName: "OtherHint",
      force: false,
    });
    assert.equal(up.ok, true, up.reason);
    assert.equal(up.destDir, existingDir);
    assert.equal(readPackManifestInfo(existingDir)?.version.join("."), "1.1.0");
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

  it("readPackManifestInfo 遇 UTF-8 BOM 仍可读出 uuid/name（剥离兼容）", async () => {
    const { readPackManifestInfo } = await import("./dist/world-packs.js");
    const dir = path.join(tmp, "bom-rp");
    fs.mkdirSync(dir, { recursive: true });
    const body = JSON.stringify(
      {
        format_version: 2,
        header: {
          name: "§l§a神金",
          uuid: "2b6de4b1-1f74-4c6e-937b-77f5e9c1f199",
          version: [1, 0, 4],
        },
        modules: [{ type: "resources", uuid: "1c710355-15e2-4293-8574-788eec05d35f", version: [1, 0, 4] }],
      },
      null,
      2
    );
    fs.writeFileSync(path.join(dir, "manifest.json"), `\uFEFF${body}`, "utf8");
    const info = readPackManifestInfo(dir);
    assert.ok(info);
    assert.equal(info.uuid, "2b6de4b1-1f74-4c6e-937b-77f5e9c1f199");
    assert.equal(info.name, "§l§a神金");
    assert.equal(info.kind, "resource");
  });
});
