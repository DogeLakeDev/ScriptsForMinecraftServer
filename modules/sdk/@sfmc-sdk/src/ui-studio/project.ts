/**
 * ui-studio/project.ts — UI 工程发现与装载（Node 侧）。
 *
 * 负责：
 * - 从用户给定目录探测 ui/ 工程根（支持标准布局与 sapi/src/ui 布局）；
 * - 读取 feature.ui.json、全部页面文件与可选预览 fixture；
 * - 读取模块 manifest 中已声明的 service 清单，供跨文件语义校验；
 * - 调用共享编译器 compileUiProject，产出统一诊断。
 *
 * 本模块只做读取，不做任何写入；写路径在 server.ts 中单独收口。
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  compileUiProject,
  validateUiFeature,
  validateUiScreen,
  type UiValidationIssue,
} from "../validation/ui-document.js";
import type {
  UiFeatureDocument,
  UiProject,
  UiScreenDocument,
} from "../contracts/ui-document.js";

/** UiProject 的 JSON 可序列化形式：screens 由 Map 转为以页面 id 为键的对象。 */
export interface SerializedUiProject {
  feature: UiFeatureDocument;
  screens: Record<string, UiScreenDocument>;
}

/**
 * 可浏览视图：feature 与每个页面单独校验，互不累及。
 * 编译器整体失败关闭（任何问题 → project 为 null），但 Studio 浏览/定位
 * 恰恰在工程损坏时最需要，因此 UI 一律以本视图为准。
 */
export interface UiStudioBrowseView {
  /** feature.ui.json 单独校验通过时的文档；否则为 null。 */
  feature: UiFeatureDocument | null;
  /** 单独校验通过的页面，键为页面 id。 */
  screens: Record<string, UiScreenDocument>;
}

/** 一次工程装载的完整快照，直接作为 /api/project 的响应体（必须可 JSON 序列化）。 */
export interface UiStudioProjectSnapshot {
  /** 启动时用户给定的目录（模块目录或 ui 目录）。 */
  projectDir: string;
  /** 探测到的 ui/ 工程根绝对路径。 */
  uiRoot: string;
  /** feature.ui.json 原始内容；解析失败为 null。 */
  feature: unknown;
  /** 页面文件内容，键为 feature 中声明的 file 相对路径。 */
  screens: Record<string, unknown>;
  /** manifest 中 services.provides 声明的 service 名称。 */
  services: string[];
  /** .ui-studio/preview.fixture.json 内容；不存在或解析失败为 null。 */
  fixture: unknown;
  /** 统一诊断列表（含文件级与跨文件语义）。 */
  issues: UiValidationIssue[];
  /** 编译成功时的工程视图（已序列化）；存在任何问题时为 null。 */
  project: SerializedUiProject | null;
  /** 可浏览视图：无论整体编译是否通过，UI 都用它渲染树与画布。 */
  browse: UiStudioBrowseView;
}

/** 工程发现失败时抛出，消息面向命令行用户。 */
export class UiStudioProjectError extends Error {}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile(
  file: string,
  label: string,
  issues: UiValidationIssue[],
): Promise<unknown> {
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    issues.push({
      path: "",
      code: "invalid_value",
      message: `无法读取${label} ${file}`,
    });
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    issues.push({
      path: "",
      code: "invalid_value",
      message: `${label} ${path.basename(file)} 不是合法 JSON：${(error as Error).message}`,
    });
    return null;
  }
}

/**
 * 探测 ui 工程根目录。候选顺序：
 * 1. `<dir>/feature.ui.json`（直接指向 ui 目录）
 * 2. `<dir>/ui/feature.ui.json`（标准模块布局）
 * 3. `<dir>/sapi/src/ui/feature.ui.json`（sapi 模块布局）
 */
export async function discoverUiRoot(projectDir: string): Promise<string> {
  const candidates = [
    projectDir,
    path.join(projectDir, "ui"),
    path.join(projectDir, "sapi", "src", "ui"),
  ];
  for (const candidate of candidates) {
    if (await pathExists(path.join(candidate, "feature.ui.json"))) {
      return candidate;
    }
  }
  throw new UiStudioProjectError(
    `在 ${projectDir} 下没有找到 feature.ui.json（已尝试 ui/ 与 sapi/src/ui/）`,
  );
}

/** 从模块 manifest 收集 services.provides 名称；找不到 manifest 时返回空表。 */
async function collectManifestServices(
  projectDir: string,
  uiRoot: string,
): Promise<string[]> {
  const candidates = [
    path.join(projectDir, "sapi", "manifest.json"),
    path.join(projectDir, "manifest.json"),
    // sapi/src/ui 布局：uiRoot 上两级即 sapi/
    path.resolve(uiRoot, "..", "..", "manifest.json"),
    // 标准布局：ui/ 的兄弟 sapi/
    path.resolve(uiRoot, "..", "sapi", "manifest.json"),
  ];
  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) continue;
    try {
      const manifest = JSON.parse(await fs.readFile(candidate, "utf8")) as {
        services?: { provides?: Array<{ name?: unknown }> };
      };
      const provides = manifest.services?.provides;
      if (!Array.isArray(provides)) return [];
      return provides
        .map((item) => (typeof item?.name === "string" ? item.name : null))
        .filter((name): name is string => name !== null);
    } catch {
      return [];
    }
  }
  return [];
}

/** 装载工程并执行统一校验。 */
export async function loadUiStudioProject(
  projectDir: string,
): Promise<UiStudioProjectSnapshot> {
  const issues: UiValidationIssue[] = [];
  const uiRoot = await discoverUiRoot(projectDir);

  const feature = await readJsonFile(
    path.join(uiRoot, "feature.ui.json"),
    "feature 文件",
    issues,
  );

  // 页面文件清单以 feature 声明为准；feature 不可用时退化为目录扫描。
  const screens: Record<string, unknown> = {};
  const declaredFiles = collectDeclaredScreenFiles(feature);
  if (declaredFiles.length > 0) {
    for (const file of declaredFiles) {
      // 拒绝越界引用，保证读取限定在 uiRoot 内。
      const resolved = path.resolve(uiRoot, file);
      if (!isInside(uiRoot, resolved)) {
        issues.push({
          path: "",
          code: "unsafe_path",
          message: `页面文件 ${file} 越出 ui 目录，已拒绝读取`,
        });
        continue;
      }
      screens[file] = await readJsonFile(resolved, `页面文件 ${file}`, issues);
    }
  }

  const services = await collectManifestServices(projectDir, uiRoot);

  const fixturePath = path.join(uiRoot, ".ui-studio", "preview.fixture.json");
  const fixture = (await pathExists(fixturePath))
    ? await readJsonFile(fixturePath, "预览 fixture", issues)
    : null;

  const compiled = compileUiProject({
    feature,
    screens,
    services,
  });
  issues.push(...compiled.issues);

  // 可浏览视图：逐文件独立校验，让损坏工程仍可浏览与定位。
  const browse: UiStudioBrowseView = { feature: null, screens: {} };
  const featureResult = validateUiFeature(feature);
  if (featureResult.ok) browse.feature = featureResult.value;
  for (const document of Object.values(screens)) {
    const screenResult = validateUiScreen(document);
    if (screenResult.ok) browse.screens[screenResult.value.id] = screenResult.value;
  }

  return {
    projectDir,
    uiRoot,
    feature,
    screens,
    services,
    fixture,
    issues,
    project: compiled.ok ? serializeProject(compiled.value) : null,
    browse,
  };
}

function serializeProject(project: UiProject): SerializedUiProject {
  return {
    feature: project.feature,
    screens: Object.fromEntries(project.screens),
  };
}

function collectDeclaredScreenFiles(feature: unknown): string[] {
  if (typeof feature !== "object" || feature === null) return [];
  const screens = (feature as { screens?: unknown }).screens;
  if (!Array.isArray(screens)) return [];
  return screens
    .map((item) =>
      typeof item === "object" && item !== null
        ? (item as { file?: unknown }).file
        : null,
    )
    .filter((file): file is string => typeof file === "string");
}

/** 判断 target 是否位于 root 之内（含 root 自身）。 */
export function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
