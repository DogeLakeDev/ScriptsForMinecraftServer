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
  items?: { id: string; kind?: string }[];
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
  logs: string[];
  scene: AssertScene;
  /** prop 断言用：已 inspect 的目标；缺失则失败 */
  target?: AssertTargetSnap | null;
  /** 表达式 $id.prop 用的对象表 */
  refs?: Record<string, AssertTargetSnap>;
};

export type AssertResult = { ok: boolean; message: string };

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
      return cfg.ignoreCase ? `${p} · 忽略大小写` : p;
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
      return `${cfg.targetKind || "?"} ${sym} ${cfg.countN ?? 0}`;
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

/** 日志子串 / 正则匹配（/pattern/flags）；ignoreCase 叠加 i */
export function assertLogMatch(
  logs: string[],
  pattern: string,
  opts?: { ignoreCase?: boolean; negate?: boolean }
): boolean {
  const ignoreCase = Boolean(opts?.ignoreCase);
  const negate = Boolean(opts?.negate);
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
      const hit = logs.some((l) =>
        ignoreCase ? l.toLowerCase().includes(raw.toLowerCase()) : l.includes(raw)
      );
      return negate ? !hit : hit;
    }
  } else {
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(escaped, ignoreCase ? "i" : "");
  }
  const hit = logs.some((l) => re.test(l));
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

function resolveExpected(
  raw: string,
  ctx: AssertEvalContext
): { ok: true; value: unknown } | { ok: false; message: string } {
  const r = resolveExpr(raw, { scene: ctx.scene, refs: ctx.refs });
  if (!r.ok) return { ok: false, message: r.error };
  return { ok: true, value: r.value };
}

type SceneRow = { id: string; kind: string; name?: string; typeId?: string; dimensionId?: string };

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
    rows.push({ id: i.id, kind: i.kind ?? "ItemStack" });
  }
  for (const b of scene.blocks ?? []) {
    rows.push({ id: b.id, kind: b.kind ?? "Block" });
  }
  return rows;
}

function filterSceneRows(scene: AssertScene, cfg: AssertConfig): SceneRow[] {
  let rows = flattenScene(scene);
  if (cfg.targetKind) {
    const k = cfg.targetKind;
    rows = rows.filter((r) => r.kind === k);
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
  ctx: AssertEvalContext
): AssertResult {
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

export function evaluateAssert(cfg: AssertConfig, ctx: AssertEvalContext): AssertResult {
  const kind = normalizeAssertKind(cfg.assertKind);
  switch (kind) {
    case "log":
    case "logNot": {
      const pattern = cfg.pattern ?? "";
      const ok = assertLogMatch(ctx.logs, pattern, {
        ignoreCase: cfg.ignoreCase,
        negate: kind === "logNot",
      });
      return {
        ok,
        message: ok
          ? `日志${kind === "logNot" ? "不含" : "包含"}: ${pattern || "（空）"}`
          : `日志${kind === "logNot" ? "仍含" : "未匹配"}: ${pattern || "（空）"}`,
      };
    }
    case "sceneExists": {
      const hits = filterSceneRows(ctx.scene, cfg);
      const ok = hits.length > 0;
      const desc = formatAssertDetail({ ...cfg, assertKind: kind });
      return {
        ok,
        message: ok ? `场景存在: ${desc}（${hits.length}）` : `场景不存在: ${desc}`,
      };
    }
    case "count": {
      const hits = filterSceneRows(ctx.scene, {
        targetKind: cfg.targetKind,
        targetName: cfg.targetName,
        targetId: undefined,
      });
      const op = cfg.countOp ?? "eq";
      const n = cfg.countN ?? 0;
      const ok = compareCount(hits.length, op, n);
      const sym = op === "gte" ? "≥" : op === "lte" ? "≤" : "=";
      return {
        ok,
        message: ok
          ? `计数通过: ${cfg.targetKind || "?"} ${hits.length} ${sym} ${n}`
          : `计数失败: ${cfg.targetKind || "?"} 实际 ${hits.length}，期望 ${sym} ${n}`,
      };
    }
    case "prop": {
      const target = ctx.target;
      if (!target) {
        return { ok: false, message: `属性断言: 找不到目标 ${cfg.targetId || "（未选）"}` };
      }
      const prop = cfg.propName ?? "";
      if (!prop) return { ok: false, message: "属性断言: 未指定属性名" };
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
      if (!cmp.ok && looksLikeExpr(expectedRaw)) return cmp;
      return {
        ok: cmp.ok,
        message: cmp.ok
          ? `属性通过: ${target.id}.${prop}=${valueAsString(actual)}`
          : `属性失败: ${target.id}.${prop}=${valueAsString(actual)}，期望(${mode}) ${expectedRaw}`,
      };
    }
    case "lastEmit": {
      const last = ctx.scene.lastEmit;
      if (!last?.path) {
        return { ok: false, message: "上次 Emit: 尚无记录" };
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
        return {
          ok: cmp.ok,
          message: cmp.ok
            ? `上次 Emit.${cfg.propName} 通过`
            : `上次 Emit.${cfg.propName} ${cmp.message}`,
        };
      }
      const pattern = (cfg.pattern ?? "").trim();
      const hay = [
        last.path,
        valueAsString(last.payload),
        valueAsString(last.result),
      ];
      if (!pattern) {
        return { ok: true, message: `上次 Emit: ${last.path}` };
      }
      const ok = assertLogMatch(hay, pattern, { ignoreCase: cfg.ignoreCase });
      return {
        ok,
        message: ok
          ? `上次 Emit 匹配: ${last.path}`
          : `上次 Emit 不匹配: path/payload/result !~ ${pattern}`,
      };
    }
    case "lastCall": {
      const last = ctx.scene.lastCall;
      if (!last) {
        return { ok: false, message: "上次 Call: 尚无记录" };
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
        return {
          ok: cmp.ok,
          message: cmp.ok
            ? `上次 Call.${cfg.propName} 通过`
            : `上次 Call.${cfg.propName} ${cmp.message}`,
        };
      }
      const hay = [
        `${last.id}.${last.method}`,
        valueAsString(last.result),
        last.method,
        last.id,
      ];
      const pattern = (cfg.pattern ?? "").trim();
      if (!pattern) {
        return { ok: true, message: `上次 Call: ${last.id}.${last.method}` };
      }
      const ok = assertLogMatch(hay, pattern, { ignoreCase: cfg.ignoreCase });
      return {
        ok,
        message: ok
          ? `上次 Call 匹配: ${last.id}.${last.method}`
          : `上次 Call 不匹配: ${last.id}.${last.method} !~ ${pattern}`,
      };
    }
    default:
      return { ok: false, message: `未知断言类型: ${String(kind)}` };
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

export const SCENE_KIND_OPTIONS = ["World", "Dimension", "Player", "Entity", "ItemStack", "Block"] as const;

export { collectExprObjectIds, looksLikeExpr, resolveExpr };
