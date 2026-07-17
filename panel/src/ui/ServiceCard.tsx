/**
 * ui/ServiceCard.tsx — 服务卡片
 *
 * 4 个服务并排，每个一行：状态点 + 名称 + PID + CPU/MEM。
 * 点击/选中走背景色变化（surfaceHi）。
 *
 */

import { Box, Text } from "ink";
import type { ServiceStatus } from "../store.js";
import { T } from "../theme.js";
import { ProgressBar } from "./common.js";

type Props = {
  service: ServiceStatus;
  selected: boolean;
  width: number;
  onSelect?: () => void;
};

export function ServiceCard({ service, selected, width }: Props) {
  const bg = selected ? T.surfaceHi : T.surface;
  const statusColor = service.running ? T.green : T.muted;
  const dot = service.running ? "●" : "○";

  return (
    <Box flexDirection="column" backgroundColor={bg} width={width} paddingX={1}>
      <Box flexDirection="row">
        <Text color={statusColor} bold={selected}>
          {dot} {service.title}
        </Text>
        <Box flexGrow={1} />
        <Text color={T.muted}>{service.running ? `PID ${service.pid}` : "未启动"}</Text>
      </Box>
      {service.running && service.memMb !== null && (
        <ProgressBar
          pct={service.cpu}
          width={Math.max(6, width - 16)}
          label="CPU"
          right={`${service.cpu}% · ${service.memMb} MB`}
        />
      )}
      {!service.running && <Text color={T.subtle}> 按 s 启动</Text>}
    </Box>
  );
}
