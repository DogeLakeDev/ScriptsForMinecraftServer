/**
 * terminal-progress / bindByteProgressToBar 契约测试
 * 从 @sfmc-bds/sdk/logs 导入权威实现（需 workspace build）。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Writable } from "node:stream";
import {
  bindByteProgressToBar,
  createTerminalProgress,
  pauseAllProgress,
  resumeAllProgress,
} from "@sfmc-bds/sdk/logs";

describe("progress pause/resume contract (registry)", () => {
  it("嵌套 pause 只在最外层 resume 时重绘", () => {
    let writes = 0;
    const stream = new Writable({
      write(_chunk, _e, cb) {
        writes++;
        cb();
      },
    });
    const bar = createTerminalProgress({ stream, forceBar: true });
    bar.start(10, 0, { speed: "0 KB/s" });
    const afterStart = writes;
    assert.ok(afterStart >= 1, "start 应至少绘制一次");

    pauseAllProgress();
    const afterOuterPause = writes;
    assert.ok(afterOuterPause > afterStart, "外层 pause 应清行");

    pauseAllProgress();
    assert.equal(writes, afterOuterPause, "嵌套 pause 不应再写流");

    /* 嵌套 pause：内层 resume 不应重绘（pausedDepth 仍 >0） */
    resumeAllProgress();
    assert.equal(writes, afterOuterPause, "内层 resume 不应重绘");
    assert.equal(bar.active, true);

    resumeAllProgress();
    assert.ok(writes > afterOuterPause, "最外层 resume 应重绘");
    assert.equal(bar.active, true);
    bar.stop();
  });
});

describe("bindByteProgressToBar LSP（未知总量→已知）", () => {
  it("无 Content-Length 中途 total=0，finish 补总量时 setTotal 修正刻度", () => {
    const starts = [];
    const setTotals = [];
    const updates = [];
    const bar = {
      active: true,
      start(total, value = 0, payload) {
        starts.push({ total, value, payload });
      },
      setTotal(total) {
        setTotals.push(total);
      },
      update(value, payload) {
        updates.push({ value, payload });
      },
      stop() {},
    };
    const seen = [];
    const onByte = bindByteProgressToBar(bar, {
      speedSampleMs: 0,
      onProgress: (dl, total) => seen.push([dl, total]),
    });

    /* 中途无 Content-Length：首帧 startValue=已下载量 */
    onByte(512 * 1024, 0);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].total, 1); /* 占位 1MB */
    assert.equal(starts[0].value, 0.5, "首帧 startValue 须反映已下载字节");
    assert.equal(updates.length, 1, "首帧须 update");
    assert.equal(updates[0].value, 0.5);
    assert.equal(seen[0][0], 512 * 1024);
    assert.equal(seen[0][1], 0);

    /* finish：用 finalBytes 作总量（与 httpDownload LSP 契约一致） */
    const finalBytes = 5 * 1024 * 1024;
    onByte(finalBytes, finalBytes);
    assert.equal(starts.length, 1, "已知总量后不得再 start");
    assert.equal(setTotals.length, 1, "总量从未知变为已知时应 setTotal");
    assert.equal(setTotals[0], 5);
    assert.equal(updates.length, 2, "setTotal 后仍须 update");
    assert.equal(updates[1].value, 5);
    assert.deepEqual(seen[1], [finalBytes, finalBytes]);
  });

  it("一开始就有 Content-Length 时不重复 start/setTotal，且首帧带已下载量", () => {
    const starts = [];
    const setTotals = [];
    const updates = [];
    const bar = {
      active: true,
      start(total, value = 0) {
        starts.push({ total, value });
      },
      setTotal(total) {
        setTotals.push(total);
      },
      update(value) {
        updates.push(value);
      },
      stop() {},
    };
    const onByte = bindByteProgressToBar(bar, { speedSampleMs: 0 });
    onByte(1024, 10 * 1024 * 1024);
    onByte(2 * 1024 * 1024, 10 * 1024 * 1024);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].total, 10);
    assert.ok(starts[0].value > 0, "首帧 startValue > 0");
    assert.equal(setTotals.length, 0, "一开始已知总量时不应 setTotal");
    assert.equal(updates.length, 2);
    assert.ok(updates[0] > 0);
  });

  it("createTerminalProgress 非 TTY：start 尊重 startValue；setTotal 后 update 出正确刻度", () => {
    const logs = [];
    const stream = new Writable({
      write(_chunk, _e, cb) {
        cb();
      },
    });
    /* forceBar:false + logger → 非 TTY 路径 */
    const bar = createTerminalProgress({
      stream,
      forceBar: false,
      logger: (m) => logs.push(m),
    });
    bar.start(5, 5, { speed: "1 MB/s" });
    assert.ok(logs.length >= 1);
    assert.match(logs[0], /100%/);
    assert.match(logs[0], /5(?:\.0)?\/5/);

    logs.length = 0;
    /* 占位刻度 → setTotal 修正后由 update 打一条，勿虚假 0% */
    const bar2 = createTerminalProgress({
      stream,
      forceBar: false,
      logger: (m) => logs.push(m),
    });
    bar2.start(1, 0.5, { speed: "0 B/s" });
    assert.match(logs[0], /50%/);
    logs.length = 0;
    bar2.setTotal(5);
    assert.equal(logs.length, 0, "setTotal 本身不打日志（留给 update）");
    bar2.update(5, { speed: "1 MB/s" });
    assert.equal(logs.length, 1);
    assert.match(logs[0], /100%/);
    assert.match(logs[0], /5(?:\.0)?\/5/);
    bar.stop();
    bar2.stop();
  });

  it("binder+非 TTY：首帧不出现虚假 0%，finish 经 setTotal 收 100%", () => {
    const logs = [];
    const stream = new Writable({
      write(_chunk, _e, cb) {
        cb();
      },
    });
    const bar = createTerminalProgress({
      stream,
      forceBar: false,
      logger: (m) => logs.push(m),
    });
    const onByte = bindByteProgressToBar(bar, { speedSampleMs: 0 });
    onByte(512 * 1024, 0);
    assert.ok(logs.length >= 1);
    assert.ok(!logs.some((m) => /^进度 0%/.test(m)), "首帧不得虚假 0%");
    assert.match(logs[0], /50%/);

    logs.length = 0;
    const finalBytes = 5 * 1024 * 1024;
    onByte(finalBytes, finalBytes);
    assert.ok(logs.some((m) => /100%/.test(m)));
    bar.stop();
  });

  it("createTerminalProgress + binder 在 forceBar 下可跑通收尾", () => {
    const chunks = [];
    const stream = new Writable({
      write(chunk, _e, cb) {
        chunks.push(String(chunk));
        cb();
      },
    });
    const bar = createTerminalProgress({ stream, forceBar: true });
    const onByte = bindByteProgressToBar(bar, { speedSampleMs: 0 });
    onByte(100, 0);
    onByte(2048, 2048);
    bar.stop();
    assert.ok(chunks.length > 0);
  });
});
