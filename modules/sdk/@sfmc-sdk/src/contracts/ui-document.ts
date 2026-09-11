/**
 * SFMC 声明式 UI 文档 v1 的平台无关契约。
 *
 * 本文件不得依赖 `@minecraft/*`：网页设计器、CLI 编译器与 BDS Runtime
 * 必须消费同一份类型定义。
 */

/** UI 文档格式版本。 */
export const UI_DOCUMENT_FORMAT_VERSION = 1 as const;

/** UI 页面底层呈现策略。 */
export type UiPresentation = "auto" | "menu" | "form" | "reactive";

/** 由主题映射为客户端可用颜色、图标或原生样式的语义色。 */
export type UiTone = "default" | "muted" | "accent" | "success" | "warning" | "danger" | "primary";

/** 可存入 UI 文档的数据值。 */
export type UiJsonValue = string | number | boolean | null | UiJsonValue[] | { [key: string]: UiJsonValue };

/** 表达式可引用的运行时数据根。 */
export type UiReferenceRoot = "player" | "params" | "data" | "state" | "derived" | "result" | "item";

/** 白名单表达式操作符；运行时禁止执行任意脚本。 */
export type UiExpressionOperator =
  | "equals"
  | "notEquals"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "and"
  | "or"
  | "not"
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "coalesce"
  | "contains";

/** 安全表达式：常量、路径引用或白名单操作。 */
export type UiExpression =
  | { value: string | number | boolean | null }
  | { ref: string }
  | { op: UiExpressionOperator; args: UiExpression[] };

/** 页面路由参数声明。 */
export type UiParamDefinition =
  | { type: "string"; required?: boolean; default?: string }
  | { type: "number"; required?: boolean; default?: number }
  | { type: "boolean"; required?: boolean; default?: boolean };

/** 每玩家、每会话、每页面隔离的输入状态声明。 */
export type UiStateDefinition =
  | {
      type: "string";
      default?: string;
      minLength?: number;
      maxLength?: number;
    }
  | {
      type: "number";
      default?: number;
      min?: number;
      max?: number;
      step?: number;
    }
  | {
      type: "boolean";
      default?: boolean;
    };

/** 声明式 service 调用。input 中的字符串允许使用 `{{path}}` 绑定。 */
export interface UiServiceCall {
  service: string;
  input?: { [key: string]: UiJsonValue };
  /** 单个数据源的等待上限；编辑器以毫秒展示，Runtime 可转换为 tick。 */
  timeoutMs?: number;
}

/** 页面打开时加载的数据源。 */
export type UiDataSource = UiServiceCall;

/** 操作前的标准确认步骤。 */
export interface UiConfirmDefinition {
  title: string;
  body: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

/** 页面动作完成后由 UI Host 统一执行的效果。 */
export type UiEffect =
  | { effect: "message"; text: string; tone?: UiTone }
  | { effect: "navigate"; to: string; params?: { [key: string]: UiJsonValue } }
  | { effect: "replace"; to: string; params?: { [key: string]: UiJsonValue } }
  | { effect: "back" }
  | { effect: "refresh" }
  | { effect: "close" }
  | { effect: "setState"; values: { [key: string]: UiJsonValue } };

/** 调用业务 service 的命名动作。 */
export interface UiActionDefinition {
  confirm?: UiConfirmDefinition;
  call: UiServiceCall;
  onSuccess?: UiEffect[];
  onError?: UiEffect[];
}

/** 按钮触发器。 */
export type UiTrigger =
  | { type: "action"; action: string; input?: { [key: string]: UiJsonValue } }
  | { type: "navigate"; to: string; params?: { [key: string]: UiJsonValue } }
  | { type: "replace"; to: string; params?: { [key: string]: UiJsonValue } }
  | { type: "back" }
  | { type: "refresh" }
  | { type: "close" };

/** 所有组件共有字段。节点 id 用于可视化编辑、稳定 diff 与诊断定位。 */
export interface UiNodeBase {
  id: string;
  visibleWhen?: UiExpression;
}

export interface UiHeaderNode extends UiNodeBase {
  type: "header";
  text: string;
  tone?: UiTone;
}

export interface UiTextNode extends UiNodeBase {
  type: "text";
  text: string;
  tone?: UiTone;
}

export interface UiInfoNode extends UiNodeBase {
  type: "info";
  items: string[];
  tone?: UiTone;
}

export interface UiImageNode extends UiNodeBase {
  type: "image";
  source: string;
  /** 提供 source 的资源包标识（CustomForm.image 的 pack 参数）。 */
  pack: string;
  alt?: string;
}

export interface UiDividerNode extends UiNodeBase {
  type: "divider";
}

export interface UiSpacerNode extends UiNodeBase {
  type: "spacer";
  size?: "small" | "medium" | "large";
}

export interface UiButtonNode extends UiNodeBase {
  type: "button";
  label: string;
  description?: string;
  /** 按钮图标在资源包内的相对路径，对应 ButtonOptions.imageDetails.imageSrc。 */
  icon?: string;
  /** 提供 icon 的资源包标识，对应 imageDetails.imagePackId；声明 icon 时必填。 */
  iconPack?: string;
  tone?: UiTone;
  disabledWhen?: UiExpression;
  trigger: UiTrigger;
}

export interface UiTextFieldNode extends UiNodeBase {
  type: "textField";
  label: string;
  bind: string;
  placeholder?: string;
  description?: string;
}

export interface UiToggleNode extends UiNodeBase {
  type: "toggle";
  label: string;
  bind: string;
  description?: string;
}

export interface UiDropdownOption {
  label: string;
  value: string | number;
}

export interface UiDropdownNode extends UiNodeBase {
  type: "dropdown";
  label: string;
  bind: string;
  options: UiDropdownOption[];
  description?: string;
}

export interface UiSliderNode extends UiNodeBase {
  type: "slider";
  label: string;
  bind: string;
  min: number;
  max: number;
  step?: number;
  description?: string;
}

/** 条件组件组。 */
export interface UiWhenNode extends UiNodeBase {
  type: "when";
  condition: UiExpression;
  content: UiNode[];
}

/** 动态列表。source 为数组路径，item 仅在 template/empty 作用域中可见。 */
export interface UiEachNode extends UiNodeBase {
  type: "each";
  source: string;
  as: string;
  template: UiNode[];
  empty?: UiNode[];
}

/** UI 文档支持的完整节点联合。 */
export type UiNode =
  | UiHeaderNode
  | UiTextNode
  | UiInfoNode
  | UiImageNode
  | UiDividerNode
  | UiSpacerNode
  | UiButtonNode
  | UiTextFieldNode
  | UiToggleNode
  | UiDropdownNode
  | UiSliderNode
  | UiWhenNode
  | UiEachNode;

/** 单个声明式页面文档。 */
export interface UiScreenDocument {
  $schema?: string;
  formatVersion: typeof UI_DOCUMENT_FORMAT_VERSION;
  id: string;
  name?: string;
  notes?: string;
  presentation: UiPresentation;
  title: string;
  params?: Record<string, UiParamDefinition>;
  state?: Record<string, UiStateDefinition>;
  load?: Record<string, UiDataSource>;
  derived?: Record<string, UiExpression>;
  body: UiNode[];
  actions?: Record<string, UiActionDefinition>;
}

/** 主菜单或管理员界面的页面入口。 */
export interface UiEntryDefinition {
  id: string;
  surface: "player" | "admin";
  group: string;
  title: string;
  description?: string;
  icon?: string;
  order?: number;
  permission?: string;
  target: string;
}

/** feature 中的页面文件引用。 */
export interface UiScreenReference {
  id: string;
  file: string;
}

/** 一个模块交给 UI Studio 打开的项目入口。 */
export interface UiFeatureDocument {
  $schema?: string;
  formatVersion: typeof UI_DOCUMENT_FORMAT_VERSION;
  moduleId: string;
  name?: string;
  notes?: string;
  entries: UiEntryDefinition[];
  screens: UiScreenReference[];
}

/** 已解析并通过跨文件语义校验的 UI 工程。 */
export interface UiProject {
  feature: UiFeatureDocument;
  screens: ReadonlyMap<string, UiScreenDocument>;
}
