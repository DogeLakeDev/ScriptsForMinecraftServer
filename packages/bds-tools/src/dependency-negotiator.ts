/**
 * dependency-negotiator.ts — Bedrock 原生模块依赖版本解析与动态协商器
 *
 * 职责：
 * 1. Bedrock 原生模块版本（SemVer / Beta / Preview）对比算法；
 * 2. 聚合平台默认基准依赖与各业务模块声明的 Minecraft 依赖需求；
 * 3. 动态提升聚合行为包 manifest.json 中的 dependencies；
 * 4. 判定协商后是否包含需要存档开启测试版玩法（Beta APIs / gametest）的模块。
 */

export interface PackManifestDependency {
  module_name?: string | undefined;
  version?: string | number[] | undefined;
  uuid?: string | undefined;
}

export interface ModuleDeclaredDependencies {
  folderId: string;
  dependencies: PackManifestDependency[];
}

export interface DependencyPromotion {
  moduleName: string;
  from: string;
  to: string;
  requestedBy: string[];
}

export interface NegotiatedDependenciesResult {
  /** 协商完成后的最终 dependencies 列表 */
  dependencies: PackManifestDependency[];
  /** 本次协商发生的版本提升记录（便于日志展示） */
  promotions: DependencyPromotion[];
  /** 是否引入了需要 level.dat 开启 Beta APIs (gametest = 1b) 的模块 */
  hasBetaApis: boolean;
}

/** Bedrock 引擎原生内置的 Script API 模块集合（排除纯 npm 类型/数据包如 vanilla-data, math） */
export const NATIVE_BEDROCK_SCRIPT_MODULES = new Set<string>([
  "@minecraft/server",
  "@minecraft/server-ui",
  "@minecraft/server-net",
  "@minecraft/server-admin",
  "@minecraft/server-gametest",
  "@minecraft/server-editor",
  "@minecraft/server-graphics",
  "@minecraft/diagnostics",
  "@minecraft/debug-utilities",
  "@minecraft/common",
]);

/** SFMC 平台合成 BP 的默认基准依赖（稳定保底） */
export const BASELINE_BEDROCK_DEPENDENCIES: PackManifestDependency[] = [
  { module_name: "@minecraft/server", version: "1.18.0" },
  { module_name: "@minecraft/server-net", version: "1.0.0-beta" },
  { module_name: "@minecraft/server-ui", version: "1.3.0" },
  { module_name: "@minecraft/server-admin", version: "1.0.0-beta" },
  { module_name: "@minecraft/diagnostics", version: "1.0.0-beta" },
];

/**
 * 清理并规范化版本号字符串（去除 npm range 前缀，如 `^2.0.0-beta` → `2.0.0-beta`）。
 */
export function cleanBedrockVersion(raw: string | number[] | undefined): string {
  if (Array.isArray(raw)) return raw.join(".");
  if (!raw || typeof raw !== "string") return "1.0.0";
  let v = raw.trim();
  if (v.toLowerCase() === "beta") return "beta";
  // 去除 >=, <=, ^, ~, >, <, =, v
  v = v.replace(/^[>=~^<v\s]+/, "");
  // 若包含空格分隔的区间（如 ">=1.0.0 <2.0.0"），取前缀
  const spaceIdx = v.indexOf(" ");
  if (spaceIdx > 0) v = v.slice(0, spaceIdx);
  // 若包含 npm preview 扩展发布后缀（如 2.10.0-beta.1.26.40-preview.30），规整为标准 SemVer prerelease（如 2.10.0-beta）
  v = v.replace(/(-beta)\..*$/i, "$1");
  return v || "1.0.0";
}

interface ParsedBedrockVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
}

function parseBedrockVersion(raw: string): ParsedBedrockVersion {
  const cleaned = cleanBedrockVersion(raw);
  const match = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?/.exec(cleaned);
  if (!match) {
    return { major: 1, minor: 0, patch: 0, prerelease: null };
  }
  return {
    major: Number(match[1] || 0),
    minor: Number(match[2] || 0),
    patch: Number(match[3] || 0),
    prerelease: match[4] ?? null,
  };
}

/**
 * 比较两个 Bedrock 版本号：
 * a > b 返回正数；a < b 返回负数；a === b 返回 0。
 *
 * 核心规则：
 * 1. "beta" 为预览/测试轨顶级，高于任何纯数字稳定版；
 * 2. 优先比较 major, minor, patch 数字；
 * 3. 在同一大版本或低版本下：
 *    - 若 majorA > majorB（例如 2.0.0 vs 1.3.0），major 高者胜出；
 *    - 若 major/minor/patch 均相同，正式版优先于 prerelease；
 *    - 若两者均为 prerelease，按字典序比较。
 */
export function compareBedrockVersion(a: string, b: string): number {
  const normA = cleanBedrockVersion(a);
  const normB = cleanBedrockVersion(b);
  const isBetaA = normA.toLowerCase() === "beta";
  const isBetaB = normB.toLowerCase() === "beta";
  if (isBetaA && isBetaB) return 0;
  if (isBetaA) return 1;
  if (isBetaB) return -1;

  const pa = parseBedrockVersion(a);
  const pb = parseBedrockVersion(b);

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  if (pa.prerelease === null && pb.prerelease === null) return 0;
  // 相同 version 骨架下：正式版（null） > 测试版（prerelease）
  if (pa.prerelease === null && pb.prerelease !== null) return 1;
  if (pa.prerelease !== null && pb.prerelease === null) return -1;

  // 均为 prerelease 时比较
  return (pa.prerelease ?? "").localeCompare(pb.prerelease ?? "");
}

/**
 * 判定一个依赖项是否真正需要世界存档开启测试版玩法（Beta APIs / gametest）。
 * 注意：@minecraft/server-net 与 @minecraft/server-admin 虽带 -beta，但属于 permissions.json 模块权限，
 * 不需要 level.dat 的 gametest 实验开关。
 */
export function isGametestBetaRequired(dep: PackManifestDependency): boolean {
  const mod = dep.module_name ?? "";
  const ver = cleanBedrockVersion(dep.version).toLowerCase();
  if (mod === "@minecraft/server-gametest" || mod === "@minecraft/server-editor") return true;
  if (mod === "@minecraft/server-net" || mod === "@minecraft/server-admin") return false;
  if ((mod === "@minecraft/server" || mod === "@minecraft/server-ui") && ver.includes("beta")) {
    return true;
  }
  return false;
}

/**
 * 动态协商 Bedrock 原生模块依赖。
 *
 * 算法：
 * 1. 以 baseline 为基准建立模块索引表；
 * 2. 遍历所有已启用模块声明的 dependencies；
 * 3. 若模块对某原生模块提出了更高的版本需求，动态提升（promote）该依赖的版本，并记录提议模组；
 * 4. 统计是否引入了需要测试玩法的 Beta API。
 *
 * @param baseline 基准依赖列表（缺省使用 BASELINE_BEDROCK_DEPENDENCIES）
 * @param moduleRequirements 各已启用模块声明的依赖项列表
 */
export function negotiateBedrockDependencies(
  baseline: PackManifestDependency[] = BASELINE_BEDROCK_DEPENDENCIES,
  moduleRequirements: ModuleDeclaredDependencies[] = []
): NegotiatedDependenciesResult {
  // 建立模块映射表，保持基准依赖的原有顺序
  const order: string[] = [];
  const map = new Map<
    string,
    {
      version: string;
      uuid?: string | undefined;
      requestedBy: string[];
      promotedFrom?: string | undefined;
    }
  >();

  for (const b of baseline) {
    if (!b.module_name) continue;
    order.push(b.module_name);
    map.set(b.module_name, {
      version: cleanBedrockVersion(b.version),
      uuid: b.uuid,
      requestedBy: ["__sfmc_baseline__"],
    });
  }

  for (const mod of moduleRequirements) {
    for (const dep of mod.dependencies) {
      if (!dep.module_name) continue;
      const modName = dep.module_name;
      const reqVer = cleanBedrockVersion(dep.version);

      if (!map.has(modName)) {
        order.push(modName);
        map.set(modName, {
          version: reqVer,
          uuid: dep.uuid,
          requestedBy: [mod.folderId],
          promotedFrom: undefined,
        });
        continue;
      }

      const existing = map.get(modName)!;
      if (compareBedrockVersion(reqVer, existing.version) > 0) {
        // 发生了版本提升
        map.set(modName, {
          version: reqVer,
          uuid: dep.uuid ?? existing.uuid,
          requestedBy: [mod.folderId],
          promotedFrom: existing.promotedFrom ?? existing.version,
        });
      } else if (compareBedrockVersion(reqVer, existing.version) === 0) {
        if (!existing.requestedBy.includes(mod.folderId)) {
          existing.requestedBy.push(mod.folderId);
        }
      }
    }
  }

  const promotions: DependencyPromotion[] = [];
  const finalDeps: PackManifestDependency[] = [];
  let hasBetaApis = false;

  for (const name of order) {
    const entry = map.get(name)!;
    const dep: PackManifestDependency = {
      module_name: name,
      version: entry.version,
      ...(entry.uuid ? { uuid: entry.uuid } : {}),
    };
    finalDeps.push(dep);

    if (entry.promotedFrom && entry.promotedFrom !== entry.version) {
      promotions.push({
        moduleName: name,
        from: entry.promotedFrom,
        to: entry.version,
        requestedBy: entry.requestedBy.filter((x) => x !== "__sfmc_baseline__"),
      });
    }

    if (isGametestBetaRequired(dep)) {
      hasBetaApis = true;
    }
  }

  return {
    dependencies: finalDeps,
    promotions,
    hasBetaApis,
  };
}
