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
  listUnpushedExistingVersionTags,
  resolveReleaseTagEntries,
  RELEASE_TAGS_STATE,
  PRE_JSON,
  ROOT,
} from "./changeset-release-lib.mjs";
import { listPublishableBuildDeps, listPublishableBuildOrder, NPM_PUBLISH_PACKAGES } from "./lib/npm-publish-packages.mjs";
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

  it("push missing-state fallback is listUnpushedExistingVersionTags (DRY/LSP)", () => {
    /* 契约：changeset-push 不得再硬编码 @sfmc-bds/* 全量扫描 */
    const allExisting = listPackagesWithExistingVersionTags();
    const existingTags = new Set(allExisting.map((e) => e.tag));
    /** @type {ReturnType<typeof listUnpushedExistingVersionTags> | undefined} */
    let fb;
    const viaResolver = resolveReleaseTagEntries(null, () => {
      fb = listUnpushedExistingVersionTags();
      return fb;
    });
    assert.equal(viaResolver, fb);
    assert.ok(Array.isArray(fb));
    for (const e of fb) {
      assert.equal(e.tag, packageTagName(e.name, e.version));
      assert.ok(existingTags.has(e.tag), "unpushed 必须是 existing 的子集");
    }
  });
});

describe("listPublishableBuildOrder / Deps (DRY/OCP)", () => {
  it("covers every NPM_PUBLISH_PACKAGES entry once; deps before dependents", () => {
    const order = listPublishableBuildOrder();
    const keys = Object.keys(NPM_PUBLISH_PACKAGES);
    assert.equal(order.length, keys.length);
    assert.deepEqual([...order].sort(), [...keys].sort());
    assert.ok(order.indexOf("@sfmc-bds/sdk") < order.indexOf("@sfmc-bds/bds-tools"));
    assert.ok(order.indexOf("@sfmc-bds/bds-tools") < order.indexOf("@sfmc-bds/cli"));
    assert.ok(order.indexOf("@sfmc-bds/bds-tools") < order.indexOf("@sfmc-bds/tools"));
  });

  it("listPublishableBuildDeps walks publishable dependency closure", () => {
    assert.deepEqual(listPublishableBuildDeps("@sfmc-bds/sdk"), []);
    assert.deepEqual(listPublishableBuildDeps("@sfmc-bds/db-server"), ["@sfmc-bds/sdk"]);
    assert.deepEqual(listPublishableBuildDeps("@sfmc-bds/cli"), ["@sfmc-bds/sdk", "@sfmc-bds/bds-tools"]);
    assert.deepEqual(listPublishableBuildDeps("@sfmc-bds/tools"), ["@sfmc-bds/sdk", "@sfmc-bds/bds-tools"]);
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
