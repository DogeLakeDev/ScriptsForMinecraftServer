/**
 * terminal-progress / bindByteProgressToBar 契约测试
 * 从 @sfmc-bds/sdk/logs 导入权威实现（需 workspace build）。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Writable } from "node:stream";
import { bindByteProgressToBar, createTerminalProgress } from "@sfmc-bds/sdk/logs";

describe("progress pause/resume contract (registry)", () => {
  it("Writable 可接收进度输出", () => {
    const chunks = [];
    const stream = new Writable({
      write(chunk, _e, cb) {
        chunks.push(String(chunk));
        cb();
      },
    });
    stream.write("progress-line\n");
    assert.ok(chunks[0].includes("progress"));
  });
});

describe("bindByteProgressToBar LSP（未知总量→已知）", () => {
  it("无 Content-Length 中途 total=0，finish 补总量时重设 bar 刻度", () => {
    const starts = [];
    const updates = [];
    const bar = {
      active: true,
      start(total, value = 0, payload) {
        starts.push({ total, value, payload });
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

    /* 中途无 Content-Length */
    onByte(512 * 1024, 0);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].total, 1); /* 占位 1MB */
    assert.equal(seen[0][0], 512 * 1024);
    assert.equal(seen[0][1], 0);

    /* finish：用 finalBytes 作总量（与 httpDownload LSP 契约一致） */
    const finalBytes = 5 * 1024 * 1024;
    onByte(finalBytes, finalBytes);
    assert.equal(starts.length, 2, "总量从未知变为已知时应重 start");
    assert.equal(starts[1].total, 5);
    assert.equal(starts[1].value, 5);
    assert.deepEqual(seen[1], [finalBytes, finalBytes]);
  });

  it("一开始就有 Content-Length 时不重复 start", () => {
    const starts = [];
    const bar = {
      active: true,
      start(total, value = 0) {
        starts.push({ total, value });
      },
      update() {},
      stop() {},
    };
    const onByte = bindByteProgressToBar(bar, { speedSampleMs: 0 });
    onByte(1024, 10 * 1024 * 1024);
    onByte(2 * 1024 * 1024, 10 * 1024 * 1024);
    assert.equal(starts.length, 1);
    assert.equal(starts[0].total, 10);
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
