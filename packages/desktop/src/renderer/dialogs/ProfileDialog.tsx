/**
 * ProfileDialog.tsx — 实例设置对话框（添加实例 / 连接设置）
 *
 * 使用场景：侧栏"添加实例"、欢迎页入口卡片（预选连接方式）、连接门与命令面板的"连接设置"。
 * 字段与原实现的 antd 表单一致：名称、连接方式、SSH 主机/端口/用户/远程系统/密码/私钥/口令/记住凭据、部署绝对目录；
 * 提交的字段集合也与原表单 validateFields 的结果一致（本机只提交 name/kind/root，SSH 额外提交连接与凭据字段）。
 * 编辑已有实例时可从客户端移除（服务器目录与运行中的服务保留）。
 */
import { useEffect, useState } from "react";
import type { Credentials, InstanceProfile } from "../../shared/api.js";
import { useDesktop } from "../app/desktop.js";
import { Button, Checkbox, Field, NumberInput, PasswordInput, Segmented, Select, TextInput } from "../components/controls.js";
import { useConfirm } from "../components/feedback.js";
import { Modal } from "../components/overlays.js";
import { errorText } from "../lib/format.js";
import { Callout } from "../components/ui.js";

/** 表单草稿：实例字段 + 一次性凭据 */
type Draft = Omit<InstanceProfile, "id" | "hasCredential"> & Credentials;

/** 新建实例的默认值（与原实现 newProfile 的初始值一致） */
const DEFAULTS: Draft = { name: "", kind: "local", root: "", os: "linux", port: 22 };

/** 判断路径是否为对应系统的绝对路径 */
function isAbsolute(path: string, windows: boolean): boolean {
  return windows ? /^[A-Za-z]:[\\/]/.test(path) || /^\\\\[^\\]+\\/.test(path) : path.startsWith("/");
}

/** 表单校验：名称与目录必填；SSH 需主机与用户；目录需为绝对路径 */
function validate(draft: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!draft.name.trim()) errors.name = "请输入实例名称";
  if (draft.kind === "ssh") {
    if (!draft.host?.trim()) errors.host = "请输入主机地址";
    if (!draft.username?.trim()) errors.username = "请输入 SSH 用户";
    if (draft.port !== undefined && (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535)) errors.port = "1–65535";
  }
  const root = draft.root.trim();
  if (!root) errors.root = "请输入部署目录";
  else if (!isAbsolute(root, draft.kind === "local" || draft.os === "windows")) errors.root = draft.kind === "local" || draft.os === "windows" ? "请输入绝对路径，例如 D:\\SFMC" : "请输入绝对路径，例如 /srv/sfmc";
  return errors;
}

/** 按连接方式取出要提交的字段（等价于原表单只返回已渲染字段） */
function payload(draft: Draft): InstanceProfile & Credentials {
  const base = { id: "", name: draft.name.trim(), kind: draft.kind, root: draft.root.trim() };
  if (draft.kind === "local") return base;
  return {
    ...base,
    host: draft.host?.trim(),
    port: draft.port,
    username: draft.username?.trim(),
    os: draft.os,
    password: draft.password || undefined,
    privateKeyPath: draft.privateKeyPath?.trim() || undefined,
    passphrase: draft.passphrase || undefined,
    remember: draft.remember,
  };
}

export function ProfileDialog() {
  const { profileDialog, closeProfileDialog, saveProfile, removeProfile, guarded } = useDesktop();
  const confirm = useConfirm();
  const { open, editing, preset } = profileDialog;
  const [draft, setDraft] = useState<Draft>(DEFAULTS);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setSaving(false);
    setError("");
    setDraft(editing ? { ...DEFAULTS, ...editing, password: "", passphrase: "" } : { ...DEFAULTS, kind: preset ?? "local" });
  }, [open, editing, preset]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const errors = submitted ? validate(draft) : {};
  const ssh = draft.kind === "ssh";
  const windowsRoot = !ssh || draft.os === "windows";

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validate(draft)).length) return;
    setSaving(true);
    setError("");
    try {
      await saveProfile(payload(draft), editing);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSaving(false);
    }
  };
  const remove = () => {
    if (!editing) return;
    void confirm({
      title: "从客户端移除此实例？",
      description: "服务器目录和运行中的服务会保留。",
      okText: "移除",
      danger: true,
      icon: "trash",
      onConfirm: () => removeProfile(editing),
    });
  };
  const choose = (kind: "directory" | "privateKey", key: "root" | "privateKeyPath") =>
    void guarded(async () => {
      const value = await window.sfmc.choose(kind);
      if (value) set(key, value);
    });

  return (
    <Modal
      open={open}
      onClose={closeProfileDialog}
      dismissible={!saving}
      size="md"
      icon={editing ? "settings" : "plus"}
      title={editing ? "连接设置" : "添加实例"}
      description={editing?.name}
      onSubmit={() => void save()}
      footer={
        <>
          {editing && <Button variant="danger-soft" icon="trash" disabled={saving} onClick={remove}>移除实例</Button>}
          <span className="dialog-foot-spacer" />
          <Button variant="ghost" disabled={saving} onClick={closeProfileDialog}>取消</Button>
          <Button variant="primary" type="submit" loading={saving}>保存</Button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="实例名称" required error={errors.name}>
          <TextInput value={draft.name} onChange={(value) => set("name", value)} placeholder="例如 生存服" autoFocus invalid={Boolean(errors.name)} />
        </Field>
        <Field label="连接方式">
          <Segmented
            value={draft.kind}
            onChange={(value) => set("kind", value)}
            label="连接方式"
            options={[
              { value: "local", label: "Windows 本机", icon: "monitor" },
              { value: "ssh", label: "SSH 远程", icon: "server" },
            ]}
          />
        </Field>
        {ssh && (
          <fieldset className="form-section">
            <legend>SSH 连接</legend>
            <div className="form-row">
              <Field label="主机" required error={errors.host} className="grow">
                <TextInput mono value={draft.host ?? ""} onChange={(value) => set("host", value)} placeholder="例如 192.168.1.20" invalid={Boolean(errors.host)} />
              </Field>
              <Field label="端口" error={errors.port}>
                <NumberInput value={draft.port ?? null} onChange={(value) => set("port", value ?? undefined)} min={1} max={65535} integer width={120} invalid={Boolean(errors.port)} />
              </Field>
            </div>
            <div className="form-row">
              <Field label="SSH 用户" required error={errors.username} className="grow">
                <TextInput mono value={draft.username ?? ""} onChange={(value) => set("username", value)} placeholder="例如 sfmc" invalid={Boolean(errors.username)} />
              </Field>
              <Field label="远程系统">
                <Select
                  label="远程系统"
                  value={draft.os}
                  onChange={(value) => set("os", value)}
                  width={180}
                  options={[
                    { value: "linux", label: "Linux" },
                    { value: "windows", label: "Windows OpenSSH" },
                  ]}
                />
              </Field>
            </div>
            <Field label="SSH 密码" description={editing?.hasCredential ? "已保存凭据；留空表示保持不变" : undefined}>
              <PasswordInput value={draft.password ?? ""} onChange={(value) => set("password", value)} />
            </Field>
            <Field label="或使用私钥">
              <TextInput
                mono
                value={draft.privateKeyPath ?? ""}
                onChange={(value) => set("privateKeyPath", value)}
                placeholder="私钥文件路径"
                suffix={<button type="button" className="input-action" onClick={() => choose("privateKey", "privateKeyPath")}>选择</button>}
              />
            </Field>
            <Field label="私钥口令">
              <PasswordInput value={draft.passphrase ?? ""} onChange={(value) => set("passphrase", value)} />
            </Field>
            <Checkbox checked={Boolean(draft.remember)} onChange={(checked) => set("remember", checked)}>使用系统加密记住密码与口令</Checkbox>
          </fieldset>
        )}
        <Field label="部署绝对目录" required error={errors.root} description={ssh ? "远程服务器上的目录" : "新目录将引导初始化；已有部署会检查版本后接入"}>
          <TextInput
            mono
            value={draft.root}
            onChange={(value) => set("root", value)}
            placeholder={windowsRoot ? "例如 D:\\SFMC" : "例如 /srv/sfmc"}
            invalid={Boolean(errors.root)}
            suffix={!ssh ? <button type="button" className="input-action" onClick={() => choose("directory", "root")}>选择本机目录</button> : undefined}
          />
        </Field>
        {error && <Callout tone="danger" title="保存失败">{error}</Callout>}
      </div>
    </Modal>
  );
}
