/**
 * 脚本沙箱断言求值：日志 / 场景存在 / 属性 / 计数 / 上次 Emit·Call
 * expected 侧支持轻量表达式，见 ./expr.ts
 */

import {
  collectExprObjectIds,
  looksLikeExpr,
  resolveExpr,
  type ExprRefSnap,
} from "./expr.ts";
import {
  isStructuredLogEvent,
  selectLogTexts,
  type StructuredLogEvent,
  type StructuredLogLevel,
} from "./logBuffer.ts";

export type AssertKind =
  | "log"
  | "logNot"
  | "sceneExists"
  | "prop"
  | "count"
  | "lastEmit"
  | "lastCall";

export type AssertMatchMode = "equals" | "contains" | "regex";
export type AssertCountOp = "eq" | "gte" | "lte";

/** 断言节点可序列化配置（旧节点仅有 pattern 时默认 assertKind=log） */
export type AssertConfig = {
  assertKind?: AssertKind;
  pattern?: string;
  ignoreCase?: boolean;
  /** 日志断言：只看最近 N 条 */
  logRecentN?: number;
  /** 日志断言：级别下限 */
  logMinLevel?: StructuredLogLevel;
  /** 日志断言：按 source 过滤（模块 id / sandbox / playground） */
  logSource?: string;
  targetKind?: string;
  targetName?: string;
  targetId?: string;
  propName?: string;
  /** 属性/字段期望；支持字面量与 $id.prop / @lastEmit… 表达式 */
  expected?: string;
  matchMode?: AssertMatchMode;
  countOp?: AssertCountOp;
  countN?: number;
};

export type AssertScene = {
  world?: { id: string; kind?: string };
  scoreboard?: { id: string; kind?: string };
  dimensions?: { id: string; kind?: string; dimensionId?: string }[];
  players?: { id: string; kind?: string; name?: string }[];
  entities?: { id: string; kind?: string; typeId?: string }[];
  items?: { id: string; kind?: string; typeId?: string }[];
  blocks?: { id: string; kind?: string }[];
  lastEmit?: {
    path: string;
    payload?: unknown;
    result?: unknown;
    at?: number;
  } | null;
  lastCall?: {
    id: string;
    method: string;
    result?: unknown;
    at?: number;
  } | null;
};

export type AssertTargetSnap = ExprRefSnap;

export type AssertEvalContext = {
  /** 字符串行或结构化事件（优先结构化，便于 recentN / level / source） */
  logs: string[] | StructuredLogEvent[];
  scene: AssertScene;
  /** prop 断言用：已 inspect 的目标；缺失则失败 */
  target?: AssertTargetSnap | null;
  /** 表达式 $id.prop 用的对象表 */
  refs?: Record<string, AssertTargetSnap>;
  /**
   * Call 节点具名返回值袋（outName → 值）。@out.<name>[.prop] 求值时使用。
   * 不传则 @out.* 永远报错「尚无记录」，与旧行为兼容。
   */
  out?: Record<string, unknown>;
  /**
   * 模块入口 source map：symbol → (file, line, column)。
   * 断言失败时若能定位到 module symbol（DESCRIPTOR / @cmd.<name> / 具名 export），
   * 把 location 写进 AssertResult.location，让 UI ⓘ 可跳转。
   * 可选；缺省时按空 Map 处理，不影响既有断言行为。
   */
  sourceMap?: Map<string, { file: string; line: number; column?: number }>;
  /**
   * 关联的 Call 节点上下文：失败断言若是某次 Call 的产物断言，
   * 把 lastCall.id / lastCall.method 透传，evaluateAssert 据此反查 sourceMap。
   */
  callContext?: { id?: string; method?: string };
};

export type AssertResult = { ok: boolean; message: string; location?: { file: string; line: number; column?: number } };

const ASSERT_KIND_LABEL: Record<AssertKind, string> = {
  log: "断言·日志包含",
  logNot: "断言·日志不含",
  sceneExists: "断言·场景存在",
  prop: "断言·属性",
  count: "断言·计数",
  lastEmit: "断言·上次 Emit",
  lastCall: "断言·上次 Call",
};

const ASSERT_TITLE: Record<AssertKind, string> = {
  log: "日志包含",
  logNot: "日志不含",
  sceneExists: "场景存在",
  prop: "属性",
  count: "计数",
  lastEmit: "上次 Emit",
  lastCall: "上次 Call",
};

export function normalizeAssertKind(raw: unknown): AssertKind {
  const k = String(raw ?? "");
  if (
    k === "log" ||
    k === "logNot" ||
    k === "sceneExists" ||
    k === "prop" ||
    k === "count" ||
    k === "lastEmit" ||
    k === "lastCall"
  ) {
    return k;
  }
  return "log";
}

/** 旧剧本：无 assertKind 时默认 log，保留 pattern */
export function migrateAssertConfig(data: AssertConfig & { detail?: string }): AssertConfig {
  const assertKind = data.assertKind ? normalizeAssertKind(data.assertKind) : "log";
  return {
    ...data,
    assertKind,
    pattern: data.pattern ?? (assertKind === "log" || assertKind === "logNot" ? data.detail : data.pattern),
  };
}

export function assertKindLabel(kind: AssertKind): string {
  return ASSERT_KIND_LABEL[kind];
}

export function assertTitle(kind: AssertKind): string {
  return ASSERT_TITLE[kind];
}

export function formatAssertDetail(cfg: AssertConfig): string {
  const kind = normalizeAssertKind(cfg.assertKind);
  switch (kind) {
    case "log":
    case "logNot": {
      const p = (cfg.pattern ?? "").trim() || "（空=通过）";
      const bits = [p];
      if (cfg.ignoreCase) bits.push("忽略大小写");
      if (cfg.logRecentN != null && cfg.logRecentN > 0) bits.push(`近${cfg.logRecentN}条`);
      if (cfg.logMinLevel) bits.push(`≥${cfg.logMinLevel}`);
      if (cfg.logSource?.trim()) bits.push(`src=${cfg.logSource.trim()}`);
      return bits.join(" · ");
    }
    case "sceneExists": {
      const parts = [cfg.targetKind || "任意 kind"];
      if (cfg.targetId) parts.push(`id=${cfg.targetId}`);
      if (cfg.targetName) parts.push(`name=${cfg.targetName}`);
      return parts.join(" · ");
    }
    case "prop": {
      const id = cfg.targetId || "?";
      const prop = cfg.propName || "?";
      const mode = cfg.matchMode ?? "equals";
      return `${id}.${prop} ${mode} ${cfg.expected ?? ""}`;
    }
    case "count": {
      const op = cfg.countOp ?? "eq";
      const sym = op === "gte" ? "≥" : op === "lte" ? "≤" : "=";
      const kindLabel = normalizeTargetKind(cfg.targetKind) || "实例(Player/Entity/Item/Block)";
      const name = cfg.targetName ? ` · ${cfg.targetName}` : "";
      return `${kindLabel}${name} ${sym} ${cfg.countN ?? 0}`;
    }
    case "lastEmit": {
      if (cfg.propName) return `${cfg.propName} ${cfg.matchMode ?? "equals"} ${cfg.expected ?? ""}`;
      return `~ ${cfg.pattern ?? ""}`;
    }
    case "lastCall": {
      if (cfg.propName) return `${cfg.propName} ${cfg.matchMode ?? "equals"} ${cfg.expected ?? ""}`;
      return `${cfg.pattern ?? ""}`;
    }
    default:
      return cfg.pattern ?? "";
  }
}

export type AssertLogMatchOpts = {
  ignoreCase?: boolean;
  negate?: boolean;
  recentN?: number;
  minLevel?: StructuredLogLevel;
  source?: string;
  runId?: number;
};

function resolveLogTexts(
  logs: string[] | StructuredLogEvent[],
  opts?: AssertLogMatchOpts
): string[] {
  if (logs.length > 0 && isStructuredLogEvent(logs[0])) {
    return selectLogTexts(logs as StructuredLogEvent[], {
      recentN: opts?.recentN,
      minLevel: opts?.minLevel,
      source: opts?.source,
      runId: opts?.runId,
    });
  }
  let lines = logs as string[];
  if (opts?.recentN != null && opts.recentN > 0 && lines.length > opts.recentN) {
    lines = lines.slice(lines.length - opts.recentN);
  }
  return lines;
}

/** 日志子串 / 正则匹配（/pattern/flags）；ignoreCase 叠加 i；可筛 recentN / level / source */
export function assertLogMatch(
  logs: string[] | StructuredLogEvent[],
  pattern: string,
  opts?: AssertLogMatchOpts
): boolean {
  const ignoreCase = Boolean(opts?.ignoreCase);
  const negate = Boolean(opts?.negate);
  const lines = resolveLogTexts(logs, opts);
  const raw = pattern.trim();
  if (!raw) {
    return negate ? false : true;
  }
  let re: RegExp;
  if (raw.startsWith("/") && raw.lastIndexOf("/") > 0) {
    const last = raw.lastIndexOf("/");
    try {
      let flags = raw.slice(last + 1);
      if (ignoreCase && !flags.includes("i")) flags += "i";
      re = new RegExp(raw.slice(1, last), flags);
    } catch {
      const hit = lines.some((l) =>
        ignoreCase ? l.toLowerCase().includes(raw.toLowerCase()) : l.includes(raw)
      );
      return negate ? !hit : hit;
    }
  } else {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(escaped, ignoreCase ? "i" : "");
  }
  const hit = lines.some((l) => re.test(l));
  return negate ? !hit : hit;
}

function matchText(actual: string, expected: string, mode: AssertMatchMode, ignoreCase: boolean): boolean {
  const a = ignoreCase ? actual.toLowerCase() : actual;
  const e = ignoreCase ? expected.toLowerCase() : expected;
  if (mode === "contains") return a.includes(e);
  if (mode === "regex") {
    try {
      return new RegExp(expected, ignoreCase ? "i" : "").test(actual);
    } catch {
      return false;
    }
  }
  return a === e;
}

export function valueAsString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/**
 * 纯函数：把 expected 字段按表达式解析。与 evaluateAssert 内部用同一解析器（expr.ts）。
 * 失败时返回 `{ ok: false, error }`，方便 UI（<ExprField>）在失焦时直接展示给作者。
 * 不做副作用、不读 cfg，符合单测要求。
 */
export function parseExpr(
  raw: string,
  ctx: AssertEvalContext
): { ok: true; value: unknown } | { ok: false; error: string } {
  return resolveExpr(raw, { scene: ctx.scene, refs: ctx.refs, out: ctx.out });
}

function resolveExpected(
  raw: string,
  ctx: AssertEvalContext
): { ok: true; value: unknown } | { ok: false; message: string } {
  const r = parseExpr(raw, ctx);
  if (!r.ok) return { ok: false, message: r.error };
  return { ok: true, value: r.value };
}

/** 摘要一段 JSON / 字符串，供失败 message 末尾追加「最近一次 emit/call 概要」 */
function briefValue(v: unknown, max = 80): string {
  const s = valueAsString(v);
  if (!s) return "(空)";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** 取最近的 N 条日志文本（不应用 recentN / level / source 过滤；用于失败 message 附件） */
function pickRecentLogTexts(logs: string[] | StructuredLogEvent[], n: number): string[] {
  if (n <= 0) return [];
  const texts = resolveLogTexts(logs, { recentN: n });
  return texts.slice(Math.max(0, texts.length - n));
}

/** expected 期望类型（与 metaForm/expectedMeta.ts 的 ExpectedMetaType 对齐；命名空间独立便于 Node 端 import） */
export type ExpectedLiteralType = "string" | "number" | "boolean" | "vector3" | "enum";

/** 把 expected 字符串按指定类型反序列化；表达式（$ / @ 前缀）原样返回字符串。 */
export function parseExpected(
  raw: string,
  meta: { type: ExpectedLiteralType; enumValues?: readonly string[] }
): { ok: true; value: unknown } | { ok: false; error: string } {
  const s = (raw ?? "").trim();
  // 表达式（$ / @）原样串返；evaluateAssert 的 resolveExpr 会处理
  if (s.startsWith("$") || s.startsWith("@")) {
    return { ok: true, value: raw };
  }
  if (meta.type === "string") {
    return { ok: true, value: raw };
  }
  if (meta.type === "vector3") {
    if (!s) return { ok: false, error: "vector3: 期望值不能为空" };
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length >= 3) {
        return {
          ok: true,
          value: {
            x: Number(arr[0]) || 0,
            y: Number(arr[1]) || 0,
            z: Number(arr[2]) || 0,
          },
        };
      }
    } catch {
      const parts = s.split(",").map((p) => Number(p.trim()));
      if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
        return { ok: true, value: { x: parts[0]!, y: parts[1]!, z: parts[2]! } };
      }
    }
    return { ok: false, error: `vector3: 无法解析「${raw}」（期望 [x,y,z] 或 x,y,z）` };
  }
  if (meta.type === "boolean") {
    if (s === "true" || s === "1") return { ok: true, value: true };
    if (s === "false" || s === "0") return { ok: true, value: false };
    return { ok: false, error: `boolean: 无法解析「${raw}」（期望 true/false）` };
  }
  if (meta.type === "number") {
    const n = Number(s);
    if (s === "" || !Number.isFinite(n)) {
      return { ok: false, error: `number: 无法解析「${raw}」` };
    }
    return { ok: true, value: n };
  }
  if (meta.type === "enum") {
    if (!s) return { ok: false, error: "enum: 期望值不能为空" };
    const values = meta.enumValues ?? [];
    if (values.length && !values.includes(s)) {
      return { ok: false, error: `enum: ${s} 不在候选值 [${values.join(", ")}] 中` };
    }
    return { ok: true, value: s };
  }
  return { ok: true, value: raw };
}

type SceneRow = { id: string; kind: string; name?: string; typeId?: string; dimensionId?: string };

/** 可构造实例（不含沙箱天生 World / Dimension） */
export const INSTANCE_SCENE_KINDS = ["Player", "Entity", "ItemStack", "Block", "Scoreboard"] as const;

/** scene.summary 字段名 / 大小写 → 规范 kind */
const TARGET_KIND_ALIASES: Record<string, string> = {
  world: "World",
  dimension: "Dimension",
  dimensions: "Dimension",
  scoreboard: "Scoreboard",
  player: "Player",
  players: "Player",
  entity: "Entity",
  entities: "Entity",
  item: "ItemStack",
  items: "ItemStack",
  itemstack: "ItemStack",
  block: "Block",
  blocks: "Block",
};

/** 把 UI / 旧剧本里的 players、player 等归一成 Player */
export function normalizeTargetKind(raw: string | undefined | null): string | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const aliased = TARGET_KIND_ALIASES[s.toLowerCase()];
  if (aliased) return aliased;
  // 已是规范 PascalCase（World / Player…）则原样；其余保留以便匹配自定义 kind
  return s;
}

function flattenScene(scene: AssertScene): SceneRow[] {
  const rows: SceneRow[] = [];
  if (scene.world) rows.push({ id: scene.world.id, kind: scene.world.kind ?? "World" });
  if (scene.scoreboard) {
    rows.push({ id: scene.scoreboard.id, kind: scene.scoreboard.kind ?? "Scoreboard" });
  }
  for (const d of scene.dimensions ?? []) {
    rows.push({
      id: d.id,
      kind: d.kind ?? "Dimension",
      dimensionId: d.dimensionId,
      name: d.dimensionId,
    });
  }
  for (const p of scene.players ?? []) {
    rows.push({ id: p.id, kind: p.kind ?? "Player", name: p.name });
  }
  for (const e of scene.entities ?? []) {
    rows.push({ id: e.id, kind: e.kind ?? "Entity", typeId: e.typeId, name: e.typeId });
  }
  for (const i of scene.items ?? []) {
    rows.push({ id: i.id, kind: i.kind ?? "ItemStack", typeId: i.typeId, name: i.typeId });
  }
  for (const b of scene.blocks ?? []) {
    rows.push({ id: b.id, kind: b.kind ?? "Block" });
  }
  return rows;
}

function filterSceneRows(scene: AssertScene, cfg: AssertConfig): SceneRow[] {
  let rows = flattenScene(scene);
  const kind = normalizeTargetKind(cfg.targetKind);
  if (kind) {
    rows = rows.filter((r) => r.kind === kind);
  }
  if (cfg.targetId) {
    rows = rows.filter((r) => r.id === cfg.targetId);
  }
  if (cfg.targetName) {
    const want = cfg.targetName;
    rows = rows.filter(
      (r) => r.name === want || r.typeId === want || r.dimensionId === want || r.id === want
    );
  }
  return rows;
}

/** 计数：必须指定 kind；未指定时不把天生 World/Dim 算进「任意」 */
function filterCountRows(scene: AssertScene, cfg: AssertConfig): SceneRow[] {
  const kind = normalizeTargetKind(cfg.targetKind);
  if (!kind) {
    // 未选 kind：只数可构造实例，避免空场景仍含 World+Dimension 天生对象导致 eq 0 永败
    return flattenScene(scene).filter((r) =>
      (INSTANCE_SCENE_KINDS as readonly string[]).includes(r.kind)
    );
  }
  return filterSceneRows(scene, {
    targetKind: kind,
    targetName: cfg.targetName,
    targetId: undefined,
  });
}

function compareCount(actual: number, op: AssertCountOp, n: number): boolean {
  if (op === "gte") return actual >= n;
  if (op === "lte") return actual <= n;
  return actual === n;
}

function digBag(root: unknown, path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function compareField(
  actual: unknown,
  expectedRaw: string,
  mode: AssertMatchMode,
  ignoreCase: boolean,
  ctx: AssertEvalContext,
  expectedMeta?: { type: ExpectedLiteralType; enumValues?: readonly string[] } | null
): AssertResult {
  // 表达式路径（$ / @）走 resolveExpr；非表达式按类型反序列化。
  if (looksLikeExpr(expectedRaw)) {
    const resolved = resolveExpected(expectedRaw, ctx);
    if (!resolved.ok) return { ok: false, message: resolved.message };
    const actualStr = valueAsString(actual);
    const expectedStr = valueAsString(resolved.value);
    const ok = matchText(actualStr, expectedStr, mode, ignoreCase);
    return {
      ok,
      message: ok
        ? `字段通过: ${actualStr} ${mode} ${expectedStr}`
        : `字段失败: 实际=${actualStr}，期望(${mode})=${expectedStr}`,
    };
  }
  // 字面量路径：有 expectedMeta 时按类型比较（更严格：vector3 / boolean / enum 直接相等）；
  // 没有 meta 时回退旧的 valueAsString 比较，与老用例兼容。
  if (expectedMeta && expectedMeta.type !== "string") {
    const parsed = parseExpected(expectedRaw, expectedMeta);
    if (!parsed.ok) return { ok: false, message: parsed.error };
    const expected = parsed.value as unknown;
    const ok = literalEqual(actual, expected, expectedMeta.type);
    const actualStr = valueAsString(actual);
    const expectedStr = valueAsString(expected);
    return {
      ok,
      message: ok
        ? `字段通过: ${actualStr} ${mode} ${expectedStr}`
        : `字段失败: 实际=${actualStr}，期望(${mode})=${expectedStr}`,
    };
  }
  const resolved = resolveExpected(expectedRaw, ctx);
  if (!resolved.ok) return { ok: false, message: resolved.message };
  const actualStr = valueAsString(actual);
  const expectedStr = valueAsString(resolved.value);
  const ok = matchText(actualStr, expectedStr, mode, ignoreCase);
  return {
    ok,
    message: ok
      ? `字段通过: ${actualStr} ${mode} ${expectedStr}`
      : `字段失败: 实际=${actualStr}，期望(${mode})=${expectedStr}`,
  };
}

/** 字面量按类型等价比较；类型不匹配（actual 形状错）按不等处理。 */
function literalEqual(actual: unknown, expected: unknown, type: ExpectedLiteralType): boolean {
  if (type === "vector3") {
    if (!actual || typeof actual !== "object") return false;
    const a = actual as { x?: number; y?: number; z?: number };
    const e = expected as { x?: number; y?: number; z?: number };
    return (a.x ?? 0) === (e.x ?? 0) && (a.y ?? 0) === (e.y ?? 0) && (a.z ?? 0) === (e.z ?? 0);
  }
  if (type === "boolean") {
    return Boolean(actual) === Boolean(expected);
  }
  if (type === "number") {
    return Number(actual) === Number(expected);
  }
  if (type === "enum") {
    return String(actual ?? "") === String(expected ?? "");
  }
  // string：equals 严格相等；contains / regex 留 matchText 处理
  return valueAsString(actual) === valueAsString(expected);
}

export function evaluateAssert(cfg: AssertConfig, ctx: AssertEvalContext): AssertResult {
  const kind = normalizeAssertKind(cfg.assertKind);
  let result: AssertResult;
  switch (kind) {
    case "log":
    case "logNot": {
      const pattern = cfg.pattern ?? "";
      const ok = assertLogMatch(ctx.logs, pattern, {
        ignoreCase: cfg.ignoreCase,
        negate: kind === "logNot",
        recentN: cfg.logRecentN,
        minLevel: cfg.logMinLevel,
        source: cfg.logSource,
      });
      if (ok) {
        result = {
          ok,
          message: `日志${kind === "logNot" ? "不含" : "包含"}: ${pattern || "（空）"}`,
        };
        break;
      }
      // 失败：附加最近 N 条日志摘要；缺省 3 条，可由 logRecentN 字段调整
      const hintN = Math.max(1, cfg.logRecentN ?? 3);
      const recent = pickRecentLogTexts(ctx.logs, hintN);
      const tail = recent.length > 0 ? ` · 最近日志: ${recent.map((s) => `«${s}»`).join(" ")}` : " · 日志缓冲为空";
      result = {
        ok,
        message: `日志${kind === "logNot" ? "仍含" : "未匹配"}: ${pattern || "（空）"}${tail}`,
      };
      break;
    }
    case "sceneExists": {
      const hits = filterSceneRows(ctx.scene, cfg);
      const ok = hits.length > 0;
      const desc = formatAssertDetail({ ...cfg, assertKind: kind });
      result = {
        ok,
        message: ok ? `场景存在: ${desc}（${hits.length}）` : `场景不存在: ${desc}`,
      };
      break;
    }
    case "count": {
      const hits = filterCountRows(ctx.scene, cfg);
      const op = cfg.countOp ?? "eq";
      const n = typeof cfg.countN === "number" && Number.isFinite(cfg.countN) ? cfg.countN : 0;
      const ok = compareCount(hits.length, op, n);
      const sym = op === "gte" ? "≥" : op === "lte" ? "≤" : "=";
      const kindLabel = normalizeTargetKind(cfg.targetKind) || "实例";
      if (ok) {
        result = {
          ok,
          message: `计数通过: ${kindLabel} ${hits.length} ${sym} ${n}`,
        };
        break;
      }
      // 失败：附加「实际数量 / 场景中所有 N」便于作者对比
      const allRows = flattenScene(ctx.scene);
      const kindCount = kindLabel
        ? allRows.filter((r) => r.kind === kindLabel).length
        : allRows.filter((r) => (INSTANCE_SCENE_KINDS as readonly string[]).includes(r.kind)).length;
      const tail = ` · ${kindLabel} 实际 ${hits.length}（场景中共 ${kindCount}）`;
      result = {
        ok,
        message: `计数失败: ${kindLabel} 实际 ${hits.length}，期望 ${sym} ${n}${tail}`,
      };
      break;
    }
    case "prop": {
      const target = ctx.target;
      if (!target) {
        const tail = cfg.targetId
          ? ` · 可用 id: ${Object.keys(ctx.refs ?? {}).join(", ") || "（未 inspect）"}`
          : " · 未选目标";
        result = { ok: false, message: `属性断言: 找不到目标 ${cfg.targetId || "（未选）"}${tail}` };
        break;
      }
      const prop = cfg.propName ?? "";
      if (!prop) {
        result = { ok: false, message: "属性断言: 未指定属性名" };
        break;
      }
      const actual = target.props[prop];
      const expectedRaw = cfg.expected ?? "";
      const mode = cfg.matchMode ?? "equals";
      const cmp = compareField(actual, expectedRaw, mode, Boolean(cfg.ignoreCase), {
        ...ctx,
        refs: {
          ...(ctx.refs ?? {}),
          [target.id]: target,
        },
      });
      if (!cmp.ok && looksLikeExpr(expectedRaw)) {
        result = cmp;
        break;
      }
      if (cmp.ok) {
        result = {
          ok: cmp.ok,
          message: `属性通过: ${target.id}.${prop}=${valueAsString(actual)}`,
        };
        break;
      }
      // 失败：把实际值附加在 message 里，便于作者定位
      result = {
        ok: cmp.ok,
        message: `属性失败: ${target.id}.${prop}=${valueAsString(actual)}，期望(${mode}) ${expectedRaw}`,
      };
      break;
    }
    case "lastEmit": {
      const last = ctx.scene.lastEmit;
      if (!last?.path) {
        result = { ok: false, message: "上次 Emit: 尚无记录" };
        break;
      }
      if (cfg.propName) {
        const path = cfg.propName.split(".").filter(Boolean);
        const actual = path[0] === "path" && path.length === 1
          ? last.path
          : digBag(last, path);
        const cmp = compareField(
          actual,
          cfg.expected ?? "",
          cfg.matchMode ?? "equals",
          Boolean(cfg.ignoreCase),
          ctx
        );
        if (cmp.ok) {
          result = {
            ok: cmp.ok,
            message: `上次 Emit.${cfg.propName} 通过`,
          };
          break;
        }
        result = {
          ok: cmp.ok,
          message: `上次 Emit.${cfg.propName} 失败: 实际=${briefValue(actual)}，期望(${cfg.matchMode ?? "equals"}) ${cfg.expected ?? ""} · ${last.path}`,
        };
        break;
      }
      const pattern = (cfg.pattern ?? "").trim();
      const hay = [
        last.path,
        valueAsString(last.payload),
        valueAsString(last.result),
      ];
      if (!pattern) {
        result = { ok: true, message: `上次 Emit: ${last.path}` };
        break;
      }
      const ok = assertLogMatch(hay, pattern, { ignoreCase: cfg.ignoreCase });
      if (ok) {
        result = {
          ok,
          message: `上次 Emit 匹配: ${last.path}`,
        };
        break;
      }
      // 失败：附 path + payload + result 摘要
      const tail = ` · ${last.path} · payload=${briefValue(last?.payload)} · result=${briefValue(last?.result)}`;
      result = {
        ok,
        message: `上次 Emit 不匹配: path/payload/result !~ ${pattern}${tail}`,
      };
      break;
    }
    case "lastCall": {
      const last = ctx.scene.lastCall;
      if (!last) {
        result = { ok: false, message: "上次 Call: 尚无记录" };
        break;
      }
      if (cfg.propName) {
        const path = cfg.propName.split(".").filter(Boolean);
        const actual = digBag(last, path);
        const cmp = compareField(
          actual,
          cfg.expected ?? "",
          cfg.matchMode ?? "equals",
          Boolean(cfg.ignoreCase),
          ctx
        );
        if (cmp.ok) {
          result = {
            ok: cmp.ok,
            message: `上次 Call.${cfg.propName} 通过`,
          };
          break;
        }
        result = {
          ok: cmp.ok,
          message: `上次 Call.${cfg.propName} 失败: 实际=${briefValue(actual)}，期望(${cfg.matchMode ?? "equals"}) ${cfg.expected ?? ""} · ${last.id}.${last.method}`,
        };
        break;
      }
      const hay = [
        `${last.id}.${last.method}`,
        valueAsString(last.result),
        last.method,
        last.id,
      ];
      const pattern = (cfg.pattern ?? "").trim();
      if (!pattern) {
        result = { ok: true, message: `上次 Call: ${last.id}.${last.method}` };
        break;
      }
      const ok = assertLogMatch(hay, pattern, { ignoreCase: cfg.ignoreCase });
      if (ok) {
        result = {
          ok,
          message: `上次 Call 匹配: ${last.id}.${last.method}`,
        };
        break;
      }
      const tail = ` · ${last.id}.${last.method} · result=${briefValue(last?.result)}`;
      result = {
        ok,
        message: `上次 Call 不匹配: ${last.id}.${last.method} !~ ${pattern}${tail}`,
      };
      break;
    }
    default:
      result = { ok: false, message: `未知断言类型: ${String(kind)}` };
  }
  // 失败时尝试把 source map 命中写到 result.location，便于 UI ⓘ 跳转到模块源码。
  if (!result.ok) attachLocation(result, ctx);
  return result;
}

/**
 * 失败结果附加 source location：
 * - lastCall 断言：按 ctx.callContext.id / lastCall.method 反查 sourceMap（先看 @cmd.<method>，
 *   再看 @cmd.<id>，都没有则回退 DESCRIPTOR）；
 * - log / lastEmit 断言：回退 ctx.callContext.method（一次 Call 触发的日志链）；
 * - 其他断言：ctx.callContext.id 作为最后兜底。
 * 缺 sourceMap / 无匹配则原样返回，UI 仍只显示 message。
 */
function attachLocation(result: AssertResult, ctx: AssertEvalContext): void {
  const sm = ctx.sourceMap;
  if (!sm || sm.size === 0) return;
  const cc = ctx.callContext ?? {};
  const candidates: string[] = [];
  if (cc.method) candidates.push(`@cmd.${cc.method}`, cc.method);
  if (cc.id) candidates.push(`@cmd.${cc.id}`, cc.id);
  candidates.push("DESCRIPTOR");
  for (const key of candidates) {
    const loc = sm.get(key);
    if (loc) {
      result.location = { file: loc.file, line: loc.line, column: loc.column };
      return;
    }
  }
}

/** 运行前需 inspect 的对象 id（目标 + expected 表达式） */
export function assertInspectIds(cfg: AssertConfig): string[] {
  const ids = new Set<string>();
  if (cfg.targetId) ids.add(cfg.targetId);
  for (const id of collectExprObjectIds(cfg.expected ?? "")) ids.add(id);
  return [...ids];
}

export const ASSERT_KIND_OPTIONS: { value: AssertKind; label: string }[] = [
  { value: "log", label: "日志包含" },
  { value: "logNot", label: "日志不含" },
  { value: "sceneExists", label: "场景存在" },
  { value: "prop", label: "属性" },
  { value: "count", label: "计数" },
  { value: "lastEmit", label: "上次 Emit" },
  { value: "lastCall", label: "上次 Call" },
];

export const SCENE_KIND_OPTIONS = [
  "World",
  "Dimension",
  "Scoreboard",
  "Player",
  "Entity",
  "ItemStack",
  "Block",
] as const;

/** 侧栏 kind 下拉：规范选项 ∪ 当前场景已有 kind */
export function sceneKindSelectOptions(scene: AssertScene | null | undefined): string[] {
  const set = new Set<string>(SCENE_KIND_OPTIONS);
  if (scene) {
    for (const r of flattenScene(scene)) set.add(r.kind);
  }
  return [...set];
}

export { collectExprObjectIds, looksLikeExpr, resolveExpr };
