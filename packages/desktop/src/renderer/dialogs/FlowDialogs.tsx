/**
 * FlowDialogs.tsx — 连接流程对话框：SSH 登录、空目录的第一次初始化
 *
 * 使用场景：desktop.connect() 根据握手结果设置 flow，App 渲染 <FlowDialogs />，按 flow.kind 从注册表中取对应对话框（OCP）。
 *  - 登录：收集密码/私钥口令后调用 connect(profile, reconnect, secret)；
 *  - 初始化：接受 EULA + 端口 → deployment.create → 等待任务完成。
 * 已有部署连上即可管理，平台升级留在更新页。
 */
import { useState, type ComponentType } from "react";
import { useDesktop, type Flow } from "../app/desktop.js";
import { Button, Field, NumberInput, PasswordInput } from "../components/controls.js";
import { toast } from "../components/feedback.js";
import { Icon } from "../components/icons.js";
import { OperationSteps } from "../components/OperationSteps.js";
import { Modal } from "../components/overlays.js";
import { Callout } from "../components/ui.js";
import { errorText } from "../lib/format.js";

/** SSH 登录：凭据仅用于本次连接（是否记住由实例设置中的选项决定） */
function LoginDialog({ flow }: { flow: Extract<Flow, { kind: "login" }> }) {
  const { connect, setFlow } = useDesktop();
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const { profile, reconnect } = flow;
  const submit = () => {
    setFlow(null);
    void connect(profile, reconnect, { password: password || undefined, passphrase: passphrase || undefined });
  };
  return (
    <Modal
      open
      onClose={() => setFlow(null)}
      size="sm"
      icon="key"
      title={`登录 ${profile.name}`}
      description={<span className="mono">{profile.username ? `${profile.username}@` : ""}{profile.host}{profile.port && profile.port !== 22 ? `:${profile.port}` : ""}</span>}
      onSubmit={submit}
      footer={
        <>
          <Button variant="ghost" onClick={() => setFlow(null)}>取消</Button>
          <Button variant="primary" type="submit" icon="plug">连接</Button>
        </>
      }
    >
      <div className="form-stack">
        <Field label="密码" description={profile.privateKeyPath ? "使用私钥登录时可留空" : undefined}>
          <PasswordInput value={password} onChange={setPassword} autoFocus />
        </Field>
        {profile.privateKeyPath && (
          <Field label="私钥口令" description={<span className="mono truncate">{profile.privateKeyPath}</span>}>
            <PasswordInput value={passphrase} onChange={setPassphrase} />
          </Field>
        )}
        <p className="form-hint"><Icon name="info" size={12} /> 如需免输入，可在“连接设置”中勾选“使用系统加密记住密码与口令”。</p>
      </div>
    </Modal>
  );
}

/** 初始化端口字段（与原实现一致） */
const PORT_FIELDS = [
  { key: "dbPort", label: "DB TCP 端口", description: "数据与 HTTP 接口服务" },
  { key: "bdsPort", label: "BDS UDP 端口", description: "玩家连接端口（IPv4）" },
  { key: "bdsPort6", label: "BDS IPv6 UDP 端口", description: "玩家连接端口（IPv6）" },
] as const;
type Ports = Record<(typeof PORT_FIELDS)[number]["key"], number | null>;

/** 端口校验：必填、1–65535 的整数、互不重复 */
function portErrors(ports: Ports): Partial<Record<keyof Ports, string>> {
  const errors: Partial<Record<keyof Ports, string>> = {};
  const seen = new Map<number, keyof Ports>();
  for (const { key } of PORT_FIELDS) {
    const value = ports[key];
    if (value === null || !Number.isInteger(value) || value < 1 || value > 65535) errors[key] = "请输入 1–65535 的端口";
    else if (seen.has(value)) errors[key] = "端口不能与其他服务重复";
    else seen.set(value, key);
  }
  return errors;
}

/** 初始化新部署：接受 EULA 并设置端口，创建后实时展示任务阶段 */
function DeployDialog({ flow }: { flow: Extract<Flow, { kind: "deploy" }> }) {
  const { createDeployment, setFlow, models } = useDesktop();
  const { profile } = flow;
  const [ports, setPorts] = useState<Ports>({ dbPort: 3001, bdsPort: 19132, bdsPort6: 19133 });
  const [submitted, setSubmitted] = useState(false);
  const [running, setRunning] = useState(false);
  const [operationId, setOperationId] = useState<string>();
  const [error, setError] = useState("");
  const errors = submitted ? portErrors(ports) : {};
  const task = operationId ? models[profile.id]?.tasks.find((row) => row.id === operationId) : undefined;
  const submit = async () => {
    setSubmitted(true);
    if (Object.keys(portErrors(ports)).length) return;
    setRunning(true);
    setError("");
    try {
      await createDeployment(profile, { dbPort: ports.dbPort!, bdsPort: ports.bdsPort!, bdsPort6: ports.bdsPort6! }, setOperationId);
      setFlow(null);
      toast.success("服务器已准备好", `${profile.name} 可以开始管理`);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setRunning(false);
    }
  };
  return (
    <Modal
      open
      onClose={() => setFlow(null)}
      dismissible={!running}
      size="md"
      icon="rocket"
      title="初始化新部署"
      description={<>将在 <span className="mono">{profile.root}</span> 准备 BDS、核心配置和模块目录，并启动服务。</>}
      onSubmit={() => void submit()}
      footer={
        <>
          <Button variant="ghost" disabled={running} onClick={() => setFlow(null)}>仅查看</Button>
          <Button variant="primary" type="submit" loading={running}>{running ? "正在初始化…" : error ? "重试" : "接受条款并创建"}</Button>
        </>
      }
    >
      {operationId ? (
        <div className="form-stack">
          <OperationSteps phases={task?.phases ?? []} pendingLabel="等待部署任务开始" />
          {error && <Callout tone="danger" title="初始化失败">{error}</Callout>}
        </div>
      ) : (
        <div className="form-stack">
          <Callout tone="info" title="使用条款" action={<Button size="sm" variant="ghost" iconEnd="external" onClick={() => void window.sfmc.openLink("eula")}>阅读 Minecraft EULA</Button>}>
            请先阅读并接受 Minecraft 服务端使用条款。点击“接受条款并创建”即确认接受相应条款。
          </Callout>
          <div className="form-grid-3">
            {PORT_FIELDS.map((row) => (
              <Field key={row.key} label={row.label} required error={errors[row.key]} description={row.description}>
                <NumberInput value={ports[row.key]} onChange={(value) => setPorts((previous) => ({ ...previous, [row.key]: value }))} min={1} max={65535} integer invalid={Boolean(errors[row.key])} />
              </Field>
            ))}
          </div>
          {error && <Callout tone="danger" title="初始化失败">{error}</Callout>}
        </div>
      )}
    </Modal>
  );
}

/** flow.kind → 对话框组件的注册表：新增连接步骤只需追加一项 */
const FLOW_DIALOGS: { [K in Flow["kind"]]: ComponentType<{ flow: Extract<Flow, { kind: K }> }> } = {
  login: LoginDialog,
  deploy: DeployDialog,
};

/** 连接流程对话框出口：同一时间最多一个；切换实例或流程时以 kind + profile.id 重新挂载，避免沿用上一流程的表单状态 */
export function FlowDialogs() {
  const { flow } = useDesktop();
  if (!flow) return null;
  const Dialog = FLOW_DIALOGS[flow.kind] as ComponentType<{ flow: Flow }>;
  return <Dialog key={`${flow.kind}:${flow.profile.id}`} flow={flow} />;
}
