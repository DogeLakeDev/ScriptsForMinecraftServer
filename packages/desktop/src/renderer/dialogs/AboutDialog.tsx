/**
 * AboutDialog.tsx — 关于与客户端更新
 *
 * 使用场景：侧栏页脚"关于与更新"、命令面板"关于与检查更新"。
 * 打开时自动执行一次 update("check")，三种形态的处理与原实现一致：
 *  - 便携版与预览版：展示桌面端更新日志，提供"打开发行页面"；
 *  - 开发模式：不执行客户端安装升级；
 *  - 安装版：有新版本时可"下载更新"，下载完成后才可"安装并重启客户端"。
 * 同时列出界面所用的设计资源与开源字体/图标/组件的许可声明。
 */
import { useEffect, useState } from "react";
import { useDesktop } from "../app/desktop.js";
import { Button } from "../components/controls.js";
import { Spinner, toast } from "../components/feedback.js";
import { LogoMark } from "../components/icons.js";
import { Modal } from "../components/overlays.js";
import { Badge, Callout } from "../components/ui.js";
import { errorText } from "../lib/format.js";
import { ReleaseNotes } from "../components/ReleaseNotes.js";

/** 第三方资源声明 */
const CREDITS: { name: string; by: string; license: string }[] = [
  { name: "SnowUI Design System", by: "ByeWind", license: "CC BY 4.0" },
  { name: "Base UI", by: "MUI", license: "MIT" },
  { name: "Phosphor Icons", by: "Phosphor", license: "MIT" },
  { name: "Inter", by: "Rasmus Andersson", license: "SIL OFL 1.1" },
  { name: "Noto Sans SC", by: "Google", license: "SIL OFL 1.1" },
  { name: "JetBrains Mono", by: "JetBrains", license: "SIL OFL 1.1" },
  { name: "Monaco Editor", by: "Microsoft", license: "MIT" },
];

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appInfo, desktopUpdate } = useDesktop();
  const { info, checking, error: checkError, check } = desktopUpdate;
  const [downloading, setDownloading] = useState(false);
  const [downloadedVersion, setDownloadedVersion] = useState<string>();
  const downloaded = Boolean(info?.version && downloadedVersion === info.version);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (open) void check();
  }, [open, check]);

  const download = () => {
    setDownloading(true);
    window.sfmc
      .update("download")
      .then(() => {
        setDownloadedVersion(info?.version);
        toast.success("更新已下载", "可安装并重启客户端");
      })
      .catch((error) => toast.error("下载更新失败", errorText(error)))
      .finally(() => setDownloading(false));
  };
  const install = () => {
    if (!downloaded) {
      toast.info("请先下载更新");
      return;
    }
    setInstalling(true);
    window.sfmc.update("install").catch((error) => {
      setInstalling(false);
      toast.error("安装更新失败", errorText(error));
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="md" title="关于 SFMC Desktop" className="about-dialog">
      <div className="about">
        <div className="about-hero">
          <LogoMark size={48} />
          <div>
            <b>SFMC Desktop</b>
            <span className="mono">v{appInfo?.version ?? "—"}</span>
          </div>
          <span className="toolbar-spacer" />
          <Badge>{appInfo?.packaged ? appInfo.version.includes("-") ? "预览版" : "正式版" : "开发版"}</Badge>
          <Badge className="mono">{appInfo?.platform ?? "—"}</Badge>
        </div>
        <section className="about-section">
          <div className="about-section-head">
            <h3>客户端更新</h3>
            <Button size="sm" variant="ghost" icon="refresh" loading={checking} onClick={() => void check()}>重新检查</Button>
          </div>
          {checking && !info ? (
            <Spinner label="正在检查更新…" />
          ) : checkError ? (
            <Callout tone="danger" title="检查失败">{checkError}</Callout>
          ) : info?.development ? (
            <p className="about-text">开发模式不执行客户端安装升级。</p>
          ) : info ? (
            <>
              <p className="about-text">
                {info.noRelease ? <Badge>暂无桌面发行版本</Badge> : info.available ? <Badge tone="info" dot>有新的桌面版本 · {info.version}</Badge> : <Badge tone="success" dot>已是最新桌面版本</Badge>}
              </p>
              {!info.noRelease && <ReleaseNotes notes={info.releaseNotes} version={info.version ?? appInfo?.version ?? "—"} title="桌面端更新日志" />}
              <div className="about-actions">
                {info.manual || info.portable || info.noRelease ? <Button iconEnd="external" onClick={() => void window.sfmc.openLink("desktop-release")}>打开发行页面</Button> : <>
                <Button icon={downloaded ? "check" : "download"} disabled={!info.available || downloaded} loading={downloading} onClick={download}>{downloaded ? "已下载" : "下载更新"}</Button>
                <Button variant="primary" icon="restart" disabled={!info.available || !downloaded} loading={installing} onClick={install}>安装并重启客户端</Button>
                </>}
              </div>
            </>
          ) : null}
        </section>
        <section className="about-section">
          <h3>致谢</h3>
          <ul className="credits">
            {CREDITS.map((row) => (
              <li key={row.name}>
                <span>{row.name}</span>
                <span className="muted">{row.by}</span>
                <span className="mono muted">{row.license}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
