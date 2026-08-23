import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export type DirectoryPickerResult =
  | { status: "selected"; path: string }
  | { status: "cancelled" }
  | { status: "unavailable" };

export type PickerCommand = { command: string; args: string[] };

/** PowerShell 单引号字符串转义。 */
export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(/'/g, "''");
}

/** AppleScript 双引号字符串转义。 */
export function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** 选择器起始目录：默认路径不存在时回退到父目录或 cwd。 */
export function resolvePickerStartDir(defaultDirectory: string): string {
  const resolved = path.resolve(defaultDirectory);
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) return resolved;
  const parent = path.dirname(resolved);
  if (fs.existsSync(parent) && fs.statSync(parent).isDirectory()) return parent;
  return process.cwd();
}

export function buildWindowsPickerScript(title: string, defaultDirectory: string): string {
  const escape = escapePowerShellSingleQuoted;
  return [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = '${escape(title)}'`,
    `$dialog.SelectedPath = '${escape(defaultDirectory)}'`,
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  ].join("; ");
}

export function buildMacOsPickerScript(title: string, defaultDirectory: string): string {
  const escTitle = escapeAppleScriptString(title);
  const escPath = escapeAppleScriptString(defaultDirectory.replace(/\\/g, "/"));
  return [
    `set defaultFolder to POSIX file "${escPath}"`,
    "try",
    `  POSIX path of (choose folder with prompt "${escTitle}" default location defaultFolder)`,
    "on error number -128",
    '  error "User cancelled"',
    "end try",
  ].join("\n");
}

/** 按平台生成原生目录选择器命令候选（先试桌面默认，再试通用工具）。 */
export function buildDirectoryPickerCandidates(
  platform: NodeJS.Platform,
  title: string,
  defaultDirectory: string
): PickerCommand[] {
  const startDir = resolvePickerStartDir(defaultDirectory);

  if (platform === "win32") {
    const script = buildWindowsPickerScript(title, startDir);
    return [
      { command: "powershell.exe", args: ["-NoProfile", "-STA", "-Command", script] },
      { command: "pwsh", args: ["-NoProfile", "-STA", "-Command", script] },
    ];
  }

  if (platform === "darwin") {
    return [{ command: "osascript", args: ["-e", buildMacOsPickerScript(title, startDir)] }];
  }

  if (platform === "linux") {
    const desktop = process.env.XDG_CURRENT_DESKTOP ?? "";
    const kdeFirst = /KDE/i.test(desktop);
    const zenity: PickerCommand = {
      command: "zenity",
      args: ["--file-selection", "--directory", `--title=${title}`, `--filename=${startDir}/`],
    };
    const kdialog: PickerCommand = {
      command: "kdialog",
      args: ["--getexistingdirectory", startDir, "--title", title],
    };
    return kdeFirst ? [kdialog, zenity] : [zenity, kdialog];
  }

  return [];
}

function isPickerCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as NodeJS.ErrnoException & { status?: number | null; stderr?: Buffer | string };
  if (err.status === 1) return true;
  const stderr = typeof err.stderr === "string" ? err.stderr : err.stderr?.toString("utf-8") ?? "";
  if (/cancelled|-128|User cancelled/i.test(stderr)) return true;
  const message = err.message ?? "";
  return /cancelled|-128/i.test(message);
}

/** 执行单次原生目录选择；命令不存在时返回 unavailable。 */
export function runDirectoryPickerCommand(candidate: PickerCommand): DirectoryPickerResult {
  try {
    const output = execFileSync(candidate.command, candidate.args, {
      encoding: "utf-8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const trimmed = output.trim();
    if (!trimmed) return { status: "cancelled" };
    return { status: "selected", path: trimmed };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return { status: "unavailable" };
    if (isPickerCancelled(error)) return { status: "cancelled" };
    return { status: "unavailable" };
  }
}

/** 跨平台系统文件夹选择器（zenity / kdialog / osascript / PowerShell）。 */
export function pickDirectoryDialog(title: string, defaultDirectory: string): DirectoryPickerResult {
  const candidates = buildDirectoryPickerCandidates(process.platform, title, defaultDirectory);
  if (candidates.length === 0) return { status: "unavailable" };

  for (const candidate of candidates) {
    const result = runDirectoryPickerCommand(candidate);
    if (result.status === "unavailable") continue;
    return result;
  }
  return { status: "unavailable" };
}
