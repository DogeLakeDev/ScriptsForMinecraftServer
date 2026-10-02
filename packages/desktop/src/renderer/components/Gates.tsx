/**
 * Gates.tsx — 工作区之前的两个整页状态
 *
 * Welcome：尚无任何实例时的首启引导（选择本机或 SSH 两种接入方式）。
 * ConnectGate：已选实例但尚未建立管理连接时的接入页，内联展示连接错误与主机指纹核实入口。
 */
import { useDesktop } from "../app/desktop.js";
import { Button } from "./controls.js";
import { Icon, type IconName } from "./icons.js";
import { profileSubtitle } from "./Sidebar.js";
import { Callout } from "./ui.js";

/** 首启欢迎页 */
export function Welcome() {
  const { openProfileDialog } = useDesktop();
  const choices: { kind: "local" | "ssh"; icon: IconName; title: string; text: string }[] = [
    { kind: "local", icon: "monitor", title: "本机", text: "Windows 上的 SFMC 部署目录" },
    { kind: "ssh", icon: "server", title: "远程服务器", text: "Linux 或 Windows，通过 SSH 连接" },
  ];
  return (
    <div className="welcome">
      <div className="welcome-hero">
        <h1>添加实例</h1>
        <p>接入已有部署，或创建新服务器。</p>
      </div>
      <div className="welcome-choices">
        {choices.map((choice) => (
          <button key={choice.kind} type="button" className="choice-card" onClick={() => openProfileDialog(null, choice.kind)}>
            <span className="choice-icon"><Icon name={choice.icon} size={20} /></span>
            <span className="choice-text">
              <b>{choice.title}</b>
              <small>{choice.text}</small>
            </span>
            <Icon name="arrowRight" size={16} className="choice-arrow" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** 未连接实例的接入页 */
export function ConnectGate() {
  const { selected, model, connect, openProfileDialog, confirmHost } = useDesktop();
  if (!selected) return null;
  const fingerprint = model.connectionMessage?.includes("主机指纹");
  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-head">
          <span className="gate-icon"><Icon name={selected.kind === "ssh" ? "server" : "monitor"} size={22} /></span>
          <div>
            <h1>{selected.name}</h1>
            <p className="mono truncate" title={profileSubtitle(selected)}>{profileSubtitle(selected)}</p>
          </div>
        </div>
        {selected.kind === "ssh" && <div className="gate-root"><Icon name="folder" size={14} /><span className="mono truncate">{selected.root}</span></div>}
        {model.connectError && !fingerprint && (
          <Callout tone="danger" title="连接失败">{model.connectError}</Callout>
        )}
        {fingerprint && (
          <Callout tone="danger" icon="shieldAlert" title="主机身份发生变化" action={<Button variant="danger" size="sm" onClick={() => void confirmHost(selected)}>核实主机指纹</Button>}>
            {model.connectionMessage}
          </Callout>
        )}
        <div className="gate-actions">
          <Button variant="primary" size="lg" loading={model.connecting} icon="plug" onClick={() => void connect(selected, false)}>
            {model.connecting ? "正在接入…" : "接入实例"}
          </Button>
          <Button size="lg" icon="settings" onClick={() => openProfileDialog(selected)}>连接设置</Button>
        </div>
      </div>
    </div>
  );
}
