/**
 * ui.tsx — 桌面端通用展示组件（SnowUI 视觉）
 *
 * 使用场景：各页面共用的页头、区块（Block）、徽章、状态点、空状态、提示条、统计卡片等。
 * 视觉细节集中在 styles/components.css，页面只组合这些组件，避免各处重复拼装样式（DRY）。
 * IconButton 的实现位于 controls.tsx（Base UI 原语层），这里转出以保持页面既有的导入路径不变。
 */
import { useState, type CSSProperties, type ReactNode } from "react";
import { cx } from "../lib/cx.js";
import type { Tone } from "../lib/format.js";
import { Icon, type IconName } from "./icons.js";
import { Tooltip } from "./tooltip.js";

export { IconButton } from "./controls.js";

/** 页头：标题（14px Semibold，SnowUI 规范）+ 描述 + 右侧操作区 */
export function PageHeader({ title, description, actions, meta }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {meta && <div className="page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

/**
 * 区块（SnowUI Block）：#F9F9FA 底色、20px 圆角、24px 内边距，可选标题行。
 * @param flush 内容区不加内边距（列表行贴边，由行自身控制留白）
 */
export function Surface({ title, description, extra, children, className, flush, icon, style }: { title?: ReactNode; description?: ReactNode; extra?: ReactNode; children?: ReactNode; className?: string; flush?: boolean; icon?: IconName; style?: CSSProperties }) {
  return (
    <section className={cx("surface", flush && "surface-flush", className)} style={style}>
      {(title || extra) && (
        <div className="surface-head">
          <div className="surface-title">
            {icon && <span className="surface-icon"><Icon name={icon} size={16} /></span>}
            <div>
              {title && <h2>{title}</h2>}
              {description && <p>{description}</p>}
            </div>
          </div>
          {extra && <div className="surface-extra">{extra}</div>}
        </div>
      )}
      {children !== undefined && <div className="surface-body">{children}</div>}
    </section>
  );
}

/** 状态点：pulse 用于"进行中"的呼吸效果 */
export function StatusDot({ tone = "neutral", pulse }: { tone?: Tone; pulse?: boolean }) {
  return <span className={cx("status-dot", `tone-${tone}`, pulse && "pulse")} aria-hidden="true" />;
}

/** 徽章：小号胶囊标签，可带图标或状态点 */
export function Badge({ tone = "neutral", children, icon, dot, title, className }: { tone?: Tone; children: ReactNode; icon?: IconName; dot?: boolean; title?: string; className?: string }) {
  return (
    <span className={cx("badge", `tone-${tone}`, className)} title={title}>
      {dot && <StatusDot tone={tone} />}
      {icon && <Icon name={icon} size={12} weight="bold" spin={icon === "loader"} />}
      {children}
    </span>
  );
}

/** 空状态：图标 + 标题 + 描述 + 操作 */
export function EmptyState({ icon = "archive", title, description, action, compact }: { icon?: IconName; title: ReactNode; description?: ReactNode; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx("empty-state", compact && "compact")}>
      <div className="empty-icon"><Icon name={icon} size={compact ? 18 : 22} weight="duotone" /></div>
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

/** 提示条：页面级/区块内的告知、警告与错误 */
export function Callout({ tone = "info", title, children, action, icon }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: IconName }) {
  const fallback: IconName = tone === "danger" ? "alert" : tone === "warning" ? "warning" : tone === "success" ? "checkCircle" : "info";
  return (
    <div className={cx("callout", `tone-${tone}`)} role={tone === "danger" ? "alert" : "status"}>
      <Icon name={icon ?? fallback} size={16} weight="fill" className="callout-icon" />
      <div className="callout-body">
        {title && <div className="callout-title">{title}</div>}
        {children && <div className="callout-text">{children}</div>}
      </div>
      {action && <div className="callout-action">{action}</div>}
    </div>
  );
}

/**
 * 统计卡片：蓝色与石墨色渐变交替，点击进入对应管理页。
 */
export function Stat({ label, value, hint, variant = "blue", icon, onClick }: { label: ReactNode; value: ReactNode; hint?: ReactNode; variant?: "blue" | "graphite"; icon?: IconName; onClick?: () => void }) {
  return (
    <button type="button" className={`stat stat-${variant}`} onClick={onClick}>
      <div className="stat-label">{label}{icon && <span className="stat-icon"><Icon name={icon} size={14} /></span>}</div>
      <div className="stat-row">
        <div className="stat-value">{value}</div>
        {hint && <div className="stat-hint">{hint}</div>}
      </div>
    </button>
  );
}

/** 键盘按键提示（SnowUI：0.5px 描边、6px 圆角、12px 字号） */
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** 等宽文本 + 一键复制（用于 UUID、路径、任务编号） */
export function CopyText({ text, display, className }: { text: string; display?: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className={cx("copy-text", className)}>
      <span className="mono truncate" title={text}>{display ?? text}</span>
      <Tooltip content={copied ? "已复制" : "复制"}>
        <button
          type="button"
          className="copy-btn"
          aria-label="复制"
          onClick={(event) => {
            event.stopPropagation();
            void navigator.clipboard.writeText(text).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            });
          }}
        >
          <Icon name={copied ? "check" : "copy"} size={12} />
        </button>
      </Tooltip>
    </span>
  );
}

/** 字母头像：同名同色，用于玩家列表 */
export function Avatar({ name, size = 24, hue }: { name: string; size?: number; hue: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.46), background: `hsl(${hue} 70% 88%)`, color: `hsl(${hue} 40% 28%)` }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** 设置行：左侧标签与说明，右侧控件（配置表单、偏好设置） */
export function SettingRow({ label, description, control, mono }: { label: ReactNode; description?: ReactNode; control: ReactNode; mono?: boolean }) {
  return (
    <div className="setting-row">
      <div className="setting-text">
        <div className={cx("setting-label", mono && "mono")}>{label}</div>
        {description && <div className="setting-desc">{description}</div>}
      </div>
      <div className="setting-control">{control}</div>
    </div>
  );
}

/** 筛选芯片：可切换的小按钮，带计数 */
export function Chip({ active, onClick, children, count, tone }: { active: boolean; onClick: () => void; children: ReactNode; count?: number; tone?: Tone }) {
  return (
    <button type="button" className={cx("chip", active && "active", tone && `tone-${tone}`)} onClick={onClick} aria-pressed={active}>
      {tone && <StatusDot tone={tone} />}
      {children}
      {count !== undefined && <span className="chip-count">{count > 999 ? "999+" : count}</span>}
    </button>
  );
}

/** 图标色块（SnowUI 右侧栏条目的 24px 圆角图标底）：用于动态列表、服务行 */
export function IconTile({ icon, tone = "neutral", size = 24, spin }: { icon: IconName; tone?: Tone | "pastel-1" | "pastel-2"; size?: number; spin?: boolean }) {
  return (
    <span className={cx("icon-tile", `tile-${tone}`)} style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.62)} spin={spin} />
    </span>
  );
}
