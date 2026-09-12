/**
 * zip.ts — Studio 工程的 zip 导入导出（fflate，纯浏览器）。
 *
 * 导出：项目文件表 + services 清单打包为 zip 下载；
 * 导入：解压 zip，取全部 .json 为文件表；根级 manifest.json
 * 自动提取 services.provides 名称（不进入文件表）。
 */

import { strToU8, strFromU8, unzipSync, zipSync } from "fflate";
import { FIXTURE_FILE, type StudioProject } from "./store/project";
import { extractServicesFromManifest } from "./store/project";

/** 随工程一起打包的 Studio 元数据文件（services 清单）。 */
const STUDIO_META_FILE = ".ui-studio/studio.json";

/** 导出项目为 zip Blob。 */
export function exportProjectZip(project: StudioProject): Blob {
  const entries: Record<string, Uint8Array> = {};
  for (const [file, doc] of Object.entries(project.files)) {
    entries[file] = strToU8(`${JSON.stringify(doc, null, 2)}\n`);
  }
  entries[STUDIO_META_FILE] = strToU8(
    `${JSON.stringify({ services: project.services }, null, 2)}\n`,
  );
  const zipped = zipSync(entries, { level: 6 });
  return new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
}

export interface ImportedProject {
  /** 工程名（zip 文件名去扩展名，或 feature.name）。 */
  name: string;
  files: Record<string, unknown>;
  services: string[];
}

/** 导入 zip 为项目数据；找不到 feature.ui.json 时抛错。 */
export function importProjectZip(data: Uint8Array, zipName: string): ImportedProject {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(data);
  } catch (error) {
    throw new Error(`zip 解压失败：${(error as Error).message}`);
  }

  const files: Record<string, unknown> = {};
  let services: string[] = [];
  const errors: string[] = [];

  // 允许 zip 内含唯一顶层文件夹（如 my-ui/feature.ui.json），统一剥掉。
  const rawPaths = Object.keys(entries).filter((p) => !p.endsWith("/"));
  const stripped = stripCommonRoot(rawPaths);
  const pathMap = new Map(rawPaths.map((raw, i) => [stripped[i]!, raw]));

  for (const [normalized, rawPath] of pathMap) {
    const content = entries[rawPath]!;
    if (!normalized) continue;
    if (normalized === "manifest.json") {
      // 根级 manifest.json：提取 services，不进文件表。
      try {
        services = extractServicesFromManifest(JSON.parse(strFromU8(content)));
      } catch {
        errors.push("manifest.json 不是合法 JSON，已跳过 services 提取");
      }
      continue;
    }
    if (normalized === STUDIO_META_FILE) {
      try {
        const meta = JSON.parse(strFromU8(content)) as { services?: unknown };
        if (Array.isArray(meta.services)) {
          services = meta.services.filter((s): s is string => typeof s === "string");
        }
      } catch {
        // 元数据损坏不阻塞导入。
      }
      continue;
    }
    if (!normalized.endsWith(".json")) continue;
    try {
      files[normalized] = JSON.parse(strFromU8(content));
    } catch {
      errors.push(`${normalized} 不是合法 JSON，已跳过`);
    }
  }

  if (!files["feature.ui.json"]) {
    throw new Error("zip 中找不到 feature.ui.json");
  }

  const feature = files["feature.ui.json"] as { name?: unknown };
  const name =
    (typeof feature.name === "string" && feature.name) ||
    zipName.replace(/\.zip$/i, "") ||
    "导入的工程";
  if (errors.length > 0) {
    // 非致命问题挂到返回值调用方提示；这里先并入 console 便于排查。
    console.warn("[ui-studio] 导入警告：", errors);
  }
  return { name, files, services };
}

/** 触发浏览器下载。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 判断导入的 zip 是否把文件包在单一顶层目录里，并返回剥离后的路径映射键。 */
export function stripCommonRoot(paths: string[]): string[] {
  const roots = new Set(paths.map((p) => p.split("/")[0]));
  if (roots.size === 1 && paths.every((p) => p.includes("/"))) {
    const root = [...roots][0]!;
    return paths.map((p) => p.slice(root.length + 1));
  }
  return paths;
}

export { FIXTURE_FILE };
