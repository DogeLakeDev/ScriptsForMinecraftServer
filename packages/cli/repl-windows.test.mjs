// @ts-check
/**
 * repl-windows.test.mjs — WindowHost / ServiceWindow / formatLogDisplay / disk logs
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { formatLogDisplay, logDisplayPrefixWidth } from "./dist/repl-windows/format-display.js";
import { WindowHost, serviceWindowId } from "./dist/repl-windows/host.js";
import { createLogsFilterWindow } from "./dist/repl-windows/logs-filter-window.js";
import { createServiceWindow } from "./dist/repl-windows/service-window.js";
import {
  diskFileForSource,
  formatLog,
  logPrefixWidth,
  parseDiskLogLine,
  readDiskLogs,
  visibleWidth,
} from "./dist/logs.js";
import { plainPrompt } from "./dist/send-target.js";

function makeLog(source, level = "info", text = "hello") {
  return { time: new Date(0), source, level, text };
}

test("WindowHost cycle/open/back", () => {
  const lines = [];
  const host = new WindowHost({ writeLog: (l) => lines.push(l) });
  host.register(createServiceWindow("bds"));
  host.register(createServiceWindow("db"));
  host.register(
    createLogsFilterWindow({
      getState: () => ({ levels: [], sources: [] }),
      setState: () => {},
      onFilterChanged: () => {},
    })
  );
  host.setServiceOrder([serviceWindowId("bds"), serviceWindowId("db")]);
  assert.equal(host.getActive()?.serviceName, "bds");

  assert.equal(host.cycleServiceWindows(), "db");
  assert.equal(host.getActive()?.serviceName, "db");
  assert.equal(host.cycleServiceWindows(), "bds");

  assert.ok(host.open("logs"));
  assert.equal(host.isLogsActive(), true);
  assert.equal(host.getChrome().showsInput, false);
  assert.ok(host.back());
  assert.equal(host.getActive()?.serviceName, "bds");
});

test("ServiceWindow.acceptLog 仅同 source", () => {
  const win = createServiceWindow("db");
  assert.equal(win.acceptLog(makeLog("db")), true);
  assert.equal(win.acceptLog(makeLog("bds")), false);
  const { text } = win.formatLogLine(makeLog("db", "info", "x"));
  assert.ok(!text.includes("[DB"), "服务窗展示应省略源标签");
  assert.ok(text.includes("[INF]"));
});

test("formatLogDisplay omitSource 宽度与落盘 formatLog 分离", () => {
  const log = makeLog("bds", "warn", "body");
  const disk = formatLog(log);
  const tty = formatLogDisplay(log, { omitSource: true });
  assert.ok(disk.includes("[BDS]") || disk.includes("BDS"), "落盘/全量格式仍带源");
  assert.ok(!tty.includes("[BDS]") && !tty.includes("[BDS"), "omitSource 无源标签");
  const wOmit = logDisplayPrefixWidth(log, { omitSource: true });
  const wFull = logDisplayPrefixWidth(log, { omitSource: false });
  assert.ok(wFull > wOmit);
  assert.equal(typeof logPrefixWidth(log), "number");
  assert.ok(visibleWidth(tty) >= wOmit);
});

test("LogsFilterWindow L/S/Esc", () => {
  let state = { levels: [], sources: [] };
  let changed = 0;
  const win = createLogsFilterWindow({
    getState: () => state,
    setState: (n) => {
      state = n;
    },
    onFilterChanged: () => {
      changed++;
    },
  });
  assert.equal(win.showsInput, false);
  assert.equal(win.acceptLog(makeLog("bds", "error")), true);
  win.onKey({ type: "char", ch: "l" });
  assert.deepEqual(state.levels, ["info"]);
  assert.equal(changed, 1);
  assert.equal(win.acceptLog(makeLog("bds", "error")), false);
  assert.equal(win.onKey({ type: "escape" }).action, "back");
});

test("WindowHost 缓冲：切窗保留缓存，routeLog 扇出到已 seed 窗", () => {
  const tty = [];
  const host = new WindowHost({ writeLog: (l) => tty.push(l) });
  host.register(createServiceWindow("bds"));
  host.register(createServiceWindow("db"));
  host.setServiceOrder([serviceWindowId("bds"), serviceWindowId("db")]);

  host.setBuffer(serviceWindowId("bds"), ["bds-seed"]);
  host.setBuffer(serviceWindowId("db"), ["db-seed"]);

  host.routeLog(makeLog("bds", "info", "live-bds"));
  host.routeLog(makeLog("db", "info", "live-db"));

  assert.equal(tty.length, 1, "仅活动窗 bds 刷 TTY");
  assert.ok(host.getBuffer(serviceWindowId("bds")).some((l) => l.includes("live-bds") || l.length > 0));
  assert.ok(host.getBuffer(serviceWindowId("db")).length >= 1);

  assert.equal(host.cycleServiceWindows(), "db");
  assert.deepEqual([...host.getBuffer(serviceWindowId("bds"))].slice(0, 1), ["bds-seed"]);
  assert.ok(host.hasBuffer(serviceWindowId("db")));
});

test("plainPrompt 无斜杠", () => {
  const p = plainPrompt();
  assert.ok(!p.includes("/"), `prompt should not contain slash: ${JSON.stringify(p)}`);
  assert.ok(p.includes("❯"));
});

test("parseDiskLogLine / readDiskLogs 从文件拉取", () => {
  assert.equal(diskFileForSource("update"), "bds-update");
  assert.equal(diskFileForSource("system"), "sfmc");

  const parsed = parseDiskLogLine("2026-07-28 01:02:03 [db] [ERROR] boom");
  assert.ok(parsed);
  assert.equal(parsed.source, "db");
  assert.equal(parsed.level, "error");
  assert.equal(parsed.text, "boom");
  assert.equal(parseDiskLogLine("not a log"), null);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-read-disk-"));
  try {
    fs.writeFileSync(
      path.join(dir, "db.log"),
      "2026-07-28 01:02:03 [db] [INFO] a\n2026-07-28 01:02:05 [db] [WARN] b\n",
      "utf8"
    );
    fs.writeFileSync(path.join(dir, "bds.log"), "2026-07-28 01:02:04 [bds] [INFO] mid\n", "utf8");
    const all = readDiskLogs({ dir });
    assert.equal(all.length, 3);
    assert.equal(all[0].text, "a");
    assert.equal(all[1].text, "mid");
    assert.equal(all[2].text, "b");
    const onlyErr = readDiskLogs({ dir, levels: ["warn"], sources: ["db"] });
    assert.equal(onlyErr.length, 1);
    assert.equal(onlyErr[0].text, "b");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
