/**
 * 元数据 → 控件路由的判定工具。
 * 类型来源：
 * - PLAYGROUND_META.classes（生成器产出）
 * - enums.generated.ts（@minecraft/server export enum 成员）
 * - interfaces.generated.ts（@minecraft/server export interface / type 别名 字段）
 */

import { getEnumMembers } from "./enums.generated.ts";
import { getInterfaceProps, type InterfaceProp } from "./interfaces.generated.ts";

/** 顶层 type 字段（如 "Foo | Bar"）按 ` | ` 拆开。 */
export function splitTypeUnion(type: string): string[] {
  if (!type) return [];
  // 简单拆分：忽略泛型与方括号嵌套，避免把 "Foo<string>" 误拆。
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of type) {
    if ("<{[(".includes(ch)) depth++;
    else if (">}])".includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === "|" && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** 是否 enum 类型（出现在 ENUM_MEMBERS 中，单名或联合中的任一项）。 */
export function isEnumType(type: string): boolean {
  if (!type) return false;
  for (const part of splitTypeUnion(type)) {
    const base = stripArraySuffix(stripNullability(part));
    if (getEnumMembers(base)) return true;
  }
  return false;
}

/** "Foo[]" → "Foo"；"Foo | null" → "Foo"；"Foo | undefined" → "Foo"。 */
export function stripArraySuffix(type: string): string {
  return type.endsWith("[]") ? type.slice(0, -2) : type;
}

export function stripNullability(type: string): string {
  let t = type.trim();
  t = t.replace(/\s*\|\s*null\s*$/, "");
  t = t.replace(/\s*\|\s*undefined\s*$/, "");
  return t.trim();
}

/** 是否是形如 "Foo[]" 的数组（联合里多个备选时取首项判断）。 */
export function isArrayType(type: string): boolean {
  if (!type) return false;
  return type.endsWith("[]");
}

/** 数组元素类型（顶层非 union 写法的 "T[]"）；多 type 联合时返回 null。 */
export function arrayElementType(type: string): string | null {
  if (!isArrayType(type)) return null;
  return stripArraySuffix(type);
}

/** 是否对象/接口（出现在 INTERFACE_MEMBERS 中）。 */
export function isObjectType(type: string): boolean {
  if (!type) return false;
  for (const part of splitTypeUnion(type)) {
    const base = stripArraySuffix(stripNullability(part));
    if (getInterfaceProps(base)) return true;
  }
  return false;
}

/** 对象/接口字段表（多 type 联合时取首个命中的）。 */
export function objectProps(type: string): InterfaceProp[] | null {
  if (!type) return null;
  for (const part of splitTypeUnion(type)) {
    const base = stripArraySuffix(stripNullability(part));
    const props = getInterfaceProps(base);
    if (props) return [...props];
  }
  return null;
}

/** enum 成员表（顶层，命中的首个 union 项）。 */
export function enumMembers(type: string): readonly string[] | null {
  if (!type) return null;
  for (const part of splitTypeUnion(type)) {
    const base = stripArraySuffix(stripNullability(part));
    const m = getEnumMembers(base);
    if (m) return m;
  }
  return null;
}
