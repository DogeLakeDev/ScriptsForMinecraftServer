/**
 * RightRail.tsx — 右侧"动态"栏（SnowUI Right Panel）：告警、任务动态、服务状态
 *
 * 使用场景：应用外壳右侧，宽 280px，可通过顶栏按钮收起（状态持久化在 App 中）。
 * 顶部 68px 为窗口拖拽区，右侧为系统窗口按钮留位；三个区块分别对应 SnowUI 的 Notifications / Activities / Contacts。
 */
import { useEffect, useState, type ReactNode } from "react";
import { useDesktop } from "../app/desktop.js";
import { AlertFeed, ServiceFeed, TaskFeed } from "./feeds.js";
import { EmptyState } from "./ui.js";

/** 区块标题行：标题 + 可选"查看全部"链接 */
function RailSection({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: ReactNode }) {
  return (
    <section className="rail-section">
      <div className="rail-section-head">
        <h2>{title}</h2>
        {action && <button type="button" className="link-btn" onClick={onAction}>{action}</button>}
      </div>
      {children}
    </section>
  );
}

/** 右侧动态栏 */
export function RightRail() {
  const { model, selected, setPage, page, openLog } = useDesktop();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const connected = Boolean(model.handshake);
  return (
    <aside className="rail" aria-label="动态">
      <div className="rail-head drag">
        <span>动态</span>
      </div>
      <div className="rail-scroll">
        {!selected || !connected ? (
          <EmptyState compact icon="broadcast" title="尚未连接" description="连接实例后显示动态" />
        ) : (
          <>
            <RailSection title="告警" action="控制台" onAction={() => setPage("logs")}>
              <AlertFeed logs={model.logs} now={now} limit={4} onSelect={openLog} />
            </RailSection>
            <RailSection title="任务动态" action="全部" onAction={() => setPage("tasks")}>
              <TaskFeed tasks={model.tasks} now={now} limit={6} onSelect={() => setPage("tasks")} />
            </RailSection>
            {page !== "overview" && <RailSection title={model.disconnected ? "服务（已断开）" : "服务"} action="总览" onAction={() => setPage("overview")}>
              <ServiceFeed services={model.services} stale={model.disconnected} onSelect={() => setPage("overview")} />
            </RailSection>}
          </>
        )}
      </div>
    </aside>
  );
}
