/**
 * menu-navigator.ts — 多页 CustomForm 导航器与响应式控件绑定
 *
 * 基于 `@minecraft/server-ui` 的 CustomForm 封装，提供以下能力：
 * - 多分段（section）动态渲染与可视状态（ObservableBoolean）无缝切换
 * - 页面路由历史栈（start / rebuild / go / back / replace）
 * - 异步任务状态提示（FormStatus）与并发互斥保护
 * - 原生 MessageBox 确认框集成与超时防卡死轮询
 */

import { Player, system } from "@minecraft/server";
import * as serverUi from "@minecraft/server-ui";
import type {
  ButtonOptions,
  CustomForm,
  DataDrivenScreenClosedReason,
  DividerOptions,
  DropdownItemData,
  DropdownOptions,
  ImageOptions,
  MessageBox,
  ObservableBoolean,
  ObservableNumber,
  ObservableString,
  SliderOptions,
  SpacingOptions,
  TextFieldOptions,
  TextOptions,
  ToggleOptions,
} from "@minecraft/server-ui";
import { mergeSectionVisible } from "./form-visible.js";
import { Msg } from "./msg.js";
import { popHistory, pushOrRewind, replaceOrRewind } from "./nav-stack.js";
import { stripDduiButtonFormatting } from "./ui-text.js";

export { mergeSectionVisible } from "./form-visible.js";
export { popHistory, pushOrRewind, replaceOrRewind } from "./nav-stack.js";

const CustomFormCtor = (serverUi as Record<string, any>).CustomForm as typeof CustomForm | undefined;
const MessageBoxCtor = (serverUi as Record<string, any>).MessageBox as typeof MessageBox | undefined;
const ObservableBooleanCtor = (serverUi as Record<string, any>).ObservableBoolean as typeof ObservableBoolean | undefined;
const ObservableNumberCtor = (serverUi as Record<string, any>).ObservableNumber as typeof ObservableNumber | undefined;
const ObservableStringCtor = (serverUi as Record<string, any>).ObservableString as typeof ObservableString | undefined;
const DataDrivenScreenClosedReasonEnum = (serverUi as Record<string, any>).DataDrivenScreenClosedReason as typeof DataDrivenScreenClosedReason | undefined;

export {
  ObservableBooleanCtor as ObservableBoolean,
  ObservableNumberCtor as ObservableNumber,
  ObservableStringCtor as ObservableString,
};

/**
 * 创建客户端可写（`clientWritable: true`）的响应式字符串 Observable 对象。
 *
 * @param v 初始字符串值，缺省为空字符串。
 * @returns 响应式字符串对象。
 */
export function obsStr(v = ""): ObservableString {
  if (!ObservableStringCtor) {
    throw new Error("当前环境下的 @minecraft/server-ui 不支持 ObservableString（需 Preview/DDUI 支持）");
  }
  return new ObservableStringCtor(v, { clientWritable: true } as any);
}

/**
 * 创建客户端可写（`clientWritable: true`）的响应式数字 Observable 对象。
 *
 * @param v 初始数值，缺省为 0。
 * @returns 响应式数字对象。
 */
export function obsNum(v = 0): ObservableNumber {
  if (!ObservableNumberCtor) {
    throw new Error("当前环境下的 @minecraft/server-ui 不支持 ObservableNumber（需 Preview/DDUI 支持）");
  }
  return new ObservableNumberCtor(v, { clientWritable: true } as any);
}

/**
 * 创建客户端可写（`clientWritable: true`）的响应式布尔 Observable 对象。
 *
 * @param v 初始布尔值，缺省为 `false`。
 * @returns 响应式布尔对象。
 */
export function obsBool(v = false): ObservableBoolean {
  if (!ObservableBooleanCtor) {
    throw new Error("当前环境下的 @minecraft/server-ui 不支持 ObservableBoolean（需 Preview/DDUI 支持）");
  }
  return new ObservableBooleanCtor(v, { clientWritable: true } as any);
}

/** CustomForm 页面构建器接口（支持链式添加各类表单控件）。 */
export interface Page {

  /** 添加按钮。DDUI 不支持格式化代码；静态字符串会自动清理，ObservableString 应只写入纯文本。 */
  button(label: string | ObservableString, onClick: () => void, options?: ButtonOptions): this;
  /** 添加标签文本。 */
  label(text: string | ObservableString, options?: TextOptions): this;
  /** 添加文本输入框。 */
  textField(label: string | ObservableString, text: ObservableString, options?: TextFieldOptions): this;
  /** 添加开关。 */
  toggle(label: string | ObservableString, toggled: ObservableBoolean, options?: ToggleOptions): this;
  /** 添加下拉框。 */
  dropdown(
    label: string | ObservableString,
    value: ObservableNumber,
    items: DropdownItemData[],
    options?: DropdownOptions
  ): this;
  /** 添加滑块。 */
  slider(
    label: string | ObservableString,
    value: ObservableNumber,
    min: number | ObservableNumber,
    max: number | ObservableNumber,
    options?: SliderOptions
  ): this;
  /** 添加分隔线。 */
  divider(options?: DividerOptions): this;
  /** 添加间距留白。 */
  spacer(options?: SpacingOptions): this;
  /** 添加图像。 */
  image(src: string | ObservableString, pack: string | ObservableString, options?: ImageOptions): this;
  /** 添加标题行。 */
  header(text: string | ObservableString, options?: TextOptions): this;
}

/** 多页 CustomForm 导航器：section 切换、历史栈与异步任务状态。 */
export class MenuNavigator {
  private sections: Map<string, { title: string; build: PageBuildFn }> = new Map();
  private sectionVis: Map<string, ObservableBoolean> = new Map();
  private history: string[] = [];
  private player: Player;
  private form: CustomForm | null = null;
  private titleObs: ObservableString | null = null;
  private backVis: ObservableBoolean | null = null;
  /** 跨页面共享的状态对象。 */
  state: Record<string, any> = {};
  private _confirmIdx = 0;
  private taskRunning = false;
  private sessionToken = 0;
  private onBack: (() => void) | undefined;

  constructor(player: Player) {
    this.player = player;
    if (ObservableStringCtor && ObservableBooleanCtor) {
      this.titleObs = new ObservableStringCtor("");
      this.backVis = new ObservableBooleanCtor(false);
    }
  }

  /** 当前面包屑栈（从根到当前页）。 */
  stack(): readonly string[] {
    return this.history;
  }

  /** 原生「回到上一级」弹栈后回调，供声明式运行时同步 session。 */
  setOnBack(handler: () => void): this {
    this.onBack = handler;
    return this;
  }

  /** 注册一个 section（id、标题与构建函数）。 */
  section(id: string, title: string, build: PageBuildFn): this {
    this.sections.set(id, { title, build });
    if (ObservableBooleanCtor) {
      this.sectionVis.set(id, new ObservableBooleanCtor(false));
    }
    return this;
  }

  /** 从指定 section 打开菜单并重置历史栈。 */
  async start(sectionId: string): Promise<void> {
    const token = ++this.sessionToken;
    this.history = [sectionId];
    this.applySection(sectionId);
    this.backVis?.setData(false);
    await this.buildAndShow(token);
  }

  /** 重建并显示表单；传入目标时前进压栈，已在栈中则回退面包屑。 */
  async rebuild(targetSection?: string): Promise<void> {
    const token = ++this.sessionToken;
    if (this.form?.isShowing()) this.form.close();
    if (targetSection) {
      this.history = pushOrRewind(this.history, targetSection);
      this.applySection(targetSection);
    }
    await this.buildAndShow(token);
  }

  /** 刷新当前页面（等价于无参 `rebuild`）。 */
  async refresh(): Promise<void> {
    await this.rebuild();
  }

  /** 替换历史栈顶 section 并重建表单。 */
  async replace(targetSection: string): Promise<void> {
    const token = ++this.sessionToken;
    this.history = replaceOrRewind(this.history, targetSection);
    this.applySection(targetSection);
    await this.buildAndShow(token);
  }

  /** 在表单上显示异步任务状态；同时只允许一个任务运行。 */
  async runTask(status: FormStatus, task: () => Promise<void>, onError = "操作失败，请稍后重试。"): Promise<void> {
    if (this.taskRunning) return;
    this.taskRunning = true;
    status.info("正在处理，请稍候...");
    try {
      await task();
    } catch (error) {
      console.warn(`[MenuNavigator] task failed: ${(error as Error).message || error}`);
      const message = error instanceof Error && error.message ? error.message : onError;
      status.fail(message);
    } finally {
      this.taskRunning = false;
    }
  }

  /** 弹出 MessageBox 确认框；返回是否点击确认。 */
  async confirmMessage(title: string, body: string, confirm = "确认", cancel = "取消"): Promise<boolean> {
    if (this.form?.isShowing()) this.form.close();
    if (!MessageBoxCtor) {
      throw new Error("当前环境下的 @minecraft/server-ui 不支持 MessageBox");
    }
    const box = new MessageBoxCtor(this.player, title);
    box.body(body).button1(confirm).button2(cancel);
    for (let i = 0; i < 20; i++) {
      try {
        const result = await box.show();
        if (result.closeReason === DataDrivenScreenClosedReasonEnum?.UserBusy) {
          await system.waitTicks(10);
          continue;
        }
        return result.closeReason === DataDrivenScreenClosedReasonEnum?.ClientClosed && result.selection === 0;
      } catch {
        await system.waitTicks(2);
      }
    }
    return false;
  }

  /** 压栈并切换到指定 section（不立即重建，需随后调用 rebuild）。 */
  go(sectionId: string): void {
    this.history = pushOrRewind(this.history, sectionId);
    this.applySection(sectionId);
  }

  /** 返回上一级 section。`notify=false` 时不触发 onBack，避免声明式返回重复 rebuild。 */
  back(notify = true): void {
    if (this.history.length <= 1) return;
    this.history = popHistory(this.history);
    const last = this.history[this.history.length - 1];
    if (last) this.applySection(last);
    if (notify) this.onBack?.();
  }

  /** 关闭当前表单并执行回调（如退出菜单流程）。 */
  leave(target: () => void): void {
    this.sessionToken++;
    if (this.form?.isShowing()) this.form.close();
    target();
  }

  /** 在当前表单内嵌确认页（确认/取消按钮）。 */
  async confirm(
    title: string,
    body: string,
    onConfirm?: () => void,
    afterConfirm?: () => void,
    onCancel?: () => void
  ): Promise<void> {
    const confirmId = `_cf${this._confirmIdx++}`;
    this.section(confirmId, title, (page) => {
      page.label(body);
      page.button("确认", () => {
        onConfirm?.();
        afterConfirm?.();
      });
      page.button("取消", () => {
        onCancel?.();
      });
    });
    await this.rebuild(confirmId);
  }

  /** 弹出 MessageBox 提示；若之前有表单打开且点确定则 rebuild 返回。 */
  async message(title: string, body: string): Promise<void> {
    const formWasOpen = this.form?.isShowing() ?? false;
    if (formWasOpen) this.form!.close();
    if (!MessageBoxCtor) {
      throw new Error("当前环境下的 @minecraft/server-ui 不支持 MessageBox");
    }
    const box = new MessageBoxCtor(this.player, title);
    box.body(body);
    box.button1("确定");
    box.button2("关闭");
    let result: any;
    for (let i = 0; i < 20; i++) {
      try {
        result = await box.show();
        break;
      } catch {
        await system.waitTicks(10);
      }
    }
    // 点击"确定"且之前有表单 → rebuild 返回
    if (formWasOpen && result?.selection === 0) {
      await this.rebuild();
    }
  }

  private async buildAndShow(token = this.sessionToken): Promise<void> {
    if (token !== this.sessionToken) return;
    if (this.form?.isShowing()) this.form.close();
    if (!CustomFormCtor || !this.titleObs || !this.backVis) {
      throw new Error("当前环境下的 @minecraft/server-ui 不支持 CustomForm (DDUI)，请在支持 DDUI 的 BDS 版本运行");
    }
    this.form = new CustomFormCtor(this.player, this.titleObs);
    this.form.button("← 回到上一级", () => this.back(), { visible: this.backVis });
    for (const [id, def] of this.sections) {
      if (token !== this.sessionToken) return;
      const vis = this.sectionVis.get(id);
      if (!vis) continue;
      const page = new PageBuilder(this.form, vis);
      await def.build(page, this);
    }
    this.form.closeButton();

    const startTick = system.currentTick;
    let notified = false;
    while (true) {
      if (system.currentTick - startTick >= 160) {
        if (notified) Msg.warning("菜单处理超时（8秒），请重新打开。", this.player);
        break;
      }
      try {
        const reason = await this.form.show();
        if (token !== this.sessionToken) return;
        if (reason === DataDrivenScreenClosedReasonEnum?.UserBusy) {
          if (!notified) {
            notified = true;
            Msg.info("您有一则菜单处理，请关闭当前界面后显示。§7（超时8秒）", this.player);
          }
          await system.waitTicks(10);
          continue;
        }
        break;
      } catch {
        break;
      }
    }
  }

  private applySection(sectionId: string): void {
    for (const [id, vis] of this.sectionVis) vis.setData(id === sectionId);
    this.backVis?.setData(this.history.length > 1);
    this.updateTitle();
  }

  private updateTitle(): void {
    const parts = this.history.map((id) => this.sections.get(id)?.title ?? id).filter(Boolean);
    this.titleObs?.setData(parts.join(" > "));
  }
}

class PageBuilder implements Page {
  constructor(
    private form: CustomForm,
    private visible: ObservableBoolean
  ) {}
  button(l: string | ObservableString, onClick: () => void, opts?: ButtonOptions): this {
    const label = typeof l === "string" ? stripDduiButtonFormatting(l) : l;
    this.form.button(label, onClick, {
      ...opts,
      visible: mergeSectionVisible(this.visible, opts?.visible),
    });
    return this;
  }
  label(t: string | ObservableString, o?: TextOptions): this {
    this.form.label(t, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  textField(l: string | ObservableString, t: ObservableString, o?: TextFieldOptions): this {
    this.form.textField(l, t, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  toggle(l: string | ObservableString, t: ObservableBoolean, o?: ToggleOptions): this {
    this.form.toggle(l, t, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  dropdown(l: string | ObservableString, v: ObservableNumber, items: DropdownItemData[], o?: DropdownOptions): this {
    this.form.dropdown(l, v, items, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  slider(
    l: string | ObservableString,
    v: ObservableNumber,
    min: number | ObservableNumber,
    max: number | ObservableNumber,
    o?: SliderOptions
  ): this {
    this.form.slider(l, v, min, max, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  divider(o?: DividerOptions): this {
    this.form.divider({ ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  spacer(o?: SpacingOptions): this {
    this.form.spacer({ ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  image(src: string | ObservableString, pack: string | ObservableString, o?: ImageOptions): this {
    this.form.image(src, pack, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
  header(t: string | ObservableString, o?: TextOptions): this {
    this.form.header(t, { ...o, visible: mergeSectionVisible(this.visible, o?.visible) });
    return this;
  }
}

/** 表单内联状态行（成功/失败/提示/清空）。 */
export class FormStatus {
  private text: ObservableString;
  /** 绑定到 page 的 label 控件。 */
  constructor(page: { label: (s: string | ObservableString) => any }) {
    this.text = obsStr("");
    page.label(this.text);
  }
  /** 显示成功状态。 */
  ok(msg: string): void {
    this.text.setData("§a✔ " + msg);
  }
  /** 显示失败状态。 */
  fail(msg: string): void {
    this.text.setData("§c✘ " + msg);
  }
  /** 显示提示信息。 */
  info(msg: string): void {
    this.text.setData("§7" + msg);
  }
  /** 清空状态行。 */
  clear(): void {
    this.text.setData("");
  }
}

type PageBuildFn = (page: Page, nav: MenuNavigator) => void | Promise<void>;
/** section 构建函数签名：交给 `MenuNavigator.section(id, title, build)`。 */
export type { PageBuildFn };
