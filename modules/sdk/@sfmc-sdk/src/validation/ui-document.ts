/**
 * 声明式 UI 文档的结构与跨文件语义校验。
 *
 * 该校验器只处理纯 JSON 数据，不依赖 Node.js、浏览器或 Minecraft Runtime。
 */

import {
  UI_DOCUMENT_FORMAT_VERSION,
  type UiActionDefinition,
  type UiEffect,
  type UiExpression,
  type UiFeatureDocument,
  type UiNode,
  type UiProject,
  type UiScreenDocument,
  type UiServiceCall,
  type UiTrigger,
} from "../contracts/ui-document.js";

/** 可供编辑器精确定位并高亮的校验问题。 */
export type UiValidationIssueCode =
  | "invalid_type"
  | "invalid_value"
  | "duplicate_id"
  | "unknown_reference"
  | "unknown_action"
  | "unknown_screen"
  | "unknown_service"
  | "unsafe_path"
  | "id_mismatch";

export interface UiValidationIssue {
  /** JSON Pointer 风格路径。 */
  path: string;
  code: UiValidationIssueCode;
  message: string;
}

export type UiValidationResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; errors: string[]; issues: UiValidationIssue[] };

/** feature 与其引用页面组成的待编译工程。screens 以 feature 中的 file 为键。 */
export interface UiProjectInput {
  feature: unknown;
  screens: ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>;
  /** 模块 manifest 声明的 service 名称；提供后会检查全部调用。 */
  services?: Iterable<string>;
}

type JsonObject = Record<string, unknown>;

type ReferenceScope = {
  params: ReadonlySet<string>;
  data: ReadonlySet<string>;
  state: ReadonlySet<string>;
  derived: ReadonlySet<string>;
  aliases: ReadonlySet<string>;
};

const PRESENTATIONS = new Set(["auto", "menu", "form", "reactive"]);
const TONES = new Set(["default", "muted", "accent", "success", "warning", "danger", "primary"]);
const EXPRESSION_OPERATORS = new Set([
  "equals",
  "notEquals",
  "greaterThan",
  "greaterThanOrEqual",
  "lessThan",
  "lessThanOrEqual",
  "and",
  "or",
  "not",
  "add",
  "subtract",
  "multiply",
  "divide",
  "coalesce",
  "contains",
]);
const REFERENCE_ROOTS = new Set(["player", "params", "data", "state", "derived", "result", "item"]);
const TEMPLATE_REFERENCE = /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9]*(?:[._-][A-Za-z0-9]+)*$/;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  issues: UiValidationIssue[],
  path: string,
  code: UiValidationIssueCode,
  message: string
): void {
  issues.push({ path, code, message });
}

function finish<T>(value: T, issues: UiValidationIssue[]): UiValidationResult<T> {
  if (issues.length > 0) {
    return { ok: false, issues, errors: issues.map((item) => `${item.path || "/"}: ${item.message}`) };
  }
  return { ok: true, value, issues: [] };
}

function requireObject(value: unknown, path: string, issues: UiValidationIssue[]): value is JsonObject {
  if (isObject(value)) return true;
  issue(issues, path, "invalid_type", "必须是普通对象");
  return false;
}

function requireString(value: unknown, path: string, issues: UiValidationIssue[]): value is string {
  if (typeof value === "string" && value.length > 0) return true;
  issue(issues, path, "invalid_type", "必须是非空字符串");
  return false;
}

function optionalString(value: unknown, path: string, issues: UiValidationIssue[]): void {
  if (value !== undefined && typeof value !== "string") {
    issue(issues, path, "invalid_type", "必须是字符串");
  }
}

function validateIdentifier(value: unknown, path: string, issues: UiValidationIssue[]): value is string {
  if (!requireString(value, path, issues)) return false;
  if (!IDENTIFIER.test(value)) {
    issue(issues, path, "invalid_value", "只能包含字母、数字、点、短横线和下划线，且必须以字母开头");
    return false;
  }
  return true;
}

function validateVersion(value: unknown, path: string, issues: UiValidationIssue[]): void {
  if (value !== UI_DOCUMENT_FORMAT_VERSION) {
    issue(issues, path, "invalid_value", `目前仅支持版本 ${UI_DOCUMENT_FORMAT_VERSION}`);
  }
}

function objectKeys(value: unknown): Set<string> {
  return new Set(isObject(value) ? Object.keys(value) : []);
}

function childScope(scope: ReferenceScope, alias: string): ReferenceScope {
  return { ...scope, aliases: new Set([...scope.aliases, alias]) };
}

function validateReference(
  reference: string,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): void {
  const [root, key] = reference.split(".");
  if (!root) return;
  if (!REFERENCE_ROOTS.has(root) && !scope.aliases.has(root)) {
    issue(issues, path, "unknown_reference", `未知的数据根 ${root}`);
    return;
  }
  const collections: Record<string, ReadonlySet<string>> = {
    params: scope.params,
    data: scope.data,
    state: scope.state,
    derived: scope.derived,
  };
  const collection = collections[root];
  if (collection && key && !collection.has(key)) {
    issue(issues, path, "unknown_reference", `未声明 ${root}.${key}`);
  }
}

function validateTemplate(
  value: string,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): void {
  for (const match of value.matchAll(TEMPLATE_REFERENCE)) {
    const reference = match[1];
    if (reference) validateReference(reference, path, scope, issues);
  }
}

function validateJsonBindings(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): void {
  if (typeof value === "string") {
    validateTemplate(value, path, scope, issues);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateJsonBindings(item, `${path}/${index}`, scope, issues));
    return;
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      validateJsonBindings(item, `${path}/${key}`, scope, issues);
    }
  }
}

function validateExpression(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): value is UiExpression {
  if (!requireObject(value, path, issues)) return false;
  const variants = ["value", "ref", "op"].filter((key) => key in value);
  if (variants.length !== 1) {
    issue(issues, path, "invalid_value", "表达式必须且只能使用 value、ref 或 op 之一");
    return false;
  }
  if ("value" in value) {
    const primitive = value.value;
    if (primitive !== null && !["string", "number", "boolean"].includes(typeof primitive)) {
      issue(issues, `${path}/value`, "invalid_type", "必须是字符串、数字、布尔值或 null");
      return false;
    }
    return true;
  }
  if ("ref" in value) {
    if (!requireString(value.ref, `${path}/ref`, issues)) return false;
    validateReference(value.ref, `${path}/ref`, scope, issues);
    return true;
  }
  if (typeof value.op !== "string" || !EXPRESSION_OPERATORS.has(value.op)) {
    issue(issues, `${path}/op`, "invalid_value", "不是允许的表达式操作符");
  }
  if (!Array.isArray(value.args) || value.args.length === 0) {
    issue(issues, `${path}/args`, "invalid_type", "必须是非空表达式数组");
    return false;
  }
  value.args.forEach((item, index) => validateExpression(item, `${path}/args/${index}`, scope, issues));
  return true;
}

function validateServiceCall(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): value is UiServiceCall {
  if (!requireObject(value, path, issues)) return false;
  requireString(value.service, `${path}/service`, issues);
  if (value.input !== undefined && requireObject(value.input, `${path}/input`, issues)) {
    validateJsonBindings(value.input, `${path}/input`, scope, issues);
  }
  if (
    value.timeoutMs !== undefined &&
    (typeof value.timeoutMs !== "number" || !Number.isFinite(value.timeoutMs) || value.timeoutMs <= 0)
  ) {
    issue(issues, `${path}/timeoutMs`, "invalid_value", "必须是大于 0 的有限数字");
  }
  return true;
}

function validateEffect(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): value is UiEffect {
  if (!requireObject(value, path, issues)) return false;
  if (!requireString(value.effect, `${path}/effect`, issues)) return false;
  switch (value.effect) {
    case "message":
      if (requireString(value.text, `${path}/text`, issues)) validateTemplate(value.text, `${path}/text`, scope, issues);
      if (value.tone !== undefined && (typeof value.tone !== "string" || !TONES.has(value.tone))) {
        issue(issues, `${path}/tone`, "invalid_value", "不是允许的语义色");
      }
      break;
    case "navigate":
    case "replace":
      requireString(value.to, `${path}/to`, issues);
      if (value.params !== undefined && requireObject(value.params, `${path}/params`, issues)) {
        validateJsonBindings(value.params, `${path}/params`, scope, issues);
      }
      break;
    case "setState":
      if (requireObject(value.values, `${path}/values`, issues)) {
        validateJsonBindings(value.values, `${path}/values`, scope, issues);
        for (const key of Object.keys(value.values)) {
          if (!scope.state.has(key)) {
            issue(issues, `${path}/values/${key}`, "unknown_reference", `未声明 state.${key}`);
          }
        }
      }
      break;
    case "back":
    case "refresh":
    case "close":
      break;
    default:
      issue(issues, `${path}/effect`, "invalid_value", "不是允许的页面效果");
  }
  return true;
}

function validateAction(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  issues: UiValidationIssue[]
): value is UiActionDefinition {
  if (!requireObject(value, path, issues)) return false;
  if (value.confirm !== undefined && requireObject(value.confirm, `${path}/confirm`, issues)) {
    requireString(value.confirm.title, `${path}/confirm/title`, issues);
    requireString(value.confirm.body, `${path}/confirm/body`, issues);
    optionalString(value.confirm.confirmText, `${path}/confirm/confirmText`, issues);
    optionalString(value.confirm.cancelText, `${path}/confirm/cancelText`, issues);
    if (value.confirm.danger !== undefined && typeof value.confirm.danger !== "boolean") {
      issue(issues, `${path}/confirm/danger`, "invalid_type", "必须是布尔值");
    }
  }
  validateServiceCall(value.call, `${path}/call`, scope, issues);
  for (const field of ["onSuccess", "onError"] as const) {
    const effects = value[field];
    if (effects === undefined) continue;
    if (!Array.isArray(effects)) {
      issue(issues, `${path}/${field}`, "invalid_type", "必须是效果数组");
      continue;
    }
    effects.forEach((effect, index) => validateEffect(effect, `${path}/${field}/${index}`, scope, issues));
  }
  return true;
}

function validateTrigger(value: unknown, path: string, scope: ReferenceScope, issues: UiValidationIssue[]): value is UiTrigger {
  if (!requireObject(value, path, issues)) return false;
  if (!requireString(value.type, `${path}/type`, issues)) return false;
  switch (value.type) {
    case "action":
      requireString(value.action, `${path}/action`, issues);
      if (value.input !== undefined && requireObject(value.input, `${path}/input`, issues)) {
        validateJsonBindings(value.input, `${path}/input`, scope, issues);
      }
      break;
    case "navigate":
    case "replace":
      requireString(value.to, `${path}/to`, issues);
      if (value.params !== undefined && requireObject(value.params, `${path}/params`, issues)) {
        validateJsonBindings(value.params, `${path}/params`, scope, issues);
      }
      break;
    case "back":
    case "refresh":
    case "close":
      break;
    default:
      issue(issues, `${path}/type`, "invalid_value", "不是允许的按钮触发器");
  }
  return true;
}

function validateBind(value: unknown, path: string, scope: ReferenceScope, issues: UiValidationIssue[]): void {
  if (!requireString(value, path, issues)) return;
  if (!value.startsWith("state.")) {
    issue(issues, path, "invalid_value", "输入组件只能绑定到 state.*");
    return;
  }
  validateReference(value, path, scope, issues);
}

function validateNode(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  nodeIds: Map<string, string>,
  issues: UiValidationIssue[]
): value is UiNode {
  if (!requireObject(value, path, issues)) return false;
  if (validateIdentifier(value.id, `${path}/id`, issues)) {
    const previousPath = nodeIds.get(value.id);
    if (previousPath) {
      issue(issues, `${path}/id`, "duplicate_id", `节点 id 与 ${previousPath} 重复`);
    } else {
      nodeIds.set(value.id, `${path}/id`);
    }
  }
  if (value.visibleWhen !== undefined) validateExpression(value.visibleWhen, `${path}/visibleWhen`, scope, issues);
  if (!requireString(value.type, `${path}/type`, issues)) return false;
  const text = (field: string): void => {
    const item = value[field];
    if (requireString(item, `${path}/${field}`, issues)) validateTemplate(item, `${path}/${field}`, scope, issues);
  };
  const description = (): void => {
    optionalString(value.description, `${path}/description`, issues);
    if (typeof value.description === "string") validateTemplate(value.description, `${path}/description`, scope, issues);
  };
  const tooltip = (): void => {
    optionalString(value.tooltip, `${path}/tooltip`, issues);
    if (typeof value.tooltip === "string") validateTemplate(value.tooltip, `${path}/tooltip`, scope, issues);
  };
  const disabledWhen = (): void => {
    if (value.disabledWhen !== undefined) validateExpression(value.disabledWhen, `${path}/disabledWhen`, scope, issues);
  };
  switch (value.type) {
    case "header":
    case "text":
      text("text");
      break;
    case "info":
      if (!Array.isArray(value.items)) {
        issue(issues, `${path}/items`, "invalid_type", "必须是字符串数组");
      } else {
        value.items.forEach((item, index) => {
          if (requireString(item, `${path}/items/${index}`, issues)) {
            validateTemplate(item, `${path}/items/${index}`, scope, issues);
          }
        });
      }
      break;
    case "image":
      text("source");
      text("pack");
      optionalString(value.alt, `${path}/alt`, issues);
      break;
    case "divider":
      break;
    case "spacer":
      if (value.size !== undefined && !["small", "medium", "large"].includes(String(value.size))) {
        issue(issues, `${path}/size`, "invalid_value", "必须是 small、medium 或 large");
      }
      break;
    case "button":
      text("label");
      description();
      tooltip();
      optionalString(value.icon, `${path}/icon`, issues);
      optionalString(value.iconPack, `${path}/iconPack`, issues);
      if (typeof value.icon === "string" && value.icon.length > 0) {
        if (requireString(value.iconPack, `${path}/iconPack`, issues)) {
          validateTemplate(value.iconPack, `${path}/iconPack`, scope, issues);
        }
        validateTemplate(value.icon, `${path}/icon`, scope, issues);
      }
      disabledWhen();
      validateTrigger(value.trigger, `${path}/trigger`, scope, issues);
      break;
    case "textField":
    case "toggle":
      text("label");
      description();
      tooltip();
      disabledWhen();
      validateBind(value.bind, `${path}/bind`, scope, issues);
      if (value.type === "textField") optionalString(value.placeholder, `${path}/placeholder`, issues);
      break;
    case "dropdown":
      text("label");
      description();
      tooltip();
      disabledWhen();
      validateBind(value.bind, `${path}/bind`, scope, issues);
      if (!Array.isArray(value.options) || value.options.length === 0) {
        issue(issues, `${path}/options`, "invalid_type", "必须是非空选项数组");
      } else {
        value.options.forEach((option, index) => {
          const optionPath = `${path}/options/${index}`;
          if (!requireObject(option, optionPath, issues)) return;
          requireString(option.label, `${optionPath}/label`, issues);
          if (typeof option.value !== "string" && typeof option.value !== "number") {
            issue(issues, `${optionPath}/value`, "invalid_type", "必须是字符串或数字");
          }
        });
      }
      break;
    case "slider":
      text("label");
      description();
      tooltip();
      disabledWhen();
      validateBind(value.bind, `${path}/bind`, scope, issues);
      for (const field of ["min", "max"] as const) {
        if (typeof value[field] !== "number" || !Number.isFinite(value[field])) {
          issue(issues, `${path}/${field}`, "invalid_type", "必须是有限数字");
        }
      }
      if (value.step !== undefined && (typeof value.step !== "number" || value.step <= 0)) {
        issue(issues, `${path}/step`, "invalid_value", "必须是大于 0 的数字");
      }
      break;
    case "when":
      validateExpression(value.condition, `${path}/condition`, scope, issues);
      validateNodeArray(value.content, `${path}/content`, scope, nodeIds, issues);
      break;
    case "each": {
      if (requireString(value.source, `${path}/source`, issues)) validateReference(value.source, `${path}/source`, scope, issues);
      const alias = validateIdentifier(value.as, `${path}/as`, issues) ? value.as : "item";
      const nestedScope = childScope(scope, alias);
      validateNodeArray(value.template, `${path}/template`, nestedScope, nodeIds, issues);
      if (value.empty !== undefined) validateNodeArray(value.empty, `${path}/empty`, scope, nodeIds, issues);
      break;
    }
    default:
      issue(issues, `${path}/type`, "invalid_value", `未知组件类型 ${value.type}`);
  }
  if (value.tone !== undefined && (typeof value.tone !== "string" || !TONES.has(value.tone))) {
    issue(issues, `${path}/tone`, "invalid_value", "不是允许的语义色");
  }
  return true;
}

function validateNodeArray(
  value: unknown,
  path: string,
  scope: ReferenceScope,
  nodeIds: Map<string, string>,
  issues: UiValidationIssue[]
): void {
  if (!Array.isArray(value)) {
    issue(issues, path, "invalid_type", "必须是组件数组");
    return;
  }
  value.forEach((node, index) => validateNode(node, `${path}/${index}`, scope, nodeIds, issues));
}

function validateDefinitions(
  value: unknown,
  path: string,
  kind: "param" | "state",
  issues: UiValidationIssue[]
): void {
  if (value === undefined) return;
  if (!requireObject(value, path, issues)) return;
  for (const [key, definition] of Object.entries(value)) {
    const itemPath = `${path}/${key}`;
    if (!validateIdentifier(key, itemPath, issues) || !requireObject(definition, itemPath, issues)) continue;
    if (!["string", "number", "boolean"].includes(String(definition.type))) {
      issue(issues, `${itemPath}/type`, "invalid_value", "必须是 string、number 或 boolean");
    }
    if (kind === "param" && definition.required !== undefined && typeof definition.required !== "boolean") {
      issue(issues, `${itemPath}/required`, "invalid_type", "必须是布尔值");
    }
    const defaultValue = definition.default;
    if (defaultValue !== undefined && definition.type !== typeof defaultValue) {
      issue(issues, `${itemPath}/default`, "invalid_type", `必须与 ${String(definition.type)} 类型一致`);
    }
  }
}

/** 校验单个页面；成功值与输入共享引用，不进行序列化或字段裁剪。 */
export function validateUiScreen(input: unknown): UiValidationResult<UiScreenDocument> {
  const issues: UiValidationIssue[] = [];
  if (!requireObject(input, "", issues)) return finish(input as UiScreenDocument, issues);
  validateVersion(input.formatVersion, "/formatVersion", issues);
  validateIdentifier(input.id, "/id", issues);
  optionalString(input.name, "/name", issues);
  optionalString(input.notes, "/notes", issues);
  if (typeof input.presentation !== "string" || !PRESENTATIONS.has(input.presentation)) {
    issue(issues, "/presentation", "invalid_value", "必须是 auto、menu、form 或 reactive");
  }
  requireString(input.title, "/title", issues);
  validateDefinitions(input.params, "/params", "param", issues);
  validateDefinitions(input.state, "/state", "state", issues);
  const scope: ReferenceScope = {
    params: objectKeys(input.params),
    data: objectKeys(input.load),
    state: objectKeys(input.state),
    derived: objectKeys(input.derived),
    aliases: new Set(),
  };
  if (typeof input.title === "string") validateTemplate(input.title, "/title", scope, issues);
  if (input.load !== undefined && requireObject(input.load, "/load", issues)) {
    for (const [key, call] of Object.entries(input.load)) {
      validateIdentifier(key, `/load/${key}`, issues);
      validateServiceCall(call, `/load/${key}`, scope, issues);
    }
  }
  if (input.derived !== undefined && requireObject(input.derived, "/derived", issues)) {
    for (const [key, expression] of Object.entries(input.derived)) {
      validateIdentifier(key, `/derived/${key}`, issues);
      validateExpression(expression, `/derived/${key}`, scope, issues);
    }
  }
  validateNodeArray(input.body, "/body", scope, new Map(), issues);
  if (input.actions !== undefined && requireObject(input.actions, "/actions", issues)) {
    for (const [key, action] of Object.entries(input.actions)) {
      validateIdentifier(key, `/actions/${key}`, issues);
      validateAction(action, `/actions/${key}`, scope, issues);
    }
  }
  return finish(input as unknown as UiScreenDocument, issues);
}

function safeUiFile(file: string): boolean {
  return (
    file.endsWith(".ui.json") &&
    !file.startsWith("/") &&
    !file.startsWith("\\") &&
    !/^[A-Za-z]:/.test(file) &&
    !file.split(/[\\/]/).includes("..")
  );
}

/** 校验 feature 入口文件。 */
export function validateUiFeature(input: unknown): UiValidationResult<UiFeatureDocument> {
  const issues: UiValidationIssue[] = [];
  if (!requireObject(input, "", issues)) return finish(input as UiFeatureDocument, issues);
  validateVersion(input.formatVersion, "/formatVersion", issues);
  validateIdentifier(input.moduleId, "/moduleId", issues);
  optionalString(input.name, "/name", issues);
  optionalString(input.notes, "/notes", issues);
  const screenIds = new Map<string, string>();
  const files = new Map<string, string>();
  if (!Array.isArray(input.screens) || input.screens.length === 0) {
    issue(issues, "/screens", "invalid_type", "必须是非空页面引用数组");
  } else {
    input.screens.forEach((screen, index) => {
      const path = `/screens/${index}`;
      if (!requireObject(screen, path, issues)) return;
      if (validateIdentifier(screen.id, `${path}/id`, issues)) {
        const previous = screenIds.get(screen.id);
        if (previous) issue(issues, `${path}/id`, "duplicate_id", `页面 id 与 ${previous} 重复`);
        else screenIds.set(screen.id, `${path}/id`);
      }
      if (requireString(screen.file, `${path}/file`, issues)) {
        if (!safeUiFile(screen.file)) {
          issue(issues, `${path}/file`, "unsafe_path", "必须是工程内的相对 .ui.json 路径，且不能包含 ..");
        }
        const previous = files.get(screen.file);
        if (previous) issue(issues, `${path}/file`, "duplicate_id", `页面文件与 ${previous} 重复`);
        else files.set(screen.file, `${path}/file`);
      }
    });
  }
  const entryIds = new Map<string, string>();
  if (!Array.isArray(input.entries)) {
    issue(issues, "/entries", "invalid_type", "必须是入口数组");
  } else {
    input.entries.forEach((entry, index) => {
      const path = `/entries/${index}`;
      if (!requireObject(entry, path, issues)) return;
      if (validateIdentifier(entry.id, `${path}/id`, issues)) {
        const previous = entryIds.get(entry.id);
        if (previous) issue(issues, `${path}/id`, "duplicate_id", `入口 id 与 ${previous} 重复`);
        else entryIds.set(entry.id, `${path}/id`);
      }
      if (!["player", "admin"].includes(String(entry.surface))) {
        issue(issues, `${path}/surface`, "invalid_value", "必须是 player 或 admin");
      }
      requireString(entry.group, `${path}/group`, issues);
      requireString(entry.title, `${path}/title`, issues);
      optionalString(entry.description, `${path}/description`, issues);
      optionalString(entry.icon, `${path}/icon`, issues);
      optionalString(entry.permission, `${path}/permission`, issues);
      requireString(entry.target, `${path}/target`, issues);
      if (entry.order !== undefined && (typeof entry.order !== "number" || !Number.isFinite(entry.order))) {
        issue(issues, `${path}/order`, "invalid_type", "必须是有限数字");
      }
    });
  }
  return finish(input as unknown as UiFeatureDocument, issues);
}

function collectNodeSemantics(
  nodes: UiNode[],
  path: string,
  actions: ReadonlySet<string>,
  screens: ReadonlySet<string>,
  issues: UiValidationIssue[]
): void {
  nodes.forEach((node, index) => {
    const nodePath = `${path}/${index}`;
    if (node.type === "button") {
      if (node.trigger.type === "action" && !actions.has(node.trigger.action)) {
        issue(issues, `${nodePath}/trigger/action`, "unknown_action", `未声明动作 ${node.trigger.action}`);
      }
      if ((node.trigger.type === "navigate" || node.trigger.type === "replace") && !screens.has(node.trigger.to)) {
        issue(issues, `${nodePath}/trigger/to`, "unknown_screen", `未声明页面 ${node.trigger.to}`);
      }
    }
    if (node.type === "when") collectNodeSemantics(node.content, `${nodePath}/content`, actions, screens, issues);
    if (node.type === "each") {
      collectNodeSemantics(node.template, `${nodePath}/template`, actions, screens, issues);
      if (node.empty) collectNodeSemantics(node.empty, `${nodePath}/empty`, actions, screens, issues);
    }
  });
}

function collectCalls(screen: UiScreenDocument): UiServiceCall[] {
  return [...Object.values(screen.load ?? {}), ...Object.values(screen.actions ?? {}).map((action) => action.call)];
}

function collectEffectScreens(action: UiActionDefinition): Array<{ target: string; field: string }> {
  const result: Array<{ target: string; field: string }> = [];
  for (const [field, effects] of [
    ["onSuccess", action.onSuccess],
    ["onError", action.onError],
  ] as const) {
    effects?.forEach((effect, index) => {
      if (effect.effect === "navigate" || effect.effect === "replace") {
        result.push({ target: effect.to, field: `${field}/${index}/to` });
      }
    });
  }
  return result;
}

/**
 * 编译 feature 与页面集合，执行跨文件、动作、跳转和 service 语义检查。
 * 成功后返回以页面 id 建索引的不可变工程视图。
 */
export function compileUiProject(input: UiProjectInput): UiValidationResult<UiProject> {
  const issues: UiValidationIssue[] = [];
  const featureResult = validateUiFeature(input.feature);
  if (!featureResult.ok) issues.push(...featureResult.issues);
  const feature = featureResult.ok ? featureResult.value : undefined;
  const fileEntries = input.screens instanceof Map ? [...input.screens.entries()] : Object.entries(input.screens);
  const validatedByFile = new Map<string, UiScreenDocument>();
  for (const [file, document] of fileEntries) {
    const result = validateUiScreen(document);
    if (!result.ok) {
      for (const item of result.issues) {
        issues.push({ ...item, path: `/files/${file}${item.path}` });
      }
    } else {
      validatedByFile.set(file, result.value);
    }
  }
  if (!feature) {
    return finish({ feature: input.feature as UiFeatureDocument, screens: new Map() }, issues);
  }
  const screens = new Map<string, UiScreenDocument>();
  for (const [index, reference] of feature.screens.entries()) {
    const document = validatedByFile.get(reference.file);
    if (!document) {
      issue(issues, `/screens/${index}/file`, "unknown_screen", `没有提供页面文件 ${reference.file}`);
      continue;
    }
    if (document.id !== reference.id) {
      issue(issues, `/screens/${index}/id`, "id_mismatch", `引用 id ${reference.id} 与文件中的 ${document.id} 不一致`);
      continue;
    }
    screens.set(reference.id, document);
  }
  const knownScreens = new Set(screens.keys());
  feature.entries.forEach((entry, index) => {
    if (!knownScreens.has(entry.target)) {
      issue(issues, `/entries/${index}/target`, "unknown_screen", `未声明页面 ${entry.target}`);
    }
  });
  const services = input.services ? new Set(input.services) : undefined;
  for (const [screenId, screen] of screens) {
    const actions = new Set(Object.keys(screen.actions ?? {}));
    collectNodeSemantics(screen.body, `/pages/${screenId}/body`, actions, knownScreens, issues);
    for (const [actionId, action] of Object.entries(screen.actions ?? {})) {
      for (const target of collectEffectScreens(action)) {
        if (!knownScreens.has(target.target)) {
          issue(
            issues,
            `/pages/${screenId}/actions/${actionId}/${target.field}`,
            "unknown_screen",
            `未声明页面 ${target.target}`
          );
        }
      }
    }
    if (services) {
      for (const call of collectCalls(screen)) {
        if (!services.has(call.service)) {
          issue(issues, `/pages/${screenId}`, "unknown_service", `manifest 未声明 service ${call.service}`);
        }
      }
    }
  }
  return finish({ feature, screens }, issues);
}
