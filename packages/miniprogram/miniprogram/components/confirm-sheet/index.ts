/**
 * confirm-sheet — 后台任务确认弹窗（WeUI half-screen-dialog）
 *
 * 使用场景：每个会提交写操作的页面放一个 <confirm-sheet id="confirm" />，由 core/actions.ts 的 submit 调用 open。
 * onConfirm 在弹窗内执行：失败时错误留在弹窗里，用户可重试或取消（与桌面端确认框一致）。
 */
import { errorText } from "../../core/format";
import type { ConfirmSheet } from "../../core/actions";

type OpenOptions = Parameters<ConfirmSheet["open"]>[0];

/** 组件实例 → 本次打开的回调（不放进 data，避免函数参与 setData） */
const pending = new WeakMap<object, { resolve: (ok: boolean) => void; onConfirm?: () => Promise<void> }>();

Component({
  options: { multipleSlots: true },
  data: {
    show: false,
    title: "",
    description: "",
    okText: "执行",
    cancelText: "取消",
    danger: false,
    acknowledge: "",
    acked: false,
    pending: false,
    error: "",
  },
  lifetimes: {
    detached() {
      pending.get(this)?.resolve(false);
      pending.delete(this);
    },
  },
  methods: {
    /** 打开弹窗，用户确认且 onConfirm 成功时返回 true */
    open(options: OpenOptions): Promise<boolean> {
      pending.get(this)?.resolve(false);
      return new Promise<boolean>((resolve) => {
        pending.set(this, { resolve, onConfirm: options.onConfirm });
        this.setData({
          show: true,
          title: options.title,
          description: options.description ?? "",
          okText: options.okText ?? "执行",
          cancelText: options.cancelText ?? "取消",
          danger: Boolean(options.danger),
          acknowledge: options.acknowledge ?? "",
          acked: false,
          pending: false,
          error: "",
        });
      });
    },
    toggleAck() {
      if (!this.data.pending) this.setData({ acked: !this.data.acked });
    },
    async confirm() {
      const entry = pending.get(this);
      if (!entry || this.data.pending || (this.data.acknowledge && !this.data.acked)) return;
      this.setData({ pending: true, error: "" });
      try {
        await entry.onConfirm?.();
      } catch (error) {
        this.setData({ pending: false, error: errorText(error) });
        return;
      }
      this.finish(true);
    },
    cancel() {
      if (!this.data.pending) this.finish(false);
    },
    onClose() {
      if (this.data.pending) return;
      this.finish(false);
    },
    finish(ok: boolean) {
      const entry = pending.get(this);
      pending.delete(this);
      this.setData({ show: false, pending: false });
      entry?.resolve(ok);
    },
  },
});
