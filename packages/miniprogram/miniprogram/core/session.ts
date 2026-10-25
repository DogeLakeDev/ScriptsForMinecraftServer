/**
 * session.ts — 当前实例的状态与管理操作的唯一权威来源（对应桌面端 DesktopProvider）
 *
 * 使用场景：app.ts 启动时 restore；各页面通过 watchSession（core/page.ts）订阅所需的状态片段，
 * 通过 session.request / submit（core/actions.ts）发起请求，页面不直接接触 WebSocket（DIP）。
 * 连接顺序、5 秒轮询、任务跟踪与桌面端一致；小程序一次只连接一个实例，切换实例时断开旧连接。
 */
import { GatewayClient } from "./client";
import { errorText, isTaskDone, taskLabel } from "./format";
import { findProfile, lastProfileId, setLastProfile, socketUrl } from "./profiles";
import type {
  Handshake,
  InstanceProfile,
  LogEntryWire,
  ManagementEvent,
  ManagementMethod,
  ManagementMethodMap,
  ModuleRow,
  OperationRecord,
  PackRow,
  ServiceStateChanged,
  ServiceStatusRow,
} from "./types";

/** 连接状态：idle=未选择或未连接；connecting=连接中；online=已握手；offline=曾连接后断开或连接失败 */
export type ConnectionStatus = "idle" | "connecting" | "online" | "offline";

/** 当前实例的视图模型（字段与桌面端 Model 对齐） */
export interface SessionState {
  profile: InstanceProfile | null;
  status: ConnectionStatus;
  /** 连接失败或断开的原因 */
  message: string;
  handshake: Handshake | null;
  services: ServiceStatusRow[];
  logs: LogEntryWire[];
  modules: ModuleRow[];
  packs: PackRow[];
  tasks: OperationRecord[];
  configKeys: string[];
}

/** 状态片段名称：页面按片段订阅，避免无关更新触发 setData */
export type Slice = "connection" | "services" | "logs" | "modules" | "packs" | "tasks" | "config";

/** 订阅回调：changed 为本次变化的片段集合 */
export type SessionListener = (state: SessionState, changed: ReadonlySet<Slice>) => void;

/** 小程序内存有限，实时日志只保留最近这么多条（桌面端为 5000） */
export const LOG_KEEP = 2000;
/** 首次连接拉取的历史日志条数（与桌面端一致） */
const LOG_HISTORY = 1000;
/** 后台轮询间隔（与桌面端一致） */
const POLL_MS = 5000;
/** 实时日志合并写入的间隔，避免高频日志导致页面频繁 setData */
const LOG_FLUSH_MS = 200;
/** 本机保留的任务记录上限（与桌面端一致） */
const TASK_KEEP = 200;

/** 正在跟踪的任务：提交后完成时弹出结果提示 */
interface Tracked {
  title: string;
}

class Session {
  readonly state: SessionState = {
    profile: null,
    status: "idle",
    message: "",
    handshake: null,
    services: [],
    logs: [],
    modules: [],
    packs: [],
    tasks: [],
    configKeys: [],
  };
  private client: GatewayClient | null = null;
  private listeners = new Set<SessionListener>();
  private pollTimer: number | null = null;
  private flushTimer: number | null = null;
  private pendingLogs: LogEntryWire[] = [];
  private tracked = new Map<string, Tracked>();
  /** 连接代次：切换实例或重连后，旧连接迟到的结果一律丢弃 */
  private generation = 0;
  /** 用户主动断开后不自动重连 */
  private manual = false;
  /** 小程序处于后台 */
  private hidden = false;

  /** 是否允许写操作：已连接、非旧版协议、目录已初始化（与桌面端 editable 一致） */
  get editable(): boolean {
    const handshake = this.state.handshake;
    return Boolean(handshake && this.state.status === "online" && !handshake.legacy && handshake.initialized);
  }

  /** 握手声明的能力 */
  can(capability: string): boolean {
    return Boolean(this.state.handshake?.capabilities.includes(capability as never));
  }

  /** 订阅状态变化，返回取消函数 */
  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 启动时恢复上次的实例并自动连接 */
  restore(): void {
    const profile = findProfile(lastProfileId());
    if (profile) void this.connect(profile);
  }

  /** 回到前台：恢复轮询；连接在后台被系统断开且不是用户主动断开时自动重连 */
  resume(): void {
    this.hidden = false;
    const { profile, status } = this.state;
    if (!profile) return;
    if (status === "offline" && !this.manual) void this.connect(profile);
    else if (status === "online") {
      this.startPolling();
      void this.refresh();
    }
  }

  /** 进入后台：停止轮询，连接保留（由系统决定是否回收） */
  pause(): void {
    this.hidden = true;
    this.stopPolling();
  }

  /**
   * 连接实例：握手 → 订阅事件 → 刷新列表 → 拉取最近日志。
   * 失败时状态为 offline 并带上原因，不抛出。
   */
  async connect(profile: InstanceProfile): Promise<void> {
    this.teardown();
    const generation = ++this.generation;
    this.manual = false;
    setLastProfile(profile.id);
    const sameInstance = this.state.profile?.id === profile.id;
    Object.assign(this.state, {
      profile,
      status: "connecting" as ConnectionStatus,
      message: "",
      ...(sameInstance ? {} : { handshake: null, services: [], logs: [], modules: [], packs: [], tasks: [], configKeys: [] }),
    });
    this.emit(["connection", "services", "logs", "modules", "packs", "tasks", "config"]);
    const client = new GatewayClient(socketUrl(profile.endpoint), profile.token);
    this.client = client;
    client.onEvent = (event) => {
      if (generation === this.generation) this.onEvent(event);
    };
    client.onClose = (reason) => {
      if (generation !== this.generation) return;
      this.client = null;
      this.stopPolling();
      this.state.status = "offline";
      this.state.message = reason;
      this.emit(["connection"]);
    };
    try {
      await client.open();
      const handshake = await client.call("handshake", {});
      if (generation !== this.generation) return;
      await client.call("events.subscribe", {});
      this.state.handshake = handshake;
      this.state.status = "online";
      this.emit(["connection"]);
      await this.refresh();
      const history = await client.call("logs.tail", { limit: LOG_HISTORY });
      if (generation !== this.generation) return;
      // 拉取历史期间到达的实时日志接在历史后面，避免丢失或重复。
      const latest = history.entries[history.entries.length - 1]?.time ?? "";
      const live = this.state.logs.filter((entry) => entry.time > latest);
      this.state.logs = [...history.entries, ...live].slice(-LOG_KEEP);
      this.emit(["logs"]);
      if (!this.hidden) this.startPolling();
    } catch (error) {
      if (generation !== this.generation) return;
      client.close();
      this.client = null;
      this.state.status = "offline";
      this.state.message = errorText(error);
      this.emit(["connection"]);
    }
  }

  /** 用新的状态重连当前实例（例如编辑了令牌） */
  reconnect(): Promise<void> {
    return this.state.profile ? this.connect(this.state.profile) : Promise.resolve();
  }

  /** 主动断开：服务器与后台任务继续运行 */
  disconnect(): void {
    this.teardown();
    this.generation++;
    this.manual = true;
    if (this.state.status !== "idle") {
      this.state.status = "offline";
      this.state.message = "已手动断开连接；服务器和后台任务继续运行";
      this.emit(["connection"]);
    }
  }

  /** 忘记当前实例（实例被删除时） */
  forget(): void {
    this.disconnect();
    setLastProfile("");
    Object.assign(this.state, { profile: null, status: "idle", message: "", handshake: null, services: [], logs: [], modules: [], packs: [], tasks: [], configKeys: [] });
    this.emit(["connection", "services", "logs", "modules", "packs", "tasks", "config"]);
  }

  /** 向当前实例发送请求；未连接时抛出 */
  request<K extends ManagementMethod>(method: K, params: unknown = {}, timeout?: number): Promise<ManagementMethodMap[K]> {
    if (!this.client || this.state.status !== "online") return Promise.reject(new Error("实例未连接"));
    return this.client.call(method, params, timeout);
  }

  /** 刷新服务、任务、模块、配置、世界包列表；按能力跳过旧平台没有的接口（与桌面端 refresh 一致） */
  async refresh(): Promise<void> {
    const generation = this.generation;
    const caps = new Set(this.state.handshake?.capabilities ?? []);
    const allow = (name: string) => caps.size === 0 || caps.has(name as never);
    const skip = Promise.reject(new Error("skip"));
    skip.catch(() => {});
    const results = await Promise.allSettled([
      allow("services") ? this.request("services.list") : skip,
      allow("operations") ? this.request("operations.list") : skip,
      allow("modules") ? this.request("modules.list") : skip,
      allow("config") ? this.request("config.list") : skip,
      allow("packs") ? this.request("packs.list") : skip,
    ]);
    if (generation !== this.generation) return;
    const changed: Slice[] = [];
    if (results[0].status === "fulfilled") {
      this.state.services = results[0].value.rows;
      changed.push("services");
    }
    if (results[1].status === "fulfilled") {
      this.state.tasks = results[1].value.operations;
      changed.push("tasks");
      this.checkTracked();
    }
    if (results[2].status === "fulfilled") {
      this.state.modules = results[2].value.modules;
      changed.push("modules");
    }
    if (results[3].status === "fulfilled") {
      this.state.configKeys = results[3].value.keys;
      changed.push("config");
    }
    if (results[4].status === "fulfilled") {
      this.state.packs = results[4].value.packs;
      changed.push("packs");
    }
    if (changed.length) this.emit(changed);
  }

  /** 跟踪一个已提交的任务：完成时提示结果 */
  track(operationId: string, title: string): void {
    this.tracked.set(operationId, { title });
  }

  /** 收到事件推送 */
  private onEvent(event: ManagementEvent): void {
    if (event.event === "log") {
      this.pendingLogs.push(event.payload as LogEntryWire);
      this.flushTimer ??= setTimeout(() => this.flushLogs(), LOG_FLUSH_MS) as unknown as number;
      return;
    }
    if (event.event === "operation") {
      const operation = event.payload as OperationRecord;
      this.state.tasks = [operation, ...this.state.tasks.filter((row) => row.id !== operation.id)].slice(0, TASK_KEEP);
      this.emit(["tasks"]);
      this.checkTracked();
      return;
    }
    if (event.event === "serviceState") {
      const changed = event.payload as ServiceStateChanged;
      this.state.services = this.state.services.map((row) =>
        row.name === changed.name ? { ...row, running: changed.running, pid: changed.pid, ...(changed.running ? {} : { uptime: "—" }) } : row,
      );
      this.emit(["services"]);
    }
  }

  /** 把累积的实时日志一次写入 */
  private flushLogs(): void {
    this.flushTimer = null;
    if (!this.pendingLogs.length) return;
    this.state.logs = [...this.state.logs, ...this.pendingLogs].slice(-LOG_KEEP);
    this.pendingLogs = [];
    this.emit(["logs"]);
  }

  /** 被跟踪的任务进入终态时提示结果（成功轻提示；失败弹窗说明原因） */
  private checkTracked(): void {
    for (const [operationId, entry] of this.tracked) {
      const record = this.state.tasks.find((row) => row.id === operationId);
      if (!record || !isTaskDone(record.status)) continue;
      this.tracked.delete(operationId);
      if (record.status === "succeeded") {
        wx.showToast({ title: `${entry.title} 已完成`, icon: "success" });
        void this.refresh();
      } else {
        wx.showModal({
          title: `${entry.title || taskLabel(record)} ${record.status === "failed" ? "失败" : "已中断"}`,
          content: record.error?.message ?? "后台任务未完成",
          showCancel: false,
          confirmText: "知道了",
        });
      }
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      if (this.state.status === "online") void this.refresh();
    }, POLL_MS) as unknown as number;
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  /** 关闭当前连接与计时器（不改状态） */
  private teardown(): void {
    this.stopPolling();
    if (this.flushTimer !== null) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.pendingLogs = [];
    const client = this.client;
    this.client = null;
    client?.close();
  }

  private emit(slices: Slice[]): void {
    const changed = new Set(slices);
    for (const listener of this.listeners) listener(this.state, changed);
  }
}

/** 全局唯一的会话实例 */
export const session = new Session();

/** 当前实例中仍在进行的任务（排队或运行中），用于标签栏角标与总览 */
export function activeTasks(state: SessionState): OperationRecord[] {
  return state.tasks.filter((task) => !isTaskDone(task.status));
}

/** 连接状态的展示语义（状态点语气 + 文案），与桌面端 connectionState 对齐 */
export function connectionLabel(state: SessionState): { tone: "success" | "warning" | "info" | "neutral"; label: string } {
  if (state.status === "connecting") return { tone: "info", label: "连接中" };
  if (state.status === "online" && state.handshake) {
    if (state.handshake.legacy) return { tone: "warning", label: "已连接（只读）" };
    if (!state.handshake.initialized) return { tone: "info", label: "待初始化" };
    return { tone: "success", label: "已连接" };
  }
  if (state.status === "offline") return { tone: "warning", label: "连接已断开" };
  return { tone: "neutral", label: "未连接" };
}
