import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  customFormButtonImageDetails,
  customFormButtonLabel,
  customFormButtonTooltip,
  customFormDropdownItems,
  customFormFieldOptions,
  customFormImageArgs,
  customFormImageOptions,
} from "../../../src/sapi/ui/ddui-widgets.ts";
import { resolveDisabledControl } from "../../../src/sapi/ui/disabled-when.ts";

type MockBool = {
  getData(): boolean;
  setData(value: boolean): void;
  subscribe(callback: (value: boolean) => void): (value: boolean) => void;
};

function mockBool(initial: boolean): MockBool {
  let value = initial;
  const listeners = new Set<(value: boolean) => void>();
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

describe("SDK DDUI 字段映射", () => {
  it("图像与按钮图标只有在资源和 pack 齐全时生成", () => {
    assert.equal(customFormImageArgs({ source: "icon" }), undefined);
    assert.deepEqual(customFormImageArgs({ source: "icon", pack: "pack" }), {
      src: "icon",
      pack: "pack",
    });
    assert.equal(customFormButtonImageDetails({ icon: "icon" }), undefined);
    assert.deepEqual(
      customFormButtonImageDetails({ icon: "icon", iconPack: "pack" }),
      { imageSrc: "icon", imagePackId: "pack" },
    );
  });

  it("按钮 tone 使用可见标记，并保留 tooltip 回退", () => {
    assert.equal(customFormButtonLabel("删除", "danger"), "✘ 删除");
    assert.equal(/§/.test(customFormButtonLabel("删除", "danger")), false);
    assert.equal(
      customFormButtonTooltip({ description: "说明" }),
      "说明",
    );
  });

  it("输入、图像和下拉选项映射为 DDUI 参数", () => {
    assert.deepEqual(
      customFormFieldOptions({ description: "说明", fixedFormatDigits: 0 }),
      { description: "说明", fixedFormatDigits: 0 },
    );
    assert.deepEqual(customFormImageOptions({ width: -1, tooltip: "图标" }), {
      tooltip: "图标",
    });
    assert.deepEqual(
      customFormDropdownItems([{ label: "甲", description: "第一项" }]),
      [{ label: "甲", value: 0, description: "第一项" }],
    );
  });
});

describe("SDK disabledWhen 响应式状态", () => {
  it("直接引用 state 布尔时复用原 Observable", () => {
    const locked = mockBool(false);
    const control = resolveDisabledControl(
      { ref: "state.locked" },
      {
        derivedDefs: {},
        getStateBoolean: (name) => (name === "locked" ? locked : undefined),
        subscribeState: () => undefined,
        evaluate: () => locked.getData(),
        createDerived: (initial) => mockBool(initial),
      },
    );
    assert.equal(control, locked);
  });

  it("derived 依赖的 state 变化会更新禁用状态", () => {
    const locked = mockBool(false);
    const control = resolveDisabledControl(
      { op: "not", args: [{ ref: "derived.canEdit" }] },
      {
        derivedDefs: {
          canEdit: { op: "not", args: [{ ref: "state.locked" }] },
        },
        getStateBoolean: (name) => (name === "locked" ? locked : undefined),
        subscribeState: (name, callback) => {
          if (name === "locked") locked.subscribe(callback);
        },
        evaluate: () => locked.getData(),
        createDerived: (initial) => mockBool(initial),
      },
    );
    assert.ok(control);
    assert.equal(control.getData(), false);
    locked.setData(true);
    assert.equal(control.getData(), true);
  });
});

