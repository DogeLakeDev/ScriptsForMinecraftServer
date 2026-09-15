/** 声明式 UI 契约的最小高信号测试。 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileUiProject, validateUiScreen } from "../../dist/esm/validation/index.js";

function readJson(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8"));
}

const feature = readJson("../../schemas/examples/land-feature.ui.json");
const home = readJson("../../schemas/examples/screens/land-home.ui.json");
const detail = readJson("../../schemas/examples/screens/land-detail.ui.json");

test("示例工程通过结构与跨文件语义校验", () => {
  const result = compileUiProject({
    feature,
    screens: {
      "screens/land-home.ui.json": home,
      "screens/land-detail.ui.json": detail,
    },
    services: ["land.list", "land.get", "economy.account.get", "land.renew", "land.terminate"],
  });

  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join("\n"));
  if (!result.ok) return;
  assert.deepEqual([...result.value.screens.keys()], ["land.home", "land.detail"]);
});

test("校验器定位重复节点", () => {
  const invalid = structuredClone(home) as Record<string, unknown>;
  invalid.body = [
    { id: "same", type: "button", label: "A", trigger: { type: "action", action: "missing" } },
    { id: "same", type: "divider" },
  ];

  const structure = validateUiScreen(invalid);
  assert.equal(structure.ok, false);
  if (structure.ok) return;
  assert.ok(structure.issues.some((item) => item.code === "duplicate_id" && item.path === "/body/1/id"));
});

test("按钮 trigger 的空 action 仍通过页面结构校验（编辑中间态）", () => {
  const result = validateUiScreen(
    screenWithBody([
      { id: "go", type: "button", label: "退出", trigger: { type: "action", action: "" } },
    ]),
  );
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join("\n"));
});

test("编译阶段把空 action 标成语义问题，不把整个页面文件丢掉", () => {
  const emptyAction = structuredClone(home) as { body: unknown[] };
  emptyAction.body = [
    { id: "go", type: "button", label: "退出", trigger: { type: "action", action: "" } },
  ];

  const project = compileUiProject({
    feature,
    screens: {
      "screens/land-home.ui.json": emptyAction,
      "screens/land-detail.ui.json": detail,
    },
  });
  assert.equal(project.ok, false);
  if (project.ok) return;
  assert.ok(
    project.issues.some((item) => item.path.includes("/trigger/action")),
    project.errors.join("\n"),
  );
  assert.ok(
    !project.issues.some((item) => item.path === "/screens/0/file"),
    "空 action 不应导致页面文件被视为缺失",
  );
});

test("编译阶段定位未知动作", () => {
  const unknownAction = structuredClone(home) as { body: unknown[] };
  unknownAction.body = [
    {
      id: "unknown-action",
      type: "button",
      label: "调用不存在的动作",
      trigger: { type: "action", action: "missing" },
    },
  ];

  const project = compileUiProject({
    feature,
    screens: {
      "screens/land-home.ui.json": unknownAction,
      "screens/land-detail.ui.json": detail,
    },
  });
  assert.equal(project.ok, false);
  if (project.ok) return;
  assert.ok(project.issues.some((item) => item.code === "unknown_action"));
});

test("编译阶段拒绝 manifest 未声明的 service", () => {
  const result = compileUiProject({
    feature,
    screens: {
      "screens/land-home.ui.json": home,
      "screens/land-detail.ui.json": detail,
    },
    services: ["land.list"],
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((item) => item.code === "unknown_service"));
});

function screenWithBody(body: unknown[]): Record<string, unknown> {
  return {
    formatVersion: 1,
    id: "test.screen",
    presentation: "form",
    title: "测试",
    body,
  };
}

test("图像节点必须声明资源包 pack", () => {
  const missingPack = validateUiScreen(
    screenWithBody([
      { id: "banner", type: "image", source: "textures/ui/icon_recipe_nature" },
    ]),
  );
  assert.equal(missingPack.ok, false);
  if (missingPack.ok) return;
  assert.ok(missingPack.issues.some((item) => item.path === "/body/0/pack"));

  const withPack = validateUiScreen(
    screenWithBody([
      {
        id: "banner",
        type: "image",
        source: "textures/ui/icon_recipe_nature",
        pack: "vanilla",
      },
    ]),
  );
  assert.equal(withPack.ok, true, withPack.ok ? undefined : withPack.errors.join("\n"));
});

test("按钮声明 icon 时必须同时声明 iconPack", () => {
  const missingPack = validateUiScreen(
    screenWithBody([
      {
        id: "go",
        type: "button",
        label: "打开",
        icon: "textures/ui/icon_recipe_nature",
        trigger: { type: "close" },
      },
    ]),
  );
  assert.equal(missingPack.ok, false);
  if (missingPack.ok) return;
  assert.ok(missingPack.issues.some((item) => item.path === "/body/0/iconPack"));

  const withPack = validateUiScreen(
    screenWithBody([
      {
        id: "go",
        type: "button",
        label: "打开",
        icon: "textures/ui/icon_recipe_nature",
        iconPack: "vanilla",
        trigger: { type: "close" },
      },
    ]),
  );
  assert.equal(withPack.ok, true, withPack.ok ? undefined : withPack.errors.join("\n"));
});

test("输入控件的 disabledWhen 与 tooltip 会参与校验", () => {
  const base = {
    formatVersion: 1,
    id: "test.screen",
    presentation: "form",
    title: "测试",
    state: {
      name: { type: "string", default: "" },
      locked: { type: "boolean", default: false },
    },
  };

  const unknownRef = validateUiScreen({
    ...base,
    body: [
      {
        id: "name",
        type: "textField",
        label: "名称",
        bind: "state.name",
        disabledWhen: { ref: "state.missing" },
      },
    ],
  });
  assert.equal(unknownRef.ok, false);
  if (unknownRef.ok) return;
  assert.ok(unknownRef.issues.some((item) => item.path.startsWith("/body/0/disabledWhen")));

  const valid = validateUiScreen({
    ...base,
    body: [
      {
        id: "name",
        type: "textField",
        label: "名称",
        bind: "state.name",
        description: "输入框下方说明",
        tooltip: "悬停提示",
        placeholder: "当前玩家 {{player.name}}",
        disabledWhen: { ref: "state.locked" },
      },
      {
        id: "flag",
        type: "toggle",
        label: "开关",
        bind: "state.locked",
        tooltip: "开关提示",
        disabledWhen: { ref: "state.locked" },
      },
    ],
  });
  assert.equal(valid.ok, true, valid.ok ? undefined : valid.errors.join("\n"));
});

test("textField placeholder 按模板校验绑定路径", () => {
  const unknown = validateUiScreen({
    formatVersion: 1,
    id: "test.screen",
    presentation: "form",
    title: "测试",
    state: { name: { type: "string", default: "" } },
    body: [
      {
        id: "name",
        type: "textField",
        label: "名称",
        bind: "state.name",
        placeholder: "未声明 {{state.missing}}",
      },
    ],
  });
  assert.equal(unknown.ok, false);
  if (unknown.ok) return;
  assert.ok(unknown.issues.some((item) => item.path === "/body/0/placeholder"));
});

test("图像 width、下拉项 description、滑块 fixedFormatDigits 会参与校验", () => {
  const invalidWidth = validateUiScreen(
    screenWithBody([
      {
        id: "banner",
        type: "image",
        source: "textures/ui/icon.png",
        pack: "vanilla",
        width: -1,
      },
    ]),
  );
  assert.equal(invalidWidth.ok, false);
  if (invalidWidth.ok) return;
  assert.ok(invalidWidth.issues.some((item) => item.path === "/body/0/width"));

  const invalidDigits = validateUiScreen({
    formatVersion: 1,
    id: "test.screen",
    presentation: "form",
    title: "测试",
    state: { amount: { type: "number", default: 1 } },
    body: [
      {
        id: "amount",
        type: "slider",
        label: "数量",
        bind: "state.amount",
        min: 1,
        max: 10,
        fixedFormatDigits: -1,
      },
    ],
  });
  assert.equal(invalidDigits.ok, false);
  if (invalidDigits.ok) return;
  assert.ok(invalidDigits.issues.some((item) => item.path === "/body/0/fixedFormatDigits"));

  const valid = validateUiScreen({
    formatVersion: 1,
    id: "test.screen",
    presentation: "form",
    title: "测试",
    state: { choice: { type: "string", default: "a" }, amount: { type: "number", default: 1 } },
    body: [
      {
        id: "banner",
        type: "image",
        source: "textures/ui/icon.png",
        pack: "vanilla",
        width: 48,
        tooltip: "示例图",
        trigger: { type: "refresh" },
      },
      {
        id: "choice",
        type: "dropdown",
        label: "选项",
        bind: "state.choice",
        options: [{ label: "甲", value: "a", description: "第一项" }],
      },
      {
        id: "amount",
        type: "slider",
        label: "数量",
        bind: "state.amount",
        min: 1,
        max: 10,
        fixedFormatDigits: 0,
      },
    ],
  });
  assert.equal(valid.ok, true, valid.ok ? undefined : valid.errors.join("\n"));
});

test("confirm.challenge 空串通过结构校验，未知绑定与非字符串会报错", () => {
  const withEmpty = validateUiScreen({
    ...screenWithBody([{ id: "go", type: "button", label: "走", trigger: { type: "refresh" } }]),
    actions: {
      go: {
        confirm: { title: "确认", body: "正文", challenge: "" },
        call: { service: "mod.svc" },
      },
    },
  });
  assert.equal(withEmpty.ok, true, withEmpty.ok ? undefined : withEmpty.errors.join("\n"));

  const unknownBind = validateUiScreen({
    ...screenWithBody([{ id: "go", type: "button", label: "走", trigger: { type: "refresh" } }]),
    actions: {
      go: {
        confirm: { title: "确认", body: "正文", challenge: "{{params.missing}}" },
        call: { service: "mod.svc" },
      },
    },
  });
  assert.equal(unknownBind.ok, false);
  if (!unknownBind.ok) {
    assert.ok(
      unknownBind.issues.some(
        (item) => item.path === "/actions/go/confirm/challenge" && item.code === "unknown_reference",
      ),
    );
  }

  const notString = validateUiScreen({
    ...screenWithBody([{ id: "go", type: "button", label: "走", trigger: { type: "refresh" } }]),
    actions: {
      go: {
        confirm: { title: "确认", body: "正文", challenge: 1 },
        call: { service: "mod.svc" },
      },
    },
  });
  assert.equal(notString.ok, false);
  if (!notString.ok) {
    assert.ok(
      notString.issues.some(
        (item) => item.path === "/actions/go/confirm/challenge" && item.code === "invalid_type",
      ),
    );
  }
});

test("开关可绑定 each 条目字段并声明变更 trigger", () => {
  const result = validateUiScreen({
    formatVersion: 1,
    id: "test.channels",
    presentation: "reactive",
    title: "频道",
    load: { model: { service: "chat.ui.channels" } },
    actions: {
      setSubscribed: { call: { service: "chat.ui.setSubscribed" } },
    },
    body: [
      {
        id: "channels",
        type: "each",
        source: "data.model.items",
        as: "channel",
        template: [
          {
            id: "subscribed",
            type: "toggle",
            label: "订阅",
            bind: "channel.subscribed",
            trigger: {
              type: "action",
              action: "setSubscribed",
              input: { channelId: "{{channel.id}}" },
            },
          },
        ],
      },
    ],
  });
  assert.equal(result.ok, true, result.ok ? undefined : result.errors.join("\n"));
});

test("开关绑定 each 字段时必须位于对应循环内", () => {
  const result = validateUiScreen({
    formatVersion: 1,
    id: "test.channels",
    presentation: "form",
    title: "频道",
    body: [
      {
        id: "subscribed",
        type: "toggle",
        label: "订阅",
        bind: "channel.subscribed",
      },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((item) => item.path === "/body/0/bind"));
});

test("输入框仍不能绑定 each 条目字段", () => {
  const result = validateUiScreen({
    formatVersion: 1,
    id: "test.channels",
    presentation: "form",
    title: "频道",
    load: { model: { service: "chat.ui.channels" } },
    body: [
      {
        id: "channels",
        type: "each",
        source: "data.model.items",
        as: "channel",
        template: [
          {
            id: "name",
            type: "textField",
            label: "名称",
            bind: "channel.name",
          },
        ],
      },
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((item) => item.path.includes("/bind")));
});

test("发布的 JSON Schema 文件至少可被标准 JSON 解析", () => {
  const screenSchema = readJson("../../schemas/ui-screen.v1.schema.json") as Record<string, unknown>;
  const featureSchema = readJson("../../schemas/ui-feature.v1.schema.json") as Record<string, unknown>;
  assert.equal(screenSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(featureSchema.$schema, "https://json-schema.org/draft/2020-12/schema");
});

test("下拉 options 可声明 load 数据源", () => {
  const valid = validateUiScreen({
    formatVersion: 1,
    id: "test.compose",
    presentation: "form",
    title: "私聊",
    state: { targetId: { type: "string", default: "" } },
    load: { players: { service: "chat.ui.onlinePlayers" } },
    body: [
      {
        id: "target",
        type: "dropdown",
        label: "目标玩家",
        bind: "state.targetId",
        options: {
          source: "data.players.items",
          as: "player",
          value: "{{player.id}}",
          label: "{{player.name}}",
        },
      },
    ],
  });
  assert.equal(valid.ok, true, valid.ok ? undefined : valid.errors.join("\n"));

  const unknown = validateUiScreen({
    formatVersion: 1,
    id: "test.compose",
    presentation: "form",
    title: "私聊",
    state: { targetId: { type: "string", default: "" } },
    load: { players: { service: "chat.ui.onlinePlayers" } },
    body: [
      {
        id: "target",
        type: "dropdown",
        label: "目标玩家",
        bind: "state.targetId",
        options: {
          source: "data.missing.items",
          as: "player",
          value: "{{player.id}}",
          label: "{{player.name}}",
        },
      },
    ],
  });
  assert.equal(unknown.ok, false);
  if (unknown.ok) return;
  assert.ok(unknown.issues.some((item) => item.path === "/body/0/options/source"));
});
