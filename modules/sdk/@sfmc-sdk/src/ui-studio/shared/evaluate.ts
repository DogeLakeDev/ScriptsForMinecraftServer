/**
 * ui-studio/shared/evaluate.ts — 声明式 UI 模板与表达式求值器（平台无关）。
 *
 * 语义与 gui 模块 Runtime（declarative.ts）保持一致：
 * - 完全由单个绑定组成的模板字符串保留原值类型；混合文本统一转为字符串；
 * - 表达式仅支持白名单操作符，不使用 eval / Function；
 * - readPath 支持数组的 .length 读取。
 *
 * 注意：gui 模块收编进平台 SDK 后，Runtime 应改为复用本实现，
 * 保证「编辑器、CLI、Runtime 同一份语义」（唯一可信源）。
 */

import type { UiExpression } from "../../contracts/ui-document.js";

/** 求值作用域：player / params / data / state / derived / result 与 each 别名。 */
export type UiEvaluateScope = Record<string, unknown>;

/** 匹配「整串即单个绑定」的模板，如 "{{state.renewYears}}"。 */
const EXACT_BINDING =
  /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}$/;

/** 匹配文本中的内联绑定。 */
const BINDING =
  /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 与 Runtime 一致的空值文本化：null/undefined → 空串。 */
export function toDisplayText(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

/** 按点分路径读取作用域；路径中断或遇原始值时返回 undefined。 */
export function readPath(scope: UiEvaluateScope, reference: string): unknown {
  let current: unknown = scope;
  for (const part of reference.split(".")) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current) && part === "length") {
      current = current.length;
      continue;
    }
    if (!isObject(current) && !Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

/**
 * 解析模板字符串。
 * 整串为单个绑定时返回原值（保留类型，供 service input 传数字/布尔）；
 * 否则做文本替换，空值替换为空串。
 */
export function resolveTemplate(value: string, scope: UiEvaluateScope): unknown {
  const exact = EXACT_BINDING.exec(value);
  if (exact?.[1]) return readPath(scope, exact[1]);
  return value.replace(BINDING, (_whole, reference: string) =>
    toDisplayText(readPath(scope, reference)),
  );
}

/** 解析模板字符串并强制文本化（展示场景使用）。 */
export function resolveTemplateText(value: string, scope: UiEvaluateScope): string {
  return toDisplayText(resolveTemplate(value, scope));
}

/** 递归解析任意 JSON 值中的模板字符串（service input 等场景）。 */
export function resolveTemplateJson(value: unknown, scope: UiEvaluateScope): unknown {
  if (typeof value === "string") return resolveTemplate(value, scope);
  if (Array.isArray(value)) return value.map((item) => resolveTemplateJson(item, scope));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, resolveTemplateJson(item, scope)]),
    );
  }
  return value;
}

/** 求值表达式 AST；无法识别的形状返回 false（失败关闭，不猜测意图）。 */
export function evaluateExpression(value: unknown, scope: UiEvaluateScope): unknown {
  if (!isObject(value)) return false;
  if ("value" in value) return value.value;
  if (typeof value.ref === "string") return readPath(scope, value.ref);
  const args = Array.isArray(value.args)
    ? (value.args as UiExpression[]).map((item) => evaluateExpression(item, scope))
    : [];
  switch (value.op) {
    case "equals":
      return args[0] === args[1];
    case "notEquals":
      return args[0] !== args[1];
    case "greaterThan":
      return Number(args[0]) > Number(args[1]);
    case "greaterThanOrEqual":
      return Number(args[0]) >= Number(args[1]);
    case "lessThan":
      return Number(args[0]) < Number(args[1]);
    case "lessThanOrEqual":
      return Number(args[0]) <= Number(args[1]);
    case "and":
      return args.every(Boolean);
    case "or":
      return args.some(Boolean);
    case "not":
      return !args[0];
    case "add":
      return args.reduce<number>((sum, item) => sum + Number(item), 0);
    case "subtract":
      return Number(args[0]) - Number(args[1]);
    case "multiply":
      return args.reduce<number>((result, item) => result * Number(item), 1);
    case "divide":
      return Number(args[0]) / Number(args[1]);
    case "coalesce":
      return args.find((item) => item !== null && item !== undefined);
    case "contains":
      return Array.isArray(args[0])
        ? args[0].includes(args[1])
        : toDisplayText(args[0]).includes(toDisplayText(args[1]));
    default:
      return false;
  }
}

/** 求值布尔语义条件（visibleWhen / disabledWhen / when.condition）。 */
export function evaluateCondition(value: unknown, scope: UiEvaluateScope): boolean {
  return Boolean(evaluateExpression(value, scope));
}
