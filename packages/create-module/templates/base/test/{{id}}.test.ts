/**
 * test/{{id}}.test.ts — manifest / DESCRIPTOR
 *
 * pnpm test / npm test
 */

import { Command } from "@sfmc-bds/sdk/sapi/runtime";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

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
  assert.equal(Command.has("{{cmdName}}"), true);
  assert.equal(typeof DESCRIPTOR.lifecycle.registerEvents, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.init, "function");
  assert.equal(typeof DESCRIPTOR.lifecycle.cleanup, "function");
});

test("PERM / 命令名与 manifest.configKey 对齐", () => {
  const manifest = readManifest();
  assert.ok(manifest.configKey, "manifest.configKey 必填");
  assert.equal(PERM, `${manifest.configKey}.use`);
  assert.ok(
    Array.isArray(manifest.permissions) && manifest.permissions.includes(`config:read:${manifest.configKey}`),
    `manifest.permissions 应含 config:read:${manifest.configKey}`
  );
});

test("PERM 格式正确", () => {
  assert.match(PERM, /^[a-z][a-z0-9_]*\.use$/);
});
