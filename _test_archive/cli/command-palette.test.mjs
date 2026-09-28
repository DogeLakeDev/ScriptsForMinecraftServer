// @ts-check
/**
 * command-palette 补全器单测
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clipPad,
  commitSelection,
  findMatchRange,
  matchWeight,
  PANEL_WIDTH,
  parseSlashLine,
  paletteGhost,
  resolvePaletteView,
} from "../../packages/cli/dist/command-palette.js";
import { visibleWidth } from "../../packages/cli/dist/logs.js";
import { listNextPaletteTokens, listPaletteRoots } from "../../packages/cli/dist/command-surface.js";

describe("clipPad 等宽", () => {
  it("垫到 PANEL_WIDTH", () => {
    assert.equal(visibleWidth(clipPad("/start", PANEL_WIDTH)), PANEL_WIDTH);
  });
});

describe("parseSlashLine", () => {
  it("/st → partial", () => {
    assert.deepEqual(parseSlashLine("/st"), {
      committed: [],
      partial: "st",
      trailingSpace: false,
    });
  });
  it("/start  → committed", () => {
    assert.deepEqual(parseSlashLine("/start "), {
      committed: ["start"],
      partial: "",
      trailingSpace: true,
    });
  });
  it("/start b → 子 partial", () => {
    assert.deepEqual(parseSlashLine("/start b"), {
      committed: ["start"],
      partial: "b",
      trailingSpace: false,
    });
  });
});

describe("resolvePaletteView", () => {
  it("仅 / 时单列且含多项", () => {
    const v = resolvePaletteView("/", [0], [0]);
    assert.equal(v.columns.length, 1);
    assert.ok(v.columns[0].items.length > 1);
  });
  it("/start 展开右侧且主列仍显示全部根", () => {
    const v = resolvePaletteView("/start ", [0], [0]);
    assert.ok(v.columns.length >= 2);
    assert.ok(v.columns[0].items.length > 1);
    assert.ok(v.columns[1].items.some((n) => n.token === "bds"));
  });
  it("/st 不删项，匹配置顶", () => {
    const all = listPaletteRoots("repl").length;
    const v = resolvePaletteView("/st", [0], [0]);
    assert.equal(v.columns[0].items.length, all);
    assert.ok(v.columns[0].items[0].token.startsWith("st"));
    assert.ok(matchWeight(v.columns[0].items[0], "st") > 0);
  });
  it("/send bds  自由参关闭面板", () => {
    const v = resolvePaletteView("/send bds ", [0], [0]);
    assert.equal(v.hidden, true);
  });
  it("/send bds 后继续打字仍关闭面板", () => {
    const v = resolvePaletteView("/send bds say hi", [0], [0]);
    assert.equal(v.hidden, true);
  });
  it("叶命令 /status 到末尾立即关闭", () => {
    assert.equal(resolvePaletteView("/status", [0], [0]).hidden, true);
  });
  it("叶命令 /start bds 到末尾立即关闭", () => {
    assert.equal(resolvePaletteView("/start bds", [0], [0]).hidden, true);
  });
  it("/ui 展开 studio 与 stop", () => {
    const v = resolvePaletteView("/ui ", [0], [0]);
    assert.equal(v.hidden, false);
    const tokens = v.columns.at(-1).items.map((n) => n.token);
    assert.deepEqual(tokens, ["studio", "stop"]);
  });
  it("/packs doctor 展开实验性开关", () => {
    const v = resolvePaletteView("/packs doctor ", [0], [0]);
    assert.equal(v.hidden, false);
    const tokens = v.columns.at(-1).items.map((n) => n.token);
    assert.ok(tokens.includes("--fix"));
    assert.ok(tokens.includes("--all-experiments"));
    assert.ok(tokens.includes("--experiments="));
    assert.ok(tokens.includes(""));
  });
  it("doctor 直接运行提交无参命令", () => {
    const v = resolvePaletteView("/packs doctor ", [0], [0]);
    const col = v.columns.at(-1);
    const idx = col.items.findIndex((n) => n.token === "");
    const view = resolvePaletteView("/packs doctor ", [0, 0, idx], [0, 0, 0]);
    const acc = commitSelection("/packs doctor ", view);
    assert.equal(acc.line, "/packs doctor");
    assert.equal(acc.submit, true);
  });
  it("--experiments= 粘在同一 token 上且随后收起面板", () => {
    const v0 = resolvePaletteView("/packs doctor ", [0], [0]);
    const idx = v0.columns.at(-1).items.findIndex((n) => n.token === "--experiments=");
    const view = resolvePaletteView("/packs doctor ", [0, 0, idx], [0, 0, 0]);
    const acc = commitSelection("/packs doctor ", view);
    assert.equal(acc.line, "/packs doctor --experiments=");
    assert.equal(acc.submit, false);
    assert.equal(resolvePaletteView("/packs doctor --experiments=beta,upcoming", [0], [0]).hidden, true);
  });
  it("灰字补全与面板共用 ui / doctor 的下一参", () => {
    assert.deepEqual(listNextPaletteTokens(["ui"]), ["studio", "stop"]);
    const doctor = listNextPaletteTokens(["packs", "doctor"]);
    assert.ok(doctor?.includes("--all-experiments"));
    assert.ok(doctor?.includes("--fix"));
    assert.equal(doctor?.includes(""), false);
  });
  it("未到末尾 /start 仍显示", () => {
    assert.equal(resolvePaletteView("/start", [0], [0]).hidden, false);
    assert.ok(resolvePaletteView("/start", [0], [0]).columns.length >= 1);
  });
  it("半词 /st 未到末尾仍显示", () => {
    assert.equal(resolvePaletteView("/st", [0], [0]).hidden, false);
  });
});

describe("commitSelection", () => {
  it("选 start → 写入并补空格，不提交", () => {
    const roots = listPaletteRoots("repl");
    const startIdx = roots.findIndex((n) => n.token === "start");
    const view = resolvePaletteView("/", [startIdx], [0]);
    const acc = commitSelection("/", view);
    assert.equal(acc.line, "/start ");
    assert.equal(acc.submit, false);
  });
  it("选 status → 写入无空格，不提交", () => {
    const roots = listPaletteRoots("repl");
    const idx = roots.findIndex((n) => n.token === "status");
    const view = resolvePaletteView("/", [idx], [0]);
    const acc = commitSelection("/", view);
    assert.equal(acc.line, "/status");
    assert.equal(acc.submit, false);
  });
  it("再次回车 status → 提交", () => {
    const view = resolvePaletteView("/status", [0], [0]);
    const acc = commitSelection("/status", view);
    assert.equal(acc.submit, true);
  });
  it("子列 bds → 写入不执行", () => {
    const v0 = resolvePaletteView("/start ", [0, 0], [0, 0]);
    const bdsIdx = v0.columns[1].items.findIndex((n) => n.token === "bds");
    const view = resolvePaletteView("/start ", [0, bdsIdx], [0, 0]);
    const acc = commitSelection("/start ", view);
    assert.equal(acc.line, "/start bds");
    assert.equal(acc.submit, false);
  });
});

describe("paletteGhost", () => {
  it("partial st 置顶项给出后缀灰字", () => {
    const view = resolvePaletteView("/st", [0], [0]);
    const top = view.columns[0].items[0].token;
    assert.ok(top.startsWith("st"));
    assert.equal(paletteGhost(view), top.slice(2));
  });
});

describe("findMatchRange", () => {
  it("匹配 label 前缀", () => {
    assert.deepEqual(findMatchRange("/start", "st"), { start: 1, end: 3 });
    assert.equal(findMatchRange("/status", "xyz"), null);
  });
});
