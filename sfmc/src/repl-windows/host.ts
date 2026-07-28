/**
 * repl-windows/host.ts — 窗口注册与切换（不写业务，只调度 ReplWindow）
 *
 * 每扇窗维护已渲染行缓存：切走清屏，切回直接恢复；后台仍把匹配日志写入对应缓存。
 */
import { wrapLogLine, type UnifiedLog } from "../logs.js";
import type { ServiceName } from "../services.js";
import type { ReplWindow, WindowChrome, WindowKeyEvent, WindowKeyResult } from "./types.js";

export type HostWriteLog = (wrappedLine: string) => void;

export class WindowHost {
  private readonly windows = new Map<string, ReplWindow>();
  /** 窗口 id → 已渲染（已 wrap）的行；切回时直接 dump，无需重拉源 */
  private readonly buffers = new Map<string, string[]>();
  /** 服务窗循环顺序（仅活跃服务） */
  private serviceOrder: string[] = [];
  private activeId: string | null = null;
  private previousId: string | null = null;
  private readonly writeLog: HostWriteLog;
  private readonly onChromeChange: (() => void) | undefined;

  constructor(opts: { writeLog: HostWriteLog; onChromeChange?: () => void }) {
    this.writeLog = opts.writeLog;
    this.onChromeChange = opts.onChromeChange;
  }

  register(win: ReplWindow): void {
    this.windows.set(win.id, win);
  }

  unregister(id: string): void {
    if (this.activeId === id) {
      this.activeId = this.previousId;
      this.previousId = null;
    }
    if (this.previousId === id) this.previousId = null;
    this.windows.delete(id);
    this.buffers.delete(id);
    this.serviceOrder = this.serviceOrder.filter((x) => x !== id);
  }

  has(id: string): boolean {
    return this.windows.has(id);
  }

  getActive(): ReplWindow | undefined {
    return this.activeId ? this.windows.get(this.activeId) : undefined;
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  getChrome(): WindowChrome {
    const w = this.getActive();
    if (!w) {
      return { showsInput: true, footerShortcuts: "", title: "" };
    }
    return {
      showsInput: w.showsInput,
      footerShortcuts: w.footerShortcuts,
      title: w.title,
    };
  }

  /** 是否已有展示缓存（有则切回时勿再 seed） */
  hasBuffer(id: string): boolean {
    return this.buffers.has(id);
  }

  getBuffer(id: string): readonly string[] {
    return this.buffers.get(id) ?? [];
  }

  /** 首次进入时写入种子行 */
  setBuffer(id: string, lines: string[]): void {
    this.buffers.set(id, [...lines]);
  }

  invalidateBuffer(id: string): void {
    this.buffers.delete(id);
  }

  private appendToBuffer(id: string, wrappedLine: string): void {
    let buf = this.buffers.get(id);
    if (!buf) {
      buf = [];
      this.buffers.set(id, buf);
    }
    buf.push(wrappedLine);
  }

  /** 按活跃服务同步 ServiceWindow id 列表（id = svc:<name>） */
  setServiceOrder(ids: string[]): void {
    this.serviceOrder = [...ids];
    const stale = [...this.windows.keys()].filter((id) => id.startsWith("svc:") && !ids.includes(id));
    for (const id of stale) {
      this.windows.delete(id);
      this.buffers.delete(id);
      if (this.activeId === id) this.activeId = null;
      if (this.previousId === id) this.previousId = null;
    }
    if (this.activeId?.startsWith("svc:") && !ids.includes(this.activeId)) {
      this.activeId = null;
    }
    if (!this.activeId && ids.length > 0) {
      this.open(ids[0]!);
    }
  }

  open(id: string): boolean {
    const next = this.windows.get(id);
    if (!next) return false;
    if (this.activeId === id) {
      next.onActivate?.();
      this.onChromeChange?.();
      return true;
    }
    const prev = this.getActive();
    prev?.onDeactivate?.();
    if (this.activeId && this.activeId !== id) {
      this.previousId = this.activeId;
    }
    this.activeId = id;
    next.onActivate?.();
    this.onChromeChange?.();
    return true;
  }

  back(): boolean {
    const fallback =
      (this.previousId && this.windows.has(this.previousId) ? this.previousId : null) ??
      this.serviceOrder.find((id) => this.windows.has(id)) ??
      null;
    this.previousId = null;
    if (!fallback) {
      this.activeId = null;
      this.onChromeChange?.();
      return false;
    }
    return this.open(fallback);
  }

  /**
   * 在服务窗之间循环；返回新激活窗的 serviceName（供同步发送目标）。
   * 若当前在非服务窗，先回到服务环。
   */
  cycleServiceWindows(): ServiceName | null {
    if (this.serviceOrder.length === 0) return null;
    const cur = this.activeId;
    const idx = cur ? this.serviceOrder.indexOf(cur) : -1;
    if (idx < 0) {
      this.open(this.serviceOrder[0]!);
    } else {
      const next = this.serviceOrder[(idx + 1) % this.serviceOrder.length]!;
      this.open(next);
    }
    return this.getActive()?.serviceName ?? null;
  }

  /**
   * 新日志：写入所有已 seed 缓存且 accept 的窗口；仅活动窗刷到 TTY。
   * 活动窗尚未 seed：只刷 TTY（随后 showActiveWindow 会 seed 含历史的缓存）。
   */
  routeLog(log: UnifiedLog): void {
    for (const [id, w] of this.windows) {
      if (!w.acceptLog(log)) continue;
      if (!this.buffers.has(id)) {
        if (id === this.activeId) {
          const { text, indent } = w.formatLogLine(log);
          this.writeLog(wrapLogLine(text, indent));
        }
        continue;
      }
      const { text, indent } = w.formatLogLine(log);
      const wrapped = wrapLogLine(text, indent);
      this.appendToBuffer(id, wrapped);
      if (id === this.activeId) this.writeLog(wrapped);
    }
  }

  /** 返回活动窗对日志的展示结果（含 acceptLog） */
  formatActiveLog(log: UnifiedLog): { text: string; indent: number } | null {
    const w = this.getActive();
    if (!w || !w.acceptLog(log)) return null;
    return w.formatLogLine(log);
  }

  onKey(ev: WindowKeyEvent): WindowKeyResult {
    const w = this.getActive();
    if (!w?.onKey) return { action: "none" };
    const r = w.onKey(ev);
    if (r.action === "back") {
      this.back();
      return { action: "redraw" };
    }
    return r;
  }

  isLogsActive(): boolean {
    return this.activeId === "logs";
  }
}

export function serviceWindowId(name: ServiceName): string {
  return `svc:${name}`;
}
