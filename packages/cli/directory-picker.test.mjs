/**
 * directory-picker.test.mjs — 原生目录选择器命令组装（不弹真实对话框）
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import {
  buildDirectoryPickerCandidates,
  buildMacOsPickerScript,
  buildWindowsPickerScript,
  escapeAppleScriptString,
  escapePowerShellSingleQuoted,
  resolvePickerStartDir,
} from "./dist/directory-picker.js";

test("PowerShell 单引号转义", () => {
  assert.equal(escapePowerShellSingleQuoted("a'b"), "a''b");
});

test("AppleScript 字符串转义", () => {
  assert.equal(escapeAppleScriptString(String.raw`a\b"c`), String.raw`a\\b\"c`);
});

test("Windows 候选含 powershell 与 pwsh", () => {
  const candidates = buildDirectoryPickerCandidates("win32", "Pick BDS", "D:/games/BDS");
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].command, "powershell.exe");
  assert.equal(candidates[1].command, "pwsh");
  assert.match(candidates[0].args.at(-1), /FolderBrowserDialog/);
});

test("Linux 默认 zenity 优先，KDE 桌面 kdialog 优先", () => {
  const gnome = buildDirectoryPickerCandidates("linux", "Pick dir", "/tmp/sfmc");
  assert.deepEqual(
    gnome.map((c) => c.command),
    ["zenity", "kdialog"]
  );
  assert.deepEqual(gnome[0].args.slice(0, 3), ["--file-selection", "--directory", "--title=Pick dir"]);

  const prev = process.env.XDG_CURRENT_DESKTOP;
  process.env.XDG_CURRENT_DESKTOP = "KDE";
  try {
    const kde = buildDirectoryPickerCandidates("linux", "Pick dir", "/tmp/sfmc");
    assert.deepEqual(
      kde.map((c) => c.command),
      ["kdialog", "zenity"]
    );
  } finally {
    if (prev === undefined) delete process.env.XDG_CURRENT_DESKTOP;
    else process.env.XDG_CURRENT_DESKTOP = prev;
  }
});

test("macOS 使用 osascript choose folder", () => {
  const [candidate] = buildDirectoryPickerCandidates("darwin", "Pick dir", "/Users/test/SFMC");
  assert.equal(candidate.command, "osascript");
  const script = candidate.args.at(-1);
  assert.match(script, /choose folder with prompt "Pick dir"/);
  assert.match(script, /default location defaultFolder/);

  const direct = buildMacOsPickerScript("Pick dir", "/Users/test/SFMC");
  assert.match(direct, /POSIX file "\/Users\/test\/SFMC"/);
});

test("resolvePickerStartDir 在默认目录不存在时回退", () => {
  const start = resolvePickerStartDir(path.join(process.cwd(), "__definitely_missing_dir__"));
  assert.equal(start, process.cwd());
});

test("buildWindowsPickerScript 保留描述与起始路径", () => {
  const script = buildWindowsPickerScript("BDS 目录", "D:/WorkPlace/SFMC/BDS");
  assert.match(script, /Description = 'BDS 目录'/);
  assert.match(script, /SelectedPath = 'D:\/WorkPlace\/SFMC\/BDS'/);
});

test("buildMacOsPickerScript 含取消处理", () => {
  const script = buildMacOsPickerScript("title", "/tmp");
  assert.match(script, /error number -128/);
});
