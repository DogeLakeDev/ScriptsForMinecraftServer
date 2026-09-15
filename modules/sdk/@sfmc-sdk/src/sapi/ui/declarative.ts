/**
 * 声明式 UI v1 Runtime。
 *
 * 文档由模块以纯 JSON 注册；这里负责数据绑定、service 调用、页面栈与 DDUI 渲染。
 * 完整静态契约由 @sfmc-bds/sdk/contracts 与 JSON Schema 维护，本文件只保留运行时窄化。
 */

import type { Player } from "@minecraft/server";
import * as serverUi from "@minecraft/server-ui";
import type {
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
} from "@minecraft/server-ui";
import {
  FormStatus,
  MenuNavigator,
  obsBool,
  obsNum,
  obsStr,
  type Page,
} from "../runtime/menu-navigator.js";
import { Msg } from "../runtime/msg.js";
import {
  popHistory,
  pushOrRewind,
  replaceOrRewind,
  shouldRenderScreen,
} from "../runtime/nav-stack.js";
import { getServiceClient } from "../service/client.js";
import {
  compileUiProject,
  type UiProjectInput,
} from "../../validation/ui-document.js";
import { resolveDisabledControl } from "./disabled-when.js";
import {
  applyCustomFormTextPlaceholder,
  customFormButtonImageDetails,
  customFormButtonLabel,
  customFormButtonTooltip,
  customFormDropdownItems,
  customFormFieldOptions,
  customFormImageArgs,
  customFormImageOptions,
} from "./ddui-widgets.js";
import {
  bindNumberTextField,
  formatNumberFieldText,
  type NumberFieldLimits,
} from "./number-text-field.js";
import { effectiveConfirmChallenge } from "../../ui-studio/shared/confirm-challenge.js";
import { resolveDropdownOptions } from "../../ui-studio/shared/evaluate.js";

const ObservableBooleanCtor = (
  serverUi as Record<string, unknown>
).ObservableBoolean as
  | (new (data: boolean) => ObservableBoolean)
  | undefined;

type JsonObject = Record<string, unknown>;

type RuntimeFeature = {
  moduleId: string;
  feature: JsonObject;
  screens: Map<string, JsonObject>;
};

type RuntimeScope = JsonObject & {
  player: JsonObject;
  params: JsonObject;
  data: JsonObject;
  state: JsonObject;
  derived: JsonObject;
  result?: unknown;
};

type StateBinding =
  | {
      kind: "string";
      control: ObservableString;
      get(): string;
      set(value: unknown): void;
    }
  | {
      kind: "number";
      control: ObservableNumber;
      get(): number;
      set(value: unknown): void;
    }
  | {
      kind: "boolean";
      control: ObservableBoolean;
      get(): boolean;
      set(value: unknown): void;
    }
  | {
      kind: "dropdown";
      control: ObservableNumber;
      /** 当前选项列表，刷新时原地更新，供 get/set 闭包读取。 */
      options: JsonObject[];
      get(): unknown;
      set(value: unknown): void;
    };

/** 开关即时 trigger 的监听上下文；aliases 在每次渲染时更新，避免 each 闭包过期。 */
type ToggleWatch = {
  applying: boolean;
  bind: string;
  aliases: JsonObject;
  rawNode: JsonObject;
  screen: JsonObject;
  status: FormStatus;
};

type RuntimeSession = {
  player: Player;
  feature: RuntimeFeature;
  nav: MenuNavigator;
  currentScreen: string;
  history: string[];
  params: Map<string, JsonObject>;
  data: Map<string, JsonObject>;
  bindings: Map<string, StateBinding>;
  numberTextViews: Map<string, ObservableString>;
  disabledControls: Map<string, ObservableBoolean>;
  toggleWatch: Map<string, ToggleWatch>;
};

const features = new Map<string, RuntimeFeature>();
const EXACT_BINDING =
  /^\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}$/;
const BINDING =
  /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function readPath(scope: JsonObject, reference: string): unknown {
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
 * 把值写回点分路径（用于 each 条目开关把新值写进当前行对象）。
 * 使用场景：拨动 `channel.subscribed` 后，trigger input 才能读到新布尔值。
 */
function writePath(scope: JsonObject, reference: string, value: unknown): void {
  const parts = reference.split(".");
  if (parts.length < 2) return;
  let current: unknown = scope;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index]!;
    if (current === null || current === undefined) return;
    if (!isObject(current) && !Array.isArray(current)) return;
    current = (current as Record<string, unknown>)[part];
  }
  const leaf = parts[parts.length - 1]!;
  if (isObject(current)) current[leaf] = value;
}

/** 条目身份：优先用 id，否则用 each 下标，保证每行开关各有一份 Observable。 */
function eachItemKey(item: unknown, index: number): string {
  if (isObject(item) && item.id !== undefined && item.id !== null) {
    const id = String(item.id);
    if (id) return id;
  }
  return String(index);
}

function isStateBind(bind: string): boolean {
  return bind.startsWith("state.");
}

function bindString(value: string, scope: JsonObject): unknown {
  const exact = EXACT_BINDING.exec(value);
  if (exact?.[1]) return readPath(scope, exact[1]);
  return value.replace(BINDING, (_whole, reference: string) =>
    text(readPath(scope, reference)),
  );
}

function bindJson(value: unknown, scope: JsonObject): unknown {
  if (typeof value === "string") return bindString(value, scope);
  if (Array.isArray(value)) return value.map((item) => bindJson(item, scope));
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, bindJson(item, scope)]),
    );
  }
  return value;
}

function expression(value: unknown, scope: JsonObject): unknown {
  if (!isObject(value)) return false;
  if ("value" in value) return value.value;
  if (typeof value.ref === "string") return readPath(scope, value.ref);
  const args = Array.isArray(value.args)
    ? value.args.map((item) => expression(item, scope))
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
        : text(args[0]).includes(text(args[1]));
    default:
      return false;
  }
}

function tonePrefix(tone: unknown): string {
  switch (tone) {
    case "success":
      return "§a";
    case "warning":
      return "§e";
    case "danger":
      return "§c";
    case "muted":
      return "§7";
    case "accent":
    case "primary":
      return "§b";
    default:
      return "";
  }
}

function boundText(value: unknown, scope: JsonObject): string {
  return text(bindString(text(value), scope));
}

function widgetDisabled(rawNode: JsonObject, scope: JsonObject): boolean {
  return (
    rawNode.disabledWhen !== undefined &&
    Boolean(expression(rawNode.disabledWhen, scope))
  );
}

function obsBoolView(value = false): ObservableBoolean {
  if (!ObservableBooleanCtor) {
    throw new Error(
      "当前环境下的 @minecraft/server-ui 不支持 ObservableBoolean（需 Preview/DDUI 支持）",
    );
  }
  return new ObservableBooleanCtor(value);
}

function ensureStateBinding(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
): StateBinding | undefined {
  const existing = session.bindings.get(`${text(screen.id)}:${name}`);
  if (existing) return existing;
  const definitions = isObject(screen.state) ? screen.state : {};
  const definition = isObject(definitions[name]) ? definitions[name] : undefined;
  if (!definition) return undefined;
  switch (definition.type) {
    case "boolean":
      return booleanBinding(session, screen, name);
    case "string":
      return stringBinding(session, screen, name);
    case "number":
      return numberBinding(session, screen, name);
    default:
      return undefined;
  }
}

function liveDisabled(
  rawNode: JsonObject,
  session: RuntimeSession,
  screen: JsonObject,
  aliases: JsonObject,
): ObservableBoolean | undefined {
  const cacheKey = `${text(screen.id)}:${text(rawNode.id)}:disabled`;
  const control = resolveDisabledControl(rawNode.disabledWhen, {
    derivedDefs: isObject(screen.derived) ? screen.derived : {},
    getStateBoolean: (name) => {
      const binding = ensureStateBinding(session, screen, name);
      return binding?.kind === "boolean" ? binding.control : undefined;
    },
    subscribeState: (name, callback) => {
      const binding = ensureStateBinding(session, screen, name);
      binding?.control.subscribe(callback);
    },
    evaluate: () => widgetDisabled(rawNode, makeScope(session, screen, aliases)),
    createDerived: (initial) => obsBoolView(initial),
    existingDerived: session.disabledControls.get(cacheKey),
  });
  if (control) {
    session.disabledControls.set(cacheKey, control as ObservableBoolean);
  }
  return control as ObservableBoolean | undefined;
}

function widgetFieldOptions(
  rawNode: JsonObject,
  scope: JsonObject,
  session: RuntimeSession,
  screen: JsonObject,
  aliases: JsonObject,
  extra: Record<string, unknown> = {},
) {
  return {
    ...customFormFieldOptions({
      description: boundText(rawNode.description, scope),
      tooltip: boundText(rawNode.tooltip, scope),
      disabled: liveDisabled(rawNode, session, screen, aliases),
      fixedFormatDigits:
        typeof rawNode.fixedFormatDigits === "number"
          ? rawNode.fixedFormatDigits
          : undefined,
    }),
    ...extra,
  };
}

function widgetTooltip(rawNode: JsonObject, scope: JsonObject): { tooltip?: string } {
  const tooltip = boundText(rawNode.tooltip, scope);
  return tooltip ? { tooltip } : {};
}

/** 已发布 SDK 的 Page.header/label 还没有 options；运行时若已升级则生效。 */
type TextWriter = (text: string, options?: { tooltip?: string }) => unknown;

function writeHeader(page: Page, text: string, options?: { tooltip?: string }): void {
  (page.header as TextWriter)(text, options);
}

function writeLabel(page: Page, text: string, options?: { tooltip?: string }): void {
  (page.label as TextWriter)(text, options);
}


function screenState(session: RuntimeSession, screen: JsonObject): JsonObject {
  const result: JsonObject = {};
  const definitions = isObject(screen.state) ? screen.state : {};
  for (const [name, definition] of Object.entries(definitions)) {
    const binding = session.bindings.get(`${text(screen.id)}:${name}`);
    result[name] =
      binding?.get() ?? (isObject(definition) ? definition.default : undefined);
  }
  return result;
}

function makeScope(
  session: RuntimeSession,
  screen: JsonObject,
  aliases: JsonObject = {},
  result?: unknown,
): RuntimeScope {
  const screenId = text(screen.id);
  const scope: RuntimeScope = {
    player: {
      id: session.player.id,
      name: session.player.name,
      dimension: session.player.dimension.id,
    },
    params: session.params.get(screenId) ?? {},
    data: session.data.get(screenId) ?? {},
    state: screenState(session, screen),
    derived: {},
    ...aliases,
  };
  if (result !== undefined) scope.result = result;
  const definitions = isObject(screen.derived) ? screen.derived : {};
  for (const [name, definition] of Object.entries(definitions)) {
    scope.derived[name] = expression(definition, scope);
  }
  return scope;
}

function defaultState(screen: JsonObject, name: string): unknown {
  const definitions = isObject(screen.state) ? screen.state : {};
  const definition = isObject(definitions[name]) ? definitions[name] : {};
  return definition.default;
}

function stringBinding(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
): StateBinding {
  const key = `${text(screen.id)}:${name}`;
  const existing = session.bindings.get(key);
  if (existing) return existing;
  const control = obsStr(text(defaultState(screen, name)));
  const binding: StateBinding = {
    kind: "string",
    control,
    get: () => control.getData(),
    set: (value) => control.setData(text(value)),
  };
  session.bindings.set(key, binding);
  return binding;
}

function numberBinding(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
): StateBinding {
  const key = `${text(screen.id)}:${name}`;
  const existing = session.bindings.get(key);
  if (existing) return existing;
  const control = obsNum(Number(defaultState(screen, name)) || 0);
  const binding: StateBinding = {
    kind: "number",
    control,
    get: () => control.getData(),
    set: (value) => control.setData(Number(value) || 0),
  };
  session.bindings.set(key, binding);
  return binding;
}

function booleanBinding(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
): StateBinding {
  const key = `${text(screen.id)}:${name}`;
  const existing = session.bindings.get(key);
  if (existing) return existing;
  const control = obsBool(Boolean(defaultState(screen, name)));
  const binding: StateBinding = {
    kind: "boolean",
    control,
    get: () => control.getData(),
    set: (value) => control.setData(Boolean(value)),
  };
  session.bindings.set(key, binding);
  return binding;
}

/** 开关绑定键：state 用字段名；each 条目用「节点 + 条目 id + 路径」。 */
function toggleBindingKey(
  screen: JsonObject,
  rawNode: JsonObject,
  bind: string,
  aliases: JsonObject,
): string {
  if (isStateBind(bind)) return `${text(screen.id)}:${bind.slice("state.".length)}`;
  const root = bind.split(".")[0] ?? "";
  const identity = eachItemKey(aliases[root], Number(aliases.__eachIndex ?? 0));
  return `${text(screen.id)}:${text(rawNode.id)}:${identity}:${bind}`;
}

/**
 * 解析开关 Observable：state.* 复用页面状态，each 字段按行新建。
 * 使用场景：频道列表每一行一个订阅开关。
 */
function resolveBooleanBinding(
  session: RuntimeSession,
  screen: JsonObject,
  rawNode: JsonObject,
  aliases: JsonObject,
  scope: JsonObject,
): StateBinding {
  const bind = text(rawNode.bind);
  if (isStateBind(bind)) {
    return booleanBinding(session, screen, bind.slice("state.".length));
  }
  const key = toggleBindingKey(screen, rawNode, bind, aliases);
  const existing = session.bindings.get(key);
  if (existing) return existing;
  const control = obsBool(Boolean(readPath(scope, bind)));
  const binding: StateBinding = {
    kind: "boolean",
    control,
    get: () => Boolean(control.getData()),
    set: (value) => control.setData(Boolean(value)),
  };
  session.bindings.set(key, binding);
  return binding;
}

/**
 * 订阅开关变化并在值真正改变时跑 trigger；重建页面时用 applying 避免回写误触发。
 * 使用场景：reactive 表单里拨动订阅立刻调 service，无需再点按钮。
 */
function syncToggleWatch(
  session: RuntimeSession,
  screen: JsonObject,
  rawNode: JsonObject,
  aliases: JsonObject,
  status: FormStatus,
  binding: StateBinding,
  scope: JsonObject,
): void {
  if (binding.kind !== "boolean") return;
  const bind = text(rawNode.bind);
  const key = toggleBindingKey(screen, rawNode, bind, aliases);
  let watch = session.toggleWatch.get(key);
  if (!watch) {
    watch = { applying: false, bind, aliases, rawNode, screen, status };
    session.toggleWatch.set(key, watch);
    binding.control.subscribe(() => {
      const ctx = session.toggleWatch.get(key);
      if (!ctx || ctx.applying) return;
      const next = Boolean(binding.get());
      if (!isStateBind(ctx.bind)) writePath(ctx.aliases, ctx.bind, next);
      if (ctx.rawNode.trigger) {
        void trigger(ctx.rawNode.trigger, session, ctx.screen, ctx.aliases, ctx.status);
      }
    });
  } else {
    watch.bind = bind;
    watch.aliases = aliases;
    watch.rawNode = rawNode;
    watch.screen = screen;
    watch.status = status;
  }
  if (!isStateBind(bind)) {
    const next = Boolean(readPath(scope, bind));
    if (next !== binding.get()) {
      watch.applying = true;
      binding.set(next);
      watch.applying = false;
    }
  }
}

function dropdownBinding(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
  options: JsonObject[],
): StateBinding {
  const key = `${text(screen.id)}:${name}`;
  const existing = session.bindings.get(key);
  if (existing?.kind === "dropdown") {
    existing.options.splice(0, existing.options.length, ...options);
    const current = existing.get();
    const keep = options.findIndex((option) => option.value === current);
    existing.control.setData(keep >= 0 ? keep : 0);
    return existing;
  }
  const stored: JsonObject[] = [...options];
  const initial = defaultState(screen, name);
  const initialIndex = Math.max(
    0,
    stored.findIndex((option) => option.value === initial),
  );
  const control = obsNum(initialIndex);
  const binding: StateBinding = {
    kind: "dropdown",
    control,
    options: stored,
    get: () => stored[Math.floor(control.getData())]?.value,
    set: (value) => {
      const index = stored.findIndex((option) => option.value === value);
      control.setData(Math.max(0, index));
    },
  };
  session.bindings.set(key, binding);
  return binding;
}

function bindName(node: JsonObject): string {
  const value = text(node.bind);
  return value.startsWith("state.") ? value.slice("state.".length) : value;
}

function stateNumberLimits(screen: JsonObject, name: string): NumberFieldLimits {
  const definitions = isObject(screen.state) ? screen.state : {};
  const definition = isObject(definitions[name]) ? definitions[name] : {};
  const limits: NumberFieldLimits = {};
  if (typeof definition.min === "number") limits.min = definition.min;
  if (typeof definition.max === "number") limits.max = definition.max;
  if (typeof definition.step === "number") limits.step = definition.step;
  return limits;
}

function ensureNumberTextView(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
  binding: Extract<StateBinding, { kind: "number" }>,
): ObservableString {
  const key = `${text(screen.id)}:${name}:text`;
  const existing = session.numberTextViews.get(key);
  if (existing) return existing;
  const control = obsStr(formatNumberFieldText(binding.get()));
  bindNumberTextField(binding.control, control, stateNumberLimits(screen, name));
  session.numberTextViews.set(key, control);
  return control;
}

function textFieldControl(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
): ObservableString {
  const key = `${text(screen.id)}:${name}`;
  const binding =
    session.bindings.get(key) ??
    ensureStateBinding(session, screen, name) ??
    stringBinding(session, screen, name);
  if (binding.kind === "number") {
    return ensureNumberTextView(session, screen, name, binding);
  }
  if (binding.kind === "string") {
    return binding.control;
  }
  return obsStr(text(binding.get()));
}

type NavExt = MenuNavigator & {
  stack?: () => readonly string[];
  setOnBack?: (handler: () => void) => MenuNavigator;
};

function syncSessionFromNav(session: RuntimeSession): void {
  const stack = (session.nav as NavExt).stack?.();
  if (stack && stack.length > 0) {
    session.history = [...stack];
  }
  session.currentScreen =
    session.history[session.history.length - 1] ?? session.currentScreen;
}

function bindNativeBack(session: RuntimeSession): void {
  (session.nav as NavExt).setOnBack?.(() => {
    syncSessionFromNav(session);
  });
}

async function goTo(
  session: RuntimeSession,
  target: string,
  params: JsonObject,
  mode: "navigate" | "replace",
): Promise<void> {
  session.params.set(target, params);
  session.history =
    mode === "replace"
      ? replaceOrRewind(session.history, target)
      : pushOrRewind(session.history, target);
  session.currentScreen = target;
  if (mode === "replace") await session.nav.replace(target);
  else await session.nav.rebuild(target);
  syncSessionFromNav(session);
}

async function goBack(session: RuntimeSession): Promise<void> {
  const next = popHistory(session.history);
  const target = next[next.length - 1];
  if (!target) return;
  session.history = next;
  session.currentScreen = target;
  await session.nav.replace(target);
  syncSessionFromNav(session);
}

async function loadScreen(
  session: RuntimeSession,
  screen: JsonObject,
): Promise<string[]> {
  const screenId = text(screen.id);
  const data: JsonObject = {};
  session.data.set(screenId, data);
  const errors: string[] = [];
  const sources = isObject(screen.load) ? screen.load : {};
  for (const [name, source] of Object.entries(sources)) {
    if (!isObject(source) || typeof source.service !== "string") continue;
    try {
      const scope = makeScope(session, screen);
      const input = isObject(source.input)
        ? (bindJson(source.input, scope) as JsonObject)
        : {};
      data[name] = await getServiceClient(session.feature.moduleId).call(
        source.service,
        input,
      );
    } catch (error) {
      data[name] = null;
      errors.push(
        `${name}: ${error instanceof Error ? error.message : text(error, "加载失败")}`,
      );
    }
  }
  return errors;
}

/**
 * 先创建页面 state 绑定，便于加载后把 data 回填进开关。
 * 下拉框依赖选项列表，仍在渲染控件时创建。
 */
function ensureStateBindings(session: RuntimeSession, screen: JsonObject): void {
  const definitions = isObject(screen.state) ? screen.state : {};
  for (const [name, definition] of Object.entries(definitions)) {
    if (!isObject(definition)) continue;
    if (definition.type === "boolean") booleanBinding(session, screen, name);
    else if (definition.type === "number") numberBinding(session, screen, name);
    else if (definition.type === "string") stringBinding(session, screen, name);
  }
}

/** 把 load 结果里的同名布尔字段写进 state，避免开关默认全关。 */
function coerceLoadedBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "true" || value === "1") return true;
  if (value === 0 || value === "false" || value === "0") return false;
  return undefined;
}

/**
 * 用 load 数据回填布尔 state（字段名需一致，如 data.channel.isBroadcast → state.isBroadcast）。
 * 重建页面时带 applying，避免把回填当成玩家拨动。
 */
function hydrateBooleanStateFromLoad(
  session: RuntimeSession,
  screen: JsonObject,
): void {
  const screenId = text(screen.id);
  const data = session.data.get(screenId) ?? {};
  const definitions = isObject(screen.state) ? screen.state : {};
  for (const source of Object.values(data)) {
    if (!isObject(source)) continue;
    for (const [name, definition] of Object.entries(definitions)) {
      if (!isObject(definition) || definition.type !== "boolean") continue;
      const next = coerceLoadedBoolean(source[name]);
      if (next === undefined) continue;
      const key = `${screenId}:${name}`;
      const binding = session.bindings.get(key);
      if (!binding || binding.kind !== "boolean") continue;
      if (next === binding.get()) continue;
      const watch = session.toggleWatch.get(key);
      if (watch) watch.applying = true;
      binding.set(next);
      if (watch) watch.applying = false;
    }
  }
}

async function applyEffects(
  effects: unknown,
  session: RuntimeSession,
  screen: JsonObject,
  aliases: JsonObject,
  result: unknown,
): Promise<void> {
  if (!Array.isArray(effects)) return;
  for (const rawEffect of effects) {
    if (!isObject(rawEffect)) continue;
    const scope = makeScope(session, screen, aliases, result);
    switch (rawEffect.effect) {
      case "message": {
        const message = text(bindString(text(rawEffect.text), scope));
        if (rawEffect.tone === "danger") Msg.error(message, session.player);
        else if (rawEffect.tone === "warning")
          Msg.warning(message, session.player);
        else if (rawEffect.tone === "success")
          Msg.success(message, session.player);
        else Msg.info(message, session.player);
        break;
      }
      case "navigate":
      case "replace":
        await goTo(
          session,
          text(rawEffect.to),
          isObject(rawEffect.params)
            ? (bindJson(rawEffect.params, scope) as JsonObject)
            : {},
          rawEffect.effect === "replace" ? "replace" : "navigate",
        );
        break;
      case "back":
        await goBack(session);
        break;
      case "refresh":
        await session.nav.refresh();
        break;
      case "close":
        session.nav.leave(() => undefined);
        break;
      case "setState":
        if (isObject(rawEffect.values)) {
          const values = bindJson(rawEffect.values, scope) as JsonObject;
          for (const [name, value] of Object.entries(values)) {
            session.bindings.get(`${text(screen.id)}:${name}`)?.set(value);
          }
        }
        break;
    }
  }
}

async function runAction(
  actionId: string,
  triggerInput: unknown,
  session: RuntimeSession,
  screen: JsonObject,
  aliases: JsonObject,
  status: FormStatus,
): Promise<void> {
  const actions = isObject(screen.actions) ? screen.actions : {};
  const action = isObject(actions[actionId]) ? actions[actionId] : undefined;
  if (
    !action ||
    !isObject(action.call) ||
    typeof action.call.service !== "string"
  ) {
    status.fail(`动作 ${actionId} 未配置`);
    return;
  }
  const call = action.call;
  const beforeScope = makeScope(session, screen, aliases);
  if (isObject(action.confirm)) {
    const title = text(bindString(text(action.confirm.title, "确认"), beforeScope), "确认");
    const body = text(bindString(text(action.confirm.body), beforeScope));
    const confirmText = text(action.confirm.confirmText, "确认");
    const cancelText = text(action.confirm.cancelText, "取消");
    const challenge = effectiveConfirmChallenge(
      text(bindString(text(action.confirm.challenge), beforeScope)),
    );
    const confirmed = challenge
      ? await session.nav.confirmChallenge(title, body, challenge, confirmText, cancelText)
      : await session.nav.confirmMessage(title, body, confirmText, cancelText);
    if (!confirmed) {
      await session.nav.refresh();
      return;
    }
  }
  await session.nav.runTask(status, async () => {
    const scope = makeScope(session, screen, aliases);
    const baseInput = isObject(call.input)
      ? (bindJson(call.input, scope) as JsonObject)
      : {};
    const extraInput = isObject(triggerInput)
      ? (bindJson(triggerInput, scope) as JsonObject)
      : {};
    try {
      const result = await getServiceClient(session.feature.moduleId).call(
        call.service as string,
        {
          ...baseInput,
          ...extraInput,
        },
      );
      await applyEffects(action.onSuccess, session, screen, aliases, result);
    } catch (error) {
      const result = {
        message:
          error instanceof Error ? error.message : text(error, "操作失败"),
      };
      if (Array.isArray(action.onError)) {
        await applyEffects(action.onError, session, screen, aliases, result);
      } else {
        throw error;
      }
    }
  });
}

async function trigger(
  value: unknown,
  session: RuntimeSession,
  screen: JsonObject,
  aliases: JsonObject,
  status: FormStatus,
): Promise<void> {
  if (!isObject(value)) return;
  const scope = makeScope(session, screen, aliases);
  switch (value.type) {
    case "action":
      await runAction(
        text(value.action),
        value.input,
        session,
        screen,
        aliases,
        status,
      );
      break;
    case "navigate":
    case "replace":
      await goTo(
        session,
        text(value.to),
        isObject(value.params)
          ? (bindJson(value.params, scope) as JsonObject)
          : {},
        value.type === "replace" ? "replace" : "navigate",
      );
      break;
    case "back":
      await goBack(session);
      break;
    case "refresh":
      await session.nav.refresh();
      break;
    case "close":
      session.nav.leave(() => undefined);
      break;
  }
}

function renderNodes(
  rawNodes: unknown,
  page: Page,
  session: RuntimeSession,
  screen: JsonObject,
  status: FormStatus,
  aliases: JsonObject = {},
): void {
  if (!Array.isArray(rawNodes)) return;
  for (const rawNode of rawNodes) {
    if (!isObject(rawNode)) continue;
    let scope = makeScope(session, screen, aliases);
    if (
      rawNode.visibleWhen !== undefined &&
      !expression(rawNode.visibleWhen, scope)
    )
      continue;
    switch (rawNode.type) {
      case "header":
        writeHeader(
          page,
          tonePrefix(rawNode.tone) +
            text(bindString(text(rawNode.text), scope)),
          widgetTooltip(rawNode, scope),
        );
        break;
      case "text":
        writeLabel(
          page,
          tonePrefix(rawNode.tone) +
            text(bindString(text(rawNode.text), scope)),
          widgetTooltip(rawNode, scope),
        );
        break;
      case "info":
        if (Array.isArray(rawNode.items)) {
          writeLabel(
            page,
            tonePrefix(rawNode.tone) +
              rawNode.items
                .map((item) => text(bindString(text(item), scope)))
                .join("\n"),
            widgetTooltip(rawNode, scope),
          );
        }
        break;
      case "image": {
        const image = customFormImageArgs({
          source: bindString(text(rawNode.source), scope),
          pack: bindString(text(rawNode.pack), scope),
        });
        if (image) {
          page.image(image.src, image.pack, {
            ...customFormImageOptions({
              width: typeof rawNode.width === "number" ? rawNode.width : undefined,
              tooltip: boundText(rawNode.tooltip, scope),
            }),
            ...(rawNode.trigger
              ? {
                  onClick: () => {
                    scope = makeScope(session, screen, aliases);
                    void trigger(
                      rawNode.trigger,
                      session,
                      screen,
                      aliases,
                      status,
                    );
                  },
                }
              : {}),
          });
        }
        break;
      }
      case "divider":
        page.divider();
        break;
      case "spacer":
        page.spacer();
        break;
      case "textField": {
        const control = textFieldControl(session, screen, bindName(rawNode));
        applyCustomFormTextPlaceholder(
          control,
          boundText(rawNode.placeholder, scope),
        );
        page.textField(
          boundText(rawNode.label, scope),
          control,
          widgetFieldOptions(rawNode, scope, session, screen, aliases),
        );
        break;
      }
      case "toggle": {
        const binding = resolveBooleanBinding(
          session,
          screen,
          rawNode,
          aliases,
          scope,
        );
        syncToggleWatch(
          session,
          screen,
          rawNode,
          aliases,
          status,
          binding,
          scope,
        );
        page.toggle(
          boundText(rawNode.label, scope),
          binding.control as ObservableBoolean,
          widgetFieldOptions(rawNode, scope, session, screen, aliases),
        );
        break;
      }
      case "slider": {
        const binding = numberBinding(session, screen, bindName(rawNode));
        page.slider(
          boundText(rawNode.label, scope),
          binding.control as ObservableNumber,
          Number(rawNode.min),
          Number(rawNode.max),
          widgetFieldOptions(rawNode, scope, session, screen, aliases, {
            step: typeof rawNode.step === "number" ? rawNode.step : 1,
          }),
        );
        break;
      }
      case "dropdown": {
        const resolved = resolveDropdownOptions(rawNode.options, scope);
        const options =
          resolved.length > 0
            ? resolved
            : [{ label: "暂无选项", value: "" }];
        const binding = dropdownBinding(
          session,
          screen,
          bindName(rawNode),
          options as JsonObject[],
        );
        page.dropdown(
          boundText(rawNode.label, scope),
          binding.control as ObservableNumber,
          customFormDropdownItems(
            options.map((option) => ({
              label: option.label,
              description: option.description,
            })),
          ),
          widgetFieldOptions(rawNode, scope, session, screen, aliases),
        );
        break;
      }
      case "button": {
        const disabled = liveDisabled(rawNode, session, screen, aliases);
        const imageDetails = customFormButtonImageDetails({
          icon: bindString(text(rawNode.icon), scope),
          iconPack: bindString(text(rawNode.iconPack), scope),
        });
        const tooltip = customFormButtonTooltip({
          tooltip: boundText(rawNode.tooltip, scope),
          description: boundText(rawNode.description, scope),
        });
        page.button(
          customFormButtonLabel(boundText(rawNode.label, scope), rawNode.tone),
          () => {
            scope = makeScope(session, screen, aliases);
            if (widgetDisabled(rawNode, scope)) return;
            void trigger(rawNode.trigger, session, screen, aliases, status);
          },
          {
            ...(disabled ? { disabled } : {}),
            ...(tooltip ? { tooltip } : {}),
            ...(imageDetails ? { imageDetails } : {}),
          },
        );
        break;
      }
      case "when":
        if (expression(rawNode.condition, scope)) {
          renderNodes(rawNode.content, page, session, screen, status, aliases);
        }
        break;
      case "each": {
        const items = readPath(scope, text(rawNode.source));
        if (Array.isArray(items) && items.length > 0) {
          const alias = text(rawNode.as, "item");
          items.forEach((item, index) => {
            renderNodes(rawNode.template, page, session, screen, status, {
              ...aliases,
              [alias]: item,
              __eachIndex: index,
            });
          });
        } else {
          renderNodes(rawNode.empty, page, session, screen, status, aliases);
        }
        break;
      }
    }
  }
}

async function renderScreen(
  page: Page,
  session: RuntimeSession,
  screen: JsonObject,
): Promise<void> {
  if (
    !shouldRenderScreen(
      text(screen.id),
      session.currentScreen,
      session.history,
    )
  ) {
    return;
  }
  const errors = await loadScreen(session, screen);
  ensureStateBindings(session, screen);
  hydrateBooleanStateFromLoad(session, screen);
  const status = new FormStatus(page);
  const scope = makeScope(session, screen);
  const title = text(bindString(text(screen.title), scope));
  if (title) page.header(title);
  for (const error of errors) page.label(`§c${error}`);
  renderNodes(screen.body, page, session, screen, status);
}

/** 打开已注册 feature 中的声明式页面。 */
export async function openDeclarativeScreen(
  moduleId: string,
  screenId: string,
  player: Player,
  params: JsonObject = {},
): Promise<void> {
  const feature = features.get(moduleId);
  if (!feature) throw new Error(`UI feature 未注册: ${moduleId}`);
  if (!feature.screens.has(screenId))
    throw new Error(`UI 页面未注册: ${screenId}`);
  const nav = new MenuNavigator(player);
  const session: RuntimeSession = {
    player,
    feature,
    nav,
    currentScreen: screenId,
    history: [screenId],
    params: new Map([[screenId, params]]),
    data: new Map(),
    bindings: new Map(),
    numberTextViews: new Map(),
    disabledControls: new Map(),
    toggleWatch: new Map(),
  };
  bindNativeBack(session);
  for (const [id, screen] of feature.screens) {
    nav.section(id, text(screen.name, text(screen.title, id)), (page) =>
      renderScreen(page, session, screen),
    );
  }
  await nav.start(screenId);
}

/** 注册一个由 feature + screens 组成的纯 JSON UI 工程。 */
export function registerDeclarativeFeature(input: UiProjectInput): {
  ok: boolean;
  error?: string;
} {
  const compiled = compileUiProject(input);
  if (!compiled.ok) {
    return { ok: false, error: compiled.errors.join("；") };
  }
  const feature = compiled.value.feature as unknown as JsonObject;
  unregisterDeclarativeFeature(compiled.value.feature.moduleId);
  const screens = new Map<string, JsonObject>(
    [...compiled.value.screens].map(([id, screen]) => [
      id,
      screen as unknown as JsonObject,
    ]),
  );
  const runtime: RuntimeFeature = {
    moduleId: compiled.value.feature.moduleId,
    feature,
    screens,
  };
  features.set(runtime.moduleId, runtime);
  return { ok: true };
}

/** 注销 feature 及其派生入口。 */
export function unregisterDeclarativeFeature(
  moduleId: string,
  expectedFeature?: unknown,
): {
  ok: boolean;
} {
  if (
    expectedFeature !== undefined &&
    features.get(moduleId)?.feature !== expectedFeature
  ) {
    return { ok: false };
  }
  return { ok: features.delete(moduleId) };
}

/** 提供给未来独立主菜单模块的纯数据入口列表。 */
export function listDeclarativeEntries(): JsonObject[] {
  const entries: JsonObject[] = [];
  for (const feature of features.values()) {
    const featureEntries = Array.isArray(feature.feature.entries)
      ? feature.feature.entries
      : [];
    for (const entry of featureEntries) {
      if (isObject(entry))
        entries.push({ ...entry, moduleId: feature.moduleId });
    }
  }
  return entries;
}

export function clearDeclarativeFeatures(): void {
  for (const moduleId of [...features.keys()])
    unregisterDeclarativeFeature(moduleId);
}
