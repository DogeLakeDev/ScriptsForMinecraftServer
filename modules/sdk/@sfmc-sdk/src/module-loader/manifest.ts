/**
 * 模块 manifest 运行时操作：
 *   - validateManifest / validateManifestV3 / validateManifestV2
 *   - migrateV2toV3
 *   - mergeSemanticV3
 *
 */

import {
  failValidation,
  issueConstMismatch,
  issueInvalidItem,
  issueInvalidType,
  issueRootNotObject,
  ManifestExpected,
} from "./manifest-issues.js";
import type {
  AnyManifest,
  ManifestIssue,
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
 * 模块 manifest 校验对外统一总入口。
 *
 * 核心调度与设计规范：
 * - 自动按 `schemaVersion` 分派至 `validateManifestV2` 或 `validateManifestV3` 校验器；
 * - 遇到未知版本号时统一构造 `const_mismatch` 结构化问题（期望值为 `"2 或 3"`）；
 * - 外部调用方（如 CLI check-modules、模块安装器、沙箱环境等）必须统一由此入口执行完整校验，禁止在业务层抄写或重复实现字段检查。
 *
 * @param input 待校验的原始 manifest 输入对象。
 * @returns 统一校验结果。若成功返回对应版本的结构化 manifest，失败返回包含 errors 与 issues 的结果对象。
 */
export function validateManifest(input: unknown): ValidationResult<AnyManifest> {
  if (!isPlainObject(input)) {
    return failValidation([issueRootNotObject()]);
  }
  const version = input.schemaVersion;
  if (version === 2) return validateManifestV2(input);
  if (version === 3) return validateManifestV3(input);
  return failValidation([issueConstMismatch("schemaVersion", "2 或 3", describe(version))]);
}

/**
 * 针对 schemaVersion = 2 的版本锁定校验函数。
 * 校验规则与 `schemas/sapi-manifest.v2.schema.json` 规范定义完全对齐。
 *
 * @param input 待校验的原始 manifest 输入对象。
 * @returns v2 版本的结构化校验结果。
 */
export function validateManifestV2(input: unknown): ValidationResult<ManifestV2> {
  if (!isPlainObject(input)) {
    return failValidation([issueRootNotObject()]);
  }
  const issues = collectCoreIssues(input, 2);
  if (issues.length > 0) return failValidation(issues);
  return { ok: true, manifest: input as ManifestV2 };
}

/**
 * 针对 schemaVersion = 3 的版本锁定校验函数。
 *
 * 校验时序与兼容性原则：
 * 1. 复用核心校验器校验所有与 v2 相同的基础顶层字段，并锁定 `schemaVersion` 必须为 3；
 * 2. 校验可选的 `semantic` 语义块；
 * 3. 兼容性保证：v3 必须能在缺省 `semantic` 时顺利通过校验，以保证仅声明 v2 字段但升级版本号的传统模块能向后平滑兼容。
 *
 * @param input 待校验的原始 manifest 输入对象。
 * @returns v3 版本的结构化校验结果。
 */
export function validateManifestV3(input: unknown): ValidationResult<ManifestV3> {
  if (!isPlainObject(input)) {
    return failValidation([issueRootNotObject()]);
  }
  const r = input;
  const issues = collectCoreIssues(r, 3);
  const semantic = r.semantic;
  if (semantic !== undefined && !isPlainObject(semantic)) {
    issues.push(issueInvalidType("semantic", ManifestExpected.object));
  } else if (isPlainObject(semantic)) {
    issues.push(...collectSemanticIssues(semantic));
  }
  if (issues.length > 0) return failValidation(issues);

  const normalized = r.semantic !== undefined ? normalizeSemantic(r.semantic) : undefined;
  const manifest: ManifestV3 = {
    schemaVersion: 3,
    id: r.id as string,
    name: r.name as string,
    configKey: r.configKey as string,
    requires: r.requires as string[],
    permissions: r.permissions as string[],
    ...(typeof r.enabledByDefault === "boolean" ? { enabledByDefault: r.enabledByDefault } : {}),
    ...(typeof r.canDisable === "boolean" ? { canDisable: r.canDisable } : {}),
    ...(r.services && typeof r.services === "object" ? { services: r.services as ManifestV2["services"] } : {}),
    ...(typeof r.notes === "string" ? { notes: r.notes } : {}),
    ...(normalized ? { semantic: normalized } : {}),
  };
  return { ok: true, manifest };
}

/**
 * 收集 v2 与 v3 共享的核心顶层字段校验问题。
 * 统一收敛必填字段（id、name、configKey、requires、permissions）与通用配置（enabledByDefault、canDisable、services），
 * 避免在 v2 与 v3 之间维护两套重复的校验规则与提示文案。
 *
 * @param r 原始输入对象字典。
 * @param expectedVersion 期望的契约版本号（2 或 3）。
 * @returns 收集到的结构化问题列表。
 */
function collectCoreIssues(r: Record<string, unknown>, expectedVersion: 2 | 3): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (r.schemaVersion !== expectedVersion) {
    issues.push(issueConstMismatch("schemaVersion", String(expectedVersion), describe(r.schemaVersion)));
  }
  requireNonEmptyString(issues, r.id, "id");
  requireNonEmptyString(issues, r.name, "name");
  requireNonEmptyString(issues, r.configKey, "configKey");
  requireStringArray(issues, r.requires, "requires");
  requireStringArray(issues, r.permissions, "permissions");
  optionalBoolean(issues, r.enabledByDefault, "enabledByDefault");
  optionalBoolean(issues, r.canDisable, "canDisable");
  if (!isPlainObject(r.services)) {
    issues.push(issueInvalidType("services", ManifestExpected.object));
  } else {
    optionalArray(issues, r.services.provides, "services.provides");
    optionalArray(issues, r.services.requires, "services.requires");
  }
  return issues;
}

/**
 * 校验 v3 专属的 semantic 语义块各子段。
 *
 * 设计边界：
 * semantic 整体是可选的；仅当其实际出现且为普通对象时，才对其各子段（configKeys、dependsOn、events、dbTables、publicApi）进行级联校验。
 *
 * @param s semantic 配置对象字典。
 * @returns 收集到的结构化问题列表。
 */
function collectSemanticIssues(s: Record<string, unknown>): ManifestIssue[] {

  const issues: ManifestIssue[] = [];
  optionalStringArray(issues, s.configKeys, "semantic.configKeys");
  optionalStringArray(issues, s.dependsOn, "semantic.dependsOn");
  if (s.events !== undefined) {
    if (!isPlainObject(s.events)) {
      issues.push(issueInvalidType("semantic.events", ManifestExpected.object));
    } else {
      optionalStringArray(issues, s.events.emits, "semantic.events.emits");
      optionalStringArray(issues, s.events.listens, "semantic.events.listens");
    }
  }
  if (s.dbTables !== undefined) {
    if (!Array.isArray(s.dbTables)) {
      issues.push(issueInvalidType("semantic.dbTables", ManifestExpected.array));
    } else {
      for (const [i, t] of s.dbTables.entries()) {
        const path = `semantic.dbTables[${i}]`;
        if (!isPlainObject(t)) {
          issues.push(issueInvalidType(path, ManifestExpected.object));
          continue;
        }
        requireNonEmptyString(issues, t.name, `${path}.name`);
        if (t.columns !== undefined) {
          optionalStringArray(issues, t.columns, `${path}.columns`);
        }
      }
    }
  }
  if (s.publicApi !== undefined) {
    if (!Array.isArray(s.publicApi)) {
      issues.push(issueInvalidType("semantic.publicApi", ManifestExpected.array));
    } else {
      for (const [i, a] of s.publicApi.entries()) {
        const path = `semantic.publicApi[${i}]`;
        if (!isPlainObject(a)) {
          issues.push(issueInvalidType(path, ManifestExpected.object));
          continue;
        }
        requireNonEmptyString(issues, a.symbol, `${path}.symbol`);
      }
    }
  }
  return issues;
}

function requireNonEmptyString(issues: ManifestIssue[], value: unknown, path: string): void {
  if (!isNonEmptyString(value)) {
    issues.push(issueInvalidType(path, ManifestExpected.nonEmptyString));
  }
}

/**
 * 校验指定字段必须为非空字符串数组。
 * 针对 requires、permissions 等必须是纯字符串标识列表的字段，期望类型为 ManifestExpected.stringArray。
 *
 * @param issues 校验问题收集列表。
 * @param value 待检查的值。
 * @param path 字段对应的 JSON 路径。
 */
function requireStringArray(issues: ManifestIssue[], value: unknown, path: string): void {
  if (!Array.isArray(value)) {
    issues.push(issueInvalidType(path, ManifestExpected.stringArray));
    return;
  }
  if (value.some((s) => !isNonEmptyString(s))) {
    issues.push(issueInvalidItem(path, ManifestExpected.nonEmptyString));
  }
}

function optionalStringArray(issues: ManifestIssue[], value: unknown, path: string): void {
  if (value === undefined) return;
  requireStringArray(issues, value, path);
}

/**
 * 校验可选字段必须为数组类型（若存在）。
 * 针对 services.provides 与 services.requires 等对象数组字段，此处仅要求「是数组（ManifestExpected.array）」，
 * 其内部具体条目为复杂对象结构，不在基础类型层强求为纯字符串数组。
 *
 * @param issues 校验问题收集列表。
 * @param value 待检查的值。
 * @param path 字段对应的 JSON 路径。
 */
function optionalArray(issues: ManifestIssue[], value: unknown, path: string): void {
  if (value !== undefined && !Array.isArray(value)) {
    issues.push(issueInvalidType(path, ManifestExpected.array));
  }
}


function optionalBoolean(issues: ManifestIssue[], value: unknown, path: string): void {
  if (value !== undefined && typeof value !== "boolean") {
    issues.push(issueInvalidType(path, ManifestExpected.boolean));
  }
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
    configKey: v2.configKey,
    requires: Array.isArray(v2.requires) ? [...v2.requires] : [],
    permissions: Array.isArray(v2.permissions) ? [...v2.permissions] : [],
    ...(typeof v2.enabledByDefault === "boolean" ? { enabledByDefault: v2.enabledByDefault } : {}),
    ...(typeof v2.canDisable === "boolean" ? { canDisable: v2.canDisable } : {}),
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
      ...(nonEmptyArray(baseEvents?.emits) ?? []),
      ...(nonEmptyArray(patchEvents?.emits) ?? []),
    ]);
    if (emits.length > 0) merged.emits = emits;
    const listens = uniquePreserveOrder([
      ...(nonEmptyArray(baseEvents?.listens) ?? []),
      ...(nonEmptyArray(patchEvents?.listens) ?? []),
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
function mergeDbTables(base: ManifestV3DbTable[], patch: ManifestV3DbTable[]): ManifestV3DbTable[] {
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
    const cols = uniquePreserveOrder([...(nonEmptyArray(prev.columns) ?? []), ...(nonEmptyArray(t.columns) ?? [])]);
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

/**
 * 生成供 `const_mismatch.actual` 使用的实际值摘要描述。
 * 针对 undefined、null、带引号字符串以及包含类型的 JSON 序列化形式进行统一渲染。
 *
 * @param v 任意待描述的值。
 * @returns 规范化的值摘要字符串。
 */
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
