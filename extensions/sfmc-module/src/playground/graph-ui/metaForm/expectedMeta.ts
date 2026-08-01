/**
 * 断言 expected 字段的类型推断与序列化：
 * - 控件 ↔ 字符串双向同步：assert.ts 的 `expected` 仍是 string，但 UI 层把它收成
 *   控件（string 文本框 / number / boolean checkbox / vector3 X·Y·Z / enum 下拉）。
 * - 序列化约定（与 assert.ts 的 parseExpected 对称）：
 *     vector3  → '[x,y,z]'  （JSON 数字数组）
 *     boolean  → 'true' | 'false'
 *     enum     → 枚举值字符串
 *     number   → 数字字符串
 *     string   → 原样
 * - 表达式（$ / @ 前缀）整段当字面量串保留；parseExpected 不会去解释。
 */

import { getEnumMembers } from "./enums.generated.ts";
import type { PlaygroundMeta } from "../metaForm";

export type ExpectedMetaType = "string" | "number" | "boolean" | "vector3" | "enum";

export type ExpectedMeta = {
  type: ExpectedMetaType;
  /** enum 时携带候选值；其余类型为空数组 */
  enumValues: readonly string[];
  /**
   * 解析失败的提示；类型 = string 时也可能在内部留下「兜底」标记，
   * 供 UI 决定是否露出「写表达式」面板。
   */
  fallback: boolean;
};

const EMPTY_META: ExpectedMeta = { type: "string", enumValues: [], fallback: true };

function looksLikeRefPath(p: string): boolean {
  // 不强求完整 $id.prop；只要能解析 propName 就能拿到类型。
  return p.trim().length > 0;
}

function splitPropName(propName: string): { className: string; propName: string } | null {
  const s = propName.trim();
  if (!s) return null;
  const dot = s.indexOf(".");
  if (dot < 0) {
    return { className: "", propName: s };
  }
  return { className: s.slice(0, dot), propName: s.slice(dot + 1) };
}

function lookupType(meta: PlaygroundMeta, className: string, propName: string): string | null {
  if (!className) return null;
  const cls = meta.classes[className];
  if (!cls) return null;
  const prop = cls.properties.find((p) => p.name === propName);
  return prop?.type ?? null;
}

function isVector3Type(type: string): boolean {
  if (!type) return false;
  if (type === "Vector3" || type === "minecraftcommon.Vector3") return true;
  if (/^location$/i.test(type)) return true;
  return false;
}

function stripTypeNoise(type: string): string {
  return type.replace(/\s+/g, "").replace(/\[\]$/, "");
}

function isUnionWithEnum(type: string): boolean {
  return stripTypeNoise(type).includes("|");
}

/** 从 PLAYGROUND_META 推断 expected 控件类型；解析不到保守走 string */
export function inferExpectedMeta(
  propNameRaw: string,
  meta: PlaygroundMeta | null
): ExpectedMeta {
  if (!propNameRaw || !looksLikeRefPath(propNameRaw)) return { ...EMPTY_META };
  const split = splitPropName(propNameRaw);
  if (!split) return { ...EMPTY_META };
  // 拿不到 meta：保守回退 string 并标记 fallback，让 UI 决定是否露「写表达式」入口
  if (!meta) return { type: "string", enumValues: [], fallback: true };
  const type = lookupType(meta, split.className, split.propName);
  if (!type) {
    // 拿不到类型——保守回退 string；记 fallback 让 UI 知道
    return { type: "string", enumValues: [], fallback: true };
  }
  if (isVector3Type(type)) {
    return { type: "vector3", enumValues: [], fallback: false };
  }
  if (type === "boolean") {
    return { type: "boolean", enumValues: [], fallback: false };
  }
  if (type === "number") {
    return { type: "number", enumValues: [], fallback: false };
  }
  // 枚举：直接命中或 union 中混入
  if (!isUnionWithEnum(type)) {
    const direct = getEnumMembers(type);
    if (direct) return { type: "enum", enumValues: direct, fallback: false };
  } else {
    for (const part of type.split("|")) {
      const trimmed = part.trim();
      const m = getEnumMembers(trimmed);
      if (m) return { type: "enum", enumValues: m, fallback: false };
    }
  }
  // 复杂对象 / 联合：保守回退 string，避免作者惊讶地看到 vector3 控件
  return { type: "string", enumValues: [], fallback: true };
}

/** 把控件值序列化成 expected 字符串 */
export function formatExpected(meta: ExpectedMeta, value: unknown): string {
  if (meta.type === "vector3") {
    if (!value || typeof value !== "object") return "[0,0,0]";
    const v = value as { x?: number; y?: number; z?: number };
    return JSON.stringify([v.x ?? 0, v.y ?? 0, v.z ?? 0]);
  }
  if (meta.type === "boolean") {
    return value ? "true" : "false";
  }
  if (meta.type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    const n = Number(value);
    return Number.isFinite(n) ? String(n) : "0";
  }
  if (meta.type === "enum") {
    return value == null ? "" : String(value);
  }
  // string
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

/** 把 expected 字符串解析成控件值；解析失败返回 null（让 UI 兜底） */
export function parseExpectedToControl(
  meta: ExpectedMeta,
  raw: string
): { ok: true; value: unknown } | { ok: false } {
  const s = (raw ?? "").trim();
  if (meta.type === "vector3") {
    if (!s) return { ok: true, value: { x: 0, y: 0, z: 0 } };
    try {
      const arr = JSON.parse(s);
      if (Array.isArray(arr) && arr.length >= 3) {
        return {
          ok: true,
          value: { x: Number(arr[0]) || 0, y: Number(arr[1]) || 0, z: Number(arr[2]) || 0 },
        };
      }
    } catch {
      // 兼容旧 "1,2,3" 写法
      const parts = s.split(",").map((p) => Number(p.trim()));
      if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
        return { ok: true, value: { x: parts[0]!, y: parts[1]!, z: parts[2]! } };
      }
    }
    return { ok: false };
  }
  if (meta.type === "boolean") {
    if (s === "true" || s === "false") return { ok: true, value: s === "true" };
    if (s === "1") return { ok: true, value: true };
    if (s === "0") return { ok: true, value: false };
    return { ok: false };
  }
  if (meta.type === "number") {
    if (!s) return { ok: false };
    const n = Number(s);
    return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
  }
  if (meta.type === "enum") {
    if (!s) return { ok: false };
    if (meta.enumValues.includes(s)) return { ok: true, value: s };
    return { ok: false };
  }
  // string 原样
  return { ok: true, value: raw ?? "" };
}
