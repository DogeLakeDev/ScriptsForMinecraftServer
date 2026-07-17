/**
 * store.ts — 统一状态层（zustand-lite）
 */

import { useSyncExternalStore } from "react";
import type { Level } from "./theme.js";

export type ServiceName = "bds" | "db" | "qq" | "llbot" | "panel";

export type ServiceStatus = {
  name: ServiceName;
  title: string;
  running: boolean;
  pid: number;
  cpu: number;
  memMb: number | null;
};

export type MonitorSnapshot = {
  systemMemPct: number;
  systemMemUsedMb: number;
  systemMemTotalMb: number;
  systemCpu: number;
  tps: number;
  entitiesTotal: number;
  totalChunks: number;
  players: Array<{ name: string; dimension: string; chunkEstimate: number; clientEntities: number }>;
  summaryAt: number;
  tick: number;
};

export type ModuleInfo = {
  id: string;
  type?: string;
  display_name?: string;
  description?: string;
  enabled: boolean;
  can_disable: boolean;
  requires?: string[];
  optional?: string[];
  commands?: string[];
  entry?: { path?: string };
};

export type ConfigFile = {
  id: string;
  path: string;
  label: string;
  data: Record<string, unknown>;
};

export type LogEntry = {
  id: number;
  time: number;
  level: Level;
  source?: string;
  text: string;
};

export type Tab = "dashboard" | "services" | "monitor" | "modules" | "configs";
export const TABS: Tab[] = ["dashboard", "services", "monitor", "modules", "configs"];
export const TAB_LABEL: Record<Tab, string> = {
  dashboard: "总览",
  services: "服务",
  monitor: "监控",
  modules: "模块",
  configs: "配置",
};

export type ModalState =
  | { kind: "confirm"; title: string; body: string[]; destructive: boolean; onConfirm: () => void; onCancel?: () => void }
  | { kind: "help" }
  | { kind: "logFilter"; selected: Level[] }
  | { kind: "historySearch"; query: string; matches: string[]; index: number };

export type ToastKind = "info" | "success" | "warning" | "error";

export type State = {
  tab: Tab;
  focus: "left" | "right";
  selectedLeft: number;
  selectedRight: number;
  services: Record<ServiceName, ServiceStatus>;
  monitor: MonitorSnapshot;
  modules: ModuleInfo[];
  modulesLoading: boolean;
  modulesError: string | null;
  configs: ConfigFile[];
  configsLoading: boolean;
  configsError: string | null;
  logs: LogEntry[];
  logFilter: Level[] | "all";
  logScroll: number;
  toast: { kind: ToastKind; msg: string } | null;
  modal: ModalState | null;
  serviceDetail: string | null;
  moduleDetail: ModuleInfo | null;
  configFocusKey: string | null;
  editing: boolean;
  inputValue: string;
  inputCursor: number;
  history: string[];
  historyCursor: number | undefined;
};

const empty: ServiceStatus = {
  name: "bds",
  title: "",
  running: false,
  pid: 0,
  cpu: 0,
  memMb: null,
};

const initial: State = {
  tab: "dashboard",
  focus: "left",
  selectedLeft: 0,
  selectedRight: 0,
  services: {
    bds: { ...empty, name: "bds", title: "BDS" },
    db: { ...empty, name: "db", title: "DB Server" },
    qq: { ...empty, name: "qq", title: "QQ Bridge" },
    llbot: { ...empty, name: "llbot", title: "LLBot" },
    panel: { ...empty, name: "panel", title: "Panel" },
  },
  monitor: {
    systemMemPct: 0,
    systemMemUsedMb: 0,
    systemMemTotalMb: 0,
    systemCpu: 0,
    tps: 0,
    entitiesTotal: 0,
    totalChunks: 0,
    players: [],
    summaryAt: 0,
    tick: 0,
  },
  modules: [],
  modulesLoading: false,
  modulesError: null,
  configs: [],
  configsLoading: false,
  configsError: null,
  logs: [],
  logFilter: "all",
  logScroll: 0,
  toast: null,
  modal: null,
  serviceDetail: null,
  moduleDetail: null,
  configFocusKey: null,
  editing: false,
  inputValue: "",
  inputCursor: 0,
  history: [],
  historyCursor: undefined,
};

let _state: State = initial;
const _subs = new Set<() => void>();
let _seq = 0;

export const get = (): State => _state;

export const set = (patch: Partial<State> | ((s: State) => Partial<State>)): void => {
  const next = typeof patch === "function" ? patch(_state) : patch;
  _state = { ..._state, ...next };
  _seq++;
  for (const fn of _subs) fn();
};

export const subscribe = (fn: () => void): (() => void) => {
  _subs.add(fn);
  return () => {
    _subs.delete(fn);
  };
};

export const useStore = <T>(selector: (s: State) => T): T =>
  useSyncExternalStore(
    subscribe,
    () => selector(_state),
    () => selector(initial),
  );

export const showToast = (msg: string, kind: ToastKind = "info", durationMs = 2500): void => {
  set({ toast: { msg, kind } });
  setTimeout(() => {
    if (_state.toast?.msg === msg) set({ toast: null });
  }, durationMs);
};

export const confirm = (opts: { title: string; body: string[]; destructive?: boolean; onConfirm: () => void; onCancel?: () => void }): void => {
  const m: ModalState = {
    kind: "confirm",
    title: opts.title,
    body: opts.body,
    destructive: opts.destructive ?? /停止|删除|退出|重启|禁用/.test(opts.title),
    onConfirm: opts.onConfirm,
  };
  if (opts.onCancel) m.onCancel = opts.onCancel;
  set({ modal: m });
};

export const switchTab = (tab: Tab): void => {
  set({ tab, focus: "left", selectedLeft: 0, selectedRight: 0, serviceDetail: null, moduleDetail: null });
};

export const _reset = (): void => {
  _state = initial;
  _subs.clear();
  _seq = 0;
};

export const _seqTick = (): number => _seq;
