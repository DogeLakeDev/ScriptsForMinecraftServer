// @ts-check
/**
 * configs/module-update.json
 * 模块自动更新的全局策略。缺文件时写入内置默认值，已存在的文件不覆盖。
 */
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./io.mjs";
import { ROOT } from "./paths.mjs";

/** 与 SDK configSchemaRef("module_update") 同一地址，供编辑器校验。 */
export const MODULE_UPDATE_SCHEMA =
  "https://cdn.jsdelivr.net/gh/DogeLakeDev/ScriptsForMinecraftServer@main/modules/sdk/@sfmc-sdk/schemas/module_update.schema.json";

/**
 * @typedef {{
 *   enabled: boolean,
 *   checkOnBdsStart: boolean,
 *   applyOnBdsStart: boolean,
 *   allowMajor: boolean,
 *   failMode: "continue" | "abort",
 *   distTag: string,
 * }} ModuleUpdateConfig
 */

/** 内置默认策略：官方索引模块可在开服前升级，major 默认跳过。 */
export const DEFAULT_MODULE_UPDATE_CONFIG = {
  enabled: true,
  checkOnBdsStart: true,
  applyOnBdsStart: true,
  allowMajor: false,
  failMode: "continue",
  distTag: "latest",
};

/**
 * @param {string} [root]
 */
export function moduleUpdateConfigPath(root = ROOT) {
  return path.join(root, "configs", "module-update.json");
}

/**
 * @param {unknown} raw
 * @returns {ModuleUpdateConfig}
 */
export function normalizeModuleUpdateConfig(raw) {
  const src = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
  const failMode = src.failMode === "abort" ? "abort" : "continue";
  const distTag = typeof src.distTag === "string" && src.distTag.trim() ? src.distTag.trim() : "latest";
  return {
    enabled: src.enabled !== false,
    checkOnBdsStart: src.checkOnBdsStart !== false,
    applyOnBdsStart: src.applyOnBdsStart !== false,
    allowMajor: src.allowMajor === true,
    failMode,
    distTag,
  };
}

/**
 * 确保策略文件存在。返回最终路径。
 * @param {string} [root]
 */
export function ensureModuleUpdateConfigFile(root = ROOT) {
  const file = moduleUpdateConfigPath(root);
  if (!fs.existsSync(file)) {
    writeJson(file, {
      $schema: MODULE_UPDATE_SCHEMA,
      ...DEFAULT_MODULE_UPDATE_CONFIG,
    });
  }
  return file;
}

/**
 * @param {string} [root]
 * @returns {ModuleUpdateConfig}
 */
export function loadModuleUpdateConfig(root = ROOT) {
  ensureModuleUpdateConfigFile(root);
  return normalizeModuleUpdateConfig(readJson(moduleUpdateConfigPath(root), null));
}
