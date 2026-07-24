/**
 * version-policy / slug 匹配测试（无构建依赖）
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

function compareSemVer3(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

function decideVersionPolicy(localBp, remoteBp, policy) {
  const remoteNewer = compareSemVer3(remoteBp, localBp) > 0;
  const majorHigher = remoteBp[0] > localBp[0];
  let shouldBumpRp = false;
  if (remoteNewer && policy.onUpdateOverwriteBoth) {
    if (majorHigher && policy.majorHigherSkipRpBump) shouldBumpRp = false;
    else if (policy.rpBumpWhenSameMajor) shouldBumpRp = true;
  }
  return { remoteNewer, majorHigher, shouldBumpRp };
}

function nextVersionGreaterThan(current, floor, component = "patch") {
  let next =
    component === "minor"
      ? [current[0], current[1] + 1, 0]
      : [current[0], current[1], current[2] + 1];
  while (compareSemVer3(next, floor) <= 0) {
    if (component === "minor") next = [next[0], next[1] + 1, 0];
    else next = [next[0], next[1], next[2] + 1];
  }
  return next;
}

const PACK_ROLE_TOKEN =
  /^(?:bp|rp|ba|behavior|behaviours?|resource|resources|pack|packs|addon|addons|mcpack|mcaddon|behavior.?pack|resource.?pack|行为包|资源包|附加包|基岩|bedrock)$/iu;

function insertCjkLatinBoundaries(name) {
  return String(name ?? "")
    .replace(/([\u3400-\u9fff\uF900-\uFAFF])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([\u3400-\u9fff\uF900-\uFAFF])/g, "$1 $2");
}

function stripPackRoleTokens(name) {
  return String(name ?? "")
    .split(/[\s_]+/)
    .filter((t) => t && !PACK_ROLE_TOKEN.test(t))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripVersionTokens(name) {
  return String(name ?? "")
    .replace(/\bv\d+(?:\.\d+)*\b/gi, " ")
    .replace(/\b\d+\.\d+(?:\.\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLatinPhrase(name) {
  const words = String(name ?? "").match(/[A-Za-z][A-Za-z0-9]*/g);
  return words ? words.join(" ") : "";
}

function normalizePackSearchName(name, stripFolderTags = true) {
  let s = String(name ?? "");
  s = s.replace(/§[0-9a-zA-Z]/g, "");
  if (stripFolderTags) s = s.replace(/\[[^\]]*]/g, " ");
  s = s.replace(/\.(zip|mcpack|mcaddon)$/i, "");
  s = insertCjkLatinBoundaries(s);
  s = s.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  s = stripPackRoleTokens(s);
  s = stripVersionTokens(s);
  return s;
}

function collectQuerySeeds(raw, stripFolderTags = true) {
  const seeds = [];
  const push = (q) => {
    const t = q.replace(/\s+/g, " ").trim();
    if (!t) return;
    if (!seeds.some((x) => x.toLowerCase() === t.toLowerCase())) seeds.push(t);
  };

  let s = String(raw ?? "");
  s = s.replace(/§[0-9a-zA-Z]/g, "");
  if (stripFolderTags) s = s.replace(/\[[^\]]*]/g, " ");
  s = s.replace(/\.(zip|mcpack|mcaddon)$/i, "");
  s = insertCjkLatinBoundaries(s);
  s = s.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  push(s);

  const noRole = stripPackRoleTokens(s);
  push(noRole);
  push(stripVersionTokens(s));
  push(stripVersionTokens(noRole));

  const latin = extractLatinPhrase(s);
  push(latin);
  const latinNoRole = stripPackRoleTokens(latin);
  push(latinNoRole);
  const latinCore = stripVersionTokens(latinNoRole);
  push(latinCore);

  let tokens = latinCore.split(/\s+/).filter(Boolean);
  while (tokens.length >= 2) {
    push(tokens.join(" "));
    tokens = tokens.slice(0, -1);
  }

  push(normalizePackSearchName(raw, stripFolderTags));
  return seeds;
}

function toCfSlugCandidate(name, stripFolderTags = true) {
  return normalizePackSearchName(name, stripFolderTags)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function toCfTitleSlug(slug) {
  return String(slug ?? "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("-");
}

function buildSearchQueries(name, stripFolderTags = true, maxQueries = 14) {
  const inputs = (Array.isArray(name) ? name : [name])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((raw, i) => ({ id: `src${i}`, raw }));
  return buildSearchQueriesFromSources(inputs, stripFolderTags, maxQueries).queries;
}

function buildSearchQueriesFromSources(sources, stripFolderTags = true, maxQueries = 14) {
  const cleaned = sources
    .map((s) => ({ id: s.id, raw: String(s.raw ?? "").trim() }))
    .filter((s) => s.raw);

  const hasCjk = (q) => /[\u3400-\u9fff]/.test(q);
  const hasLatin = (q) => /[A-Za-z]/.test(q);
  const kindRank = (q) => {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*-addon$/.test(q)) return 0;
    if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(q)) return 1;
    if (/^[A-Z][a-z0-9]*(?:-[A-Z][a-z0-9]*)+$/.test(q)) return 2;
    if (hasCjk(q) && !hasLatin(q)) return 5;
    if (hasCjk(q)) return 4;
    return 3;
  };
  const sortQueries = (list) =>
    [...list].sort((a, b) => {
      const ka = kindRank(a);
      const kb = kindRank(b);
      if (ka !== kb) return ka - kb;
      const ta = a.split(/[\s\-]+/).filter(Boolean).length;
      const tb = b.split(/[\s\-]+/).filter(Boolean).length;
      if (ta !== tb) return ta - tb;
      return a.length - b.length;
    });

  const expandOne = (raw) => {
    const out = [];
    const push = (q) => {
      const t = q.trim();
      if (!t) return;
      if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t);
    };
    for (const seed of collectQuerySeeds(raw, stripFolderTags)) {
      push(seed);
      const slug = toCfSlugCandidate(seed, false);
      push(slug);
      if (slug) {
        push(toCfTitleSlug(slug));
        if (!slug.endsWith("-addon")) push(`${slug}-addon`);
      }
    }
    return sortQueries(out);
  };

  const perSource = {};
  const perSourcePreferred = [];
  for (const src of cleaned) {
    const all = expandOne(src.raw);
    const latinish = all.filter((q) => hasLatin(q));
    const preferred = latinish.length > 0 ? latinish : all;
    perSource[src.id] = preferred;
    perSourcePreferred.push(preferred);
  }

  const merged = [];
  const pushMerged = (q) => {
    if (!q) return;
    if (merged.some((x) => x.toLowerCase() === q.toLowerCase())) return;
    merged.push(q);
  };
  const maxLen = Math.max(0, ...perSourcePreferred.map((x) => x.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of perSourcePreferred) {
      if (i < list.length) pushMerged(list[i]);
    }
  }

  const anyLatin = merged.some((q) => hasLatin(q));
  const filtered = anyLatin ? merged.filter((q) => hasLatin(q)) : merged;
  const queries = sortQueries(filtered).slice(0, Math.max(1, maxQueries));
  return { queries, sources: cleaned, perSource };
}

function nameSimilarity(a, b) {
  const na = normalizePackSearchName(a).toLowerCase();
  const nb = normalizePackSearchName(b).toLowerCase();
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const ta = new Set(na.split(/[\s_\-]+/).filter(Boolean));
  const tb = new Set(nb.split(/[\s_\-]+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

function packSourceScore(query, hit, stripFolderTags = true) {
  const byName = nameSimilarity(query, hit.name);
  const qSlug = toCfSlugCandidate(query, stripFolderTags);
  const hSlug = String(hit.slug ?? "").toLowerCase();
  let bySlug = 0;
  if (qSlug && hSlug) {
    if (hSlug === qSlug) bySlug = 1;
    else if (hSlug === `${qSlug}-addon` || hSlug.startsWith(`${qSlug}-`)) bySlug = 0.96;
    else if (hSlug.includes(qSlug) || qSlug.includes(hSlug)) bySlug = 0.88;
    else bySlug = nameSimilarity(qSlug.replace(/-/g, " "), hSlug.replace(/-/g, " "));
  }
  return Math.max(byName, bySlug);
}

describe("version-policy", () => {
  it("同 major 更新应 bump RP", () => {
    const d = decideVersionPolicy([1, 21, 100], [1, 21, 110], {
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      majorHigherSkipRpBump: true,
    });
    assert.equal(d.remoteNewer, true);
    assert.equal(d.shouldBumpRp, true);
  });

  it("major 更高则不额外 bump RP", () => {
    const d = decideVersionPolicy([1, 21, 100], [2, 0, 0], {
      onUpdateOverwriteBoth: true,
      rpBumpWhenSameMajor: true,
      majorHigherSkipRpBump: true,
    });
    assert.equal(d.majorHigher, true);
    assert.equal(d.shouldBumpRp, false);
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
    assert.equal(extractLatinPhrase(insertCjkLatinBoundaries(folder.replace(/\[[^\]]*\]/g, " "))), "Slash Blade v4 BP");
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
