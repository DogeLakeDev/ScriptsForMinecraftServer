// @ts-check
/**
 * export-coverage.test.mjs — L0 声明面覆盖率门禁（≥95%）
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  listValueExports,
  HAND_WRITTEN_SERVER,
  HAND_WRITTEN_SERVER_UI,
} from "./scripts/gen-mc-fake.mjs";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const THRESHOLD = 0.95;

function assertCoverage(moduleName, dtsPath, metaPath, handSet) {
  const source = fs.readFileSync(dtsPath, "utf8");
  const all = listValueExports(source);
  assert.ok(fs.existsSync(metaPath), `请先运行 npm run gen:mc-fake（缺 ${metaPath}）`);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const generated = new Set(meta.generatedNames);
  const covered = all.filter((e) => handSet.has(e.name) || generated.has(e.name));
  const ratio = covered.length / all.length;
  assert.ok(
    ratio >= THRESHOLD,
    `${moduleName} 覆盖率 ${(ratio * 100).toFixed(1)}% < ${THRESHOLD * 100}%（${covered.length}/${all.length}）`
  );
}

test("L0 覆盖率：@minecraft/server 手写+生成 ≥ 95%", () => {
  assertCoverage(
    "@minecraft/server",
    require.resolve("@minecraft/server/index.d.ts"),
    path.join(here, "src/testing/engine/generated/export-names.json"),
    HAND_WRITTEN_SERVER
  );
});

test("L0 覆盖率：@minecraft/server-ui 手写+生成 ≥ 95%", () => {
  assertCoverage(
    "@minecraft/server-ui",
    require.resolve("@minecraft/server-ui/index.d.ts"),
    path.join(here, "src/testing/engine/generated/export-names-ui.json"),
    HAND_WRITTEN_SERVER_UI
  );
});
