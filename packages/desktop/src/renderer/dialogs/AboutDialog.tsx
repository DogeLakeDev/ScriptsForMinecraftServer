/**
 * AboutDialog.tsx — 关于与客户端更新
 *
 * 使用场景：侧栏页脚"关于与更新"、命令面板"关于与检查更新"。
 * 打开时自动执行一次 update("check")：
 *  - 手动更新或便携版：提供发行页下载入口；
 *  - 开发模式：不执行客户端安装升级；
 *  - 支持自动更新的安装版：下载完成后可"安装并重启客户端"。
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

/** update("check") 的返回形状（与原实现的收窄一致） */
interface UpdateInfo {
  manual?: boolean;
  portable?: boolean;
  development?: boolean;
  available?: boolean;
  releaseNotes?: string;
}

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
  const { appInfo } = useDesktop();
  const [info, setInfo] = useState<UpdateInfo>();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [installing, setInstalling] = useState(false);

  const check = () => {
    setChecking(true);
    setCheckError("");
    window.sfmc
      .update("check")
      .then((value) => setInfo(value as UpdateInfo))
      .catch((error) => setCheckError(errorText(error)))
      .finally(() => setChecking(false));
  };
  useEffect(() => {
    if (open) check();
  }, [open]);

  const download = () => {
    setDownloading(true);
    window.sfmc
      .update("download")
      .then(() => {
        setDownloaded(true);
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
          <Badge>{appInfo?.packaged ? "正式版" : "开发版"}</Badge>
          <Badge className="mono">{appInfo?.platform ?? "—"}</Badge>
        </div>
        <section className="about-section">
          <div className="about-section-head">
            <h3>客户端更新</h3>
            <Button size="sm" variant="ghost" icon="refresh" loading={checking} onClick={check}>
              重新检查
            </Button>
          </div>
          {checking && !info ? (
            <Spinner label="正在检查更新…" />
          ) : checkError ? (
            <Callout tone="danger" title="检查失败">
              {checkError}
            </Callout>
          ) : info?.manual || info?.portable ? (
            <>
              <p className="about-text">
                请从发行页下载安装包，或下载 ZIP 后退出客户端并替换应用文件。实例和后台继续运行。
              </p>
              <div className="about-actions">
                <Button iconEnd="external" onClick={() => void window.sfmc.openLink("desktop-release")}>
                  打开发行页面
                </Button>
              </div>
            </>
          ) : info?.development ? (
            <p className="about-text">开发模式不执行客户端安装升级。</p>
          ) : info ? (
            <>
              <p className="about-text">
                {info.available ? (
                  <Badge tone="info" dot>
                    有新的桌面版本
                  </Badge>
                ) : (
                  <Badge tone="success" dot>
                    已是最新桌面版本
                  </Badge>
                )}
              </p>
              {info.releaseNotes && <pre className="code-block about-notes">{info.releaseNotes}</pre>}
              <div className="about-actions">
                <Button
                  icon={downloaded ? "check" : "download"}
                  disabled={!info.available || downloaded}
                  loading={downloading}
                  onClick={download}
                >
                  {downloaded ? "已下载" : "下载更新"}
                </Button>
                <Button
                  variant="primary"
                  icon="restart"
                  disabled={!info.available}
                  loading={installing}
                  onClick={install}
                >
                  安装并重启客户端
                </Button>
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
          <p className="about-foot">SFMC 以独立后台运行，关闭客户端不会停止服务与已提交的任务。</p>
        </section>
      </div>
    </Modal>
  );
}
