/**
 * views/Dashboard.tsx — 总览
 */

import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { T } from "../theme.js";
import { ServiceCard } from "../ui/ServiceCard.js";
import { LogBlock } from "../ui/LogBlock.js";
import { SectionTitle, StatusLine, ProgressBar } from "../ui/common.js";

const SERVICE_ORDER = ["bds", "db", "qq", "llbot"] as const;

export function Dashboard({ leftWidth, rightWidth, viewHeight }: { leftWidth: number; rightWidth: number; viewHeight: number }) {
  const services = useStore((s) => s.services);
  const monitor = useStore((s) => s.monitor);
  const logs = useStore((s) => s.logs);
  const logScroll = useStore((s) => s.logScroll);
  const selectedLeft = useStore((s) => s.selectedLeft);

  const cardWidth = Math.max(20, Math.floor(leftWidth / 4) - 2);
  const errors = logs.filter((l) => l.level === "error").length;
  const running = SERVICE_ORDER.filter((n) => services[n].running).length;

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={leftWidth} backgroundColor={T.panel} paddingX={1}>
        <SectionTitle detail="← → 切换 · s/x/r 控制">服务</SectionTitle>
        <Box flexDirection="row" flexWrap="wrap">
          {SERVICE_ORDER.map((name, i) => (
            <Box key={name} marginRight={1} marginBottom={1}>
              <ServiceCard service={services[name]} selected={selectedLeft === i} width={cardWidth} />
            </Box>
          ))}
        </Box>

        <Box marginTop={1}>
          <SectionTitle detail="db-server 实时">指标</SectionTitle>
          <ProgressBar
            pct={monitor.systemMemPct}
            width={Math.max(8, leftWidth - 24)}
            label="内存"
            right={`${monitor.systemMemPct}% · ${monitor.systemMemUsedMb}/${monitor.systemMemTotalMb} MB`}
          />
          <ProgressBar pct={monitor.systemCpu} width={Math.max(8, leftWidth - 24)} label="CPU  " right={`${monitor.systemCpu}%`} />
        </Box>

        <Box marginTop={1} flexDirection="row" flexWrap="wrap">
          <Box marginRight={3}>
            <Text color={monitor.tps >= 19 ? T.green : monitor.tps >= 15 ? T.yellow : T.red}>
              TPS {monitor.tps > 0 ? monitor.tps.toFixed(1) : "N/A"}
            </Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.text}>玩家 {monitor.players.length}</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.text}>实体 {monitor.entitiesTotal}</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.text}>区块 {monitor.totalChunks}</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={errors > 0 ? T.red : T.muted}>错误 {errors}</Text>
          </Box>
          <Box>
            <Text color={running === 4 ? T.green : T.yellow}>运行 {running}/4</Text>
          </Box>
        </Box>
      </Box>

      <Box flexDirection="column" width={rightWidth} paddingX={1}>
        <SectionTitle detail={`${logs.length} 条 · L 等级过滤`}>最近日志</SectionTitle>
        {logs.length === 0 ? (
          <StatusLine kind="empty">暂无日志 — 启动服务后会出现在这里</StatusLine>
        ) : (
          <LogBlock entries={logs} width={rightWidth} height={viewHeight - 4} scroll={logScroll} />
        )}
      </Box>
    </Box>
  );
}
