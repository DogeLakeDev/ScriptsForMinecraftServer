/**
 * UI Studio 原子保存（saveUiProjectFile）单测。
 *
 * 覆盖设计文档「保存、兼容与恢复」的硬性要求：
 * - 写入限定 ui 根内（拒绝绝对路径与 .. 越界）；
 * - 临时文件 + 原子替换，不留半截文件；
 * - 首次改写前创建可恢复备份，且每会话每文件只备份一次；
 * - 未知字段随文档整体回写，不丢失。
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  saveUiProjectFile,
  UiStudioSaveError,
} from "../../dist/esm/ui-studio/index.js";

async function makeUiRoot(): Promise<string> {
  const uiRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ui-studio-save-"));
  await fs.mkdir(path.join(uiRoot, "screens"), { recursive: true });
  await fs.writeFile(
    path.join(uiRoot, "feature.ui.json"),
    `${JSON.stringify({ formatVersion: 1, moduleId: "demo" }, null, 2)}\n`,
    "utf8",
  );
  await fs.writeFile(
    path.join(uiRoot, "screens", "home.ui.json"),
    `${JSON.stringify({ formatVersion: 1, id: "home", customField: "保留我" }, null, 2)}\n`,
    "utf8",
  );
  return uiRoot;
}

function saveOptions(uiRoot: string, relativePath: string, document: unknown) {
  return {
    uiRoot,
    relativePath,
    document,
    sessionId: "2026-09-12T00-00-00-000Z",
    backupsDone: new Set<string>(),
  };
}

test("save: 覆盖写入并保留未知字段", async () => {
  const uiRoot = await makeUiRoot();
  const original = JSON.parse(
    await fs.readFile(path.join(uiRoot, "screens", "home.ui.json"), "utf8"),
  ) as Record<string, unknown>;
  // 模拟客户端：在内存文档上改已知字段，未知字段原样保留。
  const next = { ...original, title: "新标题" };
  await saveUiProjectFile(saveOptions(uiRoot, "screens/home.ui.json", next));

  const written = JSON.parse(
    await fs.readFile(path.join(uiRoot, "screens", "home.ui.json"), "utf8"),
  ) as Record<string, unknown>;
  assert.equal(written.title, "新标题");
  assert.equal(written.customField, "保留我");
});

test("save: 首次改写前备份，且每会话只备份一次", async () => {
  const uiRoot = await makeUiRoot();
  const options = saveOptions(uiRoot, "feature.ui.json", { formatVersion: 1, moduleId: "v2" });
  await saveUiProjectFile(options);

  const backupDir = path.join(uiRoot, ".ui-studio", "backups");
  const backups = await fs.readdir(backupDir);
  assert.deepEqual(backups, ["feature.ui.json.2026-09-12T00-00-00-000Z.bak"]);
  // 备份内容应为改写前的旧版本。
  const backup = JSON.parse(
    await fs.readFile(path.join(backupDir, backups[0]!), "utf8"),
  ) as Record<string, unknown>;
  assert.equal(backup.moduleId, "demo");

  // 第二次保存不再新建备份。
  await saveUiProjectFile({ ...options, document: { formatVersion: 1, moduleId: "v3" } });
  assert.equal((await fs.readdir(backupDir)).length, 1);
});

test("save: 拒绝绝对路径与 .. 越界", async () => {
  const uiRoot = await makeUiRoot();
  await assert.rejects(
    saveUiProjectFile(saveOptions(uiRoot, path.join(uiRoot, "feature.ui.json"), {})),
    UiStudioSaveError,
  );
  await assert.rejects(
    saveUiProjectFile(saveOptions(uiRoot, "../outside.json", {})),
    UiStudioSaveError,
  );
  await assert.rejects(
    saveUiProjectFile(saveOptions(uiRoot, "screens/../../escape.json", {})),
    UiStudioSaveError,
  );
});

test("save: 拒绝非 .json 与不存在的目标", async () => {
  const uiRoot = await makeUiRoot();
  await assert.rejects(
    saveUiProjectFile(saveOptions(uiRoot, "feature.ui.txt", {})),
    UiStudioSaveError,
  );
  await assert.rejects(
    saveUiProjectFile(saveOptions(uiRoot, "screens/new.ui.json", {})),
    /目标文件不存在/,
  );
});

test("save: 写入后目录中不留临时文件", async () => {
  const uiRoot = await makeUiRoot();
  await saveUiProjectFile(saveOptions(uiRoot, "feature.ui.json", { formatVersion: 1, moduleId: "v2" }));
  const entries = await fs.readdir(uiRoot);
  assert.ok(!entries.some((name) => name.includes(".tmp-")), `残留临时文件：${entries.join(",")}`);
});
