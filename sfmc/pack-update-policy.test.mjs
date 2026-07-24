/**
 * version-policy / slug 匹配测试
 * 从 dist 导入权威实现，禁止再内联复制（DRY / LSP：测生产契约）。
 * 需先 `npm run build -w @sfmc-bds/cli`。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSearchQueries,
  buildSearchQueriesFromSources,
  collectQuerySeeds,
  decideVersionPolicy,
  extractLatinPhrase,
  insertCjkLatinBoundaries,
  nextVersionGreaterThan,
  normalizePackSearchName,
  packSourceScore,
  toCfSlugCandidate,
} from "./dist/pack-update/version-policy.js";

describe("version-policy", () => {
  it("同 major 更新应 bump RP", () => {
    const d = decideVersionPolicy([1, 21, 100], [1, 21, 110], {
      authority: "behavior_pack",
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      rpBumpComponent: "patch",
      majorHigherSkipRpBump: true,
    });
    assert.equal(d.remoteNewer, true);
    assert.equal(d.shouldBumpRp, true);
  });

  it("major 更高则不额外 bump RP", () => {
    const d = decideVersionPolicy([1, 21, 100], [2, 0, 0], {
      authority: "behavior_pack",
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      rpBumpComponent: "patch",
      majorHigherSkipRpBump: true,
    });
    assert.equal(d.majorHigher, true);
    assert.equal(d.shouldBumpRp, false);
  });

  it("同版本未更高时默认不 bump；treatAsUpdate 强制同步仍可 bump RP", () => {
    const policy = {
      authority: "behavior_pack",
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      rpBumpComponent: "patch",
      majorHigherSkipRpBump: true,
    };
    const plain = decideVersionPolicy([1, 0, 0], [1, 0, 0], policy);
    assert.equal(plain.remoteNewer, false);
    assert.equal(plain.shouldBumpRp, false);

    const forced = decideVersionPolicy([1, 0, 0], [1, 0, 0], policy, { treatAsUpdate: true });
    assert.equal(forced.remoteNewer, false);
    assert.equal(forced.shouldBumpRp, true);
  });

  it("远程更旧但 treatAsUpdate 时仍按同 major 规则 bump RP", () => {
    const d = decideVersionPolicy([1, 2, 0], [1, 1, 0], {
      authority: "behavior_pack",
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      rpBumpComponent: "patch",
      majorHigherSkipRpBump: true,
    }, { treatAsUpdate: true });
    assert.equal(d.remoteNewer, false);
    assert.equal(d.majorHigher, false);
    assert.equal(d.shouldBumpRp, true);
  });

  it("nextVersionGreaterThan", () => {
    assert.deepEqual(nextVersionGreaterThan([1, 0, 5], [1, 0, 8], "patch"), [1, 0, 9]);
  });

  it("normalize 去掉方括号、版本与 BP", () => {
    const n = normalizePackSearchName("[BA] [玩法] Slash Blade v4 BP");
    assert.equal(n, "Slash Blade");
  });

  it("CJK 粘连分界并提取拉丁核心", () => {
    const folder = "[BP] [BA] [玩法] 拔刀剑Slash Blade v4 BP";
    assert.equal(normalizePackSearchName(folder), "拔刀剑 Slash Blade");
    assert.equal(
      extractLatinPhrase(insertCjkLatinBoundaries(folder.replace(/\[[^\]]*\]/g, " "))),
      "Slash Blade v4 BP"
    );
    const seeds = collectQuerySeeds(folder);
    assert.ok(seeds.includes("Slash Blade v4 BP"));
    assert.ok(seeds.includes("Slash Blade v4"));
    assert.ok(seeds.includes("Slash Blade"));
    assert.ok(seeds.some((s) => s.includes("拔刀剑")));
  });

  it("脏文件夹名派生含 slug / Title-Slug / addon", () => {
    const qs = buildSearchQueries("[BP] [BA] [玩法] 拔刀剑Slash Blade v4 BP");
    assert.ok(qs.includes("slash-blade"), `queries=${JSON.stringify(qs)}`);
    assert.ok(qs.includes("slash-blade-addon"), `queries=${JSON.stringify(qs)}`);
    assert.ok(qs.includes("Slash Blade"), `queries=${JSON.stringify(qs)}`);
    /* Title-Case 与小写 slug 大小写不敏感去重，只保留其一 */
    assert.ok(
      qs.some((q) => q.toLowerCase() === "slash-blade"),
      `queries=${JSON.stringify(qs)}`
    );
    /* 核心 slug 应排在含 CJK 的查询之前 */
    const iSlug = qs.findIndex((q) => q === "slash-blade-addon");
    const iCjk = qs.findIndex((q) => q.includes("拔刀剑"));
    assert.ok(iSlug >= 0 && (iCjk < 0 || iSlug < iCjk));
  });

  it("header+文件夹双源：有拉丁时不搜纯中文，且文件夹贡献 slug", () => {
    const qs = buildSearchQueries(["拔刀剑", "[BP] [BA] [玩法] 拔刀剑Slash Blade v4 BP"]);
    assert.ok(qs.includes("slash-blade-addon"));
    assert.ok(qs.includes("Slash Blade"));
    assert.ok(qs.every((q) => /[A-Za-z]/.test(q)), `不应再搜纯中文: ${JSON.stringify(qs)}`);
  });

  it("双源轮询：header 与 folder 都会贡献", () => {
    const plan = buildSearchQueriesFromSources([
      { id: "header", raw: "Cool Swords Pack" },
      { id: "folder", raw: "[BP] [BA] [玩法] 拔刀剑Slash Blade v4 BP" },
    ]);
    assert.ok(plan.perSource.header?.some((q) => /cool|swords/i.test(q)));
    assert.ok(plan.perSource.folder?.some((q) => /slash-blade/i.test(q)));
    assert.ok(plan.queries.some((q) => /slash-blade/i.test(q)));
    assert.ok(plan.queries.some((q) => /cool|swords/i.test(q)));
  });

  it("slug 候选无空格", () => {
    assert.equal(toCfSlugCandidate("Slash Blade v4"), "slash-blade");
    const qs = buildSearchQueries("Slash Blade v4");
    assert.ok(qs.includes("Slash Blade"));
    assert.ok(qs.includes("slash-blade"));
    assert.ok(qs.includes("slash-blade-addon"));
  });

  it("slug 命中 slash-blade-addon 高分", () => {
    const score = packSourceScore("Slash Blade v4", {
      name: "Slash Blade Addon",
      slug: "slash-blade-addon",
    });
    assert.ok(score >= 0.95, `score=${score}`);
  });
});
