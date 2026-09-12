/**
 * 表单防吞重试管道（UserBusy ≈ 8 秒）
 */

import { Player, system } from "@minecraft/server";
import {
  ActionFormData,
  FormCancelationReason,
  MessageFormData,
  ModalFormData,
} from "@minecraft/server-ui";
import { Msg } from "../runtime/msg.js";

export type ShowableForm = {
  show: (player: Player) => Promise<unknown>;
};

export interface BusyRetryOptions {
  maxRetries?: number;
  retryTicks?: number;
  notify?: boolean;
}

/**
 * 统一代理 ActionForm / ModalForm / MessageForm 展现，捕获 UserBusy 重试。
 */
export async function showFormWithBusyRetry(
  player: Player,
  form: ShowableForm,
  opts: BusyRetryOptions = {},
): Promise<unknown> {
  const maxRetries = opts.maxRetries ?? 16;
  const retryTicks = opts.retryTicks ?? 10;
  let notified = false;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = (await form.show(player)) as {
        cancelationReason?: FormCancelationReason;
        canceled?: boolean;
      };
      if (result?.cancelationReason === FormCancelationReason.UserBusy) {
        if (!notified && opts.notify !== false) {
          notified = true;
          Msg.info("界面繁忙，正在重试唤起…§7（约 8 秒）", player);
        }
        await system.waitTicks(retryTicks);
        continue;
      }
      return result;
    } catch {
      await system.waitTicks(retryTicks);
    }
  }
  if (opts.notify !== false) {
    Msg.warning("表单唤起超时，请稍后重试。", player);
  }
  return undefined;
}

/** ActionFormData 轻量封装：divider / header / label + 繁忙重试 show。 */
export class ActionForm {
  private form = new ActionFormData();

  title(t: string): this {
    this.form.title(t);
    return this;
  }
  body(t: string): this {
    this.form.body(t);
    return this;
  }
  button(t: string, icon?: string): this {
    this.form.button(t, icon);
    return this;
  }
  divider(): this {
    this.form.divider();
    return this;
  }
  header(t: string): this {
    this.form.header(t);
    return this;
  }
  label(t: string): this {
    this.form.label(t);
    return this;
  }
  show(player: Player, opts?: BusyRetryOptions): Promise<unknown> {
    return showFormWithBusyRetry(player, this.form, opts);
  }
}

/** ModalFormData 封装。 */
export class ModalForm {
  private form = new ModalFormData();

  title(t: string): this {
    this.form.title(t);
    return this;
  }
  textField(label: string, placeholder = "", defaultValue = ""): this {
    this.form.textField(label, placeholder, { defaultValue } as never);
    return this;
  }
  toggle(label: string, defaultValue = false): this {
    this.form.toggle(label, { defaultValue } as never);
    return this;
  }
  divider(): this {
    this.form.divider();
    return this;
  }
  show(player: Player, opts?: BusyRetryOptions): Promise<unknown> {
    return showFormWithBusyRetry(player, this.form, opts);
  }
}

/** MessageForm 确认框。 */
export async function showConfirm(
  player: Player,
  title: string,
  body: string,
  confirmText = "确认",
  cancelText = "取消",
  opts?: BusyRetryOptions,
): Promise<boolean> {
  const form = new MessageFormData();
  form.title(title);
  form.body(body);
  form.button1(confirmText);
  form.button2(cancelText);
  const result = (await showFormWithBusyRetry(player, form, opts)) as {
    selection?: number;
    canceled?: boolean;
  } | undefined;
  if (!result || result.canceled) return false;
  return result.selection === 0;
}
