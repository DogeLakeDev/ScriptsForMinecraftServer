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
  customFormButtonImageDetails,
  customFormButtonLabel,
  customFormButtonTooltip,
  customFormDropdownItems,
  customFormFieldOptions,
  customFormImageArgs,
  customFormImageOptions,
} from "./ddui-widgets.js";

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
      get(): unknown;
      set(value: unknown): void;
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
  disabledControls: Map<string, ObservableBoolean>;
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

function dropdownBinding(
  session: RuntimeSession,
  screen: JsonObject,
  name: string,
  options: JsonObject[],
): StateBinding {
  const key = `${text(screen.id)}:${name}`;
  const existing = session.bindings.get(key);
  if (existing) return existing;
  const initial = defaultState(screen, name);
  const initialIndex = Math.max(
    0,
    options.findIndex((option) => option.value === initial),
  );
  const control = obsNum(initialIndex);
  const binding: StateBinding = {
    kind: "dropdown",
    control,
    get: () => options[Math.floor(control.getData())]?.value,
    set: (value) => {
      const index = options.findIndex((option) => option.value === value);
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
    const confirmed = await session.nav.confirmMessage(
      text(bindString(text(action.confirm.title, "确认"), beforeScope), "确认"),
      text(bindString(text(action.confirm.body), beforeScope)),
      text(action.confirm.confirmText, "确认"),
      text(action.confirm.cancelText, "取消"),
    );
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
        const binding = stringBinding(session, screen, bindName(rawNode));
        page.textField(
          boundText(rawNode.label, scope),
          binding.control as ObservableString,
          widgetFieldOptions(rawNode, scope, session, screen, aliases),
        );
        break;
      }
      case "toggle": {
        const binding = booleanBinding(session, screen, bindName(rawNode));
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
        const options = Array.isArray(rawNode.options)
          ? rawNode.options.filter(isObject)
          : [];
        const binding = dropdownBinding(
          session,
          screen,
          bindName(rawNode),
          options,
        );
        page.dropdown(
          boundText(rawNode.label, scope),
          binding.control as ObservableNumber,
          customFormDropdownItems(
            options.map((option) => ({
              label: boundText(option.label, scope),
              description: boundText(option.description, scope),
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
          for (const item of items) {
            renderNodes(rawNode.template, page, session, screen, status, {
              ...aliases,
              [text(rawNode.as, "item")]: item,
            });
          }
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
    disabledControls: new Map(),
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
