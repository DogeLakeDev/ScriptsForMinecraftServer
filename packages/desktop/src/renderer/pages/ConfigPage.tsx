/**
 * ConfigPage.tsx — 配置编辑
 *
 * 使用场景：左侧按"核心 / BDS / 模块"分组列出可编辑配置，右侧提供表单与源码两种视图。
 * 表单视图由 JSON Schema（或平台下发的 server.properties 字段清单，旧平台回退常用字段）生成，修改始终回写到原文以保留注释与未知字段；
 * config.save 只保存文件（携带读取时的 revision 防止覆盖他人修改），需要时由独立按钮重启服务。
 */
import Editor from "@monaco-editor/react";
import type { ConfigDocument } from "@sfmc-bds/management";
import * as monaco from "monaco-editor";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDesktop, useUnsavedChanges } from "../app/desktop.js";
import { FONT_MONO, useAppearance } from "../app/theme.js";
import { Button, NumberInput, PasswordInput, SearchInput, Segmented, Select, Switch, TextInput } from "../components/controls.js";
import { Spinner, useConfirm } from "../components/feedback.js";
import { Icon, type IconName } from "../components/icons.js";
import { ManualRestartNotice, RestartServicesButton, useManualRestartSupport } from "../components/RestartServicesButton.js";
import { Tooltip } from "../components/tooltip.js";
import { Badge, Callout, EmptyState, PageHeader, SettingRow } from "../components/ui.js";
import { fieldsFromSchema, fieldsFromValue, parseJsonText, parseProperties, propertyFormFields, setJsonField, setProperty, type FieldSpec } from "../lib/config-form.js";
import { errorText, isTaskDone } from "../lib/format.js";

/** 核心配置文件的友好名称 */
const CORE_NAMES: Record<string, string> = {
  "runtime.json": "运行时",
  "db_config.json": "数据服务",
  "qq_config.json": "QQ 互通",
  "bds_updater.json": "BDS 更新",
  "permissions.json": "权限",
  "log-filter.json": "日志过滤",
  "module-update.json": "模块更新",
  "pack-update.json": "世界包更新",
  "server.properties": "BDS配置",
};

/**
 * 配置键的分组与展示信息。
 * names：模块逻辑 id → 目录中的展示名。使用场景：真实实例的模块配置按 configKey 分组，侧栏显示「经济系统」而不是 economy。
 */
function describeKey(key: string, names?: Map<string, string>): { group: string; title: string; file: string; icon: IconName } {
  const parts = key.split("/");
  const file = parts.at(-1) ?? key;
  if (parts[0] === "core") return { group: "核心配置", title: CORE_NAMES[file] ?? file, file, icon: "settings" };
  if (parts[0] === "bds") return { group: "BDS", title: CORE_NAMES[file] ?? file, file, icon: "cube" };
  if (parts[0] === "module") {
    const id = parts[1] ?? "";
    const label = names?.get(id);
    return { group: label && label !== id ? label : `模块 ${id}`, title: file, file: parts.slice(1).join("/"), icon: "modules" };
  }
  return { group: "其他", title: file, file: key, icon: "fileCode" };
}

/** 表单字段控件：根据字段类型渲染并把新值交给 onChange（null 表示忽略本次输入） */
function FieldControl({ field, value, disabled, onChange }: { field: FieldSpec; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const label = field.label ?? field.key;
  if (field.kind === "boolean") return <Switch size="sm" label={label} checked={value === true || value === "true"} disabled={disabled} onChange={onChange} />;
  if (field.kind === "enum")
    return <Select label={label} value={value === undefined ? undefined : String(value)} disabled={disabled} options={field.options ?? []} onChange={onChange} width={200} variant="outline" />;
  if (field.kind === "number")
    return (
      <NumberInput
        label={label}
        value={value === undefined || value === "" ? null : Number(value)}
        disabled={disabled}
        min={field.min}
        max={field.max}
        integer={field.integer}
        onChange={(next) => next !== null && onChange(next)}
        width={200}
      />
    );
  if (field.kind === "secret") return <PasswordInput aria-label={label} value={String(value ?? "")} disabled={disabled} onChange={onChange} variant="outline" style={{ width: 280 }} />;
  return <TextInput aria-label={label} value={String(value ?? "")} disabled={disabled} onChange={onChange} variant="outline" style={{ width: 280 }} />;
}

/** 表单视图 */
function ConfigForm({ document, text, setText, editable }: { document: ConfigDocument; text: string; setText: (text: string) => void; editable: boolean }) {
  if (document.format === "properties") {
    const values = parseProperties(text);
    const [fields, others] = propertyFormFields(text, document.fields);
    if (!fields.length) return <EmptyState compact icon="fileCode" title="没有可识别的常用字段" description="请切换到“源码”视图编辑此文件" />;
    const groups = [...new Set(fields.map((field) => field.group ?? ""))];
    return (
      <div className="form-groups">
        {groups.map((group) => (
          <section key={group} className="form-group">
            <h3>{group}</h3>
            {fields.filter((field) => field.group === group).map((field) => (
              <SettingRow
                key={field.key}
                label={<>{field.label}<span className="setting-key mono">{field.key}</span></>}
                description={field.description}
                control={<FieldControl field={field} value={values.get(field.key)} disabled={!editable} onChange={(next) => setText(setProperty(text, field.key, String(next)))} />}
              />
            ))}
          </section>
        ))}
        {others > 0 && <p className="form-foot">另有 {others} 项属性未列入表单，可在“源码”视图中编辑。</p>}
      </div>
    );
  }
  const value = parseJsonText(text);
  if (!value) return <Callout tone="danger" title="JSON 语法错误">切换到“源码”修复后可使用表单。</Callout>;
  const [fields, skipped] = document.schema ? fieldsFromSchema(document.schema) : fieldsFromValue(value);
  if (!fields.length) return <EmptyState compact icon="fileCode" title="此配置使用源码编辑" description="没有可直接表单化的顶层字段" />;
  return (
    <div className="form-groups">
      <section className="form-group">
        {document.schema && <h3>常用设置</h3>}
        {fields.map((field) => (
          <SettingRow
            key={field.key}
            mono={!field.label}
            label={field.label ?? field.key}
            description={field.description}
            control={<FieldControl field={field} value={value[field.key]} disabled={!editable} onChange={(next) => setText(setJsonField(text, field.key, next))} />}
          />
        ))}
      </section>
      {skipped > 0 && <p className="form-foot">另有 {skipped} 个对象或数组字段，可在“源码”视图中编辑。</p>}
    </div>
  );
}

export function ConfigPage() {
  const { model, editable: connectedEditable, request, submit } = useDesktop();
  const supportsManualRestart = useManualRestartSupport();
  const editable = connectedEditable && supportsManualRestart;
  const confirm = useConfirm();
  const { editorTheme } = useAppearance();
  const [document, setDocument] = useState<ConfigDocument>();
  const [text, setText] = useState("");
  const [view, setView] = useState<"form" | "source">("form");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState("");
  const [loadError, setLoadError] = useState<{ key: string; message: string }>();
  const [saveError, setSaveError] = useState("");
  const [problems, setProblems] = useState(0);
  /** 已提交、待完成后重新读取的保存任务 */
  const [pendingSave, setPendingSave] = useState<{ operationId: string; key: string; text: string }>();
  const documentRef = useRef(document);
  documentRef.current = document;
  const readSequence = useRef(0);
  const completedSave = useRef("");
  const dirty = Boolean(document && text !== document.text);
  useUnsavedChanges(dirty, `${document?.key ?? "配置"} 有尚未保存的修改，离开后将丢失。`);
  useEffect(() => () => { readSequence.current++; }, []);

  const load = useCallback((key: string, submittedText?: string) => {
    const sequence = ++readSequence.current;
    setLoading(key);
    setLoadError(undefined);
    return request("config.read", { key })
      .then((value) => {
        if (sequence !== readSequence.current) return;
        setDocument(value);
        setText((draft) => submittedText !== undefined && draft !== submittedText ? draft : value.text);
        setProblems(0);
        monaco.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          enableSchemaRequest: false,
          allowComments: value.format === "jsonc",
          trailingCommas: value.format === "jsonc" ? "ignore" : "error",
          schemas: value.schema ? [{ uri: `sfmc://${key}/schema`, fileMatch: ["*"], schema: value.schema }] : [],
        });
      })
      .catch((error) => {
        if (sequence === readSequence.current) setLoadError({ key, message: errorText(error) });
      })
      .finally(() => {
        if (sequence === readSequence.current) setLoading("");
      });
  }, [request]);
  const select = (key: string) => {
    if (key === document?.key) return;
    if (!dirty) return void load(key);
    void confirm({
      title: "放弃未保存的更改？",
      description: `${document!.key} 有尚未保存的修改，切换后将丢失。`,
      okText: "放弃并切换",
      cancelText: "继续编辑",
      danger: true,
      icon: "warning",
    }).then((ok) => {
      if (ok) { setSaveError(""); void load(key); }
    });
  };

  // 保存任务完成后重新读取，获得新的 revision，避免下次保存冲突
  useEffect(() => {
    if (!pendingSave) return;
    const record = model.tasks.find((row) => row.id === pendingSave.operationId);
    if (!record || !isTaskDone(record.status) || completedSave.current === record.id) return;
    completedSave.current = record.id;
    setPendingSave(undefined);
    if (record.status !== "succeeded") setSaveError(record.error?.message ?? "配置保存已中断，未保存的修改已保留");
    const saved = record.status === "succeeded" || (record.error?.details as { saved?: boolean } | undefined)?.saved === true;
    if (saved && documentRef.current?.key === pendingSave.key && (!loading || loading === pendingSave.key)) {
      void load(pendingSave.key, pendingSave.text);
    }
  }, [model.tasks, pendingSave, loading, load]);

  const moduleNames = useMemo(() => new Map(model.modules.map((row) => [row.id, row.name])), [model.modules]);
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; file: string; icon: IconName }[]>();
    for (const key of model.configKeys) {
      const info = describeKey(key, moduleNames);
      if (filter && !`${key} ${info.title} ${info.group}`.toLowerCase().includes(filter.toLowerCase())) continue;
      map.set(info.group, [...(map.get(info.group) ?? []), { key, ...info }]);
    }
    return [...map.entries()];
  }, [model.configKeys, filter, moduleNames]);

  const syntaxError = document && document.format !== "properties" && !parseJsonText(text);
  const save = () => {
    if (!document) return;
    const submittedText = text;
    setSaveError("");
    void submit("config.save", { key: document.key, text, revision: document.revision }, `保存 ${describeKey(document.key, moduleNames).title}`, {
      description: (<>将写入 <span className="mono">{document.key}</span>。保存后可手动重启服务使配置生效。</>) as ReactNode,
      okText: "保存",
    }).then((operationId) => operationId && setPendingSave({ operationId, key: document.key, text: submittedText }));
  };

  const info = document ? describeKey(document.key, moduleNames) : undefined;
  return (
    <div className="page page-fill">
      <PageHeader title="配置" />
      <ManualRestartNotice />
      {loadError && <Callout tone="danger" title={`读取 ${loadError.key} 失败`} action={<Button size="sm" onClick={() => {
        if (loadError.key === document?.key) void load(loadError.key, document.text);
        else select(loadError.key);
      }}>重试</Button>}>{loadError.message}</Callout>}
      {saveError && <Callout tone="danger" title="配置保存未完成">{saveError}</Callout>}
      <div className="config-layout surface">
        <aside className="config-list">
          <div className="config-filter">
            <SearchInput size="sm" placeholder="筛选配置文件" aria-label="筛选配置文件" value={filter} onChange={setFilter} />
          </div>
          <div className="config-groups">
            {groups.map(([group, rows]) => (
              <div key={group} className="config-group">
                <div className="config-group-label truncate" title={group}>{group}</div>
                {rows.map((row) => (
                  <Tooltip key={row.key} content={row.file} side="right">
                    <button type="button" className={`config-item${document?.key === row.key ? " active" : ""}`} onClick={() => select(row.key)}>
                      <Icon name={row.icon} size={14} />
                      <span className="config-item-text">
                        <b className="truncate">{row.title}</b>
                        <small className="mono truncate">{row.file}</small>
                      </span>
                      {loading === row.key && <Icon name="loader" spin size={13} />}
                      {document?.key === row.key && dirty && <span className="dirty-dot" title="未保存" />}
                    </button>
                  </Tooltip>
                ))}
              </div>
            ))}
            {!groups.length && <div className="config-empty muted">{model.configKeys.length ? "没有匹配的配置" : "暂无可编辑配置"}</div>}
          </div>
        </aside>
        <div className="config-editor">
          {document && info ? (
            <>
              <div className="config-head">
                <div className="config-head-text">
                  <div className="config-head-title">
                    <b>{info.title}</b>
                    <Badge className="mono">{document.format}</Badge>
                    {document.schema && <Badge tone="accent" icon="shield">Schema 校验</Badge>}
                    {dirty && <Badge tone="warning" dot>未保存</Badge>}
                    {pendingSave && <Badge tone="info" icon="loader">保存中</Badge>}
                  </div>
                  <span className="mono muted">{document.key}</span>
                </div>
                <Segmented
                  size="sm"
                  label="编辑视图"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "form", label: "表单", icon: "sliders" },
                    { value: "source", label: "源码", icon: "code", count: problems > 0 ? problems : undefined, countTone: "danger" },
                  ]}
                />
              </div>
              <div className={`config-body${view === "source" ? " source" : ""}`}>
                {view === "form" ? (
                  <ConfigForm document={document} text={text} setText={setText} editable={editable && !loading} />
                ) : (
                  <Editor
                    key={document.key}
                    path={`sfmc://${document.key}`}
                    height="100%"
                    theme={editorTheme}
                    language={document.format === "properties" ? "ini" : "json"}
                    value={text}
                    onChange={(next) => setText(next ?? "")}
                    onValidate={(markers) => setProblems(markers.filter((marker) => marker.severity === monaco.MarkerSeverity.Error).length)}
                    options={{ readOnly: !editable || Boolean(loading), minimap: { enabled: false }, wordWrap: "on", automaticLayout: true, fontSize: 12.5, fontFamily: FONT_MONO, scrollBeyondLastLine: false, padding: { top: 14, bottom: 14 }, lineNumbersMinChars: 3, tabSize: 2 }}
                  />
                )}
              </div>
              <div className="config-foot">
                <span className="config-foot-note">
                  <Icon name="info" size={13} />
                  {syntaxError ? <span className="tone-text-danger">存在语法错误，修复后才能保存</span> : "保存后可手动重启服务使配置生效"}
                </span>
                <Button variant="ghost" disabled={!dirty || Boolean(loading) || Boolean(pendingSave)} onClick={() => setText(document.text)}>放弃更改</Button>
                <RestartServicesButton target="all" disabled={dirty || Boolean(loading) || Boolean(pendingSave)} />
                <Button variant="primary" disabled={!editable || !dirty || Boolean(loading) || Boolean(syntaxError) || problems > 0 || Boolean(pendingSave)} onClick={save} icon="check">保存</Button>
              </div>
            </>
          ) : loading ? (
            <div className="config-placeholder"><Spinner label="正在读取配置…" /></div>
          ) : (
            <div className="config-placeholder">
              <EmptyState icon="sliders" title="选择一个配置文件" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
