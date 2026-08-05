import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import {
  appendLocationToMessage,
  lookupLocation,
  scanModuleSourceMap,
  type SourceLocation,
} from "./sourceMap.ts";

const FIXTURE_ROOT = path.resolve("src/playground/__fixtures__/sample-module");

test("scanModuleSourceMap 解析入口每个 export 的行号", async () => {
  const map = await scanModuleSourceMap(FIXTURE_ROOT);
  // const / function / class / enum / type / interface / DESCRIPTOR 都应被收录
  assert.ok(map.has("MODULE_ID"), "应收录 MODULE_ID");
  assert.ok(map.has("PERM"), "应收录 PERM");
  assert.ok(map.has("registerPermissions"), "应收录 registerPermissions");
  assert.ok(map.has("SampleService"), "应收录 class SampleService");
  assert.ok(map.has("SampleLevel"), "应收录 enum SampleLevel");
  assert.ok(map.has("SampleConfig"), "应收录 interface SampleConfig");
  assert.ok(map.has("SampleCount"), "应收录 type SampleCount");
  assert.ok(map.has("DESCRIPTOR"), "应收录 DESCRIPTOR");
  assert.ok(map.has("default"), "应收录 default");
});

test("loc 行号落在 fixture 实际声明行", async () => {
  const map = await scanModuleSourceMap(FIXTURE_ROOT);
  const descriptorLoc = map.get("DESCRIPTOR");
  assert.ok(descriptorLoc, "DESCRIPTOR 应在 map 中");
  assert.equal(descriptorLoc!.file, "sapi/src/index.ts");
  assert.equal(descriptorLoc!.line, 57, "DESCRIPTOR 行号 = 57");
  const sampleServiceLoc = map.get("SampleService");
  assert.ok(sampleServiceLoc);
  assert.equal(sampleServiceLoc!.file, "sapi/src/index.ts");
  assert.equal(sampleServiceLoc!.line, 18, "SampleService 行号 = 18");
});

test("Command.register 字面量收录到 @cmd.<name>", async () => {
  const map = await scanModuleSourceMap(FIXTURE_ROOT);
  const sampleCmd = map.get("@cmd.sample");
  assert.ok(sampleCmd, "@cmd.sample 应在 map 中");
  assert.equal(sampleCmd!.file, "sapi/src/index.ts");
  assert.equal(sampleCmd!.symbol, "sample");
  const infoCmd = map.get("@cmd.sample-info");
  assert.ok(infoCmd, "@cmd.sample-info 应在 map 中");
});

test("lookupLocation 优先精确键，回退 @cmd / DESCRIPTOR / default", async () => {
  const map = await scanModuleSourceMap(FIXTURE_ROOT);
  assert.ok(lookupLocation(map, "MODULE_ID"));
  // 未知键 → 回退 DESCRIPTOR
  const fallback = lookupLocation(map, "some-method-not-exported");
  assert.ok(fallback, "未知键应回退到 DESCRIPTOR");
  assert.equal(fallback!.symbol, "DESCRIPTOR");
  // 命令名（无对应 export）→ 回退 @cmd.<name>
  const cmdLookup = lookupLocation(map, "sample-info");
  assert.ok(cmdLookup);
  assert.equal(cmdLookup!.symbol, "sample-info");
});

test("appendLocationToMessage 追加 → file:line", () => {
  const loc: SourceLocation = { file: "sapi/src/index.ts", line: 12, column: 0 };
  assert.equal(
    appendLocationToMessage("失败: foo", loc),
    "失败: foo\n→ sapi/src/index.ts:12"
  );
  // 有 column 时输出 :col+1（VS Code 1-based）
  assert.equal(
    appendLocationToMessage("失败: foo", { ...loc, column: 4 }),
    "失败: foo\n→ sapi/src/index.ts:12:5"
  );
  // 无 location 时原样返回
  assert.equal(appendLocationToMessage("失败: foo", undefined), "失败: foo");
});

test("scanModuleSourceMap 对没有入口的模块返回空 Map", async () => {
  const map = await scanModuleSourceMap(path.resolve("src/playground/__fixtures__/empty-module"));
  assert.equal(map.size, 0);
});