/**
 * manifest-loader.ts — 读 v2 manifest,失败 = 启动失败
 *
 * v2 schema:
 *   {
 *     "schemaVersion": 2,
 *     "id": "feature-land",
 *     "name": "领地",
 *     "type": "feature",
 *     "configKey": "land",
 *     "requires": ["feature-economy"],
 *     "permissions": ["db:read:lands", "service:economy.account"],
 *     "services": {
 *       "provides": [{ "name": "lands.byOwner", "input": {...}, "output": {...} }],
 *       "requires":  [{ "name": "economy.account" }]
 *     },
 *     "notes": "..."
 *   }
 *
 *   不要 routes / tables / migrations / seeds / handlers / events。
 *
 * 调用方:db-server/src/index.ts 启动时一次 loadManifestV2,
 *        throw 即 crash。
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultPackagesDir } from "./manifest.js";
import { validateManifestPermissions } from "./permission-gate.js";

export interface ManifestServiceIO {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ServiceEntry {
  name: string;
  input?: ManifestServiceIO | undefined;
  output?: ManifestServiceIO | undefined;
}

export interface ModuleManifestV2 {
  schemaVersion: 2;
  id: string;
  name: string;
  type: "core" | "feature";
  configKey: string;
  requires: string[];
  permissions: string[];
  services: { provides: ServiceEntry[]; requires: ServiceEntry[] };
  notes?: string | undefined;
}

const VALID_TYPES = new Set(["core", "feature"]);
const IDENT = /^[A-Za-z0-9_-]+$/;

/** v1 / 缺 schemaVersion:跳过(直到所有模块迁 v2) */
export class ModuleV1SkippedError extends Error {
  constructor(public moduleId: string, public declaredVersion: unknown) {
    super(`moduleId=${moduleId} schemaVersion=${String(declaredVersion)} (需要 2),跳过`);
  }
}

function assertModuleObject(modId: string, obj: Record<string, unknown>): void {
  if (typeof obj.schemaVersion !== "number") {
    throw new Error(`[manifest] ${modId}: schemaVersion 缺失`);
  }
  if (obj.schemaVersion !== 2) {
    throw new Error(`[manifest] ${modId}: schemaVersion=${obj.schemaVersion} (需要 2)`);
  }
  if (typeof obj.id !== "string" || !IDENT.test(obj.id)) {
    throw new Error(`[manifest] ${modId}: id 缺失或非法 "${String(obj.id)}"`);
  }
  if (typeof obj.name !== "string" || obj.name.length === 0) {
    throw new Error(`[manifest] ${modId}: name 缺失`);
  }
  if (typeof obj.type !== "string" || !VALID_TYPES.has(obj.type)) {
    throw new Error(`[manifest] ${modId}: type 必须是 core|feature ("${String(obj.type)}")`);
  }
  if (typeof obj.configKey !== "string" || obj.configKey.length === 0) {
    throw new Error(`[manifest] ${modId}: configKey 缺失`);
  }
  if (Array.isArray(obj.routes)) {
    throw new Error(`[manifest] ${modId}: 不再支持 routes 字段,改用 db.defineTable + platform routes`);
  }
  if (Array.isArray(obj.migrations)) {
    throw new Error(`[manifest] ${modId}: 不再支持 migrations 字段,改用 db.defineTable 自动建表`);
  }
  if (Array.isArray(obj.tables)) {
    throw new Error(`[manifest] ${modId}: 不再支持 tables 字段,改用 db.defineTable`);
  }
  if (Array.isArray(obj.events)) {
    throw new Error(`[manifest] ${modId}: 不再支持 events 字段,改用 platform event-bus`);
  }
}

function parseServices(modId: string, raw: unknown): { provides: ServiceEntry[]; requires: ServiceEntry[] } {
  if (raw === undefined) return { provides: [], requires: [] };
  if (typeof raw !== "object" || raw === null) {
    throw new Error(`[manifest] ${modId}: services 必须是对象`);
  }
  const obj = raw as Record<string, unknown>;
  const provides = parseServiceList(modId, "provides", obj.provides);
  const requires = parseServiceList(modId, "requires", obj.requires);
  for (const r of requires) {
    if (provides.find((p) => p.name === r.name)) {
      throw new Error(`[manifest] ${modId}: service "${r.name}" 既 provides 又 requires`);
    }
  }
  return { provides, requires };
}

function parseServiceList(modId: string, dir: string, raw: unknown): ServiceEntry[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`[manifest] ${modId}: services.${dir} 必须是数组`);
  const out: ServiceEntry[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) {
      throw new Error(`[manifest] ${modId}: services.${dir} 项必须是对象`);
    }
    const e = item as Record<string, unknown>;
    if (typeof e.name !== "string" || e.name.length === 0) {
      throw new Error(`[manifest] ${modId}: services.${dir} 项缺少 name`);
    }
    const seen = new Set<string>();
    if (seen.has(e.name)) {
      throw new Error(`[manifest] ${modId}: services.${dir} name 重复 "${e.name}"`);
    }
    seen.add(e.name);
    out.push({ name: e.name, input: e.input as ManifestServiceIO | undefined, output: e.output as ManifestServiceIO | undefined });
  }
  return out;
}

function parseMod(modId: string, raw: Record<string, unknown>): ModuleManifestV2 {
  if (raw.schemaVersion !== 2) {
    throw new ModuleV1SkippedError(modId, raw.schemaVersion);
  }
  assertModuleObject(modId, raw);
  const requires = Array.isArray(raw.requires) ? (raw.requires as unknown[]).filter((x) => typeof x === "string") as string[] : [];
  const permissions = Array.isArray(raw.permissions) ? (raw.permissions as unknown[]).filter((x) => typeof x === "string") as string[] : [];
  validateManifestPermissions(modId, permissions);
  return {
    schemaVersion: 2,
    id: raw.id as string,
    name: raw.name as string,
    type: raw.type as "core" | "feature",
    configKey: raw.configKey as string,
    requires,
    permissions,
    services: parseServices(modId, raw.services),
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
  };
}

export interface LoadedManifests {
  modules: Record<string, ModuleManifestV2>;
  providesMap: Map<string, string>; // service name → moduleId
}

/**
 * 启动期调。throw = 启动失败。
 * 注:不读 v1 manifest。只有 schemaVersion=2 才走。
 */
export function loadManifestV2(packagesDir: string = defaultPackagesDir()): LoadedManifests {
  if (!existsSync(packagesDir)) {
    throw new Error(`[manifest] ${packagesDir} 不存在;无法启动 v2 协议`);
  }
  const ids = readdirSync(packagesDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
  const modules: Record<string, ModuleManifestV2> = {};
  const providesMap = new Map<string, string>();

  for (const id of ids) {
    const p = resolve(packagesDir, id, "sapi", "manifest.json");
    if (!existsSync(p)) continue;
    let raw: string;
    try {
      raw = readFileSync(p, "utf8");
    } catch (e) {
      throw new Error(`[manifest] ${id}: 读 ${p} 失败: ${(e as Error).message}`);
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch (e) {
      throw new Error(`[manifest] ${id}: ${p} 非合法 JSON: ${(e as Error).message}`);
    }
    try {
      const m = parseMod(id, parsed);
      modules[m.id] = m;
      for (const s of m.services.provides) {
        const prev = providesMap.get(s.name);
        if (prev) {
          throw new Error(`[manifest] service "${s.name}" 已被 ${prev} provides,${m.id} 抢注`);
        }
        providesMap.set(s.name, m.id);
      }
    } catch (e) {
      if (e instanceof ModuleV1SkippedError) {
        // PoC 兼容:不是 v2 的模块跳过,等到所有模块迁 v2 后改为 throw
        console.warn(`[manifest] ${id}: ${e.message}; v1 跳过`);
        continue;
      }
      throw e;
    }
  }

  // requires:校验目标 service 在某个 provides 里
  for (const m of Object.values(modules)) {
    for (const r of m.services.requires) {
      const owner = providesMap.get(r.name);
      if (!owner) {
        throw new Error(`[manifest] ${m.id}.services.requires.${r.name} 没有模块 provides`);
      }
    }
    // requires 模块依赖也要么 enabled 要么本身 installed (启动期不强求 enabled;运行时再查)
    for (const dep of m.requires) {
      if (!modules[dep]) {
        throw new Error(`[manifest] ${m.id}.requires.${dep} 没找到对应模块`);
      }
    }
  }

  return { modules, providesMap };
}

/**
 * 给定 moduleId 集合,过滤出 enabled (= lock 文件 enabled 的) 子集。
 * map(moduleId → manifest) — 没装则跳过。
 */
export function filterEnabled(
  loaded: LoadedManifests,
  enabledIds: ReadonlySet<string>
): Record<string, ModuleManifestV2> {
  const out: Record<string, ModuleManifestV2> = {};
  for (const [id, m] of Object.entries(loaded.modules)) {
    if (enabledIds.has(id)) out[id] = m;
  }
  return out;
}
