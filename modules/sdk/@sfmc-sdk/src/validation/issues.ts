/**
 * validation/issues.ts — 平台级「结构形状」校验诊断内核
 *
 * 供 catalog / config / manifest 等 JSON 形状校验共用：结构化 issue + 统一中文句式。
 * 域名文案（如「manifest 根…」）由调用方传入 rootLabel，不在此写死业务名。
 *
 * 句式约定：
 * - root_not_object：`{rootLabel} 根必须是普通对象`
 * - invalid_type：`{path} 必须是{expected}`
 * - const_mismatch：`{path} 必须为 {expected}，实际为 {actual}`
 * - invalid_item：`{path} 的元素必须是{expected}`
 */

/** 期望形状的规范中文标签（禁止各校验器自造同义词）。 */
export const Expected = {
  /** 非空字符串。 */
  nonEmptyString: "非空字符串",
  /** 纯字符串数组。 */
  stringArray: "字符串数组",
  /** 通用数组。 */
  array: "数组",
  /** 布尔值。 */
  boolean: "布尔值",
  /** 普通对象。 */
  object: "普通对象",
} as const;

/** 期望形状中文标签联合类型。 */
export type ExpectedLabel = (typeof Expected)[keyof typeof Expected];

/**
 * 结构形状问题种类。
 * 新增种类时必须同时扩展 `formatShapeIssue`。
 */
export type ShapeIssueKind =
  /** 根值不是普通对象。 */
  | "root_not_object"
  /** 常量值不符。 */
  | "const_mismatch"
  /** 字段类型不符（含必填缺失、空串等）。 */
  | "invalid_type"
  /** 数组元素类型不符。 */
  | "invalid_item";

/** 单条机器可读的结构校验问题。 */
export type ShapeIssue = {
  /** JSON 属性路径；根对象为空串。 */
  path: string;
  /** 问题种类。 */
  kind: ShapeIssueKind;
  /** 期望类型名或常量描述。 */
  expected?: string;
  /** 实际值简述（主要用于 const_mismatch）。 */
  actual?: string;
};

/** 格式化选项：域名主语。 */
export type FormatShapeIssueOptions = {
  /** 根对象文案主语，如 `manifest` → `manifest 根必须是普通对象`。 */
  rootLabel: string;
};

/** 构造根非普通对象问题。 */
export function issueRootNotObject(): ShapeIssue {
  return { path: "", kind: "root_not_object" };
}

/** 构造常量不匹配问题。 */
export function issueConstMismatch(path: string, expected: string, actual: string): ShapeIssue {
  return { path, kind: "const_mismatch", expected, actual };
}

/** 构造字段类型不符问题。 */
export function issueInvalidType(path: string, expected: ExpectedLabel): ShapeIssue {
  return { path, kind: "invalid_type", expected };
}

/** 构造数组元素类型不符问题。 */
export function issueInvalidItem(path: string, expected: ExpectedLabel): ShapeIssue {
  return { path, kind: "invalid_item", expected };
}

/**
 * 将结构化问题格式化为规范中文。
 *
 * @param issue 结构化问题。
 * @param opts.rootLabel 根对象主语。
 */
export function formatShapeIssue(issue: ShapeIssue, opts: FormatShapeIssueOptions): string {
  switch (issue.kind) {
    case "root_not_object":
      return `${opts.rootLabel} 根必须是普通对象`;
    case "const_mismatch":
      return `${issue.path} 必须为 ${issue.expected}，实际为 ${issue.actual}`;
    case "invalid_type":
      return `${issue.path} 必须是${issue.expected}`;
    case "invalid_item":
      return `${issue.path} 的元素必须是${issue.expected}`;
  }
}

/**
 * 由 issues 派生失败结果（errors 仅由此处格式化，保证文案唯一）。
 *
 * @param issues 结构化问题列表。
 * @param opts 格式化选项。
 */
export function failShapeValidation(
  issues: ShapeIssue[],
  opts: FormatShapeIssueOptions
): { ok: false; errors: string[]; issues: ShapeIssue[] } {
  return {
    ok: false,
    issues,
    errors: issues.map((i) => formatShapeIssue(i, opts)),
  };
}
