// @ts-check
/** 模块默认配置播种：仅补缺，不覆盖用户已有值。 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CONFIG_KEY_RE = /^[A-Za-z0-9_-]+$/;

/** @param {unknown} value */
function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** @param {string} root @param {string} candidate */
function assertWithin(root, candidate) {
  const absRoot = path.resolve(root);
  const absCandidate = path.resolve(candidate);
  const rel = path.relative(absRoot, absCandidate);
  if (rel === "" || (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))) {
    return absCandidate;
  }
  throw new Error("配置路径越界: " + absCandidate);
}

/** @param {string} file @param {string} label */
function readObject(file, label) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(label + " JSON 解析失败: " + message);
  }
  if (!isPlainObject(parsed)) throw new Error(label + " 顶层必须是 JSON 对象");
  return parsed;
}

/**
 * @param {Record<string, unknown>} current
 * @param {Record<string, unknown>} defaults
 * @param {string} [prefix]
 * @returns {{ value: Record<string, unknown>; addedPaths: string[] }}
 */
export function mergeMissing(current, defaults, prefix = "") {
  const value = structuredClone(current);
  /** @type {string[]} */
  const addedPaths = [];
  for (const key of Object.keys(defaults).sort()) {
    const fieldPath = prefix ? prefix + "." + key : key;
    if (!Object.hasOwn(value, key)) {
      value[key] = structuredClone(defaults[key]);
      addedPaths.push(fieldPath);
      continue;
    }
    if (isPlainObject(value[key]) && isPlainObject(defaults[key])) {
      const nested = mergeMissing(
        /** @type {Record<string, unknown>} */ (value[key]),
        /** @type {Record<string, unknown>} */ (defaults[key]),
        fieldPath
      );
      value[key] = nested.value;
      addedPaths.push(...nested.addedPaths);
    }
  }
  return { value, addedPaths: addedPaths.sort() };
}

/**
 * @typedef {{
 *   status: "created" | "updated" | "unchanged" | "missing-defaults";
 *   target: string;
 *   addedPaths: string[];
 * }} SeedResult
 */

/**
 * @param {{ moduleRoot: string; projectRoot: string; configKey: string }} options
 * @returns {SeedResult}
 */
export function seedModuleConfig(options) {
  const { moduleRoot, projectRoot, configKey } = options;
  if (!CONFIG_KEY_RE.test(configKey)) throw new Error('invalid configKey "' + configKey + '"');

  const safeModuleRoot = path.resolve(moduleRoot);
  const safeProjectRoot = path.resolve(projectRoot);
  const source = assertWithin(safeModuleRoot, path.join(safeModuleRoot, "configs-default", configKey + ".json"));
  const configsDir = assertWithin(safeProjectRoot, path.join(safeProjectRoot, "configs"));
  const target = assertWithin(configsDir, path.join(configsDir, configKey + ".json"));
  if (!fs.existsSync(source)) {
    const defaultsDir = path.dirname(source);
    const jsonFiles = fs.existsSync(defaultsDir)
      ? fs.readdirSync(defaultsDir).filter((name) => name.toLowerCase().endsWith(".json"))
      : [];
    if (jsonFiles.length > 0) {
      throw new Error("默认配置文件名必须为 configs-default/" + configKey + ".json，实际为 " + jsonFiles.join(", "));
    }
    return { status: "missing-defaults", target, addedPaths: [] };
  }

  const defaults = readObject(source, "默认配置 " + source);
  let status = /** @type {SeedResult["status"]} */ ("created");
  let value = defaults;
  let addedPaths = Object.keys(defaults).sort();
  if (fs.existsSync(target)) {
    const current = readObject(target, "用户配置 " + target);
    const merged = mergeMissing(current, defaults);
    value = merged.value;
    addedPaths = merged.addedPaths;
    status = addedPaths.length > 0 ? "updated" : "unchanged";
  }
  if (status === "unchanged") return { status, target, addedPaths };

  fs.mkdirSync(configsDir, { recursive: true });
  const temp = assertWithin(configsDir, path.join(configsDir, "." + configKey + "." + randomUUID() + ".tmp"));
  try {
    fs.writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8", flag: "wx" });
    fs.renameSync(temp, target);
  } finally {
    try {
      fs.rmSync(temp, { force: true });
    } catch {
      /* best-effort */
    }
  }
  return { status, target, addedPaths };
}
