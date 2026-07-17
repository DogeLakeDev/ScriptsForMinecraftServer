/**
 * ui/Overlays.tsx — Confirm / Help / LogFilter / HistorySearch 弹层
 */

import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { T, LEVEL_ORDER, LEVEL_COLOR } from "../theme.js";

export function ConfirmOverlay() {
  const m = useStore((s) => s.modal);
  if (m?.kind !== "confirm") return null;
  const color = m.destructive ? T.red : T.blue;
  return (
    <Box position="absolute" alignItems="center" justifyContent="center" width="100%" height="100%">
      <Box flexDirection="column" backgroundColor={T.surface} paddingX={3} paddingY={2}>
        <Text color={color} bold>
          {m.title}
        </Text>
        {m.body.map((line, i) => (
          <Text key={i} color={T.text}>
            {line}
          </Text>
        ))}
        <Box marginTop={1}>
          <Text color={T.green} bold>
            [y]
          </Text>
          <Text color={T.muted}> 确认    </Text>
          <Text color={T.red} bold>
            [n/Esc]
          </Text>
          <Text color={T.muted}> 取消</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function HelpOverlay() {
  const m = useStore((s) => s.modal);
  if (m?.kind !== "help") return null;
  return (
    <Box position="absolute" alignItems="center" justifyContent="center" width="100%" height="100%">
      <Box flexDirection="column" backgroundColor={T.surface} paddingX={3} paddingY={2}>
        <Text color={T.blue} bold>
          快捷键
        </Text>
        <Box marginTop={1} flexDirection="column">
          <HelpRow k="Tab" v="切换栏 / 切 Tab" />
          <HelpRow k="↑ ↓" v="上下选择" />
          <HelpRow k="Enter" v="进入 / 提交" />
          <HelpRow k="Esc" v="返回 / 双击退出" />
          <HelpRow k="s / x / r" v="启 / 停 / 重启服务" />
          <HelpRow k=":" v="进入命令模式" />
          <HelpRow k="↑ ↓ (命令模式)" v="翻历史命令" />
          <HelpRow k="Ctrl+R" v="反向搜索历史" />
          <HelpRow k="Ctrl+A/E" v="跳到行首/行尾" />
          <HelpRow k="Ctrl+W/U" v="删词 / 清行" />
          <HelpRow k="c" v="复制日志到剪贴板" />
          <HelpRow k="L" v="日志等级过滤" />
          <HelpRow k="/" v="搜索（模块）" />
          <HelpRow k="f" v="筛选（模块 / 日志）" />
          <HelpRow k="e" v="编辑配置 / 切换模块" />
          <HelpRow k="d" v="依赖详情" />
          <HelpRow k="?" v="本帮助" />
          <HelpRow k="q" v="退出确认" />
        </Box>
      </Box>
    </Box>
  );
}

function HelpRow({ k, v }: { k: string; v: string }) {
  return (
    <Box>
      <Text color={T.blue} bold>
        {k.padEnd(14)}
      </Text>
      <Text color={T.muted}> {v}</Text>
    </Box>
  );
}

export function LogFilterOverlay() {
  const m = useStore((s) => s.modal);
  if (m?.kind !== "logFilter") return null;
  const cur = m.selected[0] ?? "info";
  return (
    <Box position="absolute" alignItems="center" justifyContent="center" width="100%" height="100%">
      <Box flexDirection="column" backgroundColor={T.surface} paddingX={3} paddingY={2}>
        <Text color={T.blue} bold>
          日志等级过滤
        </Text>
        <Box marginTop={1} flexDirection="column">
          {LEVEL_ORDER.map((lv) => (
            <Box key={lv}>
              <Text color={LEVEL_COLOR[lv]} bold>
                {cur === lv ? "▶ " : "  "}
                {lv.padEnd(10)}
              </Text>
              <Text color={T.muted}> Space 切换</Text>
            </Box>
          ))}
        </Box>
        <Box marginTop={1}>
          <Text color={T.green} bold>
            [Enter]
          </Text>
          <Text color={T.muted}> 确定</Text>
          <Text color={T.red} bold>
            {"  "}[Esc]
          </Text>
          <Text color={T.muted}> 取消</Text>
        </Box>
      </Box>
    </Box>
  );
}

export function HistorySearchOverlay() {
  const m = useStore((s) => s.modal);
  if (m?.kind !== "historySearch") return null;
  return (
    <Box position="absolute" alignItems="flex-start" justifyContent="flex-start" width="100%" paddingX={3} paddingY={2}>
      <Box flexDirection="column" backgroundColor={T.surfaceHi} paddingX={2} paddingY={1}>
        <Box>
          <Text color={T.blue} bold>
            反向搜索:{" "}
          </Text>
          <Text color={T.text}>{m.query || "(空)"}</Text>
        </Box>
        {m.matches.length === 0 ? (
          <Text color={T.muted}>  无匹配</Text>
        ) : (
          m.matches.slice(0, 5).map((line, i) => (
            <Text key={i} color={i === m.index ? T.blue : T.muted} bold={i === m.index}>
              {i === m.index ? "▶ " : "  "}
              {line}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}
