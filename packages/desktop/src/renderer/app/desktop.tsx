/**
 * desktop.tsx — 实例状态与管理操作的唯一权威来源（DesktopProvider / useDesktop）
 *
 * 使用场景：应用根部提供一次，所有页面、对话框、命令面板通过 useDesktop() 读取当前实例模型并调用操作，
 * 页面不直接访问 window.sfmc 的连接细节（DIP）。连接、刷新、轮询、任务等待等流程沿用原实现的语义，
 * 仅把原先内嵌在 modal.confirm 中的界面拆成独立对话框（通过 flow 状态驱动）。
 */
import type {
  Handshake,
  LogEntryWire,
  ManagementMethod,
  ManagementMethodMap,
  ModuleRow,
  OperationRecord,
  PackRow,
  ServiceStateChanged,
  ServiceStatusRow,
} from "@sfmc-bds/management";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AppInfo, Credentials, InstanceProfile } from "../../shared/api.js";
import { toast, useConfirm } from "../components/feedback.js";
import { errorText, isTaskDone, phaseLabel } from "../lib/format.js";
import type { PageKey } from "./nav.js";
import { useDesktopUpdate, type DesktopUpdateState } from "./desktop-update.js";

/** 单个实例在客户端内的完整视图模型（与原实现字段一致，新增 connecting / connectError 供连接门展示） */
export interface Model {
  handshake?: Handshake;
  services: ServiceStatusRow[];
  logs: LogEntryWire[];
  modules: ModuleRow[];
  packs: PackRow[];
  tasks: OperationRecord[];
  configKeys: string[];
  disconnected?: boolean;
  connectionMessage?: string;
  /** 正在建立连接（连接门按钮的加载态） */
  connecting?: boolean;
  /** 最近一次连接失败的原因（连接门内联展示） */
  connectError?: string;
}
/** 空模型 */
export const blank = (): Model => ({ services: [], logs: [], modules: [], packs: [], tasks: [], configKeys: [] });

/**
 * 需要用户参与的连接流程：SSH 登录，或空目录的第一次初始化。
 * 使用场景：connect() 根据握手结果设置 flow，App 根据 flow 渲染对应对话框。
 * 已有部署连上即可管理，不再单独确认接入。
 */
export type Flow =
  | { kind: "login"; profile: InstanceProfile; reconnect: boolean }
  | { kind: "deploy"; profile: InstanceProfile };

/** 提交后台任务时的确认选项 */
export interface SubmitOptions {
  /** 确认框中的补充说明（替换默认影响说明的首段） */
  description?: ReactNode;
  /** 危险操作：确认按钮为红色 */
  danger?: boolean;
  /** 确认按钮文案（默认"执行"） */
  okText?: string;
  /** 强确认：确认框内显示此文案的复选框，勾选后才能执行（用于恢复备份等会丢弃数据的操作） */
  acknowledge?: string;
}

/** 绑定到当前实例的请求函数类型 */
export type RequestFn = <K extends ManagementMethod>(method: K, params?: unknown) => Promise<ManagementMethodMap[K]>;
/** 提交后台任务函数类型：确认后提交，返回任务编号（取消或失败返回 undefined） */
export type SubmitFn = (method: ManagementMethod, params: unknown, title: string, options?: SubmitOptions) => Promise<string | undefined>;

interface DesktopValue {
  /** 实例列表已从主进程读取完成（避免启动瞬间误显示首启欢迎页） */
  ready: boolean;
  profiles: InstanceProfile[];
  current: string;
  setCurrent: (id: string) => void;
  selected: InstanceProfile | undefined;
  models: Record<string, Model>;
  model: Model;
  page: PageKey;
  setPage: (page: PageKey) => void;
  /** 打开日志控制台并定位到这一条 */
  logFocus: { entry: LogEntryWire; nonce: number } | null;
  openLog: (entry: LogEntryWire) => void;
  clearLogFocus: () => void;
  busy: boolean;
  /** 包裹异步操作：显示全局进度、捕获错误并提示 */
  guarded: <T>(action: () => Promise<T>) => Promise<T | undefined>;
  patch: (id: string, values: Partial<Model>) => void;
  refresh: (id: string) => Promise<void>;
  request: RequestFn;
  submit: SubmitFn;
  /** 是否允许写操作：已连接、目录已初始化、非旧版协议 */
  editable: boolean;
  connect: (profile: InstanceProfile, reconnect?: boolean, secret?: Credentials) => Promise<void>;
  disconnect: (profile: InstanceProfile) => Promise<void>;
  /** 初始化新部署（接受条款 + 端口）：任务受理后回调 onAccepted 供界面展示进度，随后等待任务完成 */
  createDeployment: (profile: InstanceProfile, ports: { dbPort: number; bdsPort: number; bdsPort6: number }, onAccepted?: (operationId: string) => void) => Promise<void>;
  confirmHost: (profile: InstanceProfile) => Promise<void>;
  flow: Flow | null;
  setFlow: (flow: Flow | null) => void;
  profileDialog: ProfileDialogState;
  /** 打开实例设置对话框；preset 用于新建时预选连接方式（欢迎页的两张入口卡片） */
  openProfileDialog: (editing: InstanceProfile | null, preset?: InstanceProfile["kind"]) => void;
  closeProfileDialog: () => void;
  saveProfile: (values: InstanceProfile & Credentials, editing: InstanceProfile | null) => Promise<void>;
  removeProfile: (profile: InstanceProfile) => Promise<void>;
  appInfo: AppInfo | undefined;
  desktopUpdate: DesktopUpdateState;
}

/** 实例设置对话框状态：editing 为空表示新建 */
export interface ProfileDialogState {
  open: boolean;
  editing: InstanceProfile | null;
  preset?: InstanceProfile["kind"];
}

const DesktopContext = createContext<DesktopValue | null>(null);
/** 上次选中实例的本地持久化键 */
const LAST_INSTANCE_KEY = "sfmc.desktop.lastInstance";

/** 打开或切换实例时，本机以及已保存凭据的 SSH 可以直接连，不必再点一次连接。 */
function canAutoConnect(profile: InstanceProfile): boolean {
  if (profile.kind === "local") return true;
  return Boolean(profile.hasCredential || profile.privateKeyPath);
}

/** 读取桌面上下文（必须位于 DesktopProvider 内） */
export function useDesktop(): DesktopValue {
  const value = useContext(DesktopContext);
  if (!value) throw new Error("useDesktop 必须在 DesktopProvider 内使用");
  return value;
}

/** 正在被通知面板跟踪的任务：记录所属实例、标题与上次渲染的进度指纹 */
interface TrackedOperation {
  instanceId: string;
  title: string;
  fingerprint: string;
  /** 用户手动关闭了进度卡片：之后不再弹出进度，但仍会提示最终结果 */
  silenced?: boolean;
}

/** 提交任务确认框中的固定提示（与原实现文案一致） */
const SUBMIT_NOTE = "后台执行期间可能重载或重启受影响服务；任务提交后关闭客户端不会取消执行。";

export function DesktopProvider({ children }: { children: ReactNode }) {
  const confirm = useConfirm();
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState<InstanceProfile[]>([]);
  const [current, setCurrentState] = useState("");
  const [models, setModels] = useState<Record<string, Model>>({});
  const [page, setPageState] = useState<PageKey>("overview");
  const [logFocus, setLogFocus] = useState<{ entry: LogEntryWire; nonce: number } | null>(null);
  const setPage = useCallback((next: PageKey) => {
    if (next !== "logs") setLogFocus(null);
    setPageState(next);
  }, []);
  const openLog = useCallback((entry: LogEntryWire) => {
    setLogFocus({ entry, nonce: Date.now() });
    setPageState("logs");
  }, []);
  const clearLogFocus = useCallback(() => setLogFocus(null), []);
  const [busyCount, setBusyCount] = useState(0);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [profileDialog, setProfileDialog] = useState<ProfileDialogState>({ open: false, editing: null });
  const [appInfo, setAppInfo] = useState<AppInfo>();
  const desktopUpdate = useDesktopUpdate();
  const modelsRef = useRef(models);
  modelsRef.current = models;
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  /** 正在连接的实例，避免打开时的自动连接和手动点击叠在一起 */
  const connectingIds = useRef(new Set<string>());
  const connectRef = useRef<(profile: InstanceProfile, reconnect?: boolean, secret?: Credentials) => Promise<void>>(async () => {});
  const tracked = useRef(new Map<string, TrackedOperation>());
  /** 待合并的实时日志（按实例），每 120ms 批量写入一次，避免高频日志导致整树重渲染 */
  const pendingLogs = useRef(new Map<string, LogEntryWire[]>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const selected = profiles.find((profile) => profile.id === current);
  const model = models[current] ?? blank();
  const setCurrent = useCallback((id: string) => {
    setCurrentState(id);
    setLogFocus(null);
    if (id) localStorage.setItem(LAST_INSTANCE_KEY, id);
    const profile = profilesRef.current.find((row) => row.id === id);
    const currentModel = modelsRef.current[id];
    // 已连上或用户刚断开时不重复连接；断开后 handshake 还在，恢复连接由用户点。
    if (profile && !currentModel?.handshake && !currentModel?.connecting && !connectingIds.current.has(id) && canAutoConnect(profile)) {
      void connectRef.current(profile);
    }
  }, []);

  const patch = useCallback(
    (id: string, values: Partial<Model>) =>
      setModels((previous) => ({ ...previous, [id]: { ...(previous[id] ?? blank()), ...values } })),
    []
  );
  const request = useCallback<RequestFn>(
    (method, params = {}) => window.sfmc.request(current, method, params),
    [current]
  );
  const guarded = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setBusyCount((count) => count + 1);
      try {
        return await action();
      } catch (error) {
        toast.error("操作失败", errorText(error));
        return undefined;
      } finally {
        setBusyCount((count) => count - 1);
      }
    },
    []
  );
  const refresh = useCallback(
    async (id: string, capabilities?: readonly string[]) => {
      // 旧版平台没有模块/配置/世界包入口。不发这些请求，避免每 5 秒都在主进程里记一条失败。
      const caps = new Set(capabilities ?? modelsRef.current[id]?.handshake?.capabilities ?? []);
      const allow = (name: string) => caps.size === 0 || caps.has(name);
      const results = await Promise.allSettled([
        allow("services") ? window.sfmc.request(id, "services.list") : Promise.reject(new Error("skip")),
        allow("operations") ? window.sfmc.request(id, "operations.list") : Promise.reject(new Error("skip")),
        allow("modules") ? window.sfmc.request(id, "modules.list") : Promise.reject(new Error("skip")),
        allow("config") ? window.sfmc.request(id, "config.list") : Promise.reject(new Error("skip")),
        allow("packs") ? window.sfmc.request(id, "packs.list") : Promise.reject(new Error("skip")),
      ]);
      const values: Partial<Model> = {};
      if (results[0]?.status === "fulfilled") values.services = results[0].value.rows;
      if (results[1]?.status === "fulfilled") values.tasks = results[1].value.operations;
      if (results[2]?.status === "fulfilled") values.modules = results[2].value.modules;
      if (results[3]?.status === "fulfilled") values.configKeys = results[3].value.keys;
      if (results[4]?.status === "fulfilled") values.packs = results[4].value.packs;
      patch(id, values);
    },
    [patch]
  );

  // 初始化：读取实例列表与客户端信息，订阅事件推送与连接状态，启动 5 秒轮询
  useEffect(() => {
    void window.sfmc
      .profiles()
      .then((rows) => {
        profilesRef.current = rows;
        setProfiles(rows);
        const last = localStorage.getItem(LAST_INSTANCE_KEY);
        const initial = rows.find((row) => row.id === last) ?? rows[0];
        if (initial) setCurrent(initial.id);
      })
      .finally(() => setReady(true));
    void window.sfmc.appInfo().then(setAppInfo).catch(() => {});
    const flushLogs = () => {
      flushTimer.current = undefined;
      const batch = pendingLogs.current;
      pendingLogs.current = new Map();
      setModels((previous) => {
        const next = { ...previous };
        for (const [id, entries] of batch) {
          const value = next[id] ?? blank();
          next[id] = { ...value, logs: [...value.logs, ...entries].slice(-5000) };
        }
        return next;
      });
    };
    const removeEvent = window.sfmc.onEvent((id, event) => {
      if (event.event === "log") {
        const queue = pendingLogs.current.get(id) ?? [];
        queue.push(event.payload as LogEntryWire);
        pendingLogs.current.set(id, queue);
        flushTimer.current ??= setTimeout(flushLogs, 120);
        return;
      }
      setModels((previous) => {
        const value = { ...(previous[id] ?? blank()) };
        if (event.event === "operation") {
          const operation = event.payload as OperationRecord;
          value.tasks = [operation, ...value.tasks.filter((row) => row.id !== operation.id)].slice(0, 200);
        }
        if (event.event === "serviceState") {
          const state = event.payload as ServiceStateChanged;
          value.services = value.services.map((row) =>
            row.name === state.name ? { ...row, running: state.running, pid: state.pid, ...(state.running ? {} : { uptime: "—" }) } : row
          );
        }
        return { ...previous, [id]: value };
      });
    });
    const removeConnection = window.sfmc.onConnection((id, connectionMessage) =>
      id
        ? patch(id, {
            connectionMessage,
            ...(/断开|结束|关闭/.test(connectionMessage) ? { disconnected: true } : {}),
          })
        : void toast.error(connectionMessage)
    );
    const timer = setInterval(() => {
      for (const [id, value] of Object.entries(modelsRef.current))
        if (value.handshake && !value.disconnected) void refresh(id);
    }, 5000);
    return () => {
      removeEvent();
      removeConnection();
      clearInterval(timer);
      if (flushTimer.current) clearTimeout(flushTimer.current);
    };
  }, [patch, refresh, setCurrent]);

  const waitOperation = useCallback(
    async (id: string, operationId: string) => {
      for (;;) {
        const { operation } = await window.sfmc.request(id, "operations.get", { operationId });
        patch(id, {
          tasks: [operation, ...(modelsRef.current[id]?.tasks ?? []).filter((row) => row.id !== operationId)],
        });
        if (["succeeded", "failed", "interrupted"].includes(operation.status)) {
          if (operation.status !== "succeeded") throw new Error(operation.error?.message ?? "后台任务未完成");
          await refresh(id);
          return operation;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    },
    [patch, refresh]
  );

  /** 开始在通知面板中跟踪一个任务 */
  const track = useCallback((instanceId: string, operationId: string, title: string) => {
    tracked.current.set(operationId, { instanceId, title, fingerprint: "" });
  }, []);

  // 任务通知：每当模型中的任务列表变化（事件推送、轮询或 waitOperation），刷新被跟踪任务的通知卡片
  useEffect(() => {
    for (const [operationId, entry] of tracked.current) {
      const record = models[entry.instanceId]?.tasks.find((row) => row.id === operationId);
      if (!record) continue;
      const lastPhase = record.phases.at(-1);
      const fingerprint = `${record.status}:${record.phases.length}:${lastPhase?.status ?? ""}`;
      if (fingerprint === entry.fingerprint) continue;
      entry.fingerprint = fingerprint;
      const instanceName = profilesRef.current.find((row) => row.id === entry.instanceId)?.name ?? "";
      const done = isTaskDone(record.status);
      const view = {
        label: "查看任务",
        onClick: () => {
          setCurrent(entry.instanceId);
          setPage("tasks");
          toast.close(operationId);
        },
      };
      if (!done) {
        if (entry.silenced) continue;
        toast.show({
          id: operationId,
          tone: "progress",
          title: entry.title,
          meta: instanceName,
          description: lastPhase ? phaseLabel(lastPhase.name) : "等待执行",
          timeout: 0,
          action: view,
          onClose: () => {
            const current = tracked.current.get(operationId);
            if (current) current.silenced = true;
          },
        });
        continue;
      }
      tracked.current.delete(operationId);
      if (record.status === "succeeded") {
        toast.show({ id: operationId, tone: "success", title: `${entry.title} 已完成`, meta: instanceName, timeout: 4500 });
      } else {
        toast.show({
          id: operationId,
          tone: "danger",
          title: `${entry.title} ${record.status === "failed" ? "失败" : "已中断"}`,
          meta: instanceName,
          description: record.error?.message ?? "后台任务未完成",
          timeout: 0,
          action: view,
        });
      }
    }
  }, [models, setCurrent]);

  /**
   * 提交后台任务：确认影响 → 提交 → 通知卡片跟踪进度（不强制跳转任务页）。
   * 提交请求在确认框内执行：失败时错误留在确认框中，用户可重试或取消；取消或失败返回 undefined。
   */
  const submit = useCallback<SubmitFn>(
    async (method, params, title, options = {}) => {
      const instanceId = current;
      let operationId: string | undefined;
      const confirmed = await confirm({
        title,
        description: options.description,
        note: SUBMIT_NOTE,
        okText: options.okText ?? "执行",
        cancelText: "取消",
        danger: options.danger,
        acknowledge: options.acknowledge,
        icon: options.danger ? "warning" : "zap",
        onConfirm: async () => {
          const accepted = (await window.sfmc.request(instanceId, method, params)) as { operationId?: string };
          if (accepted.operationId) {
            track(instanceId, accepted.operationId, title);
            await refresh(instanceId);
          }
          operationId = accepted.operationId;
        },
      });
      return confirmed ? operationId : undefined;
    },
    [current, confirm, refresh, track]
  );

  const connect = useCallback(
    async (profile: InstanceProfile, reconnect = false, secret?: Credentials) => {
      if (connectingIds.current.has(profile.id)) return;
      connectingIds.current.add(profile.id);
      try {
        // 不走 setCurrent：setCurrent 会在尚未握手时再次调用 connect。
        setCurrentState(profile.id);
        setLogFocus(null);
        localStorage.setItem(LAST_INSTANCE_KEY, profile.id);
        // 已配置私钥时直接尝试连接；没有密钥也没有已存凭据时才先弹出登录框。
        if (profile.kind === "ssh" && !profile.hasCredential && !secret && !profile.privateKeyPath) {
          setFlow({ kind: "login", profile, reconnect });
          return;
        }
        patch(profile.id, { connecting: true, connectError: "" });
        await guarded(async () => {
          try {
            const handshake = await window.sfmc.connect(profile.id, secret);
            if (secret) {
              const rows = await window.sfmc.profiles();
              profilesRef.current = rows;
              setProfiles(rows);
            }
            if (handshake.host.arch !== "x64" || !["windows", "linux"].includes(handshake.host.os)) throw new Error("v1 仅支持 Windows／Linux x64 宿主");
            patch(profile.id, { handshake, disconnected: false, connectionMessage: "" });
            await refresh(profile.id, handshake.capabilities);
            const history = await window.sfmc.request(profile.id, "logs.tail", { limit: 1000 });
            patch(profile.id, { logs: history.entries });
            if (!handshake.initialized) setFlow({ kind: "deploy", profile });
          } catch (error) {
            const message = errorText(error);
            patch(profile.id, { connectError: message });
            if (profile.kind === "ssh" && /authentication methods failed|All configured authentication|passphrase|私钥/i.test(message)) {
              setFlow({ kind: "login", profile, reconnect });
            }
            throw error;
          } finally {
            patch(profile.id, { connecting: false });
          }
        });
      } finally {
        connectingIds.current.delete(profile.id);
      }
    },
    [guarded, patch, refresh]
  );
  connectRef.current = connect;

  const disconnect = useCallback(
    async (profile: InstanceProfile) => {
      await guarded(async () => {
        await window.sfmc.disconnect(profile.id);
        patch(profile.id, { disconnected: true, connectionMessage: "已手动断开连接；服务器和后台任务继续运行" });
      });
    },
    [guarded, patch]
  );

  const createDeployment = useCallback(
    async (profile: InstanceProfile, ports: { dbPort: number; bdsPort: number; bdsPort6: number }, onAccepted?: (operationId: string) => void) => {
      const accepted = await window.sfmc.request(profile.id, "deployment.create", { acceptEula: true, ...ports });
      onAccepted?.(accepted.operationId);
      await waitOperation(profile.id, accepted.operationId);
      const handshake = modelsRef.current[profile.id]?.handshake;
      if (handshake) patch(profile.id, { handshake: { ...handshake, initialized: true } });
    },
    [patch, waitOperation]
  );

  const confirmHost = useCallback(
    async (profile: InstanceProfile) => {
      await guarded(async () => {
        if (await window.sfmc.confirmHost(profile.id)) toast.success("已确认新身份", "请重新连接实例");
      });
    },
    [guarded]
  );

  const saveProfile = useCallback(
    async (values: InstanceProfile & Credentials, editing: InstanceProfile | null) => {
      const { password, passphrase, ...valuesWithoutSecrets } = values;
      const rows = await window.sfmc.saveProfile({ ...valuesWithoutSecrets, id: editing?.id ?? "" }, { password, passphrase });
      profilesRef.current = rows;
      setProfiles(rows);
      const row = rows.at(-1)!;
      setCurrent(row.id);
      setProfileDialog({ open: false, editing: null });
    },
    [setCurrent]
  );

  const removeProfile = useCallback(
    async (profile: InstanceProfile) => {
      const rows = await window.sfmc.removeProfile(profile.id);
      profilesRef.current = rows;
      setProfiles(rows);
      setModels((previous) => {
        const next = { ...previous };
        delete next[profile.id];
        return next;
      });
      setProfileDialog({ open: false, editing: null });
      setCurrent(rows[0]?.id ?? "");
    },
    [setCurrent]
  );

  const editable = Boolean(model.handshake && !model.disconnected && !model.handshake.legacy && model.handshake.initialized);
  const value = useMemo<DesktopValue>(
    () => ({
      ready,
      profiles,
      current,
      setCurrent,
      selected,
      models,
      model,
      page,
      setPage,
      logFocus,
      openLog,
      clearLogFocus,
      busy: busyCount > 0,
      guarded,
      patch,
      refresh,
      request,
      submit,
      editable,
      connect,
      disconnect,
      createDeployment,
      confirmHost,
      flow,
      setFlow,
      profileDialog,
      openProfileDialog: (editing, preset) => setProfileDialog({ open: true, editing, ...(preset ? { preset } : {}) }),
      closeProfileDialog: () => setProfileDialog({ open: false, editing: null }),
      saveProfile,
      removeProfile,
      appInfo,
      desktopUpdate,
    }),
    [ready, profiles, current, setCurrent, selected, models, model, page, setPage, logFocus, openLog, clearLogFocus, busyCount, guarded, patch, refresh, request, submit, editable, connect, disconnect, createDeployment, confirmHost, flow, profileDialog, saveProfile, removeProfile, appInfo, desktopUpdate]
  );
  return <DesktopContext.Provider value={value}>{children}</DesktopContext.Provider>;
}

/**
 * 实例连接状态的展示语义（状态点语气 + 文案）。
 * 使用场景：侧边栏实例切换器、标题栏连接胶囊、命令面板的实例列表。
 */
export function connectionState(model: Model | undefined): { tone: "success" | "warning" | "info" | "neutral"; label: string; online: boolean } {
  if (model?.connecting) return { tone: "info", label: "连接中", online: false };
  if (model?.handshake && !model.disconnected) {
    if (model.handshake.legacy) return { tone: "warning", label: "已连接（只读）", online: true };
    if (!model.handshake.initialized) return { tone: "info", label: "待初始化", online: true };
    return { tone: "success", label: "已连接", online: true };
  }
  if (model?.handshake && model.disconnected) return { tone: "warning", label: "连接已断开", online: false };
  return { tone: "neutral", label: "未连接", online: false };
}

/** 当前实例中仍在进行的任务（排队或运行中），用于标题栏任务指示与侧边栏计数 */
export function activeTasks(model: Model): OperationRecord[] {
  return model.tasks.filter((task) => !isTaskDone(task.status));
}
