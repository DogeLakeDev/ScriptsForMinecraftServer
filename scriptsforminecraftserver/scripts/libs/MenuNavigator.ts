import { Player, system } from "@minecraft/server";
import {
  CustomForm,
  MessageBox,
  DataDrivenScreenClosedReason,
  ObservableString,
  ObservableBoolean,
  ObservableNumber,
  TextFieldOptions,
  ToggleOptions,
  DropdownOptions,
  SliderOptions,
  DropdownItemData,
  ButtonOptions,
} from "@minecraft/server-ui";
import { Msg } from "./Tools";

export { ObservableString, ObservableBoolean, ObservableNumber };

export function obsStr(v = ""): ObservableString {
  return new ObservableString(v, { clientWritable: true } as any);
}
export function obsNum(v = 0): ObservableNumber {
  return new ObservableNumber(v, { clientWritable: true } as any);
}
export function obsBool(v = false): ObservableBoolean {
  return new ObservableBoolean(v, { clientWritable: true } as any);
}

export interface Page {
  button(label: string | ObservableString, onClick: () => void, options?: ButtonOptions): this;
  label(text: string | ObservableString): this;
  textField(label: string | ObservableString, text: ObservableString, options?: TextFieldOptions): this;
  toggle(label: string | ObservableString, toggled: ObservableBoolean, options?: ToggleOptions): this;
  dropdown(
    label: string | ObservableString,
    value: ObservableNumber,
    items: DropdownItemData[],
    options?: DropdownOptions
  ): this;
  slider(
    label: string | ObservableString,
    value: ObservableNumber,
    min: number | ObservableNumber,
    max: number | ObservableNumber,
    options?: SliderOptions
  ): this;
  divider(): this;
  header(text: string | ObservableString): this;
}

export class MenuNavigator {
  private sections: Map<string, { title: string; build: PageBuildFn }> = new Map();
  private sectionVis: Map<string, ObservableBoolean> = new Map();
  private history: string[] = [];
  private player: Player;
  private _onRootClose: (() => void) | null = null;
  private form: CustomForm | null = null;
  private titleObs: ObservableString = new ObservableString("");
  private backVis: ObservableBoolean = new ObservableBoolean(false);
  state: Record<string, any> = {};
  private _confirmIdx = 0;

  constructor(player: Player) {
    this.player = player;
  }
  onRootClose(cb: () => void): void {
    this._onRootClose = cb;
  }

  section(id: string, title: string, build: PageBuildFn): this {
    this.sections.set(id, { title, build });
    this.sectionVis.set(id, new ObservableBoolean(false));
    return this;
  }

  async start(sectionId: string): Promise<void> {
    this.history = [sectionId];
    this.applySection(sectionId);
    this.backVis.setData(false);
    await this.buildAndShow();
  }

  async rebuild(targetSection?: string): Promise<void> {
    if (this.form?.isShowing()) this.form.close();
    if (targetSection) {
      this.history.push(targetSection);
      this.applySection(targetSection);
    }
    await this.buildAndShow();
  }

  go(sectionId: string): void {
    this.history.push(sectionId);
    this.applySection(sectionId);
  }

  back(): void {
    if (this.history.length <= 1) return;
    this.history.pop();
    this.applySection(this.history[this.history.length - 1]);
  }

  leave(target: () => void): void {
    if (this.form?.isShowing()) this.form.close();
    target();
  }

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
      page.button("§a确认", () => {
        onConfirm?.();
        afterConfirm?.();
      });
      page.button("§7取消", () => {
        onCancel?.();
      });
    });
    await this.rebuild(confirmId);
  }

  async message(title: string, body: string): Promise<void> {
    const formWasOpen = this.form?.isShowing() ?? false;
    if (formWasOpen) this.form!.close();
    const box = new MessageBox(this.player, title);
    box.body(body);
    box.button1("§a确定");
    box.button2("§c关闭");
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

  private async buildAndShow(): Promise<void> {
    if (this.form?.isShowing()) this.form.close();
    this.form = new CustomForm(this.player, this.titleObs);
    this.form.button("§l← 回到上一级", () => this.back(), { visible: this.backVis });
    for (const [id, def] of this.sections) {
      const vis = this.sectionVis.get(id)!;
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
        if (reason === DataDrivenScreenClosedReason.UserBusy) {
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
    this.backVis.setData(this.history.length > 1);
    this.updateTitle();
  }

  private updateTitle(): void {
    const parts = this.history.map((id) => this.sections.get(id)?.title ?? id).filter(Boolean);
    this.titleObs.setData(parts.join(" > "));
  }
}

class PageBuilder implements Page {
  constructor(
    private form: CustomForm,
    private visible: ObservableBoolean
  ) {}
  button(l: string | ObservableString, onClick: () => void, opts?: ButtonOptions): this {
    this.form.button(l, onClick, { ...opts, visible: this.visible });
    return this;
  }
  label(t: string | ObservableString): this {
    this.form.label(t, { visible: this.visible });
    return this;
  }
  textField(l: string | ObservableString, t: ObservableString, o?: TextFieldOptions): this {
    this.form.textField(l, t, { ...o, visible: this.visible });
    return this;
  }
  toggle(l: string | ObservableString, t: ObservableBoolean, o?: ToggleOptions): this {
    this.form.toggle(l, t, { ...o, visible: this.visible });
    return this;
  }
  dropdown(l: string | ObservableString, v: ObservableNumber, items: DropdownItemData[], o?: DropdownOptions): this {
    this.form.dropdown(l, v, items, { ...o, visible: this.visible });
    return this;
  }
  slider(
    l: string | ObservableString,
    v: ObservableNumber,
    min: number | ObservableNumber,
    max: number | ObservableNumber,
    o?: SliderOptions
  ): this {
    this.form.slider(l, v, min, max, { ...o, visible: this.visible });
    return this;
  }
  divider(): this {
    this.form.divider({ visible: this.visible });
    return this;
  }
  header(t: string | ObservableString): this {
    this.form.header(t, { visible: this.visible });
    return this;
  }
}

export class FormStatus {
  private text: ObservableString;
  constructor(page: { label: (s: string | ObservableString) => any }) {
    this.text = obsStr("");
    page.label(this.text);
  }
  ok(msg: string): void { this.text.setData("§a✔ " + msg); }
  fail(msg: string): void { this.text.setData("§c✘ " + msg); }
  info(msg: string): void { this.text.setData("§7" + msg); }
  clear(): void { this.text.setData(""); }
}

type PageBuildFn = (page: Page, nav: MenuNavigator) => void | Promise<void>;
