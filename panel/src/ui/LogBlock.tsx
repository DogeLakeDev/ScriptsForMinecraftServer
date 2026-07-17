/**
 * ui/LogBlock.tsx — 渲染着色日志块
 */

import { memo } from "react";
import { Box, Text } from "ink";
import type { LogEntry } from "../store.js";
import { T } from "../theme.js";
import { tokenize, truncate } from "../log/highlighter.js";
import { ScrollBar } from "./common.js";

type Props = {
  entries: LogEntry[];
  width: number;
  height: number;
  scroll: number;
};

export const LogBlock = memo(function LogBlock({ entries, width, height, scroll }: Props) {
  const total = entries.length;
  const maxRows = Math.max(1, height - 1);
  const endIdx = Math.max(0, total - scroll);
  const startIdx = Math.max(0, endIdx - maxRows);
  const visible = entries.slice(startIdx, endIdx);

  if (visible.length === 0) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Text color={T.muted}> 暂无日志</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={Math.max(1, width - 2)}>
        {visible.map((entry) => (
          <LogLine key={entry.id} entry={entry} width={width - 2} />
        ))}
      </Box>
      <ScrollBar total={total} viewport={maxRows} offset={scroll} height={maxRows} />
    </Box>
  );
});

function LogLine({ entry, width }: { entry: LogEntry; width: number }) {
  const time = new Date(entry.time);
  const hh = String(time.getHours()).padStart(2, "0");
  const mm = String(time.getMinutes()).padStart(2, "0");
  const ss = String(time.getSeconds()).padStart(2, "0");
  const tokens = tokenize(entry.text, entry.level);
  return (
    <Box flexDirection="row">
      <Text color={T.muted}>
        {hh}:{mm}:{ss}
      </Text>
      <Text color={T.subtle}> </Text>
      {tokens.map((t, i) => (
        <Text key={i} color={t.color} bold={t.bold === true}>
          {truncate(t.text, width - 10)}
        </Text>
      ))}
    </Box>
  );
}
