/**
 * ui/Shell.tsx — Header / Footer / 输入框
 */

import { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { T } from "../theme.js";
import { TAB_LABEL, type Tab, TABS } from "../store.js";
import type { ServiceName, ServiceStatus, State } from "../store.js";
import { Crumb, KeyHint } from "./common.js";

const SERVICE_ORDER: ServiceName[] = ["bds", "db", "qq", "llbot"];

type HeaderProps = {
  tab: Tab;
  services: Record<ServiceName, ServiceStatus>;
  cols: number;
  onSwitchTab: (t: Tab) => void;
};

export function Header({ tab, services }: HeaderProps) {
  const [now, setNow] = useState(() => fmtTime());
  useEffect(() => {
    const t = setInterval(() => setNow(fmtTime()), 1000);
    return () => clearInterval(t);
  }, []);

  const running = SERVICE_ORDER.filter((n) => services[n].running).length;
  const total = SERVICE_ORDER.length;

  return (
    <Box height={1} backgroundColor={T.panel} flexDirection="row" paddingX={1}>
      <Text color={T.text} bold>
        BDS Panel
      </Text>
      <Text color={T.subtle}> · </Text>
      <Text color={T.blue} bold>
        {TAB_LABEL[tab]}
      </Text>
      <Box flexGrow={1} />

      {TABS.map((t, i) => (
        <Box key={t} marginLeft={2}>
          {t === tab ? (
            <Text color={T.blue} bold backgroundColor={T.surface}>
              {" "}
              {i + 1} {TAB_LABEL[t]}{" "}
            </Text>
          ) : (
            <Text color={T.muted}>
              {" "}
              {i + 1} {TAB_LABEL[t]}{" "}
            </Text>
          )}
        </Box>
      ))}

      <Box flexGrow={1} />

      <Box marginLeft={2}>
        {SERVICE_ORDER.map((name) => (
          <Text key={name} color={services[name].running ? T.green : T.muted}>
            {services[name].running ? "●" : "○"}
          </Text>
        ))}
        <Text color={T.muted}>
          {" "}
          {running}/{total}
        </Text>
      </Box>

      <Box marginLeft={2}>
        <Text color={T.muted}>{now}</Text>
      </Box>
    </Box>
  );
}

function fmtTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

type FooterProps = {
  tab: Tab;
  crumbParts: string[];
  hintKeys: Array<{ key: string; label: string }>;
  state: Pick<State, "editing" | "inputValue" | "inputCursor">;
  blinkTick: number;
};

export function Footer({ crumbParts, hintKeys, state, blinkTick }: FooterProps) {
  return (
    <Box flexDirection="column" backgroundColor={T.panel} paddingX={1}>
      <Box>
        <Crumb parts={crumbParts} />
      </Box>
      <Box marginTop={1}>
        <KeyHint keys={hintKeys} />
      </Box>
      <Box marginTop={1} backgroundColor={state.editing ? T.surfaceHi : T.surface} paddingX={1}>
        <Text color={T.blue} bold>
          {" "}
          {state.editing ? "›" : ":"}
        </Text>
        <Text color={T.muted}> </Text>
        {state.editing ? (
          <InputLine value={state.inputValue} cursor={state.inputCursor} visible={blinkTick % 2 === 0} />
        ) : (
          <Text color={T.muted}>输入命令（按 : 进入，↑↓ 历史，Ctrl+R 搜索）</Text>
        )}
      </Box>
    </Box>
  );
}

function InputLine({ value, cursor, visible }: { value: string; cursor: number; visible: boolean }) {
  const before = value.slice(0, cursor);
  const at = value.charAt(cursor);
  const after = value.slice(cursor + 1);
  return (
    <Box flexDirection="row">
      <Text color={T.text}>{before}</Text>
      <Text color={T.blue} bold>
        {visible ? at === "" ? "█" : at : at === "" ? " " : at}
      </Text>
      <Text color={T.text}>{after}</Text>
    </Box>
  );
}

export function computeHintKeys(state: State): Array<{ key: string; label: string }> {
  if (state.modal?.kind === "confirm") return [{ key: "y/n", label: "确认/取消" }];
  if (state.modal?.kind === "help") return [{ key: "Esc", label: "关闭" }];
  if (state.modal?.kind === "logFilter") return [{ key: "Space", label: "切换" }, { key: "Enter", label: "确定" }];
  if (state.modal?.kind === "historySearch") return [{ key: "Enter", label: "调出" }, { key: "Esc", label: "退出" }];

  if (state.editing) {
    return [
      { key: "Enter", label: "执行" },
      { key: "↑↓", label: "历史" },
      { key: "Ctrl+R", label: "搜索历史" },
      { key: "Esc", label: "取消" },
    ];
  }

  const base: Array<{ key: string; label: string }> = [
    { key: "Tab", label: "切 Tab" },
    { key: "↑↓", label: "选择" },
    { key: "Enter", label: "进入" },
    { key: "Esc", label: "返回" },
  ];
  if (state.tab === "services" || state.tab === "dashboard") {
    base.push({ key: "s/x/r", label: "启/停/重启" });
  }
  if (state.tab === "modules") {
    base.push({ key: "/", label: "搜索" }, { key: "f", label: "筛选" });
  }
  if (state.tab === "configs") {
    base.push({ key: "e", label: "系统编辑器" });
  }
  base.push({ key: "L", label: "日志等级" }, { key: "c", label: "复制日志" });
  base.push({ key: ":", label: "输入命令" });
  base.push({ key: "?", label: "帮助" }, { key: "q", label: "退出" });
  return base;
}

void Header;
