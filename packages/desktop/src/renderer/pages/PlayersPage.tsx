/**
 * PlayersPage.tsx — 玩家与权限
 *
 * 使用场景：查看在线玩家快照（5 秒轮询，与原实现一致）。
 * 「允许名单」列出业务库 sfmc_qq_bindings 的绑定记录，只读。
 * BDS 权限与 SFMC 权限仍在本地暂存，点击「保存并应用」后提交 players.apply。
 */
import Editor from "@monaco-editor/react";
import type { ManagementMethodMap } from "@sfmc-bds/management";
import { useEffect, useMemo, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { FONT_MONO, useAppearance } from "../app/theme.js";
import { Button, Field, IconButton, Segmented, Select, Switch, TextInput } from "../components/controls.js";
import { toast, useConfirm } from "../components/feedback.js";
import { Icon } from "../components/icons.js";
import { Modal } from "../components/overlays.js";
import { Tooltip } from "../components/tooltip.js";
import { Avatar, Badge, EmptyState, PageHeader, Surface } from "../components/ui.js";
import { errorText, fullTime, hashHue, isTaskDone, relativeTime } from "../lib/format.js";

/** 权限名单种类（与 players.apply 的 kind 参数一致） */
type Kind = "allowlist" | "permissions" | "sfmcPermissions";
type PlayersData = ManagementMethodMap["players.list"];
type Entry = Record<string, unknown>;

const KINDS: { value: Kind; label: string }[] = [
  { value: "allowlist", label: "允许名单" },
  { value: "permissions", label: "BDS 权限" },
  { value: "sfmcPermissions", label: "SFMC 权限" },
];
const BDS_LEVELS: Record<string, string> = { visitor: "访客", member: "成员", operator: "管理员" };
const SFMC_LEVELS = ["游客", "成员", "管理员", "Admin"];
/** QQ 通道在绑定表里的取值，与向导里的 qq_backend 一致。 */
const QQ_BACKENDS: Record<string, string> = { official: "官方 Bot", llbot: "LLBot" };

/** 允许名单这一栏展示的是绑定记录，不是原版 allowlist.json。 */
const bindingRows = (data: PlayersData | undefined) => data?.bindings ?? [];

/** 解析草稿 JSON 为条目数组；语法错误返回 undefined */
function parseEntries(text: string): Entry[] | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as Entry[]) : undefined;
  } catch {
    return undefined;
  }
}

/** 条目的玩家名 */
const entryName = (row: Entry) => String(row.player_name ?? row.name ?? "");

/** 玩家名所在字段：SFMC 权限使用 player_name，BDS 名单使用 name（与原表单字段一致） */
const nameKey = (kind: Kind) => (kind === "sfmcPermissions" ? "player_name" : "name");

/**
 * 条目编辑表单的校验（与原 antd Form 规则一致）：
 * 玩家名除 BDS 权限外必填；BDS 权限的 XUID 必填且为纯数字；BDS 权限与 SFMC 权限等级必选。
 */
function validateEntry(kind: Kind, draft: Entry): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = String(draft[nameKey(kind)] ?? "").trim();
  if (kind !== "permissions" && !name) errors.name = "请输入玩家名";
  if (kind === "permissions" && !/^\d+$/.test(String(draft.xuid ?? ""))) errors.xuid = "XUID 为纯数字";
  if (kind === "permissions" && !draft.permission) errors.permission = "请选择权限";
  if (kind === "sfmcPermissions" && (draft.level === undefined || draft.level === null || draft.level === "")) errors.level = "请选择权限等级";
  return errors;
}

/** 只保留当前名单种类的表单字段，并去掉空字符串（等价于原表单 validateFields 只返回已注册字段） */
function formValues(kind: Kind, draft: Entry): Entry {
  const keys = [nameKey(kind), ...(kind !== "sfmcPermissions" ? ["xuid"] : []), ...(kind === "allowlist" ? ["ignoresPlayerLimit"] : []), ...(kind === "permissions" ? ["permission"] : []), ...(kind === "sfmcPermissions" ? ["level"] : [])];
  const value: Entry = {};
  for (const key of keys) {
    const raw = draft[key];
    value[key] = typeof raw === "string" ? (raw.trim() || undefined) : raw;
  }
  return value;
}

/** 权限列的展示 */
function EntryPermission({ kind, row }: { kind: Kind; row: Entry }) {
  if (kind === "allowlist") return <span className="perm-cell"><Badge tone="success">允许加入</Badge>{row.ignoresPlayerLimit === true && <Badge>不受人数上限</Badge>}</span>;
  if (kind === "permissions") {
    const level = String(row.permission ?? "");
    return <Badge tone={level === "operator" ? "warning" : level === "member" ? "info" : "neutral"}>{BDS_LEVELS[level] ?? level}</Badge>;
  }
  const level = Number(row.level);
  return <Badge tone={level >= 3 ? "danger" : level === 2 ? "warning" : level === 1 ? "info" : "neutral"} className="mono">{level} {SFMC_LEVELS[level] ?? "未知"}</Badge>;
}

/** 条目编辑对话框：新增或编辑名单中的一项，结果写回草稿 JSON */
function EntryDialog({ kind, label, initial, mode, onClose, onCommit }: { kind: Kind; label: string; initial: Entry | null; mode: "new" | "edit" | null; onClose: () => void; onCommit: (value: Entry) => void }) {
  const [draft, setDraft] = useState<Entry>({});
  const [submitted, setSubmitted] = useState(false);
  useEffect(() => {
    if (!mode) return;
    setDraft(initial ? { ...initial } : {});
    setSubmitted(false);
  }, [mode, initial]);
  const errors = validateEntry(kind, draft);
  const shown = submitted ? errors : {};
  const set = (key: string, value: unknown) => setDraft((previous) => ({ ...previous, [key]: value }));
  const commit = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    onCommit(formValues(kind, draft));
  };
  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      size="sm"
      icon={mode === "new" ? "plus" : "pencil"}
      title={mode === "new" ? `添加到${label}` : `编辑${label}条目`}
      onSubmit={commit}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>取消</Button>
          <Button variant="primary" type="submit">{mode === "new" ? "加入草稿" : "更新草稿"}</Button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="玩家名" required={kind !== "permissions"} error={shown.name}>
          <TextInput value={String(draft[nameKey(kind)] ?? "")} onChange={(value) => set(nameKey(kind), value)} placeholder="例如 Steve" autoFocus invalid={Boolean(shown.name)} />
        </Field>
        {kind !== "sfmcPermissions" && (
          <Field label="XUID" required={kind === "permissions"} error={shown.xuid} description={kind === "permissions" ? "BDS 按 XUID 匹配权限，可在玩家加入日志中找到" : "可选，填写后可防止改名绕过"}>
            <TextInput mono value={String(draft.xuid ?? "")} onChange={(value) => set("xuid", value)} placeholder="2535…" invalid={Boolean(shown.xuid)} inputMode="numeric" />
          </Field>
        )}
        {kind === "allowlist" && (
          <div className="field-inline">
            <span className="field-label">不受最大人数限制</span>
            <Switch size="sm" label="不受最大人数限制" checked={draft.ignoresPlayerLimit === true} onChange={(checked) => set("ignoresPlayerLimit", checked)} />
          </div>
        )}
        {kind === "permissions" && (
          <Field label="BDS 权限" required error={shown.permission}>
            <Select label="BDS 权限" value={draft.permission as string | undefined} onChange={(value) => set("permission", value)} invalid={Boolean(shown.permission)} options={[{ value: "visitor", label: "访客" }, { value: "member", label: "成员" }, { value: "operator", label: "管理员" }]} />
          </Field>
        )}
        {kind === "sfmcPermissions" && (
          <Field label="SFMC 权限" required error={shown.level}>
            <Select label="SFMC 权限" value={draft.level as number | undefined} onChange={(value) => set("level", value)} invalid={Boolean(shown.level)} options={[0, 1, 2, 3].map((level) => ({ value: level, label: `${level} ${SFMC_LEVELS[level]}` }))} />
          </Field>
        )}
      </div>
    </Modal>
  );
}

export function PlayersPage() {
  const { model, editable, request, submit } = useDesktop();
  const confirm = useConfirm();
  const { editorTheme } = useAppearance();
  const connected = !model.disconnected;
  const [data, setData] = useState<PlayersData>();
  const [kind, setKind] = useState<Kind>("allowlist");
  const [text, setText] = useState("[]");
  /** 上次从服务器载入的名单文本，用于判断是否有未保存修改 */
  const [baseline, setBaseline] = useState("[]");
  const [view, setView] = useState<"list" | "json">("list");
  const [clock, setClock] = useState(Date.now());
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [pendingSave, setPendingSave] = useState<string>();

  const reset = (value: PlayersData, next: Kind) => {
    const json = JSON.stringify(value[next] ?? [], null, 2);
    setText(json);
    setBaseline(json);
  };
  useEffect(() => {
    void request("players.list")
      .then((value) => {
        setData(value);
        reset(value, "allowlist");
      })
      .catch((error) => toast.error("读取玩家名单失败", errorText(error)));
  }, [request]);
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(Date.now());
      if (connected) void request("players.list").then(setData).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [request, connected]);
  // 保存任务结束后重新读取名单
  useEffect(() => {
    if (!pendingSave) return;
    const record = model.tasks.find((row) => row.id === pendingSave);
    if (!record || !isTaskDone(record.status)) return;
    setPendingSave(undefined);
    void request("players.list").then((value) => {
      setData(value);
      if (record.status === "succeeded") reset(value, kind);
    });
  }, [model.tasks, pendingSave]);

  const fresh = Boolean(connected && data?.fresh && clock - Date.parse(data.updatedAt) < 60_000);
  const entries = useMemo(() => parseEntries(text), [text]);
  const dirty = text !== baseline;
  const counts = data ? { allowlist: bindingRows(data).length, permissions: data.permissions.length, sfmcPermissions: data.sfmcPermissions.length } : undefined;
  const bindings = bindingRows(data);
  const showingBindings = kind === "allowlist";

  const switchKind = (next: Kind) => {
    const apply = () => {
      setKind(next);
      if (data) reset(data, next);
    };
    if (!dirty) return apply();
    void confirm({ title: "放弃未保存的更改？", description: "当前名单有尚未保存的修改，切换后将丢失。", okText: "放弃并切换", cancelText: "继续编辑", danger: true, icon: "warning" }).then((ok) => {
      if (ok) apply();
    });
  };
  /** 编辑对话框的初始值：编辑时为当前条目，新增时为空 */
  const editingEntry = useMemo(() => (typeof editing === "number" && entries ? entries[editing] ?? null : null), [editing, entries]);
  const commitEditor = (value: Entry) => {
    const next = [...(entries ?? [])];
    if (editing === "new") next.push(value);
    else if (editing !== null) next[editing] = { ...next[editing], ...value };
    setText(JSON.stringify(next, null, 2));
    setEditing(null);
  };
  const save = () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast.error("权限 JSON 语法错误");
      return;
    }
    void submit("players.apply", { kind, entries: parsed }, "保存玩家权限并应用", { description: `将写入${KINDS.find((row) => row.value === kind)!.label}（${Array.isArray(parsed) ? parsed.length : 0} 项）并在维护任务中应用。`, okText: "保存并应用" }).then((operationId) => operationId && setPendingSave(operationId));
  };
  const active = KINDS.find((row) => row.value === kind)!;
  return (
    <div className="page">
      <PageHeader title="玩家与权限" />
      <Surface
        title="在线玩家"
        description={data?.updatedAt ? `同步于 ${relativeTime(data.updatedAt, clock)}` : "尚无实时快照"}
        extra={<Badge tone={fresh ? "success" : "warning"} dot>{fresh ? `${data?.players.length ?? 0} 人在线` : "在线状态未知"}</Badge>}
      >
        {data?.players.length ? (
          <div className="player-chips">
            {data.players.map((player) => (
              <span key={player.name} className={`player-chip${fresh ? "" : " stale"}`}>
                <Avatar name={player.name} hue={hashHue(player.name)} size={24} />
                <span>{player.name}</span>
                {fresh && <span className="player-online" />}
              </span>
            ))}
          </div>
        ) : (
          <p className="muted inline-empty">{fresh ? "当前没有玩家在线" : "暂无有效在线快照"}</p>
        )}
      </Surface>
      <Surface
        title="名单与权限"
        extra={
          <Segmented
            size="sm"
            label="编辑视图"
            value={view}
            onChange={setView}
            options={[
              { value: "list", label: "列表", icon: "list" },
              { value: "json", label: "JSON", icon: "code" },
            ]}
          />
        }
        flush
      >
        <div className="list-toolbar">
          <Segmented
            variant="text"
            label="名单种类"
            value={kind}
            onChange={switchKind}
            options={KINDS.map((row) => ({ value: row.value, label: row.label, count: counts?.[row.value] }))}
          />
          <span className="toolbar-spacer" />
          {!showingBindings && <Button size="sm" disabled={!editable || !entries} icon="plus" onClick={() => setEditing("new")}>添加玩家</Button>}
        </div>
        {showingBindings && <p className="list-note">来自绑定记录，显示玩家名、XUID、QQ 通道和绑定时间。</p>}
        {showingBindings ? (
          view === "json" ? (
            <div className="json-pane">
              <Editor height="340px" theme={editorTheme} language="json" value={JSON.stringify(bindings, null, 2)} options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12.5, fontFamily: FONT_MONO, scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 }, lineNumbersMinChars: 3, tabSize: 2 }} />
            </div>
          ) : bindings.length ? (
            <ul className="row-list">
              {bindings.map((row) => {
                const name = row.playerName || "未记录玩家名";
                return (
                  <li key={row.playerXuid || row.qqUserOpenid} className="row-item">
                    <Avatar name={name} hue={hashHue(name)} size={32} />
                    <div className="row-main">
                      <div className="row-title"><b>{name}</b></div>
                      <div className="row-sub mono">XUID {row.playerXuid}</div>
                      <div className="row-sub mono">{QQ_BACKENDS[row.qqBackend] ?? (row.qqBackend || "未知通道")} · {row.qqUserOpenid || "未记录 QQ"}</div>
                    </div>
                    <span className="perm-cell">
                      <Badge tone="success">已绑定</Badge>
                      <span className="muted" title={fullTime(row.boundAt)}>{relativeTime(row.boundAt, clock)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon="users" title="还没有绑定的玩家" description="玩家在游戏内完成绑定后会出现在这里" />
          )
        ) : view === "json" ? (
          <div className="json-pane">
            <Editor height="340px" theme={editorTheme} language="json" value={text} onChange={(next) => setText(next ?? "[]")} options={{ readOnly: !editable, minimap: { enabled: false }, fontSize: 12.5, fontFamily: FONT_MONO, scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 }, lineNumbersMinChars: 3, tabSize: 2 }} />
          </div>
        ) : !entries ? (
          <EmptyState compact icon="warning" title="JSON 语法错误" description="请切换到 JSON 视图修复后再编辑列表" />
        ) : entries.length ? (
          <ul className="row-list">
            {entries.map((row, index) => {
              const name = entryName(row) || "—";
              return (
                <li key={index} className="row-item">
                  <Avatar name={name} hue={hashHue(name)} size={32} />
                  <div className="row-main">
                    <div className="row-title"><b>{name}</b></div>
                    <div className="row-sub mono">{row.xuid ? `XUID ${String(row.xuid)}` : kind === "sfmcPermissions" ? "按玩家名匹配" : "未记录 XUID"}</div>
                  </div>
                  <EntryPermission kind={kind} row={row} />
                  <div className="row-actions">
                    <IconButton icon="pencil" label="编辑" size="sm" disabled={!editable} onClick={() => setEditing(index)} />
                    <IconButton icon="trash" label="移除" size="sm" danger disabled={!editable} onClick={() => setText(JSON.stringify(entries.filter((_, position) => position !== index), null, 2))} />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon="users" title="名单为空" />
        )}
        {!showingBindings && (dirty || pendingSave) && (
          <div className="save-bar">
            <Icon name={pendingSave ? "loader" : "pencil"} size={14} spin={Boolean(pendingSave)} />
            <span>{pendingSave ? "正在应用名单…" : "名单有未保存的更改"}</span>
            <span className="toolbar-spacer" />
            <Button size="sm" variant="ghost" disabled={Boolean(pendingSave)} onClick={() => setText(baseline)}>放弃</Button>
            <Tooltip content={editable ? undefined : "当前为只读"} wrap>
              <Button size="sm" variant="primary" disabled={!editable || !entries || Boolean(pendingSave)} onClick={save}>保存并应用</Button>
            </Tooltip>
          </div>
        )}
      </Surface>
      <EntryDialog
        kind={kind}
        label={active.label}
        mode={editing === null ? null : editing === "new" ? "new" : "edit"}
        initial={editingEntry}
        onClose={() => setEditing(null)}
        onCommit={commitEditor}
      />
    </div>
  );
}
