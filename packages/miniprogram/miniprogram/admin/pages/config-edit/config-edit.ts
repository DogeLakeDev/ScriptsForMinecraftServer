/**
 * config-edit — 配置编辑（表单 / 源码）
 *
 * 使用场景：从配置列表进入，读取 config.read 的原文编辑。默认「表单」视图，字段规则与桌面端相同：
 * JSON 有 Schema 时按 Schema 生成，没有时按顶层基础类型推断；server.properties 用平台下发的完整字段清单（旧平台回退常用字段）。
 * 表单的每次修改都回写到原文（保留注释与未知字段），「源码」视图编辑的是同一份文本。
 * 保存走 config.save，携带读取时的 revision 防止覆盖他人修改；保存任务完成后重新读取以拿到新 revision。
 * JSON 语法错误时禁止保存（json 严格解析；jsonc 允许注释与尾逗号，规则来自桌面端 parseJsonText）。
 */
import { restartBlockReason, restartServices, submit } from "../../../core/actions";
import { describeKey } from "../../core/config-keys";
import { errorText, isTaskDone } from "../../../core/format";
import { connectionView, unwatchSession, watchSession } from "../../../core/page";
import { session, type SessionState } from "../../../core/session";
import type { ConfigDocument } from "../../../core/types";
import { fieldsFromSchema, fieldsFromValue, parseJsonText, parseProperties, propertyFormFields, setJsonField, setProperty } from "../../../vendor/desktop-lib";

/** 桌面端 config-form 的字段描述（vendor 只导出函数，类型从返回值取） */
type FieldSpec = ReturnType<typeof fieldsFromSchema>[0][number];

/** 当前打开的文档、编辑视图与待完成的保存任务（不放进 data） */
const editor = {
  key: "",
  document: null as ConfigDocument | null,
  text: "",
  view: "form" as "form" | "source",
  pendingSave: null as { operationId: string; text: string } | null,
  sequence: 0,
};

/**
 * 当前文本可表单化的字段与取值。
 * 使用场景：render 生成表单展示数据，字段修改时按 key 找回字段类型与范围。
 * state：none 尚未读取；syntax JSON 语法错误；empty 没有可表单化的字段；fields 正常。
 */
function formModel(document: ConfigDocument | null, text: string) {
  if (!document) return { state: "none" as const, specs: [] as FieldSpec[], values: new Map<string, unknown>(), foot: "" };
  if (document.format === "properties") {
    const properties = parseProperties(text);
    const [specs, others] = propertyFormFields(text, document.fields);
    return {
      state: specs.length ? ("fields" as const) : ("empty" as const),
      specs,
      values: properties as Map<string, unknown>,
      foot: others > 0 ? `另有 ${others} 项属性未列入表单，可在「源码」视图中编辑。` : "",
    };
  }
  const value = parseJsonText(text);
  if (!value) return { state: "syntax" as const, specs: [] as FieldSpec[], values: new Map<string, unknown>(), foot: "" };
  const [specs, skipped] = document.schema ? fieldsFromSchema(document.schema) : fieldsFromValue(value);
  return {
    state: specs.length ? ("fields" as const) : ("empty" as const),
    specs,
    values: new Map(Object.entries(value)),
    foot: skipped > 0 ? `另有 ${skipped} 个对象或数组字段，可在「源码」视图中编辑。` : "",
  };
}

/** 数字输入框的键盘：非负整数用数字键盘，非负小数用带小数点的键盘，可能为负时用普通键盘 */
function numberInputType(field: FieldSpec): "number" | "digit" | "text" {
  if (field.min === undefined || field.min < 0) return "text";
  return field.integer ? "number" : "digit";
}

/** 表单展示数据：WXML 不能调用函数，控件需要的文字、勾选、选项序号在这里算好 */
function formView(document: ConfigDocument | null, text: string) {
  const model = formModel(document, text);
  const properties = document?.format === "properties";
  const fields = model.specs.map((field) => {
    const value = model.values.get(field.key);
    const options = field.options ?? [];
    const optionIndex = options.findIndex((option) => option.value === String(value));
    return {
      key: field.key,
      group: field.group ?? "",
      kind: field.kind,
      label: field.label ?? field.key,
      // 与桌面端一致：没有中文名时 key 本身用等宽字体；server.properties 另起一行显示 key
      mono: !field.label,
      showKey: properties && Boolean(field.label),
      description: field.description ?? "",
      text: value === undefined || value === null ? "" : String(value),
      checked: value === true || value === "true",
      options: options.map((option) => option.label),
      optionIndex: Math.max(optionIndex, 0),
      optionLabel: optionIndex >= 0 ? options[optionIndex]!.label : value === undefined ? "未设置" : String(value),
      inputType: numberInputType(field),
    };
  });
  const names = [...new Set(fields.map((field) => field.group))];
  // JSON 有 Schema 时与桌面端一样加「常用设置」标题；推断出的字段不分组
  const title = (name: string) => name || (document?.schema ? "常用设置" : "");
  return {
    state: model.state,
    groups: names.map((name) => ({ name: title(name), fields: fields.filter((field) => field.group === name) })),
    foot: model.foot,
  };
}

/** 语法检查：返回错误说明，无错误返回空字符串 */
function syntaxError(document: ConfigDocument | null, text: string): string {
  if (!document || document.format === "properties") return "";
  if (document.format === "json") {
    try {
      const value: unknown = JSON.parse(text);
      return value && typeof value === "object" && !Array.isArray(value) ? "" : "顶层必须是对象";
    } catch (error) {
      return errorText(error);
    }
  }
  return parseJsonText(text) ? "" : "JSONC 语法错误";
}

function render(state: SessionState) {
  const document = editor.document;
  const dirty = Boolean(document && editor.text !== document.text);
  const names = new Map(state.modules.map((row) => [row.id, row.name]));
  return {
    ...connectionView(state),
    editable: session.editable && session.can("manual-restart"),
    key: editor.key,
    title: describeKey(editor.key, names).title,
    format: document?.format ?? "",
    hasSchema: Boolean(document?.schema),
    affected: document?.affectedServices.join("、") ?? "",
    dirty,
    saving: Boolean(editor.pendingSave),
    syntax: syntaxError(document, editor.text),
    restartReason: restartBlockReason("all", dirty || Boolean(editor.pendingSave)),
    view: editor.view,
    form: formView(document, editor.text),
  };
}

Page({
  data: {
    ...render(session.state),
    text: "",
    loading: false,
    loadError: "",
    saveError: "",
  },
  onLoad(query: Record<string, string | undefined>) {
    editor.key = decodeURIComponent(query.key ?? "");
    editor.document = null;
    editor.text = "";
    editor.view = "form";
    editor.pendingSave = null;
    void this.load();
  },
  onShow() {
    watchSession(this, ["connection", "tasks", "services", "modules"], (state) => {
      this.checkSave(state);
      return render(state);
    });
  },
  onHide() {
    unwatchSession(this);
  },
  onUnload() {
    unwatchSession(this);
    editor.sequence++;
    wx.disableAlertBeforeUnload();
  },

  /** 读取配置；submittedText 用于保存后重读时保留保存后又继续编辑的草稿 */
  async load(submittedText?: string) {
    const sequence = ++editor.sequence;
    this.setData({ loading: true, loadError: "" });
    try {
      const document = await session.request("config.read", { key: editor.key });
      if (sequence !== editor.sequence) return;
      editor.document = document;
      if (submittedText === undefined || editor.text === submittedText) editor.text = document.text;
      this.setData({ ...render(session.state), text: editor.text });
      wx.setNavigationBarTitle({ title: this.data.title as string });
    } catch (error) {
      if (sequence === editor.sequence) this.setData({ loadError: errorText(error) });
    } finally {
      if (sequence === editor.sequence) this.setData({ loading: false });
      this.syncLeaveGuard();
    }
  },
  retry() {
    void this.load(editor.pendingSave?.text);
  },

  onInput(event: WechatMiniprogram.Input) {
    editor.text = event.detail.value;
    this.setData(render(session.state));
    this.syncLeaveGuard();
  },

  /** 切换「表单 / 源码」视图；两者编辑同一份文本，切换不丢修改 */
  setView(event: WechatMiniprogram.TouchEvent) {
    const view = event.currentTarget.dataset.value as typeof editor.view;
    if (view === editor.view) return;
    editor.view = view;
    this.setData({ ...render(session.state), text: editor.text });
  },
  /** 按 key 取当前文本中的表单字段（类型、范围以此为准，不信任 dataset 里的展示数据） */
  fieldOf(event: WechatMiniprogram.BaseEvent): FieldSpec | undefined {
    const key = event.currentTarget.dataset.key as string;
    return formModel(editor.document, editor.text).specs.find((field) => field.key === key);
  },
  /** 把一个字段的新值回写到原文：properties 按行替换，JSON 用 jsonc-parser 修改并保留注释 */
  applyField(field: FieldSpec, value: string | number | boolean) {
    const data = this.data as unknown as ReturnType<typeof render> & { loading: boolean };
    const document = editor.document;
    if (!document || !data.editable || data.loading || editor.pendingSave) return;
    editor.text = document.format === "properties" ? setProperty(editor.text, field.key, String(value)) : setJsonField(editor.text, field.key, value);
    this.setData({ ...render(session.state), text: editor.text });
    this.syncLeaveGuard();
  },
  onFieldToggle(event: WechatMiniprogram.TouchEvent) {
    const field = this.fieldOf(event);
    if (field?.kind !== "boolean") return;
    const current = formModel(editor.document, editor.text).values.get(field.key);
    this.applyField(field, !(current === true || current === "true"));
  },
  onFieldPick(event: WechatMiniprogram.PickerChange) {
    const field = this.fieldOf(event);
    const option = field?.options?.[Number(event.detail.value)];
    if (field && option) this.applyField(field, option.value);
  },
  /** 文本与密码字段：逐字回写（与桌面端 TextInput 相同） */
  onFieldText(event: WechatMiniprogram.Input) {
    const field = this.fieldOf(event);
    if (field) this.applyField(field, event.detail.value);
  },
  /** 数字字段：失焦或确认时提交，按 integer/min/max 规整（与桌面端 NumberInput 失焦行为一致）；无效输入还原为原值 */
  onFieldNumber(event: WechatMiniprogram.InputBlur) {
    const field = this.fieldOf(event);
    if (!field) return;
    const raw = String(event.detail.value).trim();
    let value = raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(value)) {
      this.setData(render(session.state));
      return;
    }
    if (field.integer) value = Math.round(value);
    if (field.min !== undefined) value = Math.max(field.min, value);
    if (field.max !== undefined) value = Math.min(field.max, value);
    this.applyField(field, value);
  },

  /** 有未保存修改时拦截返回 */
  syncLeaveGuard() {
    if (editor.document && editor.text !== editor.document.text) wx.enableAlertBeforeUnload({ message: "配置有尚未保存的修改，离开后将丢失。" });
    else wx.disableAlertBeforeUnload();
  },

  discard() {
    if (!editor.document || editor.pendingSave) return;
    editor.text = editor.document.text;
    this.setData({ ...render(session.state), text: editor.text, saveError: "" });
    this.syncLeaveGuard();
  },

  async save() {
    const document = editor.document;
    const data = this.data as unknown as ReturnType<typeof render>;
    if (!document || !data.dirty || data.syntax || editor.pendingSave || !data.editable) return;
    const submittedText = editor.text;
    this.setData({ saveError: "" });
    const operationId = await submit(this, "config.save", { key: document.key, text: submittedText, revision: document.revision }, `保存 ${data.title}`, {
      description: `将写入 ${document.key}。保存后可手动重启服务使配置生效。`,
      okText: "保存",
    });
    if (!operationId) return;
    editor.pendingSave = { operationId, text: submittedText };
    this.setData(render(session.state));
  },

  /** 保存任务结束后重读（失败但已写入时同样重读，与桌面端一致） */
  checkSave(state: SessionState) {
    const pending = editor.pendingSave;
    if (!pending) return;
    const record = state.tasks.find((row) => row.id === pending.operationId);
    if (!record || !isTaskDone(record.status)) return;
    editor.pendingSave = null;
    if (record.status !== "succeeded") this.setData({ saveError: record.error?.message ?? "配置保存已中断，未保存的修改已保留" });
    const saved = record.status === "succeeded" || (record.error?.details as { saved?: boolean } | undefined)?.saved === true;
    if (saved) void this.load(pending.text);
  },

  restart() {
    const data = this.data as unknown as ReturnType<typeof render>;
    restartServices(this, "all", data.dirty || data.saving);
  },
});
