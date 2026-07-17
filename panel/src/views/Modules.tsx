/**
 * views/Modules.tsx — 模块 Tab
 */

import { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import { getJson, postJson, ApiError } from "../api/client.js";
import { useStore, set, showToast, confirm as showConfirm, type ModuleInfo } from "../store.js";
import { T } from "../theme.js";
import { SectionTitle, StatusLine } from "../ui/common.js";

const ERROR_LABEL: Record<string, (d: { unmet?: Array<{ id: string }> }) => string> = {
  dependency_unmet: (d) => `缺少依赖: ${(d.unmet ?? []).map((u) => u.id).join(", ")}`,
  module_cannot_disable: () => "该模块不可禁用",
};

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    const fn = ERROR_LABEL[err.code];
    if (fn) return fn((err.detail as { unmet?: Array<{ id: string }> }) ?? {});
    return err.code;
  }
  return (err as Error).message ?? "操作失败";
}

const FILTER_ORDER = ["all", "enabled", "disabled"] as const;
type Filter = (typeof FILTER_ORDER)[number];

function nextFilter(f: Filter): Filter {
  const idx = FILTER_ORDER.indexOf(f);
  const next = FILTER_ORDER[(idx + 1) % FILTER_ORDER.length];
  return next ?? "all";
}

export function Modules({ leftWidth, rightWidth }: { leftWidth: number; rightWidth: number }) {
  const modules = useStore((s) => s.modules);
  const loading = useStore((s) => s.modulesLoading);
  const error = useStore((s) => s.modulesError);
  const selectedLeft = useStore((s) => s.selectedLeft);

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDeps, setShowDeps] = useState(false);

  const moduleMap = useMemo(() => new Map(modules.map((m) => [m.id, m])), [modules]);

  const filtered = useMemo(() => {
    return modules.filter((m) => {
      if (filter === "enabled" && !m.enabled) return false;
      if (filter === "disabled" && m.enabled) return false;
      if (!query) return true;
      const needle = query.toLowerCase();
      return `${m.id} ${m.display_name ?? ""} ${m.description ?? ""}`.toLowerCase().includes(needle);
    });
  }, [modules, filter, query]);

  useEffect(() => {
    set({ modulesLoading: true, modulesError: null });
    getJson<{ modules: ModuleInfo[] }>("/api/sfmc/modules")
      .then((d) => set({ modules: d.modules ?? [], modulesLoading: false }))
      .catch((e) => set({ modulesError: describeError(e), modulesLoading: false }));
  }, [set]);

  const focus = Math.min(selectedLeft, Math.max(0, filtered.length - 1));
  const selected = filtered[focus] ?? null;
  const missing: string[] = useMemo(() => {
    if (!selected) return [];
    return (selected.requires ?? []).filter((dep) => {
      const m = moduleMap.get(dep);
      return !m || !m.enabled;
    });
  }, [selected, moduleMap]);

  function doToggle(action: "enable" | "disable") {
    if (!selected) return;
    setBusy(true);
    postJson<{ module?: ModuleInfo }>(`/api/sfmc/modules/${encodeURIComponent(selected.id)}/${action}`)
      .then((d) => {
        if (d.module) {
          const next = d.module;
          set((s) => ({ modules: s.modules.map((m) => (m.id === next.id ? next : m)) }));
        }
        showToast(`${selected.display_name ?? selected.id}: ${action === "enable" ? "已启用" : "已禁用"}`, "success");
      })
      .catch((e) => showToast(`${selected.display_name ?? selected.id}: ${describeError(e)}`, "error"))
      .finally(() => setBusy(false));
  }

  useInput(
    (input, key) => {
      if (loading || busy) return;
      if (searching) {
        if (key.escape || key.return) {
          setSearching(false);
          return;
        }
        if (key.backspace) {
          setQuery((q) => q.slice(0, -1));
          return;
        }
        if (input && !key.ctrl && !key.meta) setQuery((q) => q + input);
        return;
      }
      if (key.upArrow) {
        set({ selectedLeft: focus <= 0 ? filtered.length - 1 : focus - 1 });
        return;
      }
      if (key.downArrow) {
        set({ selectedLeft: focus >= filtered.length - 1 ? 0 : focus + 1 });
        return;
      }
      if (input === "/") {
        setSearching(true);
        return;
      }
      if (input === "f") {
        setFilter(nextFilter);
        set({ selectedLeft: 0 });
        return;
      }
      if (input === "r") {
        set({ modulesLoading: true, modulesError: null });
        getJson<{ modules: ModuleInfo[] }>("/api/sfmc/modules")
          .then((d) => set({ modules: d.modules ?? [], modulesLoading: false }))
          .catch((e) => set({ modulesError: describeError(e), modulesLoading: false }));
        return;
      }
      if (input === "d") {
        setShowDeps((v) => !v);
        return;
      }
      if (input === "e" || key.return) {
        if (!selected) return;
        if (selected.enabled) {
          if (!selected.can_disable) {
            showToast("该模块不可禁用", "warning");
            return;
          }
          showConfirm({
            title: "禁用模块",
            body: [`${selected.display_name ?? selected.id} 将被禁用`, "确定继续？"],
            onConfirm: () => doToggle("disable"),
          });
        } else {
          if (missing.length > 0) {
            showToast(`未满足依赖: ${missing.join(", ")}`, "warning");
            return;
          }
          showConfirm({
            title: "启用模块",
            body: [`${selected.display_name ?? selected.id} 将被启用`, "确定继续？"],
            onConfirm: () => doToggle("enable"),
          });
        }
      }
    },
    { isActive: true },
  );

  if (loading) {
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box width={leftWidth} backgroundColor={T.panel} paddingX={1}>
          <SectionTitle>模块目录</SectionTitle>
          <StatusLine kind="loading">正在加载模块目录...</StatusLine>
        </Box>
        <Box width={rightWidth} paddingX={1}>
          <Text color={T.muted}>  </Text>
        </Box>
      </Box>
    );
  }
  if (error) {
    return (
      <Box flexDirection="row" flexGrow={1}>
        <Box width={leftWidth} backgroundColor={T.panel} paddingX={1}>
          <SectionTitle>模块目录</SectionTitle>
          <StatusLine kind="err">无法加载: {error}</StatusLine>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={leftWidth} backgroundColor={T.panel} paddingX={1}>
        <SectionTitle detail={`${filtered.length}/${modules.length}`}>模块</SectionTitle>
        <Text color={searching ? T.blue : T.muted}>
          {searching ? `搜索: ${query}█` : `筛选: ${filter} · / 搜索 · f 切换 · e 启停 · d 依赖 · r 刷新`}
        </Text>
        <Box marginTop={1} flexDirection="column" flexGrow={1}>
          {filtered.length === 0 ? (
            <StatusLine kind="empty">没有匹配模块</StatusLine>
          ) : (
            filtered.slice(0, Math.max(3, 18)).map((m, i) => {
              const sel = i === focus;
              return (
                <Box key={m.id} backgroundColor={sel ? T.surfaceHi : T.panel} paddingX={1}>
                  <Text color={m.enabled ? T.green : T.muted}>{m.enabled ? "●" : "○"}</Text>
                  <Text color={sel ? T.blue : T.text} bold={sel}>
                    {" "}
                    {m.id} {m.display_name ? `(${m.display_name})` : ""}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <Box flexDirection="column" width={rightWidth} paddingX={1}>
        {selected ? (
          <>
            <SectionTitle detail={selected.type ?? "feature"}>{selected.display_name ?? selected.id}</SectionTitle>
            <Text color={T.text}>{selected.description ?? ""}</Text>
            <Box marginTop={1}>
              <Text color={T.muted}>依赖: </Text>
              <Text color={missing.length > 0 ? T.yellow : T.green}>{(selected.requires ?? []).join(", ") || "无"}</Text>
            </Box>
            {missing.length > 0 && <StatusLine kind="warn">未满足依赖: {missing.join(", ")}</StatusLine>}
            <Box marginTop={1}>
              <Text color={T.muted}>命令: </Text>
              <Text color={T.text}>{(selected.commands ?? []).join(", ") || "无"}</Text>
            </Box>
            <Box>
              <Text color={T.muted}>可禁用: </Text>
              <Text color={selected.can_disable ? T.green : T.yellow}>{selected.can_disable ? "是" : "否"}</Text>
            </Box>

            {showDeps && (
              <Box marginTop={1} flexDirection="column">
                <Text color={T.muted}>依赖关系：</Text>
                {(selected.requires ?? []).map((dep) => {
                  const m = moduleMap.get(dep);
                  const ready = m?.enabled;
                  return (
                    <Text key={dep} color={ready ? T.green : T.red}>
                      {"  "}- {dep} [{ready ? "就绪" : "未就绪"}]
                    </Text>
                  );
                })}
              </Box>
            )}
            {busy && <StatusLine kind="loading">正在提交变更...</StatusLine>}
          </>
        ) : (
          <StatusLine kind="empty">请选择模块</StatusLine>
        )}
      </Box>
    </Box>
  );
}
