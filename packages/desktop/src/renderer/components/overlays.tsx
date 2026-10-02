/**
 * overlays.tsx — 浮层原语：下拉菜单、弹出卡片、模态对话框、侧边抽屉（Base UI 封装）
 *
 * 使用场景：页面"更多"菜单、标题栏连接详情、实例设置/登录/向导对话框、开机启动脚本抽屉。
 * 焦点管理、Esc 关闭、滚动锁定、ARIA 角色由 Base UI 负责；视觉统一为 SnowUI 毛玻璃浮层（styles/overlays.css）。
 * 菜单由数据驱动（MenuEntry[]），新增菜单项只需追加数据（OCP）。
 */
import { Dialog } from "@base-ui/react/dialog";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cx } from "../lib/cx.js";
import type { Tone } from "../lib/format.js";
import { Icon, type IconName } from "./icons.js";

/** 浮层相对触发器的方位 */
type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

/** 菜单条目：普通项 / 分隔线 / 分组标题；checked 用于单选型菜单（如外观模式）在右侧显示对勾 */
export type MenuEntry =
  | { type?: "item"; key: string; label: ReactNode; icon?: IconName; hint?: ReactNode; danger?: boolean; disabled?: boolean; checked?: boolean; onSelect: () => void }
  | { type: "separator"; key: string }
  | { type: "label"; key: string; label: ReactNode };

/** 下拉菜单：trigger 必须是可接收 ref 与事件属性的元素（如 <Button>、<IconButton>） */
export function Menu({ trigger, items, side = "bottom", align = "end", width }: { trigger: ReactElement; items: MenuEntry[]; side?: Side; align?: Align; width?: number }) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner className="pop-positioner" side={side} align={align} sideOffset={6}>
          <BaseMenu.Popup className="pop menu" style={width ? { minWidth: width } : undefined}>
            {items.map((item) => {
              if (item.type === "separator") return <BaseMenu.Separator key={item.key} className="menu-sep" />;
              if (item.type === "label") return <div key={item.key} className="menu-label">{item.label}</div>;
              return (
                <BaseMenu.Item key={item.key} disabled={item.disabled} onClick={item.onSelect} className={cx("menu-item", item.danger && "danger")}>
                  {item.icon && <Icon name={item.icon} size={16} className="menu-item-icon" />}
                  <span className="menu-item-label">{item.label}</span>
                  {item.hint && <span className="menu-item-hint">{item.hint}</span>}
                  {item.checked && <Icon name="check" size={14} className="menu-item-check" />}
                </BaseMenu.Item>
              );
            })}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}

/** 弹出卡片：点击触发器打开的非模态浮层（连接详情、告警列表、实例切换） */
export function Popover({ trigger, children, side = "bottom", align = "end", open, onOpenChange, className, width }: { trigger: ReactElement; children: ReactNode; side?: Side; align?: Align; open?: boolean; onOpenChange?: (open: boolean) => void; className?: string; width?: number }) {
  return (
    <BasePopover.Root open={open} onOpenChange={onOpenChange ? (next) => onOpenChange(next) : undefined}>
      <BasePopover.Trigger render={trigger} />
      <BasePopover.Portal>
        <BasePopover.Positioner className="pop-positioner" side={side} align={align} sideOffset={8}>
          <BasePopover.Popup className={cx("pop", "popover", className)} style={width ? { width } : undefined}>{children}</BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </BasePopover.Root>
  );
}

/** 对话框公共属性（Modal 与 Sheet 共用同一契约，可互换使用：LSP） */
export interface DialogShellProps {
  open: boolean;
  /** 用户请求关闭（点击遮罩、Esc、右上角关闭）；dismissible=false 时不会触发 */
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  /** 是否允许用户关闭（提交中应设为 false，避免中途关闭） */
  dismissible?: boolean;
  /** 提供后对话框内容包在 <form> 中：回车提交，底部主按钮应设 type="submit" */
  onSubmit?: () => void;
  className?: string;
}

/** 对话框主体：标题区 + 内容 + 底部操作；onSubmit 存在时整体为表单 */
function DialogContent({ title, description, icon, iconTone, dismissible, children, footer, onSubmit, headExtra }: Pick<DialogShellProps, "title" | "description" | "dismissible" | "children" | "footer" | "onSubmit"> & { icon?: IconName; iconTone?: Tone; headExtra?: ReactNode }) {
  const body = (
    <>
      {children !== undefined && children !== null && children !== false && <div className="dialog-body">{children}</div>}
      {footer && <div className="dialog-foot">{footer}</div>}
    </>
  );
  return (
    <>
      <div className="dialog-head">
        {icon && <span className={cx("dialog-icon", `tone-${iconTone ?? "neutral"}`)}><Icon name={icon} size={20} /></span>}
        <div className="dialog-head-text">
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          {description && <Dialog.Description className="dialog-desc">{description}</Dialog.Description>}
        </div>
        {headExtra}
        {dismissible !== false && (
          <Dialog.Close className="icon-btn icon-btn-sm icon-btn-ghost dialog-close" aria-label="关闭"><Icon name="x" size={16} /></Dialog.Close>
        )}
      </div>
      {onSubmit ? (
        <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }} noValidate>{body}</form>
      ) : body}
    </>
  );
}

/** 居中模态对话框：sm 420px / md 520px / lg 640px */
export function Modal({ open, onClose, dismissible = true, size = "md", icon, iconTone, className, ...content }: DialogShellProps & { size?: "sm" | "md" | "lg"; icon?: IconName; iconTone?: Tone }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && dismissible) onClose(); }} disablePointerDismissal={!dismissible}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop" />
        <Dialog.Viewport className="dialog-viewport">
          <Dialog.Popup className={cx("dialog", `dialog-${size}`, className)}>
            <DialogContent {...content} dismissible={dismissible} icon={icon} iconTone={iconTone} />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** 右侧抽屉：用于内容较长的只读/辅助面板（开机启动脚本、任务详情） */
export function Sheet({ open, onClose, dismissible = true, width = 640, actions, className, ...content }: DialogShellProps & { width?: number; actions?: ReactNode }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next && dismissible) onClose(); }} disablePointerDismissal={!dismissible}>
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-backdrop sheet-backdrop" />
        <Dialog.Viewport className="sheet-viewport">
          <Dialog.Popup className={cx("dialog", "sheet", className)} style={{ "--sheet-width": `${width}px` } as CSSProperties}>
            <DialogContent {...content} dismissible={dismissible} headExtra={actions && <div className="sheet-actions">{actions}</div>} />
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
