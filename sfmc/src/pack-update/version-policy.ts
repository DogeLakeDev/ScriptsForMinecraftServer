/**
 * 版本策略：以 BP 为准比较；同 major 更新时抬高 RP 版本触发客户端刷新
 */
import type { SemVer3, VersionCompareResult, VersionPolicyConfig } from "./types.js";

export function compareSemVer3(a: SemVer3, b: SemVer3): number {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

export function isNewer(remote: SemVer3, local: SemVer3): boolean {
  return compareSemVer3(remote, local) > 0;
}

/**
 * 根据本地/远程 BP 版本与策略，决定是否更新以及是否额外 bump RP。
 * `treatAsUpdate`：同版本/未更高但需强制同步写入时（如 fileId 尚未 apply）也走更新侧 RP bump 规则（OCP：策略集中于此，勿在编排层复刻）。
 */
export function decideVersionPolicy(
  localBp: SemVer3,
  remoteBp: SemVer3,
  policy: VersionPolicyConfig,
  opts?: { treatAsUpdate?: boolean }
): VersionCompareResult {
  const remoteNewer = isNewer(remoteBp, localBp);
  const majorHigher = remoteBp[0] > localBp[0];
  const asUpdate = remoteNewer || Boolean(opts?.treatAsUpdate);
  let shouldBumpRp = false;
  if (asUpdate && policy.onUpdateOverwriteBoth) {
    if (majorHigher && policy.majorHigherSkipRpBump) {
      shouldBumpRp = false;
    } else if (policy.rpBumpWhenSameMajor) {
      shouldBumpRp = true;
    }
  }
  return { remoteNewer, majorHigher, shouldBumpRp };
}

/** 生成严格大于 floor 的下一版本（按 patch 或 minor 抬一级） */
export function nextVersionGreaterThan(
  current: SemVer3,
  floor: SemVer3,
  component: "patch" | "minor" = "patch"
): SemVer3 {
  let next: SemVer3 =
    component === "minor"
      ? [current[0], current[1] + 1, 0]
      : [current[0], current[1], current[2] + 1];
  while (compareSemVer3(next, floor) <= 0) {
    if (component === "minor") {
      next = [next[0], next[1] + 1, 0];
    } else {
      next = [next[0], next[1], next[2] + 1];
    }
  }
  return next;
}

/** 包类型/渠道等噪音 token（整词去掉，勿删产品名） */
const PACK_ROLE_TOKEN =
  /^(?:bp|rp|ba|behavior|behaviours?|resource|resources|pack|packs|addon|addons|mcpack|mcaddon|behavior.?pack|resource.?pack|行为包|资源包|附加包|基岩|bedrock)$/iu;

/** 中日韩与拉丁粘连时插入空格：拔刀剑Slash → 拔刀剑 Slash */
export function insertCjkLatinBoundaries(name: string): string {
  return String(name ?? "")
    .replace(/([\u3400-\u9fff\uF900-\uFAFF])([A-Za-z])/g, "$1 $2")
    .replace(/([A-Za-z])([\u3400-\u9fff\uF900-\uFAFF])/g, "$1 $2");
}

/** 去掉整词包角色标记（末尾 BP/RP/Addon 等） */
export function stripPackRoleTokens(name: string): string {
  return String(name ?? "")
    .split(/[\s_]+/)
    .filter((t) => t && !PACK_ROLE_TOKEN.test(t))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 去掉 v4 / 1.21.100 一类版本尾巴 */
export function stripVersionTokens(name: string): string {
  return String(name ?? "")
    .replace(/\bv\d+(?:\.\d+)*\b/gi, " ")
    .replace(/\b\d+\.\d+(?:\.\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** 仅保留拉丁词（CF slug/search 主路径） */
export function extractLatinPhrase(name: string): string {
  const words = String(name ?? "").match(/[A-Za-z][A-Za-z0-9]*/g);
  return words ? words.join(" ") : "";
}

/**
 * 共享预处理：§码、方括号标签、扩展名、CJK/拉丁分界、下划线→空格。
 * normalize / collectQuerySeeds 共用，避免两处各写一遍（DRY）。
 */
export function preprocessPackNameRaw(name: string, stripFolderTags = true): string {
  let s = String(name ?? "");
  s = s.replace(/§[0-9a-zA-Z]/g, "");
  if (stripFolderTags) {
    s = s.replace(/\[[^\]]*]/g, " ");
  }
  s = s.replace(/\.(zip|mcpack|mcaddon)$/i, "");
  s = insertCjkLatinBoundaries(s);
  s = s.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  return s;
}

/**
 * 基础清洗：预处理 + 包角色 + 版本号。
 * 例："[BP] [BA] [玩法] 拔刀剑Slash Blade v4 BP" → "拔刀剑 Slash Blade"
 */
export function normalizePackSearchName(name: string, stripFolderTags = true): string {
  let s = preprocessPackNameRaw(name, stripFolderTags);
  s = stripPackRoleTokens(s);
  s = stripVersionTokens(s);
  return s;
}

/**
 * 从原始文件夹名/展示名收集多级清洗种子（由脏到净）。
 * 例："[BP] [BA] [玩法] 拔刀剑Slash Blade v4 BP"
 * → 拔刀剑 Slash Blade v4 BP → Slash Blade v4 BP → Slash Blade v4 → Slash Blade
 */
export function collectQuerySeeds(raw: string, stripFolderTags = true): string[] {
  const seeds: string[] = [];
  const push = (q: string): void => {
    const t = q.replace(/\s+/g, " ").trim();
    if (!t) return;
    if (!seeds.some((x) => x.toLowerCase() === t.toLowerCase())) seeds.push(t);
  };

  const s = preprocessPackNameRaw(raw, stripFolderTags);
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

  /* 拉丁核心再逐级缩短，至少保留 2 个词（避免单独搜 Blade 过泛） */
  let tokens = latinCore.split(/\s+/).filter(Boolean);
  while (tokens.length >= 2) {
    push(tokens.join(" "));
    tokens = tokens.slice(0, -1);
  }

  push(normalizePackSearchName(raw, stripFolderTags));
  return seeds;
}

/**
 * 从展示名推导 CF slug 候选（无空格、小写、连字符）。
 * 例："Slash Blade v4 BP" → "slash-blade"
 */
export function toCfSlugCandidate(name: string, stripFolderTags = true): string {
  const base = normalizePackSearchName(name, stripFolderTags);
  /* slug 侧几乎总是拉丁片段；保留字母数字，其余变连字符 */
  let s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return s;
}

/** Title-Case 连字符：slash-blade → Slash-Blade（部分 CF 搜索更吃这个） */
export function toCfTitleSlug(slug: string): string {
  return String(slug ?? "")
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("-");
}

/**
 * 派生一组搜索词：多源输入 × 多级清洗种子 ×（展示名 / slug / Title-Slug / slug-addon）。
 * `name` 可为字符串或数组（如 header.name + 文件夹名）。
 *
 * 规则：只要存在含拉丁字母的候选，就**丢弃纯 CJK 查询**（CF Bedrock 几乎不靠中文搜）。
 */
export function buildSearchQueries(
  name: string | readonly string[],
  stripFolderTags = true,
  maxQueries = 14
): string[] {
  const inputs = (Array.isArray(name) ? name : [name])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .map((raw, i) => ({ id: `src${i}`, raw }));
  return buildSearchQueriesFromSources(inputs, stripFolderTags, maxQueries).queries;
}

export type SearchQuerySource = { id: string; raw: string };

export type SearchQueryPlan = {
  /** 最终发给 CF 的查询（已去重、排序、截断） */
  queries: string[];
  /** 各源原始输入（便于日志） */
  sources: SearchQuerySource[];
  /** 每源贡献了哪些词（截断前，便于确认双源都参与） */
  perSource: Record<string, string[]>;
};

/**
 * 按源分别派生，再合并：保证 header / 文件夹名都会贡献候选，而非混成一锅被截断偏科。
 */
export function buildSearchQueriesFromSources(
  sources: readonly SearchQuerySource[],
  stripFolderTags = true,
  maxQueries = 14
): SearchQueryPlan {
  const cleaned = sources
    .map((s) => ({ id: s.id, raw: String(s.raw ?? "").trim() }))
    .filter((s) => s.raw);

  const hasCjk = (q: string): boolean => /[\u3400-\u9fff]/.test(q);
  const hasLatin = (q: string): boolean => /[A-Za-z]/.test(q);
  const kindRank = (q: string): number => {
    if (/^[a-z0-9]+(?:-[a-z0-9]+)*-addon$/.test(q)) return 0;
    if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(q)) return 1;
    if (/^[A-Z][a-z0-9]*(?:-[A-Z][a-z0-9]*)+$/.test(q)) return 2;
    if (hasCjk(q) && !hasLatin(q)) return 5;
    if (hasCjk(q)) return 4;
    return 3;
  };
  const sortQueries = (list: string[]): string[] =>
    [...list].sort((a, b) => {
      const ka = kindRank(a);
      const kb = kindRank(b);
      if (ka !== kb) return ka - kb;
      const ta = a.split(/[\s\-]+/).filter(Boolean).length;
      const tb = b.split(/[\s\-]+/).filter(Boolean).length;
      if (ta !== tb) return ta - tb;
      return a.length - b.length;
    });

  const expandOne = (raw: string): string[] => {
    const out: string[] = [];
    const push = (q: string): void => {
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

  const perSource: Record<string, string[]> = {};
  const perSourcePreferred: string[][] = [];
  for (const src of cleaned) {
    const all = expandOne(src.raw);
    /* 单源内：有拉丁则丢掉纯中文 */
    const latinish = all.filter((q) => hasLatin(q));
    const preferred = latinish.length > 0 ? latinish : all;
    perSource[src.id] = preferred;
    perSourcePreferred.push(preferred);
  }

  /* 轮询合并各源，避免某一源占满配额导致另一源完全没搜 */
  const merged: string[] = [];
  const pushMerged = (q: string): void => {
    if (!q) return;
    if (merged.some((x) => x.toLowerCase() === q.toLowerCase())) return;
    merged.push(q);
  };
  const maxLen = Math.max(0, ...perSourcePreferred.map((x) => x.length));
  for (let i = 0; i < maxLen; i++) {
    for (const list of perSourcePreferred) {
      if (i < list.length) pushMerged(list[i]!);
    }
  }

  /* 全局再滤一次：整体已有拉丁时，丢掉混进来的纯 CJK */
  const anyLatin = merged.some((q) => hasLatin(q));
  const filtered = anyLatin ? merged.filter((q) => hasLatin(q)) : merged;
  const queries = sortQueries(filtered).slice(0, Math.max(1, maxQueries));

  return { queries, sources: cleaned, perSource };
}

/** 简单相似度：0~1（基于共同 token 与包含关系） */
export function nameSimilarity(a: string, b: string): number {
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

/**
 * 综合展示名 + CF slug 打分。
 * slug 无空格（slash-blade-addon），与本地「Slash Blade v4」对齐时权重大于纯 name。
 */
export function packSourceScore(
  query: string,
  hit: { name: string; slug: string },
  stripFolderTags = true
): number {
  const byName = nameSimilarity(query, hit.name);
  const qSlug = toCfSlugCandidate(query, stripFolderTags);
  const hSlug = String(hit.slug ?? "")
    .toLowerCase()
    .replace(/^-+|-+$/g, "");
  let bySlug = 0;
  if (qSlug && hSlug) {
    if (hSlug === qSlug) bySlug = 1;
    else if (hSlug === `${qSlug}-addon` || hSlug.startsWith(`${qSlug}-`)) bySlug = 0.96;
    else if (hSlug.includes(qSlug) || qSlug.includes(hSlug)) bySlug = 0.88;
    else bySlug = nameSimilarity(qSlug.replace(/-/g, " "), hSlug.replace(/-/g, " "));
  }
  return Math.max(byName, bySlug);
}
