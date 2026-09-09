import assert from "node:assert/strict";
import test from "node:test";
import type { UnifiedLog } from "../logs.js";
import type { ServiceName } from "../services.js";
import { WindowHost, serviceWindowId } from "./host.js";
import { createServiceWindow } from "./service-window.js";
import { createSfmcWindow, SFMC_WINDOW_ID } from "./sfmc-window.js";

test("WindowHost: 管理服务窗与 SFMC 平台窗生命周期", () => {
  const written: string[] = [];
  const host = new WindowHost({ writeLog: (l) => written.push(l) });

  let activeTargets: ServiceName[] = ["bds"];
  host.register(createServiceWindow("bds"));
  host.register(createSfmcWindow({ getActiveTargets: () => activeTargets }));

  host.setServiceOrder([serviceWindowId("bds"), SFMC_WINDOW_ID]);

  // 初始激活第 1 个窗口（bds）
  assert.equal(host.getActiveId(), serviceWindowId("bds"));
  assert.equal(host.getActive()?.title, "BDS");
  assert.equal(host.getActive()?.serviceName, "bds");

  // Tab 轮换至 SFMC 窗
  const res1 = host.cycleServiceWindows();
  assert.equal(res1.switched, true);
  assert.equal(res1.serviceName, null);
  assert.equal(host.getActiveId(), SFMC_WINDOW_ID);
  assert.equal(host.getActive()?.title, "SFMC");
  assert.equal(host.getActive()?.serviceName, undefined);

  // 再次 Tab 轮换回 BDS 窗
  const res2 = host.cycleServiceWindows();
  assert.equal(res2.switched, true);
  assert.equal(res2.serviceName, "bds");
  assert.equal(host.getActiveId(), serviceWindowId("bds"));

  // 服务停止：setServiceOrder 清空时应注销服务窗与 SFMC 窗
  activeTargets = [];
  host.setServiceOrder([]);
  assert.equal(host.getActiveId(), null);
  assert.equal(host.has(serviceWindowId("bds")), false);
  assert.equal(host.has(SFMC_WINDOW_ID), false);
});

test("createSfmcWindow: acceptLog 过滤活跃服务日志并接收非服务/平台日志", () => {
  const activeTargets: ServiceName[] = ["bds", "db"];
  const win = createSfmcWindow({ getActiveTargets: () => activeTargets });

  const now = new Date();
  const bdsLog: UnifiedLog = { time: now, source: "bds", level: "info", text: "Server started" };
  const dbLog: UnifiedLog = { time: now, source: "db", level: "info", text: "Database ready" };
  const packLog: UnifiedLog = { time: now, source: "pack", level: "info", text: "assembled BP uuid=xxx" };
  const sysLog: UnifiedLog = { time: now, source: "system", level: "info", text: "Platform initialized" };
  const qqLog: UnifiedLog = { time: now, source: "qq", level: "info", text: "QQ stopped" };

  // 活跃服务（bds, db）的日志在 SFMC 窗被过滤
  assert.equal(win.acceptLog(bdsLog), false);
  assert.equal(win.acceptLog(dbLog), false);

  // 非活跃服务或平台日志（pack, system, qq）在 SFMC 窗被接收
  assert.equal(win.acceptLog(packLog), true);
  assert.equal(win.acceptLog(sysLog), true);
  assert.equal(win.acceptLog(qqLog), true);

  // 格式化输出应包含来源标签（omitSource: false）
  const formatted = win.formatLogLine(packLog);
  assert.ok(formatted.text.includes("[PAK]"));
});

test("WindowHost: routeLog 将日志正确分流到活动窗口与后台窗口缓存", () => {
  const written: string[] = [];
  const host = new WindowHost({ writeLog: (l) => written.push(l) });

  const activeTargets: ServiceName[] = ["bds"];
  host.register(createServiceWindow("bds"));
  host.register(createSfmcWindow({ getActiveTargets: () => activeTargets }));
  host.setServiceOrder([serviceWindowId("bds"), SFMC_WINDOW_ID]);

  // 给两个窗口预设 buffer（模拟 seed）
  host.setBuffer(serviceWindowId("bds"), []);
  host.setBuffer(SFMC_WINDOW_ID, []);

  // 当前在 BDS 窗
  assert.equal(host.getActiveId(), serviceWindowId("bds"));

  const now = new Date();
  const bdsLog: UnifiedLog = { time: now, source: "bds", level: "info", text: "Hello BDS" };
  const packLog: UnifiedLog = { time: now, source: "pack", level: "info", text: "Building pack" };

  // 产生 BDS 日志：活动窗立即收到写入
  host.routeLog(bdsLog);
  assert.equal(written.length, 1);
  assert.ok(written[0]?.includes("Hello BDS"));

  // 产生 Pack 日志：当前在 BDS 窗，Tty 不直接写，但 SFMC 窗口后台 buffer 应追加
  host.routeLog(packLog);
  assert.equal(written.length, 1); // 没有直接写到当前 Tty
  const sfmcBuffer = host.getBuffer(SFMC_WINDOW_ID);
  assert.equal(sfmcBuffer.length, 1);
  assert.ok(sfmcBuffer[0]?.includes("Building pack"));
  assert.ok(sfmcBuffer[0]?.includes("[PAK]"));
});
