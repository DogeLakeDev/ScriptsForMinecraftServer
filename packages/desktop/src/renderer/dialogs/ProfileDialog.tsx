/**
 * ProfileDialog.tsx — 实例设置对话框（添加实例 / 连接设置）
 *
 * 使用场景：侧栏"添加实例"、欢迎页入口卡片（预选连接方式）、连接门与命令面板的"连接设置"。
 * 字段：名称、连接方式（本机 / SSH / 管理网关）、SSH 主机与凭据、网关地址与访问令牌、部署绝对目录。
 * 网关不填目录，目录由服务器上的网关决定。提交字段与原先一样只包含当前连接方式用到的项。
 * 网关的访问令牌也可以“用小程序登录”获得（DeviceLoginPanel），获批的设备凭证按令牌保存。
 * 编辑已有实例时可从客户端移除（服务器目录与运行中的服务保留）。
 */
import { useEffect, useState } from "react";
import type { Credentials, InstanceProfile } from "../../shared/api.js";
import { normalizeEndpoint } from "../../shared/gateway-url.js";
import { useDesktop } from "../app/desktop.js";
import { Button, Checkbox, Field, NumberInput, PasswordInput, Segmented, Select, TextInput } from "../components/controls.js";
import { useConfirm } from "../components/feedback.js";
import { Modal } from "../components/overlays.js";
import { errorText } from "../lib/format.js";
import { Callout } from "../components/ui.js";
import { DeviceLoginPanel } from "./DeviceLoginPanel.js";

/** 表单草稿：实例字段 + 一次性凭据 */
type Draft = Omit<InstanceProfile, "id" | "hasCredential"> & Credentials;

/** 新建实例的默认值（与原实现 newProfile 的初始值一致） */
const DEFAULTS: Draft = { name: "", kind: "local", root: "", os: "linux", port: 22 };

/** 判断路径是否为对应系统的绝对路径 */
function isAbsolute(path: string, windows: boolean): boolean {
  return windows ? /^[A-Za-z]:[\\/]/.test(path) || /^\\\\[^\\]+\\/.test(path) : path.startsWith("/");
}

/** 表单校验：名称必填；SSH 需主机、用户和绝对目录；网关需地址，新建时还需令牌 */
function validate(draft: Draft, editing: InstanceProfile | null): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {};
  if (!draft.name.trim()) errors.name = "请输入实例名称";
  if (draft.kind === "gateway") {
    if (!draft.endpoint?.trim()) errors.endpoint = "请输入网关地址";
    else {
      try { normalizeEndpoint(draft.endpoint); }
      catch (error) { errors.endpoint = error instanceof Error ? error.message : "网关地址无效"; }
    }
    if (!editing?.hasCredential && !draft.token?.trim()) errors.token = "请输入访问令牌";
    return errors;
  }
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
  if (draft.kind === "gateway") {
    return { ...base, root: "", endpoint: normalizeEndpoint(draft.endpoint ?? ""), token: draft.token?.trim() || undefined, remember: draft.remember };
  }
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
    setDraft(editing ? { ...DEFAULTS, ...editing, password: "", passphrase: "", token: "" } : { ...DEFAULTS, kind: preset ?? "local" });
  }, [open, editing, preset]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((previous) => ({ ...previous, [key]: value }));
  const errors = submitted ? validate(draft, editing) : {};
  const ssh = draft.kind === "ssh";
  const gateway = draft.kind === "gateway";
  const windowsRoot = !ssh || draft.os === "windows";

  const save = async () => {
    setSubmitted(true);
    if (Object.keys(validate(draft, editing)).length) return;
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
              { value: "local", label: "本机", icon: "monitor" },
              { value: "ssh", label: "SSH", icon: "server" },
              { value: "gateway", label: "网关", icon: "globe" },
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
        {gateway && (
          <fieldset className="form-section">
            <legend>管理网关</legend>
            <Field label="网关地址" required error={errors.endpoint} description="与小程序中填写的地址相同，例如 https://mc.example.com/sfmc">
              <TextInput mono value={draft.endpoint ?? ""} onChange={(value) => set("endpoint", value)} placeholder="https://mc.example.com/sfmc" invalid={Boolean(errors.endpoint)} />
            </Field>
            <Field label="访问令牌" required={!editing?.hasCredential} error={errors.token} description={editing?.hasCredential ? "已保存令牌；留空表示保持不变" : "网关启动时打印的访问令牌"}>
              <PasswordInput value={draft.token ?? ""} onChange={(value) => set("token", value)} invalid={Boolean(errors.token)} />
            </Field>
            {/* 也可由游戏内 3 级管理员用小程序批准：拿到的设备凭证填入访问令牌，并默认用系统加密记住（30 天有效，免得重启后重新扫码） */}
            <DeviceLoginPanel
              key={open ? editing?.id ?? "new" : "closed"}
              endpoint={draft.endpoint ?? ""}
              onCredential={(credential) => setDraft((previous) => ({ ...previous, token: credential, remember: true }))}
            />
            <Checkbox checked={Boolean(draft.remember)} onChange={(checked) => set("remember", checked)}>使用系统加密记住访问令牌</Checkbox>
          </fieldset>
        )}
        {!gateway && (
        <Field label="部署绝对目录" required error={errors.root} description={ssh ? "远程服务器上的目录" : "空目录会在连接后初始化；已有服务器连接后直接管理"}>
          <TextInput
            mono
            value={draft.root}
            onChange={(value) => set("root", value)}
            placeholder={windowsRoot ? "例如 D:\\SFMC" : "例如 /srv/sfmc"}
            invalid={Boolean(errors.root)}
            suffix={!ssh ? <button type="button" className="input-action" onClick={() => choose("directory", "root")}>选择本机目录</button> : undefined}
          />
        </Field>
        )}
        {error && <Callout tone="danger" title="保存失败">{error}</Callout>}
      </div>
    </Modal>
  );
}
