/**
 * feedback.tsx — 全局反馈：通知（Toast）与确认对话框（Confirm）
 *
 * 使用场景：
 * - toast：操作结果提示、后台任务进度卡片（以任务编号为 id 原地更新）。基于 Base UI 全局 ToastManager，
 *   因此 DesktopProvider 的回调等非组件代码也能直接调用，调用方不依赖具体渲染细节（DIP）。
 * - useConfirm：替代 antd modal.confirm 的 Promise 式确认框，支持危险操作、强确认复选框，
 *   以及 onConfirm 异步执行（执行中按钮显示加载，失败时错误留在对话框内并保持打开）。
 */
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { Toast } from "@base-ui/react/toast";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { cx } from "../lib/cx.js";
import { errorText } from "../lib/format.js";
import { Button, Checkbox } from "./controls.js";
import { Icon, type IconName } from "./icons.js";

/** 通知语气：progress 为进行中的后台任务（旋转图标 + 不确定进度条，默认不自动关闭） */
export type ToastTone = "success" | "danger" | "warning" | "info" | "progress";

/** 通知自定义数据（随 Base UI toast 对象传递给渲染层） */
interface ToastData {
  tone: ToastTone;
  /** 标题下方的次要信息（例如所属实例名） */
  meta?: ReactNode;
}

/** 通知参数 */
export interface ToastOptions {
  /** 相同 id 再次调用会原地更新（任务进度卡片使用任务编号作为 id） */
  id?: string;
  tone?: ToastTone;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  /** 自动关闭时间（毫秒），0 表示不自动关闭；默认 progress 不关闭、danger 8 秒、其余 4.5 秒 */
  timeout?: number;
  action?: { label: string; onClick: () => void };
  /** 通知被关闭时回调（用户手动关闭或超时） */
  onClose?: () => void;
}

/** 全局通知管理器（模块级单例，由 <ToastHost> 渲染） */
const manager = Toast.createToastManager<ToastData>();

/** 通知 API：toast.show / success / error / info / warning / close */
export const toast = {
  show(options: ToastOptions): string {
    const tone = options.tone ?? "info";
    return manager.add({
      id: options.id,
      title: options.title,
      description: options.description,
      type: tone,
      timeout: options.timeout ?? (tone === "progress" ? 0 : tone === "danger" ? 8000 : 4500),
      priority: tone === "danger" ? "high" : "low",
      onClose: options.onClose,
      actionProps: options.action ? { children: options.action.label, onClick: options.action.onClick } : undefined,
      data: { tone, meta: options.meta },
    });
  },
  success: (title: ReactNode, description?: ReactNode) => toast.show({ tone: "success", title, description }),
  error: (title: ReactNode, description?: ReactNode) => toast.show({ tone: "danger", title, description }),
  info: (title: ReactNode, description?: ReactNode) => toast.show({ tone: "info", title, description }),
  warning: (title: ReactNode, description?: ReactNode) => toast.show({ tone: "warning", title, description }),
  close: (id?: string) => manager.close(id),
};

/** 语气 → 图标 */
const TONE_ICON: Record<Exclude<ToastTone, "progress">, IconName> = { success: "checkCircle", danger: "xCircle", warning: "warning", info: "info" };

/** 通知列表（必须位于 Toast.Provider 内） */
function ToastList() {
  const { toasts } = Toast.useToastManager<ToastData>();
  return toasts.map((item) => {
    const tone = item.data?.tone ?? "info";
    return (
      <Toast.Root key={item.id} toast={item} className={cx("toast", `toast-${tone}`)}>
        <Toast.Content className="toast-content">
          <span className="toast-icon">{tone === "progress" ? <Icon name="loader" spin size={18} /> : <Icon name={TONE_ICON[tone]} size={18} weight="fill" />}</span>
          <div className="toast-text">
            <Toast.Title className="toast-title" />
            {item.data?.meta && <div className="toast-meta">{item.data.meta}</div>}
            <Toast.Description className="toast-desc" />
            {tone === "progress" && <div className="toast-progress" aria-hidden="true"><span /></div>}
          </div>
          {item.actionProps && <Toast.Action className="btn btn-secondary btn-sm toast-action" />}
          <Toast.Close className="icon-btn icon-btn-sm icon-btn-ghost toast-close" aria-label="关闭通知"><Icon name="x" size={14} /></Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

/** 通知渲染宿主：应用根节点放置一次（右下角堆叠，悬停展开） */
export function ToastHost() {
  return (
    <Toast.Provider toastManager={manager} limit={4}>
      <Toast.Portal>
        <Toast.Viewport className="toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

/** 确认对话框参数 */
export interface ConfirmOptions {
  title: ReactNode;
  /** 主要说明 */
  description?: ReactNode;
  /** 次要提示（灰色小字，例如"任务提交后关闭客户端不会取消执行"） */
  note?: ReactNode;
  okText?: string;
  cancelText?: string;
  /** 危险操作：红色图标与确认按钮 */
  danger?: boolean;
  icon?: IconName;
  /** 强确认：需勾选此文案的复选框后才能确认 */
  acknowledge?: string;
  /** 确认后执行的异步动作：执行中按钮显示加载；抛错时错误显示在对话框内并保持打开 */
  onConfirm?: () => Promise<unknown> | unknown;
}
/** 打开确认框：确认（且 onConfirm 成功）返回 true，取消返回 false */
export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** 读取确认函数（必须位于 ConfirmProvider 内） */
export function useConfirm(): ConfirmFn {
  const value = useContext(ConfirmContext);
  if (!value) throw new Error("useConfirm 必须在 ConfirmProvider 内使用");
  return value;
}

/** 当前确认请求 */
interface ConfirmRequest {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

/**
 * 确认框提供者：同一时刻只显示一个确认框；新的请求会以"取消"结束上一个尚未回答的请求。
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<ConfirmRequest | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        current.current?.resolve(false);
        const next = { options, resolve };
        current.current = next;
        setRequest(next);
        setBusy(false);
        setAcknowledged(false);
        setError("");
        setOpen(true);
      }),
    []
  );
  /** 结束当前请求并关闭对话框 */
  const finish = (value: boolean) => {
    current.current?.resolve(value);
    current.current = null;
    setOpen(false);
  };
  const accept = async () => {
    const active = current.current;
    if (!active) return;
    if (!active.options.onConfirm) return finish(true);
    setBusy(true);
    setError("");
    try {
      await active.options.onConfirm();
      if (current.current === active) finish(true);
    } catch (reason) {
      if (current.current === active) setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const options = request?.options;
  const tone = options?.danger ? "danger" : "neutral";
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog.Root open={open} onOpenChange={(next) => { if (!next && !busy) finish(false); }} onOpenChangeComplete={(next) => { if (!next && !current.current) setRequest(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="dialog-backdrop" />
          <AlertDialog.Viewport className="dialog-viewport">
            <AlertDialog.Popup className="dialog dialog-sm confirm">
              {options && (
                <>
                  <div className="dialog-head">
                    <span className={cx("dialog-icon", `tone-${tone}`)}><Icon name={options.icon ?? (options.danger ? "warning" : "zap")} size={20} /></span>
                    <div className="dialog-head-text">
                      <AlertDialog.Title className="dialog-title">{options.title}</AlertDialog.Title>
                      {options.description && <AlertDialog.Description className="dialog-desc" render={<div />}>{options.description}</AlertDialog.Description>}
                    </div>
                  </div>
                  {(options.note || options.acknowledge || error) && (
                    <div className="dialog-body confirm-body">
                      {options.note && <p className="confirm-note">{options.note}</p>}
                      {options.acknowledge && <Checkbox checked={acknowledged} onChange={setAcknowledged} disabled={busy}>{options.acknowledge}</Checkbox>}
                      {error && <div className="confirm-error" role="alert"><Icon name="xCircle" size={14} />{error}</div>}
                    </div>
                  )}
                  <div className="dialog-foot">
                    <Button variant="ghost" disabled={busy} onClick={() => finish(false)}>{options.cancelText ?? "取消"}</Button>
                    <Button variant={options.danger ? "danger" : "primary"} loading={busy} disabled={Boolean(options.acknowledge) && !acknowledged} onClick={() => void accept()} autoFocus={!options.danger}>
                      {options.okText ?? "确定"}
                    </Button>
                  </div>
                </>
              )}
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </ConfirmContext.Provider>
  );
}

/** 不确定进度条（标题栏全局忙碌指示、加载占位） */
export function ProgressLine({ className }: { className?: string }) {
  return <div className={cx("progress-line", className)} role="progressbar" aria-label="正在处理"><span /></div>;
}

/** 居中加载指示 */
export function Spinner({ label, size = 20 }: { label?: ReactNode; size?: number }) {
  return (
    <div className="spinner" role="status">
      <Icon name="loader" spin size={size} />
      {label && <span>{label}</span>}
    </div>
  );
}
