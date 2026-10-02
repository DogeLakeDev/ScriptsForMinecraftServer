/**
 * StartupDrawer.tsx — 开机启动配置抽屉
 *
 * 使用场景：服务总览"更多 → 配置开机启动"。读取 startup.plan 生成的一次性安装脚本，
 * 以只读编辑器展示并提供复制；脚本需由管理员在宿主机上执行（与原实现的说明一致）。
 */
import Editor from "@monaco-editor/react";
import { useEffect, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { FONT_MONO, useAppearance } from "../app/theme.js";
import { Button } from "../components/controls.js";
import { Spinner } from "../components/feedback.js";
import { Icon } from "../components/icons.js";
import { Sheet } from "../components/overlays.js";
import { Callout } from "../components/ui.js";
import { errorText } from "../lib/format.js";

export function StartupDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { request, model } = useDesktop();
  const { editorTheme } = useAppearance();
  const [plan, setPlan] = useState<{ script: string; filename: string }>();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    setPlan(undefined);
    setError("");
    request("startup.plan").then(setPlan).catch((reason) => setError(errorText(reason)));
  }, [open, request]);
  const windows = model.handshake?.host.os === "windows";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      width={720}
      title="配置开机启动"
      description={windows ? "注册为 Windows 系统服务" : "注册为 systemd 服务"}
      actions={
        <Button
          variant="primary"
          size="sm"
          disabled={!plan}
          icon={copied ? "check" : "copy"}
          onClick={() => plan && void navigator.clipboard.writeText(plan.script).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
        >
          {copied ? "已复制" : "复制脚本"}
        </Button>
      }
    >
      <div className="sheet-stack">
        <Callout tone="info" title="以部署账号运行">
          {windows
            ? "在宿主机上以管理员身份打开 PowerShell，粘贴并运行此脚本，将 SFMC 注册为 Windows 系统服务。"
            : "在宿主机上以 root 运行此脚本，将 SFMC 注册为 systemd 服务。"}
          管理员权限不足时，将此脚本交给管理员安装。
        </Callout>
        {error && <Callout tone="danger" title="无法生成安装脚本">{error}</Callout>}
        {!plan && !error && <div className="sheet-loading"><Spinner label="正在生成脚本…" /></div>}
        {plan && (
          <div className="code-frame">
            <div className="code-frame-head">
              <Icon name="fileCode" size={14} />
              <span className="mono">{plan.filename}</span>
            </div>
            <Editor
              height="460px"
              theme={editorTheme}
              language={plan.filename.endsWith(".ps1") ? "powershell" : "shell"}
              value={plan.script}
              options={{ readOnly: true, minimap: { enabled: false }, wordWrap: "on", fontSize: 12.5, fontFamily: FONT_MONO, lineNumbersMinChars: 3, scrollBeyondLastLine: false, padding: { top: 12, bottom: 12 }, renderLineHighlight: "none" }}
            />
          </div>
        )}
      </div>
    </Sheet>
  );
}
