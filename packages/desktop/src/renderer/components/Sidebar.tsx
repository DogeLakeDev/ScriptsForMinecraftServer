/**
 * Sidebar.tsx — 左侧栏（SnowUI Sidebar）：品牌位、实例列表、分组导航、客户端信息
 *
 * 使用场景：应用外壳常驻左侧，宽 212px，可通过底部按钮或 Ctrl+B 切换图标模式。
 * 顶部品牌行与标题栏同高并作为窗口拖拽区；实例列表对应 SnowUI 的 Favorites 区，导航对应 Dashboards/Pages 分组。
 */
import type { InstanceProfile } from "../../shared/api.js";
import { activeTasks, connectionState, useDesktop } from "../app/desktop.js";
import { NAV, type NavItem } from "../app/nav.js";
import { cx } from "../lib/cx.js";
import { Icon, LogoMark } from "./icons.js";
import { IconButton } from "./controls.js";
import { Tooltip } from "./tooltip.js";
import { StatusDot } from "./ui.js";

/** 实例的副标题：本机显示目录，远程显示主机与系统（侧栏悬浮提示、命令面板、欢迎页共用） */
export function profileSubtitle(profile: InstanceProfile): string {
  return profile.kind === "local" ? `本机 ${profile.root}` : `${profile.username ? `${profile.username}@` : ""}${profile.host}${profile.port && profile.port !== 22 ? `:${profile.port}` : ""} ${profile.os === "windows" ? "Windows" : "Linux"}`;
}

/** 实例列表：每行一个实例（状态点 + 名称），当前实例高亮，悬停显示设置按钮 */
function InstanceList({ collapsed }: { collapsed: boolean }) {
  const { profiles, current, setCurrent, models, openProfileDialog } = useDesktop();
  return (
    <div className="sb-section">
      <div className="sb-section-head">
        <span className="sb-group-label">实例</span>
        <IconButton icon="plus" label="添加实例" size="sm" onClick={() => openProfileDialog(null)} />
      </div>
      {profiles.length ? (
        <ul className="sb-instances">
          {profiles.map((profile) => {
            const state = connectionState(models[profile.id]);
            const active = profile.id === current;
            return (
              <li key={profile.id} className={cx("sb-instance", active && "active")}>
                <Tooltip content={<><b>{profile.name}</b><br />{profileSubtitle(profile)}<br />{state.label}</>} side="right">
                  <button type="button" className="sb-instance-main" aria-label={profile.name} aria-current={active ? "true" : undefined} onClick={() => setCurrent(profile.id)}>
                    <StatusDot tone={state.tone} pulse={state.tone === "info"} />
                    <span className="truncate">{profile.name}</span>
                    <Icon name={profile.kind === "ssh" ? "server" : "monitor"} size={14} className="sb-instance-kind" />
                  </button>
                </Tooltip>
                <IconButton icon="settings" label="实例设置" size="sm" className="sb-instance-edit" tooltip={false} onClick={() => openProfileDialog(profile)} />
              </li>
            );
          })}
        </ul>
      ) : (
        <Tooltip content={collapsed ? "添加第一个实例" : undefined} side="right">
          <button type="button" className="sb-instance-empty" aria-label="添加第一个实例" onClick={() => openProfileDialog(null)}>
            <Icon name="plus" size={14} />
            <span className="sb-item-label">添加第一个实例</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
}

/** 左侧栏 */
export function Sidebar({ collapsed, onToggleSidebar, onOpenAbout }: { collapsed: boolean; onToggleSidebar: () => void; onOpenAbout: () => void }) {
  const { model, page, setPage, desktopUpdate } = useDesktop();
  const hasDesktopUpdate = desktopUpdate.info?.available === true;
  const running = activeTasks(model).length;
  const groups = [...new Set(NAV.map((item) => item.group))];
  const disabled = (item: NavItem) => Boolean(model.handshake && !model.handshake.capabilities.includes(item.capability));
  return (
    <aside className="sidebar" aria-label="侧栏">
      <div className="sb-brand drag">
        <LogoMark size={24} />
        <span className="sb-brand-name">SFMC</span>
      </div>
      <div className="sb-scroll">
        <InstanceList collapsed={collapsed} />
        <nav className="sb-nav" id="sidebar-nav" aria-label="工作区">
          {groups.map((group) => (
            <div className="sb-section" key={group}>
              <div className="sb-section-head"><span className="sb-group-label">{group}</span></div>
              {NAV.filter((item) => item.group === group).map((item) => {
                const active = page === item.key;
                return (
                  <Tooltip key={item.key} content={collapsed ? item.label : undefined} side="right" wrap={collapsed && disabled(item)}>
                    <button
                      type="button"
                      className={cx("sb-item", active && "active")}
                      disabled={disabled(item)}
                      aria-label={item.label}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setPage(item.key)}
                    >
                      <Icon name={item.icon} size={20} weight={active ? "fill" : "duotone"} />
                      <span className="sb-item-label">{item.label}</span>
                      {item.key === "tasks" && running > 0 && <span className="sb-count">{running}</span>}
                    </button>
                  </Tooltip>
                );
              })}
              {group === "维护" && (
                <Tooltip content={collapsed ? "关于" : undefined} side="right">
                  <button type="button" className="sb-item sb-about" aria-label={hasDesktopUpdate ? "关于，有桌面更新" : "关于"} onClick={onOpenAbout}>
                    <Icon name="info" size={20} weight="duotone" />
                    <span className="sb-item-label">关于</span>
                    {hasDesktopUpdate && <span className="sb-update-dot" aria-hidden="true" />}
                  </button>
                </Tooltip>
              )}
            </div>
          ))}
        </nav>
      </div>
      <div className="sb-footer">
        <IconButton
          icon="panel"
          label={collapsed ? "展开侧栏" : "收起侧栏"}
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav"
          onClick={onToggleSidebar}
        />
      </div>
    </aside>
  );
}
