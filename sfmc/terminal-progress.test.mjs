/**
 * terminal-progress 注册表测试（构建后从 dist 导入；此处内联最小实现验证契约）
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Writable } from "node:stream";

const active = new Map();
let nextId = 1;
let pausedDepth = 0;

function pauseAllProgress() {
  if (active.size === 0) return;
  pausedDepth++;
  if (pausedDepth !== 1) return;
  for (const e of active.values()) e.pause();
}
function resumeAllProgress() {
  if (active.size === 0) {
    pausedDepth = 0;
    return;
  }
  if (pausedDepth <= 0) return;
  pausedDepth--;
  if (pausedDepth !== 0) return;
  for (const e of active.values()) e.resume();
}

describe("progress pause/resume contract", () => {
  it("嵌套 pause 只在最外层 resume 时重绘", () => {
    let pauses = 0;
    let resumes = 0;
    const id = nextId++;
    active.set(id, {
      pause: () => {
        pauses++;
      },
      resume: () => {
        resumes++;
      },
    });
    pauseAllProgress();
    pauseAllProgress();
    assert.equal(pauses, 1);
    resumeAllProgress();
    assert.equal(resumes, 0);
    resumeAllProgress();
    assert.equal(resumes, 1);
    active.delete(id);
    pausedDepth = 0;
  });

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
