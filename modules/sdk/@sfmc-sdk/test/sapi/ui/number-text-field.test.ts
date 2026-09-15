import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  bindNumberTextField,
  formatNumberFieldText,
  parseNumberFieldText,
} from "../../../src/sapi/ui/number-text-field.ts";

type MockNum = {
  getData(): number;
  setData(value: number): void;
  subscribe(callback: (value: number) => void): (value: number) => void;
};

type MockStr = {
  getData(): string;
  setData(value: string): void;
  subscribe(callback: (value: string) => void): (value: string) => void;
};

function mockNum(initial: number): MockNum {
  let value = initial;
  const listeners = new Set<(value: number) => void>();
  return {
    getData: () => value,
    setData: (next) => {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener(next);
    },
    subscribe: (callback) => {
      listeners.add(callback);
      return callback;
    },
  };
}

function mockStr(initial: string): MockStr {
  let value = initial;
  const listeners = new Set<(value: string) => void>();
  return {
    getData: () => value,
    setData: (next) => {
      if (next === value) return;
      value = next;
      for (const listener of listeners) listener(next);
    },
    subscribe: (callback) => {
      listeners.add(callback);
      return callback;
    },
  };
}

describe("number textField 与 slider 共用数字绑定", () => {
  it("解析合法数字并夹到 min/max，输入中途不打断", () => {
    assert.equal(formatNumberFieldText(12), "12");
    assert.equal(parseNumberFieldText("12", { min: 1, max: 100, step: 1 }), 12);
    assert.equal(parseNumberFieldText("0", { min: 1, max: 100, step: 1 }), 1);
    assert.equal(parseNumberFieldText("999", { min: 1, max: 100, step: 1 }), 100);
    assert.equal(parseNumberFieldText(""), undefined);
    assert.equal(parseNumberFieldText("1."), undefined);
    assert.equal(parseNumberFieldText("abc"), undefined);
  });

  it("滑块改数字会写回输入框，输入框改合法数字会写回滑块", () => {
    const amount = mockNum(1);
    const typed = mockStr("1");
    bindNumberTextField(amount, typed, { min: 1, max: 10000, step: 1 });

    amount.setData(8);
    assert.equal(typed.getData(), "8");

    typed.setData("25");
    assert.equal(amount.getData(), 25);

    typed.setData("");
    assert.equal(amount.getData(), 25);
    assert.equal(typed.getData(), "");
  });
});
