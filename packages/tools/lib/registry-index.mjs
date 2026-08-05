// @ts-check
/**
 * tools/lib/registry-index.mjs — 解析 Tanya7z/sfmc-modules index.json
 *
 * 契约（与 sfmc/src/registry.ts#parseRegistryIndex 保持一致）:
 *   { modules: { <id>: { npm?, version?, sdk?, repo?, tag? } } }
 * 条目至少具备 npm 或 repo+tag。`_` 前缀键视为元数据并忽略。
 */

/**
 * @typedef {{ npm?: string, version?: string, sdk?: string, repo?: string, tag?: string }} RegistryEntry
 * @typedef {Record<string, RegistryEntry>} RegistryIndex
 */

/**
 * @param {unknown} json
 * @returns {RegistryIndex}
 */
export function parseRegistryIndex(json) {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("registry index must be a JSON object with a 'modules' field");
  }
  const modules = /** @type {Record<string, unknown>} */ (json).modules;
  if (typeof modules !== "object" || modules === null || Array.isArray(modules)) {
    throw new Error("registry index must have a 'modules' object mapping id → entry");
  }
  /** @type {RegistryIndex} */
  const filtered = {};
  for (const [k, v] of Object.entries(modules)) {
    if (k.startsWith("_")) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const entry = /** @type {Record<string, unknown>} */ (v);
    const hasNpm = typeof entry.npm === "string" && entry.npm.length > 0;
    const hasGh = typeof entry.repo === "string" && typeof entry.tag === "string";
    if (!hasNpm && !hasGh) continue;
    /** @type {RegistryEntry} */
    const out = {};
    if (hasNpm) {
      out.npm = /** @type {string} */ (entry.npm);
      if (typeof entry.version === "string") out.version = entry.version;
      if (typeof entry.sdk === "string") out.sdk = entry.sdk;
    }
    if (hasGh) {
      out.repo = /** @type {string} */ (entry.repo);
      out.tag = /** @type {string} */ (entry.tag);
    }
    filtered[k] = out;
  }
  return filtered;
}
