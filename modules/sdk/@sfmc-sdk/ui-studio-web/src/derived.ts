/**
 * derived.ts — 由项目文件表实时派生工程视图。
 *
 * 直接复用 SDK 平台无关校验器（compileUiProject / validateUiScreen /
 * validateUiFeature），编辑的同时即可看到最新画布与诊断。
 *
 * 与早先服务端装载的口径差异：
 * - 编译输入取 feature 声明的页面文件（与服务端一致）；
 * - 可浏览视图更宽容：任何通过页面校验的文件都可浏览，
 *   即使 feature 损坏或漏登记，也能先修复再挂回。
 */

import {
  compileUiProject,
  validateUiFeature,
  validateUiScreen,
} from "../../src/validation/ui-document.js";
import type { UiStudioBrowseView } from "../../src/ui-studio/project.js";
import { FEATURE_FILE, type ProjectView } from "./model";
import { screenRefs } from "./store/project";

/** 由项目文件表派生工程视图。 */
export function deriveView(
  files: Record<string, unknown>,
  services: string[],
): ProjectView {
  const feature = files[FEATURE_FILE] ?? null;

  // 统一诊断：编译输入为 feature 声明的页面文件（与服务端口径一致）。
  const declaredScreens: Record<string, unknown> = {};
  for (const ref of screenRefs(files)) {
    if (ref.file in files) declaredScreens[ref.file] = files[ref.file];
  }
  const compiled = compileUiProject({ feature, screens: declaredScreens, services });

  // 可浏览视图：feature 单独校验；所有文件中能通过页面校验的都纳入。
  const browse: UiStudioBrowseView = { feature: null, screens: {} };
  const featureResult = validateUiFeature(feature);
  if (featureResult.ok) browse.feature = featureResult.value;
  for (const [file, doc] of Object.entries(files)) {
    if (file === FEATURE_FILE) continue;
    const screenResult = validateUiScreen(doc);
    if (screenResult.ok) browse.screens[screenResult.value.id] = screenResult.value;
  }

  return { feature, files, browse, issues: compiled.issues, services };
}
