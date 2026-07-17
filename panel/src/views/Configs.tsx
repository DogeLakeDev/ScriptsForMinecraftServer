/**
 * views/Configs.tsx — 配置 Tab
 *
 * e 键调起系统编辑器（$EDITOR > vscode > notepad）。
 */

import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { useStore, set, showToast, type ConfigFile } from "../store.js";
import { T } from "../theme.js";
import { SectionTitle, StatusLine } from "../ui/common.js";

const CONFIG_FILES: Array<{ id: string; label: string; relPath: string }> = [
  { id: "bds_updater", label: "BDS 更新器", relPath: "configs/bds_updater.json" },
  { id: "qq_config", label: "QQ Bridge", relPath: "configs/qq_config.json" },
  { id: "panel_config", label: "面板", relPath: "configs/panel_config.json" },
  { id: "settings", label: "通用设置", relPath: "configs/settings.json" },
  { id: "land", label: "领地", relPath: "configs/land.json" },
  { id: "clean", label: "清理", relPath: "configs/clean.json" },
];

const REPO_ROOT = path.resolve(process.cwd());

function readConfig(file: string): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, file), "utf-8")) as Record<string, unknown>;
  } catch (e) {
    return { __error: (e as Error).message };
  }
}

export function Configs({ leftWidth, rightWidth }: { leftWidth: number; rightWidth: number }) {
  const configs = useStore((s) => s.configs);
  const loading = useStore((s) => s.configsLoading);
  const error = useStore((s) => s.configsError);
  const selectedLeft = useStore((s) => s.selectedLeft);
  const focusKey = useStore((s) => s.configFocusKey);

  const [editor, setEditor] = useState<string | null>(null);

  useEffect(() => {
    set({ configsLoading: true, configsError: null });
    try {
      const list: ConfigFile[] = CONFIG_FILES.map((c) => ({
        id: c.id,
        label: c.label,
        path: path.join(REPO_ROOT, c.relPath),
        data: readConfig(c.relPath),
      }));
      set({ configs: list, configsLoading: false });
    } catch (e) {
      set({ configsError: (e as Error).message, configsLoading: false });
    }
  }, [set]);

  useInput(
    (input) => {
      if (loading) return;
      if (editor) return;
      if (input === "e") {
        const file = configs[selectedLeft];
        if (!file) return;
        spawnEditor(file.path);
        setEditor(file.path);
        showToast(`编辑器已启动: ${file.path}`, "info");
        return;
      }
      if (input === "r") {
        set({ configsLoading: true, configsError: null });
        const list = CONFIG_FILES.map((c) => ({
          id: c.id,
          label: c.label,
          path: path.join(REPO_ROOT, c.relPath),
          data: readConfig(c.relPath),
        }));
        set({ configs: list, configsLoading: false });
        showToast("配置已重载", "success");
      }
    },
    { isActive: true },
  );

  useEffect(() => {
    if (!editor) return;
    const t = setInterval(() => {
      const idx = configs.findIndex((c) => c.path === editor);
      if (idx >= 0) {
        const cfg = CONFIG_FILES[idx];
        if (!cfg) return;
        const fresh = readConfig(cfg.relPath);
        const i = idx;
        set((s) => ({
          configs: s.configs.map((c, j) => (j === i ? { ...c, data: fresh } : c)),
        }));
      }
    }, 1500);
    const stop = setTimeout(() => {
      clearInterval(t);
      setEditor(null);
    }, 60000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [editor, configs, set]);

  const cur = configs[selectedLeft];
  const keys = cur ? Object.keys(cur.data) : [];
  const focusK = focusKey ?? keys[0] ?? null;

  if (loading) {
    return (
      <Box paddingX={1}>
        <SectionTitle>配置</SectionTitle>
        <StatusLine kind="loading">正在加载配置文件...</StatusLine>
      </Box>
    );
  }
  if (error) {
    return (
      <Box paddingX={1}>
        <SectionTitle>配置</SectionTitle>
        <StatusLine kind="err">加载失败: {error}</StatusLine>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={leftWidth} backgroundColor={T.panel} paddingX={1}>
        <SectionTitle detail={`${configs.length} 项 · e 编辑 · r 刷新`}>配置</SectionTitle>
        {configs.map((c, i) => {
          const sel = selectedLeft === i;
          return (
            <Box key={c.id} backgroundColor={sel ? T.surfaceHi : T.panel} paddingX={1}>
              <Text color={sel ? T.blue : T.text} bold={sel}>
                {sel ? "▶ " : "  "}
                {c.label}
              </Text>
              <Text color={T.subtle}>  {path.basename(c.path)}</Text>
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" width={rightWidth} paddingX={1}>
        {cur ? (
          <>
            <SectionTitle detail={path.relative(REPO_ROOT, cur.path)}>{cur.label}</SectionTitle>
            {editor && <StatusLine kind="info">编辑器运行中... 修改保存后会自动重载</StatusLine>}
            {keys.length === 0 ? (
              <Text color={T.muted}>（空文件）</Text>
            ) : (
              keys.map((k) => {
                const v = cur.data[k];
                const sel = k === focusK;
                return (
                  <Box key={k} backgroundColor={sel ? T.surfaceHi : T.panel} paddingX={1}>
                    <Text color={sel ? T.blue : T.text} bold={sel}>
                      {k}
                    </Text>
                    <Text color={T.subtle}> = </Text>
                    <Text color={sel ? T.text : T.muted}>{formatValue(v)}</Text>
                  </Box>
                );
              })
            )}
          </>
        ) : (
          <Text color={T.muted}>选择配置项</Text>
        )}
      </Box>
    </Box>
  );
}

function formatValue(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function spawnEditor(filepath: string): void {
  const editor = process.env["EDITOR"] ?? process.env["VISUAL"] ?? "";
  if (editor) {
    const child = spawn(editor, [filepath], { stdio: "inherit", shell: true });
    child.on("exit", () => {});
    return;
  }
  if (process.platform === "win32") {
    const child = spawn("notepad.exe", [filepath], { stdio: "inherit", detached: true });
    child.unref();
    return;
  }
  const child = spawn("nano", [filepath], { stdio: "inherit" });
  child.on("exit", () => {});
}
