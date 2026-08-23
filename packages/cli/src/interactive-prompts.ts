import { isCancel, select, text } from "@clack/prompts";
import fs from "node:fs";
import path from "node:path";
import { pickDirectoryDialog as runNativeDirectoryPicker } from "./directory-picker.js";
import { t } from "./i18n/index.js";

/** 与 init 向导一致：文本输入或系统文件夹选择器。 */
export async function pickDirectory(message: string, defaultDirectory: string): Promise<string> {
  const method = await select({
    message,
    options: [
      { value: "text", label: t("prompt.enterPath"), hint: defaultDirectory },
      { value: "browse", label: t("prompt.browse"), hint: t("prompt.browseHint") },
    ],
  });
  if (isCancel(method)) return defaultDirectory;

  if (method === "browse") {
    const result = runNativeDirectoryPicker(message, defaultDirectory);
    if (result.status === "selected") return result.path;
    if (result.status === "cancelled") return defaultDirectory;

    const selected = await text({
      message: `${message} — ${t("prompt.browseUnavailable")}`,
      initialValue: defaultDirectory,
    });
    return isCancel(selected) || !selected ? defaultDirectory : selected;
  }

  const selected = await text({ message, initialValue: defaultDirectory });
  return isCancel(selected) || !selected ? defaultDirectory : selected;
}

export { pickDirectoryDialog, type DirectoryPickerResult } from "./directory-picker.js";

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
