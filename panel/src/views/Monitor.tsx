/**
 * views/Monitor.tsx — 监控 Tab
 *
 * 左：系统资源条 + 各服务 CPU/MEM
 * 右：TPS 进度条 + 实体/区块数 + 在线玩家表
 */

import { Box, Text } from "ink";
import { useStore } from "../store.js";
import { T } from "../theme.js";
import { ProgressBar, SectionTitle } from "../ui/common.js";

const SERVICE_ORDER = ["bds", "db", "qq", "llbot", "panel"] as const;
const SERVICE_LABEL: Record<(typeof SERVICE_ORDER)[number], string> = {
  bds: "BDS    ",
  db: "DB     ",
  qq: "QQ     ",
  llbot: "LLBot  ",
  panel: "Panel  ",
};

export function Monitor({ leftWidth, rightWidth, viewHeight }: { leftWidth: number; rightWidth: number; viewHeight: number }) {
  const services = useStore((s) => s.services);
  const monitor = useStore((s) => s.monitor);

  const stale = !monitor.summaryAt || Date.now() - monitor.summaryAt > 7000;
  const tpsPct = Math.min(100, Math.round((monitor.tps / 20) * 100));
  const tpsColor = monitor.tps >= 19.5 ? T.green : monitor.tps >= 15 ? T.yellow : T.red;

  return (
    <Box flexDirection="row" flexGrow={1}>
      <Box flexDirection="column" width={leftWidth} backgroundColor={T.panel} paddingX={1}>
        <SectionTitle detail={stale ? "数据已过期" : "实时"}>资源</SectionTitle>
        <ProgressBar pct={monitor.systemMemPct} width={Math.max(8, leftWidth - 28)} label="系统内存" right={`${monitor.systemMemPct}% · ${monitor.systemMemUsedMb}/${monitor.systemMemTotalMb} MB`} />
        <ProgressBar pct={monitor.systemCpu} width={Math.max(8, leftWidth - 28)} label="系统CPU " right={`${monitor.systemCpu}%`} />

        <Box marginTop={1}>
          <SectionTitle>进程</SectionTitle>
          {SERVICE_ORDER.map((name) => {
            const info = services[name];
            return (
              <ProgressBar
                key={name}
                pct={info.cpu}
                width={Math.max(8, leftWidth - 28)}
                label={SERVICE_LABEL[name]}
                right={`${info.cpu}% · ${info.memMb ?? "?"} MB`}
              />
            );
          })}
        </Box>
      </Box>

      <Box flexDirection="column" width={rightWidth} paddingX={1}>
        <SectionTitle>游戏</SectionTitle>
        <Box flexDirection="row" marginBottom={1}>
          <ProgressBar pct={tpsPct} width={Math.max(8, rightWidth - 28)} label="TPS    " right={`${monitor.tps > 0 ? monitor.tps.toFixed(1) : "N/A"}/20 (${tpsPct}%)`} />
          <Text color={tpsColor} bold>
            {" "}
            {tpsColor === T.green ? "流畅" : tpsColor === T.yellow ? "卡顿" : "严重卡顿"}
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="row" flexWrap="wrap">
          <Box marginRight={3}>
            <Text color={T.text}>实体 </Text>
            <Text color={T.muted}>{monitor.entitiesTotal}</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.text}>区块 </Text>
            <Text color={T.muted}>{monitor.totalChunks}</Text>
          </Box>
          <Box marginRight={3}>
            <Text color={T.text}>在线 </Text>
            <Text color={T.muted}>{monitor.players.length}</Text>
          </Box>
        </Box>

        <Box marginTop={1}>
          <SectionTitle detail={`${monitor.players.length} 在线`}>玩家</SectionTitle>
          {monitor.players.length === 0 ? (
            <Text color={T.muted}>暂无在线玩家</Text>
          ) : (
            monitor.players.slice(0, Math.max(3, viewHeight - 14)).map((p, i) => (
              <Box key={i} flexDirection="row">
                <Text color={T.text}>  {(p.name ?? "?").padEnd(16)}</Text>
                <Text color={T.muted}> {dimLabel(p.dimension)}</Text>
                <Text color={T.subtle}>  区块 {p.chunkEstimate}  实体 {p.clientEntities}</Text>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </Box>
  );
}

function dimLabel(d: string): string {
  if (d?.includes("nether")) return "下界";
  if (d?.includes("the_end")) return "末地";
  return "主世界";
}
