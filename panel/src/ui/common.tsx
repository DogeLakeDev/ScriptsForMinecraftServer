/**
 * ui/common.tsx — 复用 UI 原子组件
 *
 * 基于 One Half Dark 配色
 * 区块分层仅靠 backgroundColor 差异。
 */

import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { T } from "../theme.js";

/** 一个区块标题 + 右侧可选的 detail（计数 / 状态） */
export function SectionTitle({ children, detail }: { children: ReactNode; detail?: ReactNode }) {
  return (
    <Box flexDirection="row" marginBottom={1}>
      <Text color={T.text} bold>
        {children}
      </Text>
      {detail !== undefined && <Text color={T.muted}> {detail}</Text>}
    </Box>
  );
}

/** 键位提示：[Tab] 切换  [Enter] 进入 */
export function KeyHint({ keys }: { keys: Array<{ key: string; label: string }> }) {
  return (
    <Box flexDirection="row" flexWrap="wrap">
      {keys.map((k, i) => (
        <Box key={i} marginRight={2}>
          <Text color={T.blue} bold>
            {k.key}
          </Text>
          <Text color={T.muted}> {k.label}</Text>
        </Box>
      ))}
    </Box>
  );
}

/** 面包屑：总览 › 服务 › BDS */
export function Crumb({ parts }: { parts: string[] }) {
  return (
    <Box flexDirection="row">
      {parts.map((p, i) => (
        <Box key={i}>
          {i > 0 && <Text color={T.subtle}> › </Text>}
          <Text color={i === parts.length - 1 ? T.blue : T.muted} bold={i === parts.length - 1}>
            {p}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/** 状态行：[+] 文本 */
export function StatusLine({
  kind,
  children,
}: {
  kind: "ok" | "warn" | "err" | "info" | "loading" | "empty";
  children: ReactNode;
}) {
  const map = {
    ok: { prefix: "[+]", color: T.green },
    warn: { prefix: "[!]", color: T.yellow },
    err: { prefix: "[x]", color: T.red },
    info: { prefix: "[*]", color: T.blue },
    loading: { prefix: "[~]", color: T.muted },
    empty: { prefix: "[-]", color: T.subtle },
  } as const;
  const s = map[kind];
  return (
    <Box flexDirection="row">
      <Text color={s.color} bold>
        {s.prefix}
      </Text>
      <Text color={kind === "err" ? T.red : T.muted}> {children}</Text>
    </Box>
  );
}

/** 滚动条（侧贴样式，仅占 1 列宽） */
export function ScrollBar({
  total,
  viewport,
  offset,
  height,
}: {
  total: number;
  viewport: number;
  offset: number;
  height: number;
}) {
  if (total <= viewport || viewport <= 0) return <Text color={T.subtle}> </Text>;
  const track = Math.max(1, height);
  const thumb = Math.max(1, Math.round((viewport / total) * track));
  const maxOffset = Math.max(1, total - viewport);
  const inverted = maxOffset - Math.min(offset, maxOffset);
  const top = Math.min(track - thumb, Math.round((inverted / maxOffset) * (track - thumb)));
  const rows = ["░".repeat(top), "█".repeat(thumb), "░".repeat(track - top - thumb)];
  return (
    <Box flexDirection="column" width={1}>
      {rows.map((r, i) => (
        <Text key={i} color={i === 1 ? T.blue : T.subtle}>
          {r}
        </Text>
      ))}
    </Box>
  );
}

/** 一段水平进度条 */
export function ProgressBar({
  pct,
  width = 20,
  label,
  right,
}: {
  pct: number;
  width?: number;
  label?: string;
  right?: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  const filled = Math.round((p / 100) * width);
  const empty = width - filled;
  const color = p >= 90 ? T.red : p >= 70 ? T.yellow : T.green;
  return (
    <Box flexDirection="row">
      {label && <Text color={T.muted}>{label.padEnd(8)}</Text>}
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text color={T.subtle}>{"░".repeat(Math.max(0, empty))}</Text>
      {right && <Text color={T.muted}> {right}</Text>}
    </Box>
  );
}

/** Spinner 帧 */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ tick }: { tick: number }) {
  const ch = SPINNER_FRAMES[tick % SPINNER_FRAMES.length] ?? "⠋";
  return (
    <Text color={T.blue} bold>
      {ch}
    </Text>
  );
}
