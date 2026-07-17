/**
 * views/Services.tsx — 服务 Tab
 */

import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { T } from "../theme.js";
import { LogBlock } from "../ui/LogBlock.js";
import { SectionTitle } from "../ui/common.js";
import { services, type ManagedServiceName } from "../services/manager.js";

const SERVICE_ORDER: ManagedServiceName[] = ["bds", "db", "qq", "llbot"];

export function Services({ leftWidth, rightWidth, viewHeight }: { leftWidth: number; rightWidth: number; viewHeight: number }) {
  const servicesState = useStore((s) => s.services);
  const selectedLeft = useStore((s) => s.selectedLeft);
  const serviceDetail = useStore((s) => s.serviceDetail);
  const logs = useStore((s) => s.logs);
  const logScroll = useStore((s) => s.logScroll);
  const editing = useStore((s) => s.editing);
  const inputValue = useStore((s) => s.inputValue);

  const focus: ManagedServiceName = (serviceDetail as ManagedServiceName | null) ?? SERVICE_ORDER[selectedLeft] ?? "bds";
  const svc = servicesState[focus];
  const svcLogs = logs.filter((l) => l.source === focus);

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={leftWidth} backgroundColor={T.panel} paddingX={1}>
        <SectionTitle detail="↑↓ 选 · Enter 进入">服务</SectionTitle>
        {SERVICE_ORDER.map((name, i) => {
          const s = servicesState[name];
          const selected = selectedLeft === i;
          return (
            <Box key={name} backgroundColor={selected ? T.surfaceHi : T.panel} paddingX={1} marginBottom={1}>
              <Box flexDirection="row">
                <Text color={s.running ? T.green : T.muted} bold={selected}>
                  {s.running ? "●" : "○"} {s.title}
                </Text>
                <Box flexGrow={1} />
                <Text color={T.muted}>{s.running ? `PID ${s.pid}` : "未启动"}</Text>
              </Box>
              <Text color={T.subtle}>{s.running ? `${s.cpu}% CPU · ${s.memMb ?? "?"} MB` : "按 s 启动"}</Text>
            </Box>
          );
        })}
      </Box>

      <Box flexDirection="column" width={rightWidth} paddingX={1}>
        <SectionTitle detail={svc.running ? `PID ${svc.pid}` : "未启动"}>{services[focus].title}</SectionTitle>

        <Box flexDirection="row" marginBottom={1}>
          <Box marginRight={3}>
            <Text color={svc.running ? T.green : T.muted} bold>
              {svc.running ? "● 运行中" : "○ 已停止"}
            </Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.muted}>日志 {svcLogs.length}</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.muted}>CPU {svc.cpu}%</Text>
          </Box>
          <Box>
            <Text color={T.muted}>MEM {svc.memMb ?? "?"} MB</Text>
          </Box>
        </Box>

        <Box flexDirection="row" marginBottom={1}>
          <ActionChip keyName="s" label="启动" disabled={svc.running} />
          <ActionChip keyName="x" label="停止" disabled={!svc.running} />
          <ActionChip keyName="r" label="重启" disabled={!svc.running} />
          <ActionChip keyName="c" label="复制日志" disabled={svcLogs.length === 0} />
          <ActionChip keyName="L" label="等级" />
        </Box>

        <LogBlock entries={svcLogs} width={rightWidth} height={Math.max(5, viewHeight - 12)} scroll={logScroll} />

        <Box marginTop={1} backgroundColor={editing ? T.surfaceHi : T.surface} paddingX={1}>
          <Text color={T.blue} bold>
            {" "}
            {editing ? "›" : ":"}
          </Text>
          <Text color={T.muted}>
            {" "}
            {editing ? inputValue || "输入后回车发送（仅对该服务生效）" : "按 : 进入发送命令模式"}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}

function ActionChip({ keyName, label, disabled }: { keyName: string; label: string; disabled?: boolean }) {
  return (
    <Box marginRight={2}>
      <Text color={disabled ? T.subtle : T.blue} bold>
        [{keyName}]
      </Text>
      <Text color={disabled ? T.subtle : T.text}> {label}</Text>
    </Box>
  );
}
