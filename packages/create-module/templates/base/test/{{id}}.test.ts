/**
 * test/{{id}}.test.ts — 模块 lifecycle + 命令冒烟（假引擎）
 *
 * 跑法：npm test（SDK minecraft-loader + createSandbox）
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { assertMsg, createSandbox, runCleanup } from "@sfmc-bds/sdk/testing";

import { DESCRIPTOR, MODULE_ID, PERM } from "../sapi/src/index.js";

const MANIFEST_PATH = fileURLToPath(new URL("../sapi/manifest.json", import.meta.url));

function readManifest(): {
  id: string;
  configKey: string;
  permissions?: string[];
} {
  return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as {
    id: string;
    configKey: string;
    permissions?: string[];
  };
}

test("descriptor / MODULE_ID 与 sapi/manifest.json 一致", () => {
  const manifest = readManifest();
  assert.equal(DESCRIPTOR.id, MODULE_ID);
  assert.equal(MODULE_ID, manifest.id, "MODULE_ID 必须等于 manifest.id");
  assert.equal(DESCRIPTOR.id, manifest.id, "DESCRIPTOR.id 必须等于 manifest.id");
  assert.equal(MODULE_ID, "{{featureId}}");
  assert.equal(DESCRIPTOR.afterWorldLoad, false);
  assert.equal(typeof DESCRIPTOR.lifecycle.registerPermissions, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.registerCommands, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.registerEvents, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.init, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.cleanup, "function");
});

test("PERM / 命令名与 manifest.configKey 对齐", () => {
  const manifest = readManifest();
  assert.ok(manifest.configKey, "manifest.configKey 必填");
  assert.equal(PERM, `${manifest.configKey}.use`);
  assert.ok(
    Array.isArray(manifest.permissions) &&
      manifest.permissions.includes(`config:read:${manifest.configKey}`),
    `manifest.permissions 应含 config:read:${manifest.configKey}`
  );
});

test("createSandbox lifecycle 跑通", async (t) => {
  const sb = await createSandbox({ module: DESCRIPTOR });
  t.after(() => sb.dispose());
  assert.ok(sb.world);
  assert.ok(sb.system);
});

test("命令 {{cmdName}} 触发后，玩家收到 Msg.info", async (t) => {
  const sb = await createSandbox({ module: DESCRIPTOR });
  t.after(() => sb.dispose());
  const player = sb.addPlayer({ id: "tester-1", name: "tester", op: true });
  await sb.triggerCommand("{{cmdName}}", player);
  assert.ok(assertMsg(player, "{{readyMsg}}", "§"), "玩家 log 应含预期文本");
  assert.equal(player.log.length, 1);
  assert.match(player.log[0]!, /^§f\[\*\] /);
});

test("cleanup 不抛错", async () => {
  const r = await runCleanup(DESCRIPTOR);
  assert.equal(r.ok, true, `cleanup 抛出: ${r.error instanceof Error ? r.error.message : String(r.error)}`);
});

test("PERM 格式正确", () => {
  assert.match(PERM, /^[a-z][a-z0-9_]*\.use$/);
});
