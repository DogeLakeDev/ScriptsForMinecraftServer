import { isCancel, select, text } from "@clack/prompts";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** 与 init 向导一致：文本输入或系统文件夹选择器。 */
export async function pickDirectory(message: string, defaultDirectory: string): Promise<string> {
  const method = await select({
    message,
    options: [
      { value: "text", label: "输入路径", hint: defaultDirectory },
      { value: "browse", label: "浏览…", hint: "打开系统文件夹选择器" },
    ],
  });
  if (isCancel(method)) return defaultDirectory;
  if (method === "browse") return pickDirectoryDialog(message, defaultDirectory) ?? defaultDirectory;

  const selected = await text({ message, initialValue: defaultDirectory });
  return isCancel(selected) || !selected ? defaultDirectory : selected;
}

/** Windows 文件夹选择器；非 Windows 或失败时返回 null。 */
export function pickDirectoryDialog(title: string, defaultDirectory: string): string | null {
  if (process.platform !== "win32") return null;
  const escape = (value: string): string => value.replace(/'/g, "''");
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    `$dialog.Description = '${escape(title)}'`,
    `$dialog.SelectedPath = '${escape(defaultDirectory)}'`,
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }",
  ].join("; ");

  try {
    const output = execFileSync("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
      encoding: "utf-8",
      timeout: 30_000,
      windowsHide: true,
    });
    return output.trim() || null;
  } catch {
    return null;
  }
}

export function ensureDirectory(directory: string): boolean {
  try {
    fs.mkdirSync(directory, { recursive: true });
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

/** 将用户输入规范为绝对路径（兼容含 # 的 Windows 路径）。 */
export function resolveUserPath(input: string, base = process.cwd()): string {
  return path.resolve(base, input.trim());
}
