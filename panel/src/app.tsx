/**
 * app.tsx — 根组件
 *
 * 极薄：组装 Header + 当前 Tab 视图 + Footer + 弹层。
 * 键盘事件完全交给 input/router.ts 的 dispatch。
 */

import { useEffect, useState } from "react";
import { Box, useInput, useStdout } from "ink";
import { useStore, get, switchTab, TAB_LABEL, type Tab } from "./store.js";
import { T } from "./theme.js";
import { Header, Footer, computeHintKeys } from "./ui/Shell.js";
import { ConfirmOverlay, HelpOverlay, LogFilterOverlay, HistorySearchOverlay } from "./ui/Overlays.js";
import { Toast } from "./Toast.js";
import { Dashboard } from "./views/Dashboard.js";
import { Services } from "./views/Services.js";
import { Monitor } from "./views/Monitor.js";
import { Modules } from "./views/Modules.js";
import { Configs } from "./views/Configs.js";
import { dispatch, setupScrollHandlers } from "./input/router.js";
import { enableMouse, disableMouse } from "./input/mouse.js";

const HEADER_H = 1;
const FOOTER_H = 5;

export function App() {
  const { stdout } = useStdout();
  const cols = stdout?.columns ?? 80;
  const rows = stdout?.rows ?? 24;

  const tab = useStore((s) => s.tab);
  const services = useStore((s) => s.services);
  const modal = useStore((s) => s.modal);
  const serviceDetail = useStore((s) => s.serviceDetail);
  const editing = useStore((s) => s.editing);
  const inputValue = useStore((s) => s.inputValue);
  const inputCursor = useStore((s) => s.inputCursor);
  const hintKeys = useStore((s) => computeHintKeys(s));

  const [blinkTick, setBlinkTick] = useState(0);
  const [resizeTick, setResizeTick] = useState(0);

  useEffect(() => {
    setupScrollHandlers();
    enableMouse();
    return () => disableMouse();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setBlinkTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onResize = () => setResizeTick((x) => x + 1);
    process.stdout.on("resize", onResize);
    return (): void => {
      process.stdout.removeListener("resize", onResize);
    };
  }, []);
  void resizeTick;

  useInput((input, key) => {
    dispatch(input, key);
  });

  const viewHeight = Math.max(5, rows - HEADER_H - FOOTER_H);
  const leftWidth = Math.max(40, Math.floor(cols * 0.42));
  const rightWidth = Math.max(20, cols - leftWidth);

  const crumbParts = buildCrumb(tab, serviceDetail, modal);

  // Footer 所需 state 切片（避免重新渲染整个 store）
  const footerState = {
    ...get(),
    editing,
    inputValue,
    inputCursor,
  };

  return (
    <Box flexDirection="column" width={cols} height={rows} backgroundColor={T.bg}>
      <Header tab={tab} services={services} cols={cols} onSwitchTab={switchTab} />
      <Box flexDirection="row" height={viewHeight}>
        {tab === "dashboard" && <Dashboard leftWidth={leftWidth} rightWidth={rightWidth} viewHeight={viewHeight} />}
        {tab === "services" && <Services leftWidth={leftWidth} rightWidth={rightWidth} viewHeight={viewHeight} />}
        {tab === "monitor" && <Monitor leftWidth={leftWidth} rightWidth={rightWidth} viewHeight={viewHeight} />}
        {tab === "modules" && <Modules leftWidth={leftWidth} rightWidth={rightWidth} />}
        {tab === "configs" && <Configs leftWidth={leftWidth} rightWidth={rightWidth} />}
      </Box>
      <Footer tab={tab} crumbParts={crumbParts} hintKeys={hintKeys} state={footerState} blinkTick={blinkTick} />

      <ConfirmOverlay />
      <HelpOverlay />
      <LogFilterOverlay />
      <HistorySearchOverlay />
      <Toast />
    </Box>
  );
}

function buildCrumb(tab: Tab, serviceDetail: string | null, modal: ReturnType<typeof get>["modal"]): string[] {
  const parts = [TAB_LABEL[tab]];
  if (tab === "services" && serviceDetail) parts.push(serviceDetail.toUpperCase());
  if (modal?.kind === "help") parts.push("帮助");
  if (modal?.kind === "confirm") parts.push("确认");
  if (modal?.kind === "logFilter") parts.push("日志过滤");
  if (modal?.kind === "historySearch") parts.push("历史搜索");
  return parts;
}
