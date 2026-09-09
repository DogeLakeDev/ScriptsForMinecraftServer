import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { clearConfigFieldCache, loadConfigFieldKeys } from "./config-fields.js";

test("loadConfigFieldKeys 优先读取 configs-default/<configKey>.json", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-eslint-config-fields-"));
  const sapi = path.join(root, "sapi");
  const source = path.join(sapi, "src", "index.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.join(root, "configs-default"), { recursive: true });
  fs.writeFileSync(
    path.join(sapi, "manifest.json"),
    JSON.stringify({ configKey: "demo", services: { provides: [], requires: [] } })
  );
  fs.writeFileSync(
    path.join(root, "configs-default", "demo.json"),
    JSON.stringify({ $schema: "schema.json", enabled: true, nested: {}, _internal: true })
  );
  fs.writeFileSync(source, "export {};\n");

  clearConfigFieldCache();
  const keys = loadConfigFieldKeys(source, root);
  assert.deepEqual([...(keys ?? [])].sort(), ["enabled", "nested"]);

  clearConfigFieldCache();
  fs.rmSync(root, { recursive: true, force: true });
});
