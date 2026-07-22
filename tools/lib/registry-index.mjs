/**
 * tools/lib/registry-index.mjs — 解析 Tanya7z/sfmc-modules index.json
 *
 * 契约（与 sfmc/src/registry.ts#parseRegistryIndex 保持一致）:
 *   { modules: { <packageFolder>: { repo, tag } } }
 * `_` 前缀键视为元数据并忽略。
 */

/**
 * @typedef {{ repo: string, tag: string }} RegistryEntry
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
    throw new Error("registry index must have a 'modules' object mapping id → { repo, tag }");
  }
  /** @type {RegistryIndex} */
  const filtered = {};
  for (const [k, v] of Object.entries(modules)) {
    if (k.startsWith("_")) continue;
    if (typeof v !== "object" || v === null || Array.isArray(v)) continue;
    const entry = /** @type {Record<string, unknown>} */ (v);
    if (typeof entry.repo !== "string" || typeof entry.tag !== "string") continue;
    filtered[k] = { repo: entry.repo, tag: entry.tag };
  }
  return filtered;
}
