/**
 * ConfigPage.tsx — 配置编辑
 *
 * 使用场景：左侧按"核心 / BDS / 模块"分组列出可编辑配置，右侧提供表单与源码两种视图。
 * 表单视图由 JSON Schema（或 server.properties 常用字段）生成，修改始终回写到原文以保留注释与未知字段；
 * 保存沿用 config.apply（携带读取时的 revision 防止覆盖他人修改），任务完成后自动重新读取最新版本。
 */
import Editor from "@monaco-editor/react";
import type { ConfigDocument } from "@sfmc-bds/management";
import * as monaco from "monaco-editor";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDesktop } from "../app/desktop.js";
import { FONT_MONO, useAppearance } from "../app/theme.js";
import { Button, NumberInput, PasswordInput, SearchInput, Segmented, Select, Switch, TextInput } from "../components/controls.js";
import { Spinner, useConfirm } from "../components/feedback.js";
import { Icon, type IconName } from "../components/icons.js";
import { Badge, Callout, EmptyState, PageHeader, SettingRow } from "../components/ui.js";
import { fieldsFromSchema, fieldsFromValue, parseJsonText, parseProperties, PROPERTY_FIELDS, setJsonField, setProperty, type FieldSpec } from "../lib/config-form.js";
import { errorText, isTaskDone } from "../lib/format.js";

/** 核心配置文件的友好名称 */
const CORE_NAMES: Record<string, string> = {
  "runtime.json": "运行时",
  "db_config.json": "数据服务",
  "qq_config.json": "QQ 互通",
  "bds_updater.json": "BDS 更新",
  "permissions.json": "权限",
  "log_filter.json": "日志过滤",
  "module_update.json": "模块更新",
  "server.properties": "BDS配置",
};

/** 配置键的分组与展示信息 */
function describeKey(key: string): { group: string; title: string; file: string; icon: IconName } {
  const parts = key.split("/");
  const file = parts.at(-1) ?? key;
  if (parts[0] === "core") return { group: "核心配置", title: CORE_NAMES[file] ?? file, file, icon: "settings" };
  if (parts[0] === "bds") return { group: "BDS", title: CORE_NAMES[file] ?? file, file, icon: "cube" };
  if (parts[0] === "module") return { group: `模块 ${parts[1]}`, title: file, file: parts.slice(1).join("/"), icon: "modules" };
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
    const fields = PROPERTY_FIELDS.filter((field) => values.has(field.key));
    const others = [...values.keys()].filter((key) => !PROPERTY_FIELDS.some((field) => field.key === key)).length;
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
        {others > 0 && <p className="form-foot">另有 {others} 项较少使用的属性，可在“源码”视图中编辑。</p>}
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
  const { model, editable, request, submit } = useDesktop();
  const confirm = useConfirm();
  const { editorTheme } = useAppearance();
  const [document, setDocument] = useState<ConfigDocument>();
  const [text, setText] = useState("");
  const [view, setView] = useState<"form" | "source">("form");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState("");
  const [loadError, setLoadError] = useState("");
  const [problems, setProblems] = useState(0);
  /** 已提交、待完成后重新读取的保存任务 */
  const [pendingSave, setPendingSave] = useState<{ operationId: string; key: string }>();
  const dirty = Boolean(document && text !== document.text);

  const load = (key: string) => {
    setLoading(key);
    setLoadError("");
    return request("config.read", { key })
      .then((value) => {
        setDocument(value);
        setText(value.text);
        setProblems(0);
        monaco.json.jsonDefaults.setDiagnosticsOptions({
          validate: true,
          enableSchemaRequest: false,
          allowComments: value.format === "jsonc",
          trailingCommas: value.format === "jsonc" ? "ignore" : "error",
          schemas: value.schema ? [{ uri: `sfmc://${key}/schema`, fileMatch: ["*"], schema: value.schema }] : [],
        });
      })
      .catch((error) => setLoadError(errorText(error)))
      .finally(() => setLoading(""));
  };
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
      if (ok) void load(key);
    });
  };

  // 保存任务完成后重新读取，获得新的 revision，避免下次保存冲突
  useEffect(() => {
    if (!pendingSave) return;
    const record = model.tasks.find((row) => row.id === pendingSave.operationId);
    if (!record || !isTaskDone(record.status)) return;
    setPendingSave(undefined);
    if (document?.key === pendingSave.key) void load(pendingSave.key);
  }, [model.tasks, pendingSave]);

  const groups = useMemo(() => {
    const map = new Map<string, { key: string; title: string; file: string; icon: IconName }[]>();
    for (const key of model.configKeys) {
      const info = describeKey(key);
      if (filter && !`${key} ${info.title}`.toLowerCase().includes(filter.toLowerCase())) continue;
      map.set(info.group, [...(map.get(info.group) ?? []), { key, ...info }]);
    }
    return [...map.entries()];
  }, [model.configKeys, filter]);

  const syntaxError = document && document.format !== "properties" && !parseJsonText(text);
  const save = () => {
    if (!document) return;
    void submit("config.apply", { key: document.key, text, revision: document.revision }, `保存并应用 ${describeKey(document.key).title}`, {
      description: (<>将停止服务、备份后写入 <span className="mono">{document.key}</span>，并重启服务：{document.affectedServices.join(" ")}。</>) as ReactNode,
      okText: "保存并应用",
    }).then((operationId) => operationId && setPendingSave({ operationId, key: document.key }));
  };

  const info = document ? describeKey(document.key) : undefined;
  return (
    <div className="page page-fill">
      <PageHeader title="配置" />
      <div className="config-layout surface">
        <aside className="config-list">
          <div className="config-filter">
            <SearchInput size="sm" placeholder="筛选配置文件" aria-label="筛选配置文件" value={filter} onChange={setFilter} />
          </div>
          <div className="config-groups">
            {groups.map(([group, rows]) => (
              <div key={group} className="config-group">
                <div className="config-group-label">{group}</div>
                {rows.map((row) => (
                  <button key={row.key} type="button" className={`config-item${document?.key === row.key ? " active" : ""}`} onClick={() => select(row.key)}>
                    <Icon name={row.icon} size={14} />
                    <span className="config-item-text">
                      <b>{row.title}</b>
                      <small className="mono">{row.file}</small>
                    </span>
                    {loading === row.key && <Icon name="loader" spin size={13} />}
                    {document?.key === row.key && dirty && <span className="dirty-dot" title="未保存" />}
                  </button>
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
                    {pendingSave && <Badge tone="info" icon="loader">应用中</Badge>}
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
                  <ConfigForm document={document} text={text} setText={setText} editable={editable} />
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
                    options={{ readOnly: !editable, minimap: { enabled: false }, wordWrap: "on", automaticLayout: true, fontSize: 12.5, fontFamily: FONT_MONO, scrollBeyondLastLine: false, padding: { top: 14, bottom: 14 }, lineNumbersMinChars: 3, tabSize: 2 }}
                  />
                )}
              </div>
              <div className="config-foot">
                <span className="config-foot-note">
                  <Icon name="info" size={13} />
                  {syntaxError ? <span className="tone-text-danger">存在语法错误，修复后才能保存</span> : <>保存后将重启：{document.affectedServices.join("、")}</>}
                </span>
                <Button variant="ghost" disabled={!dirty} onClick={() => setText(document.text)}>放弃更改</Button>
                <Button variant="primary" disabled={!editable || !dirty || Boolean(syntaxError) || problems > 0 || Boolean(pendingSave)} onClick={save} icon="check">保存并应用</Button>
              </div>
            </>
          ) : loading ? (
            <div className="config-placeholder"><Spinner label="正在读取配置…" /></div>
          ) : (
            <div className="config-placeholder">
              {loadError ? <Callout tone="danger" title="读取配置失败">{loadError}</Callout> : <EmptyState icon="sliders" title="选择一个配置文件" />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
