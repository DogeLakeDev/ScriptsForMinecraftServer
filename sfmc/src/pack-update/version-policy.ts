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

/** 根据本地/远程 BP 版本与策略，决定是否更新以及是否额外 bump RP */
export function decideVersionPolicy(
  localBp: SemVer3,
  remoteBp: SemVer3,
  policy: VersionPolicyConfig
): VersionCompareResult {
  const remoteNewer = isNewer(remoteBp, localBp);
  const majorHigher = remoteBp[0] > localBp[0];
  let shouldBumpRp = false;
  if (remoteNewer && policy.onUpdateOverwriteBoth) {
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

/** 清洗展示名：去掉 [BA]/[BP]/玩法等方括号标签 */
export function normalizePackSearchName(name: string, stripFolderTags = true): string {
  let s = String(name ?? "");
  s = s.replace(/§[0-9a-zA-Z]/g, "");
  if (stripFolderTags) {
    s = s.replace(/\[[^\]]*]/g, " ");
  }
  s = s.replace(/\.(zip|mcpack|mcaddon)$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
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
