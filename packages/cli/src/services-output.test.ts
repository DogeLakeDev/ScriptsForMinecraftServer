/**
 * 子进程日志入口契约：纯空白行不能进入统一日志并被包装成 [INF]。
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nonBlankOutputLines } from "./services.js";

describe("子进程输出分行", () => {
  it("过滤 LF、CRLF 与纯空白行，保留真实日志内容", () => {
    assert.deepEqual(nonBlankOutputLines("first\r\n\r\n  \r\nsecond\r\n"), ["first", "second"]);
  });
});
