/**
 * 模块 manifest 运行时操作：
 *   - validateManifestV3 / validateManifestV2
 *   - migrateV2toV3
 *   - mergeSemanticV3
 *
 * 设计原则：
 *   - 失败优先 fail-fast：返回 errors 数组而非抛错，便于调用方聚合；
 *   - 字段校验分两层：v2 必备字段严格校验；v3 semantic 全部字段容忍缺失；
 *   - 默认值保守：migrate 函数不臆造语义信息，仅推导明显前缀并留空。
 */

import type {
  ManifestV2,
  ManifestV3,
  ManifestV3DbTable,
  ManifestV3Events,
  ManifestV3PublicApi,
  ManifestV3Semantic,
  ServiceEntry,
  ValidationResult,
} from "./manifest-schema.js";

/**
 * 校验 v2 manifest。返回结构化结果；errors 为人类可读字符串列表。
 * 与 schemas/sapi-manifest.v2.schema.json 的「required」保持一致：
 * schemaVersion=2 / id / name / type / configKey / requires / permissions / services。
 */
export function validateManifestV2(input: unknown): ValidationResult<ManifestV2> {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["manifest 根必须是 plain object"] };
  }
  const r = input as Record<string, unknown>;

  if (r.schemaVersion !== 2) {
    errors.push(`schemaVersion 必须为 2，实际为 ${describe(r.schemaVersion)}`);
  }
  if (!isNonEmptyString(r.id)) errors.push("id 缺失或类型错（非空字符串）");
  if (!isNonEmptyString(r.name)) errors.push("name 缺失或类型错（非空字符串）");
  if (r.type !== "core" && r.type !== "feature") {
    errors.push(`type 必须是 "core" 或 "feature"，实际为 ${describe(r.type)}`);
  }
  if (!isNonEmptyString(r.configKey)) errors.push("configKey 缺失或类型错");
  if (!Array.isArray(r.requires)) errors.push("requires 必须是数组");
  else if (r.requires.some((s) => !isNonEmptyString(s))) {
    errors.push("requires 元素必须为非空字符串");
  }
  if (!Array.isArray(r.permissions)) errors.push("permissions 必须是数组");
  else if (r.permissions.some((s) => !isNonEmptyString(s))) {
    errors.push("permissions 元素必须为非空字符串");
  }
  if (!isPlainObject(r.services)) {
    errors.push('services 缺失或类型错（需形如 { provides?: [...], requires?: [...] }）');
  } else {
    const services = r.services as Record<string, unknown>;
    if (services.provides !== undefined && !Array.isArray(services.provides)) {
      errors.push("services.provides 必须是数组（如不需要声明数组请写 []）");
    }
    if (services.requires !== undefined && !Array.isArray(services.requires)) {
      errors.push("services.requires 必须是数组");
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, manifest: input as ManifestV2 };
}

/**
 * 校验 v3 manifest：先跑 v2 校验，再确认 schemaVersion=3，最后校正 semantic 形状。
 * 关键：v3 必须能在缺省 semantic 时通过校验（向后兼容 v2 模块）。
 */
export function validateManifestV3(input: unknown): ValidationResult<ManifestV3> {
  const errors: string[] = [];
  if (!isPlainObject(input)) {
    return { ok: false, errors: ["manifest 根必须是 plain object"] };
  }
  const r = input as Record<string, unknown>;

  if (r.schemaVersion !== 3) {
    errors.push(`schemaVersion 必须为 3，实际为 ${describe(r.schemaVersion)}`);
  }
  if (!isNonEmptyString(r.id)) errors.push("id 缺失或类型错（非空字符串）");
  if (!isNonEmptyString(r.name)) errors.push("name 缺失或类型错（非空字符串）");
  if (r.type !== "core" && r.type !== "feature") {
    errors.push(`type 必须是 "core" 或 "feature"，实际为 ${describe(r.type)}`);
  }
  if (!isNonEmptyString(r.configKey)) errors.push("configKey 缺失或类型错");
  if (!Array.isArray(r.requires)) errors.push("requires 必须是数组");
  else if (r.requires.some((s) => !isNonEmptyString(s))) {
    errors.push("requires 元素必须为非空字符串");
  }
  if (!Array.isArray(r.permissions)) errors.push("permissions 必须是数组");
  else if (r.permissions.some((s) => !isNonEmptyString(s))) {
    errors.push("permissions 元素必须为非空字符串");
  }
  if (!isPlainObject(r.services)) {
    errors.push('services 缺失或类型错（需形如 { provides?: [...], requires?: [...] }）');
  } else {
    const services = r.services as Record<string, unknown>;
    if (services.provides !== undefined && !Array.isArray(services.provides)) {
      errors.push("services.provides 必须是数组");
    }
    if (services.requires !== undefined && !Array.isArray(services.requires)) {
      errors.push("services.requires 必须是数组");
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  // semantic 是可选块；存在时校正各子字段形状
  const semantic = r.semantic;
  if (semantic !== undefined && !isPlainObject(semantic)) {
    errors.push("semantic 必须是 plain object（缺失合法）");
  } else if (isPlainObject(semantic)) {
    const sErrors = validateSemanticShape(semantic as Record<string, unknown>);
    if (sErrors.length > 0) {
      errors.push(...sErrors);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  const normalized = r.semantic !== undefined ? normalizeSemantic(r.semantic) : undefined;
  const manifest: ManifestV3 = {
    schemaVersion: 3,
    id: r.id as string,
    name: r.name as string,
    type: r.type as "core" | "feature",
    configKey: r.configKey as string,
    requires: r.requires as string[],
    permissions: r.permissions as string[],
    ...(r.services && typeof r.services === "object"
      ? { services: r.services as ManifestV2["services"] }
      : {}),
    ...(typeof r.notes === "string" ? { notes: r.notes } : {}),
    ...(normalized ? { semantic: normalized } : {}),
  };
  return { ok: true, manifest };
}

/** 校验 semantic 各子段；返回扁平 errors 数组（带 `[semantic.<field>]` 前缀便于定位）。 */
function validateSemanticShape(s: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (s.configKeys !== undefined) {
    if (!Array.isArray(s.configKeys)) {
      errors.push("[semantic.configKeys] 必须是字符串数组（缺失合法）");
    } else if (s.configKeys.some((v) => !isNonEmptyString(v))) {
      errors.push("[semantic.configKeys] 元素必须为非空字符串");
    }
  }
  if (s.dependsOn !== undefined) {
    if (!Array.isArray(s.dependsOn)) {
      errors.push("[semantic.dependsOn] 必须是字符串数组（缺失合法）");
    } else if (s.dependsOn.some((v) => !isNonEmptyString(v))) {
      errors.push("[semantic.dependsOn] 元素必须为非空字符串");
    }
  }
  if (s.events !== undefined) {
    if (!isPlainObject(s.events)) {
      errors.push("[semantic.events] 必须是 plain object（缺失合法）");
    } else {
      const e = s.events as Record<string, unknown>;
      if (e.emits !== undefined) {
        if (!Array.isArray(e.emits)) {
          errors.push("[semantic.events.emits] 必须是字符串数组");
        } else if (e.emits.some((v) => !isNonEmptyString(v))) {
          errors.push("[semantic.events.emits] 元素必须为非空字符串");
        }
      }
      if (e.listens !== undefined) {
        if (!Array.isArray(e.listens)) {
          errors.push("[semantic.events.listens] 必须是字符串数组");
        } else if (e.listens.some((v) => !isNonEmptyString(v))) {
          errors.push("[semantic.events.listens] 元素必须为非空字符串");
        }
      }
    }
  }
  if (s.dbTables !== undefined) {
    if (!Array.isArray(s.dbTables)) {
      errors.push("[semantic.dbTables] 必须是数组（缺失合法）");
    } else {
      for (const [i, t] of s.dbTables.entries()) {
        if (!isPlainObject(t)) {
          errors.push(`[semantic.dbTables[${i}]] 必须是 plain object`);
          continue;
        }
        const tn = (t as Record<string, unknown>).name;
        if (!isNonEmptyString(tn)) {
          errors.push(`[semantic.dbTables[${i}].name]] 缺失或非字符串`);
        }
        const cols = (t as Record<string, unknown>).columns;
        if (cols !== undefined) {
          if (!Array.isArray(cols) || cols.some((v) => !isNonEmptyString(v))) {
            errors.push(`[semantic.dbTables[${i}].columns]] 必须是字符串数组`);
          }
        }
      }
    }
  }
  if (s.publicApi !== undefined) {
    if (!Array.isArray(s.publicApi)) {
      errors.push("[semantic.publicApi] 必须是数组（缺失合法）");
    } else {
      for (const [i, a] of s.publicApi.entries()) {
        if (!isPlainObject(a)) {
          errors.push(`[semantic.publicApi[${i}]] 必须是 plain object`);
          continue;
        }
        const sym = (a as Record<string, unknown>).symbol;
        if (!isNonEmptyString(sym)) {
          errors.push(`[semantic.publicApi[${i}].symbol]] 缺失或非字符串`);
        }
      }
    }
  }
  return errors;
}

/**
 * v2 → v3 迁移。保守策略：
 *   - 所有 v2 必需字段原样复制；
 *   - semantic 全部默认空（不强填臆造值），依赖用户在下一轮手动补全；
 *   - 输入缺失字段（requires/permissions 缺失）默认空数组——沙箱里跑测的临时模块常常
 *     只写 id/name，运行时兼容；catalog 投影路径仍以 schemaVersion 校验为准。
 *   - 允许 readonly 输入。
 */
export function migrateV2toV3(v2: ManifestV2): ManifestV3 {
  const manifest: ManifestV3 = {
    schemaVersion: 3,
    id: v2.id,
    name: v2.name,
    type: v2.type,
    configKey: v2.configKey,
    requires: Array.isArray(v2.requires) ? [...v2.requires] : [],
    permissions: Array.isArray(v2.permissions) ? [...v2.permissions] : [],
    ...(v2.services ? { services: cloneServices(v2.services) } : {}),
    ...(v2.notes !== undefined ? { notes: v2.notes } : {}),
  };
  return manifest;
}

/**
 * 合并两份 semantic：以 base 字段为底层，逐字段用 patch 覆盖。
 * 数组字段：去重合并（base ∪ patch），保证顺序 base → patch。
 * 对象字段（events / dbTables / publicApi 单元素）：patch 非空时整体替换。
 * 缺失值（undefined / 空数组 / 空对象）视为「不覆盖」。
 */
export function mergeSemanticV3(
  base: ManifestV3Semantic | undefined,
  patch: ManifestV3Semantic | undefined
): ManifestV3Semantic {
  if (!base && !patch) return {};
  const out: ManifestV3Semantic = {};
  const baseConfigKeys = nonEmptyArray(base?.configKeys) ?? [];
  const patchConfigKeys = nonEmptyArray(patch?.configKeys) ?? [];
  const configKeys = uniquePreserveOrder([...baseConfigKeys, ...patchConfigKeys]);
  if (configKeys.length > 0) out.configKeys = configKeys;

  const baseDependsOn = nonEmptyArray(base?.dependsOn) ?? [];
  const patchDependsOn = nonEmptyArray(patch?.dependsOn) ?? [];
  const dependsOn = uniquePreserveOrder([...baseDependsOn, ...patchDependsOn]);
  if (dependsOn.length > 0) out.dependsOn = dependsOn;

  const baseEvents = base?.events;
  const patchEvents = patch?.events;
  if (baseEvents || patchEvents) {
    const merged: ManifestV3Events = {};
    const emits = uniquePreserveOrder([
      ...nonEmptyArray(baseEvents?.emits) ?? [],
      ...nonEmptyArray(patchEvents?.emits) ?? [],
    ]);
    if (emits.length > 0) merged.emits = emits;
    const listens = uniquePreserveOrder([
      ...nonEmptyArray(baseEvents?.listens) ?? [],
      ...nonEmptyArray(patchEvents?.listens) ?? [],
    ]);
    if (listens.length > 0) merged.listens = listens;
    if (merged.emits || merged.listens) out.events = merged;
  }

  const baseTables = Array.isArray(base?.dbTables) ? base!.dbTables : [];
  const patchTables = Array.isArray(patch?.dbTables) ? patch!.dbTables : [];
  const tables = mergeDbTables(baseTables, patchTables);
  if (tables.length > 0) out.dbTables = tables;

  const baseApis = Array.isArray(base?.publicApi) ? base!.publicApi : [];
  const patchApis = Array.isArray(patch?.publicApi) ? patch!.publicApi : [];
  const apis = mergePublicApi(baseApis, patchApis);
  if (apis.length > 0) out.publicApi = apis;

  return out;
}

/** dbTables 合并：按 name 去重；重名时合并 columns（patch 覆盖缺失列）。 */
function mergeDbTables(
  base: ManifestV3DbTable[],
  patch: ManifestV3DbTable[]
): ManifestV3DbTable[] {
  if (base.length === 0) return patch.map(cloneTable);
  const map = new Map<string, ManifestV3DbTable>();
  for (const t of base) {
    if (!t?.name) continue;
    map.set(t.name, cloneTable(t));
  }
  for (const t of patch) {
    if (!t?.name) continue;
    const prev = map.get(t.name);
    if (!prev) {
      map.set(t.name, cloneTable(t));
      continue;
    }
    const cols = uniquePreserveOrder([
      ...(nonEmptyArray(prev.columns) ?? []),
      ...(nonEmptyArray(t.columns) ?? []),
    ]);
    if (cols.length > 0) prev.columns = cols;
  }
  return [...map.values()];
}

/** publicApi 合并：按 symbol 去重；重名时整体以 patch 覆盖（patch 字段更权威）。 */
function mergePublicApi(base: ManifestV3PublicApi[], patch: ManifestV3PublicApi[]): ManifestV3PublicApi[] {
  if (base.length === 0) return patch.map(cloneApi);
  const map = new Map<string, ManifestV3PublicApi>();
  for (const a of base) {
    if (!a?.symbol) continue;
    map.set(a.symbol, cloneApi(a));
  }
  for (const a of patch) {
    if (!a?.symbol) continue;
    map.set(a.symbol, cloneApi(a));
  }
  return [...map.values()];
}

function cloneServices(s: NonNullable<ManifestV2["services"]>): NonNullable<ManifestV2["services"]> {
  return {
    ...(Array.isArray(s.provides) ? { provides: s.provides.map(cloneServiceEntry) } : {}),
    ...(Array.isArray(s.requires) ? { requires: s.requires.map(cloneServiceEntry) } : {}),
  };
}

function cloneServiceEntry(e: ServiceEntry): ServiceEntry {
  return {
    name: e.name,
    ...(e.input ? { input: { ...e.input } } : {}),
    ...(e.output ? { output: { ...e.output } } : {}),
  };
}

function cloneTable(t: ManifestV3DbTable): ManifestV3DbTable {
  return {
    name: t.name,
    ...(Array.isArray(t.columns) ? { columns: [...t.columns] } : {}),
  };
}

function cloneApi(a: ManifestV3PublicApi): ManifestV3PublicApi {
  return {
    symbol: a.symbol,
    ...(a.description !== undefined ? { description: a.description } : {}),
    ...(Array.isArray(a.params) ? { params: a.params.map((p) => ({ ...p })) } : {}),
    ...(a.returns ? { returns: { ...a.returns } } : {}),
  };
}

function normalizeSemantic(raw: unknown): ManifestV3Semantic | undefined {
  if (!isPlainObject(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: ManifestV3Semantic = {};
  const configKeys = nonEmptyArray(r.configKeys);
  if (configKeys) out.configKeys = configKeys;
  const dependsOn = nonEmptyArray(r.dependsOn);
  if (dependsOn) out.dependsOn = dependsOn;
  if (isPlainObject(r.events)) {
    const e = r.events as Record<string, unknown>;
    const emits = nonEmptyArray(e.emits);
    const listens = nonEmptyArray(e.listens);
    if (emits || listens) {
      out.events = {
        ...(emits ? { emits } : {}),
        ...(listens ? { listens } : {}),
      };
    }
  }
  const tables = Array.isArray(r.dbTables)
    ? (r.dbTables.filter(isPlainObject).map((t) => {
        const obj = t as Record<string, unknown>;
        const cols = nonEmptyArray(obj.columns);
        return {
          name: String(obj.name ?? "").trim(),
          ...(cols ? { columns: cols } : {}),
        } as ManifestV3DbTable;
      }) as ManifestV3DbTable[])
    : [];
  const cleanTables = tables.filter((t) => t.name.length > 0);
  if (cleanTables.length > 0) out.dbTables = cleanTables;
  const apis = Array.isArray(r.publicApi)
    ? (r.publicApi.filter(isPlainObject).map((a) => {
        const obj = a as Record<string, unknown>;
        const ret = obj.returns as Record<string, unknown> | undefined;
        return {
          symbol: String(obj.symbol ?? "").trim(),
          ...(typeof obj.description === "string" ? { description: obj.description } : {}),
          ...(Array.isArray(obj.params)
            ? {
                params: (obj.params as Array<Record<string, unknown>>).map((p) => ({
                  name: String(p.name ?? "").trim(),
                  type: String(p.type ?? "").trim(),
                  ...(typeof p.required === "boolean" ? { required: p.required } : {}),
                  ...(typeof p.description === "string" ? { description: p.description } : {}),
                })),
              }
            : {}),
          ...(ret && typeof ret === "object"
            ? {
                returns: {
                  type: String((ret as Record<string, unknown>).type ?? "").trim(),
                  ...(typeof ret.description === "string" ? { description: ret.description } : {}),
                },
              }
            : {}),
        } as ManifestV3PublicApi;
      }) as ManifestV3PublicApi[])
    : [];
  const cleanApis = apis.filter((a) => a.symbol.length > 0);
  if (cleanApis.length > 0) out.publicApi = cleanApis;
  return Object.keys(out).length > 0 ? out : undefined;
}

/* ─────────────────────────── helpers ─────────────────────────── */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function describe(v: unknown): string {
  if (v === undefined) return "undefined";
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  return `${typeof v} ${JSON.stringify(v)}`;
}

/** 返回数组；空数组视为 undefined（去噪）。 */
function nonEmptyArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v.filter(isNonEmptyString);
  return out.length > 0 ? out : undefined;
}

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}
