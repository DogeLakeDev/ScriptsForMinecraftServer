import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { ensureEmitServerTelemetry } from "./dist/server-properties.js";

test("ensureEmitServerTelemetry appends when missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-props-"));
  const file = path.join(dir, "server.properties");
  fs.writeFileSync(file, "level-name=Bedrock level\n", "utf8");
  const msgs = [];
  const wrote = ensureEmitServerTelemetry(dir, { info: (m) => msgs.push(m) });
  assert.equal(wrote, true);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /^emit-server-telemetry=true$/m);
  assert.match(msgs[0] ?? "", /EULA/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("ensureEmitServerTelemetry skips when present", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sfmc-props-"));
  const file = path.join(dir, "server.properties");
  fs.writeFileSync(file, "emit-server-telemetry=false\nlevel-name=x\n", "utf8");
  const wrote = ensureEmitServerTelemetry(dir);
  assert.equal(wrote, false);
  assert.equal(fs.readFileSync(file, "utf8"), "emit-server-telemetry=false\nlevel-name=x\n");
  fs.rmSync(dir, { recursive: true, force: true });
});
