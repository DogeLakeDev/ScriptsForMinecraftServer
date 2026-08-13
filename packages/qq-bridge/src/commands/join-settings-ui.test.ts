/**
 * commands/join-settings-ui.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJoinSettingsPanel,
  parseCfgInteractionData,
} from "./join-settings-ui.js";
import { renderOfficial } from "./render.js";

test("parseCfgInteractionData", () => {
  assert.deepEqual(parseCfgInteractionData("cfg:allowlist:off"), {
    field: "allowlist_enabled",
    value: false,
  });
  assert.deepEqual(parseCfgInteractionData("cfg:approval:on"), {
    field: "require_approval",
    value: true,
  });
  assert.equal(parseCfgInteractionData("join:approve:x"), null);
});

test("official 配置面板为 INTERACTION 回调按钮", () => {
  const panel = buildJoinSettingsPanel({
    settings: { allowlist_enabled: true, require_approval: false, treat_group_admins_as_admins: false },
    backend: "official",
    adminOpenids: ["admin1"],
  });
  assert.equal(panel.buttons?.length, 2);
  assert.equal(panel.buttons?.[0]?.actionType, 1);
  assert.equal(panel.buttons?.[0]?.command, "cfg:allowlist:off");
  assert.equal(panel.buttons?.[1]?.command, "cfg:approval:on");
  const rendered = renderOfficial(panel);
  assert.equal(rendered.msgType, 2);
  assert.equal(rendered.keyboardButtons?.[0]?.actionType, 1);
  assert.equal(rendered.keyboardButtons?.[0]?.data, "cfg:allowlist:off");
});

test("llbot 配置面板为文本命令编号", () => {
  const panel = buildJoinSettingsPanel({
    settings: { allowlist_enabled: false, require_approval: true },
    backend: "llbot",
  });
  assert.equal(panel.buttons?.[0]?.command, "配置 白名单 开");
  assert.equal(panel.buttons?.[1]?.command, "配置 审批 关");
  assert.equal(panel.buttons?.[0]?.actionType, undefined);
});
