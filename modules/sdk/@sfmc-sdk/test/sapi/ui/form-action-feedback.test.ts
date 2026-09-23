import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formFeedbackKind,
  formFeedbackRebuildsStatus,
  formFeedbackRoute,
  presentFormStatus,
} from "../../../src/sapi/ui/form-action-feedback.ts";

describe("form-action-feedback", () => {
  it("danger/success 映射到失败与成功状态行", () => {
    assert.equal(formFeedbackKind("danger"), "fail");
    assert.equal(formFeedbackKind("success"), "ok");
    assert.equal(formFeedbackKind("warning"), "info");
    assert.equal(formFeedbackKind(undefined), "info");
  });

  it("含 close 时走聊天，否则走表单状态行", () => {
    assert.equal(
      formFeedbackRoute([
        { effect: "message", text: "已切换" },
        { effect: "close" },
      ]),
      "chat",
    );
    assert.equal(
      formFeedbackRoute([{ effect: "message", text: "发送失败", tone: "danger" }]),
      "form",
    );
    assert.equal(
      formFeedbackRoute([
        { effect: "message", text: "存款成功", tone: "success" },
        { effect: "refresh" },
      ]),
      "form",
    );
  });

  it("刷新或跳转会换掉当前 FormStatus，需要挂到新页面", () => {
    assert.equal(
      formFeedbackRebuildsStatus([{ effect: "refresh" }]),
      true,
    );
    assert.equal(
      formFeedbackRebuildsStatus([{ effect: "replace", to: "chat.private" }]),
      true,
    );
    assert.equal(
      formFeedbackRebuildsStatus([{ effect: "message", text: "失败" }]),
      false,
    );
    assert.equal(
      formFeedbackRebuildsStatus([
        { effect: "message", text: "已发送" },
        { effect: "close" },
      ]),
      false,
    );
  });

  it("presentFormStatus 按 tone 写入状态行", () => {
    const calls: string[] = [];
    const status = {
      ok: (message: string) => calls.push(`ok:${message}`),
      fail: (message: string) => calls.push(`fail:${message}`),
      info: (message: string) => calls.push(`info:${message}`),
    };
    presentFormStatus(status, "发送失败：消息为空或过长。", "danger");
    presentFormStatus(status, "已保存", "success");
    presentFormStatus(status, "请稍候", "muted");
    assert.deepEqual(calls, [
      "fail:发送失败：消息为空或过长。",
      "ok:已保存",
      "info:请稍候",
    ]);
  });
});
