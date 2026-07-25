/**
 * changeset-release 共用库单测（node:test）
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  packageTagName,
  extractChangelogNotes,
  listPendingChangesetFiles,
  listPackagesWithExistingVersionTags,
  resolveReleaseTagEntries,
  RELEASE_TAGS_STATE,
  PRE_JSON,
  ROOT,
} from "./lib/changeset-release.mjs";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("packageTagName", () => {
  it("matches changeset publish format (no v prefix)", () => {
    assert.equal(packageTagName("@sfmc-bds/db-server", "0.2.0-beta.1"), "@sfmc-bds/db-server@0.2.0-beta.1");
  });
});

describe("extractChangelogNotes", () => {
  it("extracts body for a version heading", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-cl-"));
    fs.writeFileSync(
      path.join(dir, "CHANGELOG.md"),
      "# pkg\n\n## 1.2.3\n\n### Patch Changes\n\n- hello\n\n## 1.2.2\n\n- old\n"
    );
    const notes = extractChangelogNotes(dir, "1.2.3");
    assert.match(notes, /hello/);
    assert.doesNotMatch(notes, /old/);
  });

  it("falls back when version missing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-cl-"));
    fs.writeFileSync(path.join(dir, "CHANGELOG.md"), "# pkg\n\n## 1.0.0\n\n- x\n");
    assert.equal(extractChangelogNotes(dir, "9.9.9"), "Release 9.9.9");
  });
});

describe("release paths (DRY)", () => {
  it("RELEASE_TAGS_STATE and PRE_JSON live under ROOT", () => {
    assert.ok(RELEASE_TAGS_STATE.startsWith(ROOT));
    assert.ok(PRE_JSON.startsWith(ROOT));
    assert.equal(path.basename(RELEASE_TAGS_STATE), ".sfmc-release-tags.json");
  });
});

describe("resolveReleaseTagEntries (LSP)", () => {
  it("trusts empty tags array — does not call fallback", () => {
    let called = false;
    const out = resolveReleaseTagEntries({ tags: [], createdAt: "t" }, () => {
      called = true;
      return [{ tag: "should-not-appear" }];
    });
    assert.deepEqual(out, []);
    assert.equal(called, false);
  });

  it("uses fallback only when state is missing", () => {
    const fb = [{ tag: "@sfmc-bds/tools@0.2.0-beta.1" }];
    const out = resolveReleaseTagEntries(null, () => fb);
    assert.equal(out, fb);
  });

  it("returns state.tags when present", () => {
    const tags = [{ name: "@sfmc-bds/tools", version: "0.2.0-beta.1", tag: "@sfmc-bds/tools@0.2.0-beta.1" }];
    const out = resolveReleaseTagEntries({ tags, createdAt: "t" }, () => []);
    assert.equal(out, tags);
  });

  it("gh-release missing-state fallback is listPackagesWithExistingVersionTags (DRY)", () => {
    /* 契约：changeset-github-release 不得再手写一遍 tag -l 扫描 */
    const out = resolveReleaseTagEntries(null, () => listPackagesWithExistingVersionTags());
    assert.ok(Array.isArray(out));
    for (const e of out) {
      assert.equal(e.tag, packageTagName(e.name, e.version));
    }
  });
});

describe("listPendingChangesetFiles (pre mode LSP)", () => {
  it("excludes ids already recorded in pre.json#changesets", () => {
    const pre = JSON.parse(fs.readFileSync(PRE_JSON, "utf8"));
    assert.equal(pre.mode, "pre");
    assert.ok(Array.isArray(pre.changesets));
    const pending = listPendingChangesetFiles();
    const pendingIds = pending.map((p) => path.basename(p, ".md"));
    for (const id of pre.changesets) {
      assert.ok(!pendingIds.includes(id), `consumed ${id} must not be pending`);
    }
  });
});
