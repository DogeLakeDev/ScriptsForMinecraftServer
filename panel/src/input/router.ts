/**
 * input/router.ts — 按模式分发的 useInput
 */

import type { Key } from "ink";
import { get, set, switchTab, TABS, confirm as showConfirm, showToast } from "../store.js";
import { services, stopAll, startAll, type ManagedServiceName } from "../services/manager.js";
import { pushLog } from "../log/buffer.js";
import { consumeLastClick, setScrollHandlers } from "./mouse.js";
import { pushHistory, searchHistory } from "./history.js";
import { spawn } from "node:child_process";

type Handler = (input: string, key: Key) => boolean;

const SERVICE_ORDER: ManagedServiceName[] = ["bds", "db", "qq", "llbot"];
function isManagedServiceName(s: string): s is ManagedServiceName {
  return (SERVICE_ORDER as string[]).includes(s);
}
function orderByIndex(i: number): ManagedServiceName | null {
  return SERVICE_ORDER[i] ?? null;
}

/* ============================================================
 *  弹层模式
 * ============================================================ */

const modalHandlers: Handler[] = [
  (input, key) => {
    const m = get().modal;
    if (!m) return false;
    if (m.kind === "confirm") {
      if (input === "y" || input === "Y") {
        const c = m.onConfirm;
        set({ modal: null });
        try {
          c();
        } catch (e) {
          pushLog(`执行失败: ${(e as Error).message}`, "error");
        }
        return true;
      }
      if (input === "n" || input === "N" || key.escape) {
        const c = m.onCancel;
        set({ modal: null });
        c?.();
        return true;
      }
      return true;
    }
    if (m.kind === "help") {
      if (key.escape || input === "?" || input === "q") {
        set({ modal: null });
        return true;
      }
      return true;
    }
    if (m.kind === "logFilter") {
      if (key.escape) {
        set({ modal: null });
        return true;
      }
      if (input === " ") {
        const order = ["error", "warning", "success", "info", "debug"] as const;
        const cur = m.selected[0] ?? "info";
        const next = order[(order.indexOf(cur as (typeof order)[number]) + 1) % order.length] ?? "info";
        set({ modal: { kind: "logFilter", selected: [next] } });
        return true;
      }
      if (key.return) {
        const sel = m.selected.length === 5 ? ("all" as const) : m.selected;
        set({ logFilter: sel, modal: null });
        return true;
      }
      return true;
    }
    if (m.kind === "historySearch") {
      if (key.escape) {
        set({ modal: null });
        return true;
      }
      if (key.return && m.matches[m.index]) {
        const picked = m.matches[m.index];
        if (picked) set({ inputValue: picked, inputCursor: picked.length, modal: null });
        return true;
      }
      if (key.upArrow && m.matches.length > 0) {
        set({ modal: { ...m, index: (m.index + 1) % m.matches.length } });
        return true;
      }
      if (key.downArrow && m.matches.length > 0) {
        set({ modal: { ...m, index: (m.index - 1 + m.matches.length) % m.matches.length } });
        return true;
      }
      if (key.backspace) {
        const q = m.query.slice(0, -1);
        const matches = searchHistory(q);
        set({ modal: { kind: "historySearch", query: q, matches, index: 0 } });
        return true;
      }
      if (input && !key.ctrl && !key.meta) {
        const q = m.query + input;
        const matches = searchHistory(q);
        set({ modal: { kind: "historySearch", query: q, matches, index: 0 } });
        return true;
      }
      return true;
    }
    return false;
  },
];

/* ============================================================
 *  输入模式（编辑输入框）
 * ============================================================ */

const inputHandlers: Handler[] = [
  // Enter 提交
  (_input, key) => {
    if (!get().editing) return false;
    if (key.return) {
      const cmd = get().inputValue.trim();
      set({ editing: false, inputValue: "", inputCursor: 0, historyCursor: undefined });
      if (cmd) {
        pushHistory(cmd);
        runCommand(cmd);
      }
      return true;
    }
    return false;
  },
  // Esc 退出编辑
  (_input, key) => {
    if (!get().editing) return false;
    if (key.escape) {
      set({ editing: false, inputValue: "", inputCursor: 0, historyCursor: undefined });
      return true;
    }
    return false;
  },
  // Ctrl+R 进入历史搜索
  (input, key) => {
    if (!get().editing) return false;
    if (key.ctrl && input === "r") {
      const matches = searchHistory("");
      set({ modal: { kind: "historySearch", query: "", matches, index: 0 } });
      return true;
    }
    return false;
  },
  // ↑↓ 翻历史
  (_input, key) => {
    if (!get().editing) return false;
    const s = get();
    if (key.upArrow) {
      const cur = s.historyCursor ?? s.history.length;
      const next = Math.max(0, cur - 1);
      const line = s.history[next] ?? "";
      set({ historyCursor: next, inputValue: line, inputCursor: line.length });
      return true;
    }
    if (key.downArrow) {
      const cur = s.historyCursor ?? s.history.length;
      const next = Math.min(s.history.length, cur + 1);
      const line = s.history[next] ?? "";
      set({ historyCursor: next, inputValue: line, inputCursor: line.length });
      return true;
    }
    return false;
  },
  // 行内编辑
  (input, key) => {
    if (!get().editing) return false;
    if (key.leftArrow) {
      set((s) => ({ inputCursor: Math.max(0, s.inputCursor - 1) }));
      return true;
    }
    if (key.rightArrow) {
      set((s) => ({ inputCursor: Math.min(s.inputValue.length, s.inputCursor + 1) }));
      return true;
    }
    if (key.ctrl && input === "a") {
      set({ inputCursor: 0 });
      return true;
    }
    if (key.ctrl && input === "e") {
      set((s) => ({ inputCursor: s.inputValue.length }));
      return true;
    }
    if (key.ctrl && input === "u") {
      set({ inputValue: "", inputCursor: 0 });
      return true;
    }
    if (key.ctrl && input === "w") {
      set((s) => {
        const left = s.inputValue.slice(0, s.inputCursor);
        const m = left.match(/(^|\s)(\S*)$/);
        const cutAt = m ? left.length - (m[2]?.length ?? 0) : 0;
        return {
          inputValue: s.inputValue.slice(0, cutAt) + s.inputValue.slice(s.inputCursor),
          inputCursor: cutAt,
        };
      });
      return true;
    }
    if (key.backspace) {
      set((s) => {
        if (s.inputCursor <= 0) return {};
        return {
          inputValue: s.inputValue.slice(0, s.inputCursor - 1) + s.inputValue.slice(s.inputCursor),
          inputCursor: s.inputCursor - 1,
        };
      });
      return true;
    }
    if (input && !key.ctrl && !key.meta && input.length === 1) {
      set((s) => ({
        inputValue: s.inputValue.slice(0, s.inputCursor) + input + s.inputValue.slice(s.inputCursor),
        inputCursor: s.inputCursor + 1,
      }));
      return true;
    }
    return true;
  },
];

/* ============================================================
 *  普通模式
 * ============================================================ */

const normalHandlers: Handler[] = [
  // q / Ctrl+C 退出
  (input, key) => {
    if (key.ctrl && input === "c") {
      pushLog("正在停止所有服务...", "info");
      void stopAll().finally(() => process.exit(0));
      return true;
    }
    if (input === "q") {
      showConfirm({
        title: "退出面板",
        body: ["将停止所有服务，确定退出？"],
        onConfirm: () => {
          pushLog("正在停止所有服务...", "info");
          void stopAll().finally(() => process.exit(0));
        },
      });
      return true;
    }
    return false;
  },
  // ? 帮助
  (input) => {
    if (input === "?") {
      set({ modal: { kind: "help" } });
      return true;
    }
    return false;
  },
  // : 进入命令模式
  (input) => {
    if (input === ":") {
      set({ editing: true, inputValue: "", inputCursor: 0, historyCursor: undefined });
      return true;
    }
    return false;
  },
  // L 日志等级过滤
  (input) => {
    if (input === "L") {
      set({ modal: { kind: "logFilter", selected: ["info"] } });
      return true;
    }
    return false;
  },
  // c 复制日志
  (input) => {
    if (input === "c") {
      const text = get()
        .logs.map((l) => l.text)
        .join("\n");
      const proc = spawn("clip", { shell: true });
      proc.stdin.write(text);
      proc.stdin.end();
      showToast("日志已复制到剪贴板", "success");
      return true;
    }
    return false;
  },
  // Tab 切 Tab
  (_input, key) => {
    if (key.tab) {
      const cur = get().tab;
      const idx = TABS.indexOf(cur);
      const dir = key.shift ? -1 : 1;
      const next = TABS[(idx + dir + TABS.length) % TABS.length];
      if (next) switchTab(next);
      return true;
    }
    return false;
  },
  // 服务控制：s / x / r
  (input) => {
    const s = get();
    if (s.tab !== "dashboard" && s.tab !== "services") return false;
    const candidate: string | null = s.serviceDetail ?? orderByIndex(s.selectedLeft) ?? null;
    if (!candidate || !isManagedServiceName(candidate)) return false;
    const target: ManagedServiceName = candidate;
    const svc = services[target];
    if (input === "s") {
      pushLog(`启动 ${target} ...`, "info");
      void svc.start();
      return true;
    }
    if (input === "x") {
      showConfirm({
        title: `停止 ${target}`,
        body: [`${svc.title} 将停止`, "确定继续？"],
        onConfirm: () => svc.stop(),
      });
      return true;
    }
    if (input === "r") {
      showConfirm({
        title: `重启 ${target}`,
        body: [`${svc.title} 将重启`, "确定继续？"],
        onConfirm: () => svc.restart(),
      });
      return true;
    }
    return false;
  },
];

/* ============================================================
 *  命令执行（: 进入后的提交）
 * ============================================================ */

function runCommand(raw: string): void {
  const cmd = raw.trim().toLowerCase();
  if (!cmd) return;
  const parts = cmd.split(/\s+/);
  const head = parts[0];

  if (head === "start" || head === "stop" || head === "restart" || head === "status") {
    const target = parts[1];
    if (target && isManagedServiceName(target)) {
      const svc = services[target];
      if (head === "start") void svc.start();
      if (head === "stop") void svc.stop();
      if (head === "restart") void svc.restart();
      if (head === "status") showToast(`${svc.title}: ${svc.running ? "运行中" : "已停止"}`, "info");
      return;
    }
    if (head === "start") void startAll();
    if (head === "stop") void stopAll();
    return;
  }

  if (cmd === "clear" || cmd === "cls") {
    set({ logs: [] });
    return;
  }

  if (cmd === "home") {
    switchTab("dashboard");
    return;
  }

  if (cmd.startsWith("tab ")) {
    const name = parts[1];
    if (name && (TABS as readonly string[]).includes(name)) switchTab(name as (typeof TABS)[number]);
    return;
  }

  const s = get();
  const target = s.serviceDetail;
  if (target && isManagedServiceName(target) && services[target]?.running) {
    services[target].send(raw);
    return;
  }

  showToast(`未知命令: ${head}`, "warning");
}

export function dispatch(input: string, key: Key): void {
  for (const h of modalHandlers) if (h(input, key)) return;
  for (const h of inputHandlers) if (h(input, key)) return;
  for (const h of normalHandlers) if (h(input, key)) return;
  consumeLastClick();
}

export function setupScrollHandlers(): void {
  setScrollHandlers(
    () => set((s) => ({ logScroll: s.logScroll + 3 })),
    () => set((s) => ({ logScroll: Math.max(0, s.logScroll - 3) })),
  );
}
