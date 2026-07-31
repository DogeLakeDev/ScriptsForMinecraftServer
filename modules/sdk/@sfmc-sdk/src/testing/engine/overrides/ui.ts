/**
 * 假 @minecraft/server-ui — 对齐本地 pin `2.2.0-beta.1.26.40-preview.30`。
 * 经典三表单 + CustomForm / MessageBox / Observables / uiManager。
 */

import type { FakePlayer } from "./player.js";
import { getUi } from "../runtime.js";

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "value" in (v as object)) {
    return String((v as { value: unknown }).value ?? "");
  }
  return String(v);
}

export const FormCancelationReason = {
  UserBusy: "UserBusy",
  UserClosed: "UserClosed",
} as const;

/** 对齐 pin DataDrivenScreenClosedReason（非 UserClosed）。 */
export const DataDrivenScreenClosedReason = {
  ClientClosed: "ClientClosed",
  ServerClosed: "ServerClosed",
  UserBusy: "UserBusy",
} as const;

class FormBase {
  titleText = "";
  bodyText = "";
  title(t: unknown) {
    this.titleText = asText(t);
    return this;
  }
  body(t: unknown) {
    this.bodyText = asText(t);
    return this;
  }
  async show(player: FakePlayer) {
    return getUi().takeResponse(player);
  }
}

export class ActionFormData extends FormBase {
  buttons: string[] = [];
  button(text: unknown, _iconPath?: string) {
    this.buttons.push(asText(text));
    return this;
  }
  divider() {
    return this;
  }
  header(_text: unknown) {
    return this;
  }
  label(_text: unknown) {
    return this;
  }
}

export class MessageFormData extends FormBase {
  button1Text = "";
  button2Text = "";
  button1(text: unknown) {
    this.button1Text = asText(text);
    return this;
  }
  button2(text: unknown) {
    this.button2Text = asText(text);
    return this;
  }
}

export class ModalFormData extends FormBase {
  controls: string[] = [];
  submitButtonText = "";
  dropdown(_label: unknown, _items: unknown, _opts?: unknown) {
    this.controls.push("dropdown");
    return this;
  }
  slider(_label: unknown, _min: number, _max: number, _opts?: unknown) {
    this.controls.push("slider");
    return this;
  }
  textField(_label: unknown, _placeholder?: unknown, _opts?: unknown) {
    this.controls.push("textField");
    return this;
  }
  toggle(_label: unknown, _opts?: unknown) {
    this.controls.push("toggle");
    return this;
  }
  divider() {
    return this;
  }
  header(_text: unknown) {
    return this;
  }
  label(_text: unknown) {
    return this;
  }
  submitButton(text: unknown) {
    this.submitButtonText = asText(text);
    return this;
  }
}

type ObsListener<T> = (v: T) => void;

class ObservableBase<T> {
  private _value: T;
  private listeners = new Set<ObsListener<T>>();
  constructor(initial: T) {
    this._value = initial;
  }
  get value(): T {
    return this._value;
  }
  set value(v: T) {
    this._value = v;
    for (const l of [...this.listeners]) l(v);
  }
  subscribe(cb: ObsListener<T>): ObsListener<T> {
    this.listeners.add(cb);
    return cb;
  }
  unsubscribe(cb: ObsListener<T>): boolean {
    return this.listeners.delete(cb);
  }
}

export class ObservableBoolean extends ObservableBase<boolean> {
  constructor(initial = false) {
    super(!!initial);
  }
}

export class ObservableNumber extends ObservableBase<number> {
  constructor(initial = 0) {
    super(Number(initial) || 0);
  }
}

export class ObservableString extends ObservableBase<string> {
  constructor(initial = "") {
    super(String(initial ?? ""));
  }
}

export class ObservableUIRawMessage extends ObservableBase<unknown> {
  constructor(initial: unknown = {}) {
    super(initial);
  }
}

type CustomWidget =
  | { kind: "button"; label: string; onClick: () => void }
  | { kind: "other"; label?: string };

/**
 * CustomForm：构造时绑定玩家；show() 无参；可用 queueResponse 驱动关闭原因与按钮。
 * queueResponse.selection = 按钮下标时触发对应 onClick。
 */
export class CustomForm {
  readonly player: FakePlayer;
  titleText: string;
  private showing = false;
  private widgets: CustomWidget[] = [];
  private closedByServer = false;

  constructor(player: FakePlayer, title: unknown) {
    this.player = player;
    this.titleText = asText(title);
  }

  button(label: unknown, onClick: () => void, _options?: unknown) {
    this.widgets.push({ kind: "button", label: asText(label), onClick });
    return this;
  }
  closeButton() {
    return this;
  }
  divider(_options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  dropdown(_label: unknown, _value: ObservableNumber, _items: unknown[], _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  header(_text: unknown, _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  image(_src: unknown, _pack: unknown, _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  label(_text: unknown, _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  slider(_label: unknown, _value: ObservableNumber, _min: number, _max: number, _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  spacer(_options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  textField(_label: unknown, _value: ObservableString, _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }
  toggle(_label: unknown, _value: ObservableBoolean, _options?: unknown) {
    this.widgets.push({ kind: "other" });
    return this;
  }

  isShowing() {
    return this.showing;
  }

  close() {
    if (!this.showing) {
      throw new Error("FormVisibilityError");
    }
    this.showing = false;
    this.closedByServer = true;
  }

  async show(): Promise<string> {
    if (this.showing) throw new Error("FormVisibilityError");
    this.showing = true;
    this.closedByServer = false;
    const res = getUi().takeResponse(this.player);
    if (typeof res.selection === "number") {
      const buttons = this.widgets.filter((w): w is Extract<CustomWidget, { kind: "button" }> => w.kind === "button");
      const btn = buttons[res.selection];
      try {
        btn?.onClick();
      } catch {
        /* 隔离回调异常 */
      }
    }
    this.showing = false;
    if (this.closedByServer || res.closeReason === DataDrivenScreenClosedReason.ServerClosed) {
      return DataDrivenScreenClosedReason.ServerClosed;
    }
    if (res.closeReason) return String(res.closeReason);
    if (res.canceled) {
      return res.cancelationReason === FormCancelationReason.UserBusy
        ? DataDrivenScreenClosedReason.UserBusy
        : DataDrivenScreenClosedReason.ClientClosed;
    }
    return DataDrivenScreenClosedReason.ClientClosed;
  }
}

/** MessageBox：构造绑定玩家；show() → { closeReason, selection? }。 */
export class MessageBox {
  readonly player: FakePlayer;
  titleText: string;
  bodyText = "";
  button1Text = "";
  button2Text = "";
  private showing = false;

  constructor(player: FakePlayer, title: unknown) {
    this.player = player;
    this.titleText = asText(title);
  }

  body(body: unknown) {
    this.bodyText = asText(body);
    return this;
  }
  button1(label: unknown, _tooltip?: unknown) {
    this.button1Text = asText(label);
    return this;
  }
  button2(label: unknown, _tooltip?: unknown) {
    this.button2Text = asText(label);
    return this;
  }
  isShowing() {
    return this.showing;
  }
  close() {
    if (!this.showing) throw new Error("FormVisibilityError");
    this.showing = false;
  }
  async show(): Promise<{ closeReason: string; selection?: number }> {
    if (this.showing) throw new Error("FormVisibilityError");
    this.showing = true;
    const res = getUi().takeResponse(this.player);
    this.showing = false;
    const closeReason =
      res.closeReason ??
      (res.canceled
        ? res.cancelationReason === FormCancelationReason.UserBusy
          ? DataDrivenScreenClosedReason.UserBusy
          : DataDrivenScreenClosedReason.ClientClosed
        : DataDrivenScreenClosedReason.ClientClosed);
    return {
      closeReason: String(closeReason),
      ...(typeof res.selection === "number" ? { selection: res.selection } : {}),
    };
  }
}

export const uiManager = {
  closeAllForms(player: FakePlayer) {
    getUi().clearPlayer(player);
  },
};

export type { FormResponse } from "./ui-host.js";
