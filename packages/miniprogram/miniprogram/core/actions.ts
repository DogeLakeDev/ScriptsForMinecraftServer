/**
 * actions.ts — 提交后台任务与包裹异步操作
 *
 * 使用场景：页面的启停、安装、保存、备份等写操作统一走 submit：
 * 先在页面内的 <confirm-sheet id="confirm"> 半屏弹窗中说明影响，确认后才发出请求，
 * 请求失败时错误留在弹窗里可重试（与桌面端 submit 语义一致）；受理后交给会话层跟踪任务结果。
 */
import { errorText } from "./format";
import { activeTasks, session } from "./session";
import type { ManagementMethod } from "./types";

/** 确认弹窗选项（与桌面端 SubmitOptions 对齐，description 为纯文本） */
export interface SubmitOptions {
  description?: string;
  /** 危险操作：确认按钮为红色 */
  danger?: boolean;
  /** 确认按钮文案（默认"执行"） */
  okText?: string;
  /** 强确认：勾选此文案后才能执行（恢复备份等会丢数据的操作） */
  acknowledge?: string;
}

/** confirm-sheet 组件对外的方法 */
export interface ConfirmSheet {
  open(options: SubmitOptions & { title: string; cancelText?: string; onConfirm?: () => Promise<void> }): Promise<boolean>;
}

/** 取得页面上的确认弹窗 */
export function confirmSheet(page: WechatMiniprogram.Page.TrivialInstance): ConfirmSheet {
  const sheet = page.selectComponent("#confirm") as unknown as ConfirmSheet | null;
  if (!sheet) throw new Error("页面缺少 <confirm-sheet id=\"confirm\" />");
  return sheet;
}

/**
 * 提交后台任务：确认影响 → 提交 → 会话层跟踪结果。
 * 返回任务编号；取消或失败返回 undefined。
 */
export async function submit(
  page: WechatMiniprogram.Page.TrivialInstance,
  method: ManagementMethod,
  params: unknown,
  title: string,
  options: SubmitOptions = {},
): Promise<string | undefined> {
  if (!session.editable) {
    wx.showToast({ title: "当前为只读或未连接", icon: "none" });
    return undefined;
  }
  let operationId: string | undefined;
  const confirmed = await confirmSheet(page).open({
    title,
    description: options.description,
    okText: options.okText ?? "执行",
    danger: options.danger,
    acknowledge: options.acknowledge,
    onConfirm: async () => {
      const accepted = (await session.request(method, params)) as { operationId?: string };
      if (accepted.operationId) {
        session.track(accepted.operationId, title);
        void session.refresh();
      }
      operationId = accepted.operationId;
    },
  });
  return confirmed ? operationId : undefined;
}

/**
 * 手动重启服务按钮不可用的原因；可用时返回空字符串（规则同桌面端 RestartServicesButton）。
 * 使用场景：模块、世界包页重启 BDS；配置页保存后重启全部服务（target = "all"）。
 */
export function restartBlockReason(target: "all" | "bds", dirty = false): string {
  const state = session.state;
  if (!session.can("manual-restart")) return "请先更新平台";
  if (dirty) return "请先保存或放弃更改";
  if (!session.editable) return "当前不可操作";
  if (activeTasks(state).length) return "请等待当前任务完成";
  if (!state.services.some((row) => row.running && (target === "all" || row.name === target))) return "没有正在运行的服务";
  return "";
}

/** 手动重启：只重启正在运行的服务，保持已停止的服务关闭；重启全部时同时重载配置 */
export function restartServices(page: WechatMiniprogram.Page.TrivialInstance, target: "all" | "bds", dirty = false): void {
  const reason = restartBlockReason(target, dirty);
  if (reason) {
    wx.showToast({ title: reason, icon: "none" });
    return;
  }
  void submit(page, "services.restart", { name: target, runningOnly: true, ...(target === "all" ? { reloadConfig: true } : {}) }, target === "all" ? "重启服务" : "重启 BDS", {
    okText: "重启",
  });
}

/** 包裹异步操作：失败时弹窗说明原因，返回 undefined */
export async function guard<T>(action: () => Promise<T>, failTitle = "操作失败"): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    wx.showModal({ title: failTitle, content: errorText(error), showCancel: false, confirmText: "知道了" });
    return undefined;
  }
}

/** 简单的二次确认（不涉及后台任务，例如放弃草稿、删除本机实例档案） */
export function ask(title: string, content: string, confirmText = "确定", danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    wx.showModal({
      title,
      content,
      confirmText,
      confirmColor: danger ? "#d92d2d" : undefined,
      success: (result) => resolve(result.confirm),
      fail: () => resolve(false),
    });
  });
}

/** 复制文本并提示 */
export function copy(text: string, label = "已复制"): void {
  wx.setClipboardData({ data: text, success: () => wx.showToast({ title: label, icon: "none" }) });
}
