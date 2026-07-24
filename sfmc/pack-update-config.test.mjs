/**
 * pack-update 配置 / provider 解析契约测试
 * 从 dist 导入权威实现（DRY / LSP）。
 * 需先 `npm run build -w @sfmc-bds/cli`。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-pack-upd-cfg-"));
process.env.SFMC_ROOT = tmpRoot;
fs.mkdirSync(path.join(tmpRoot, "configs"), { recursive: true });

const { loadPackUpdateConfig, getPackMatchConfig } = await import(
  pathToFileURL(path.resolve("dist/pack-update/config.js")).href
);
const { providerShortLabel, resolveConfiguredPackProvider, createPackSourceProvider } = await import(
  pathToFileURL(path.resolve("dist/pack-update/providers/index.js")).href
);

describe("pack-update config + provider resolve", () => {
  before(() => {
    fs.mkdirSync(path.join(tmpRoot, "configs"), { recursive: true });
  });

  after(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it("defaultBindingEnabled 默认 false，且出现在类型化配置上", () => {
    const cfgPath = path.join(tmpRoot, "configs", "pack-update.json");
    if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
    const cfg = loadPackUpdateConfig();
    assert.equal(cfg.defaultBindingEnabled, false);
    assert.equal(typeof cfg.match.nameMinScore, "number");
    assert.equal(cfg.uninstall.recycleBin, true);
    assert.equal(cfg.uninstall.trashRelativeDir, "packs/_trash");
  });

  it("旧版 providers.curseforge.match 提升到顶层 match", () => {
    const cfgPath = path.join(tmpRoot, "configs", "pack-update.json");
    fs.writeFileSync(
      cfgPath,
      JSON.stringify({
        providers: {
          curseforge: {
            enabled: true,
            apiKey: "",
            match: { nameMinScore: 0.91, stripFolderTags: false },
          },
        },
      }),
      "utf8"
    );
    const cfg = loadPackUpdateConfig();
    assert.equal(cfg.match.nameMinScore, 0.91);
    assert.equal(cfg.match.stripFolderTags, false);
    assert.equal(getPackMatchConfig(cfg).nameMinScore, 0.91);
    assert.equal("match" in cfg.providers.curseforge, false);
  });

  it("providerShortLabel / resolveConfiguredPackProvider 契约", () => {
    assert.equal(providerShortLabel("curseforge"), "cf");
    const cfg = loadPackUpdateConfig();
    assert.equal(resolveConfiguredPackProvider(cfg), null);
    cfg.providers.curseforge.apiKey = "test-key-not-real";
    const p = resolveConfiguredPackProvider(cfg);
    assert.ok(p);
    assert.equal(p.id, "curseforge");
    assert.equal(createPackSourceProvider(cfg, "curseforge").id, "curseforge");
  });
});
