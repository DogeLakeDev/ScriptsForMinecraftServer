// @ts-check
/**
 * 解析 Tanya7z/sfmc-modules index.json
 *
 * 契约（与 sfmc/src/registry.ts#parseRegistryIndex 保持一致）:
 *   { modules: { <id>: { npm?, version?, sdk?, repo?, tag?, name?, description?, category?, license?, official?, requires? } } }
 * 条目至少具备 npm 或 repo+tag。`_` 前缀键视为元数据并忽略。
 * requires 只有在全部是非空字符串时才保留；空数组表示没有额外依赖。缺字段表示索引没有声明依赖。
 */

/**
 * @typedef {{ npm?: string, version?: string, sdk?: string, repo?: string, tag?: string, name?: string, description?: string, category?: string, license?: string, official?: boolean, requires?: string[] }} RegistryEntry
 * @typedef {Record<string, RegistryEntry>} RegistryIndex
 */

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function optionalText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * 索引 requires。格式不对时返回 undefined，让安装方拒绝，而不是当成没有依赖。
 * @param {unknown} value
 * @returns {string[] | undefined}
 */
function optionalRequires(value) {
  if (!Array.isArray(value)) return undefined;
  /** @type {string[]} */
  const items = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) return undefined;
    items.push(item.trim());
  }
  return items;
}

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
    const npm = optionalText(entry.npm);
    const repo = optionalText(entry.repo);
    const tag = optionalText(entry.tag);
    const hasNpm = Boolean(npm);
    const hasGh = Boolean(repo && tag);
    if (!hasNpm && !hasGh) continue;
    /** @type {RegistryEntry} */
    const out = {};
    if (npm) out.npm = npm;
    const version = optionalText(entry.version);
    const sdk = optionalText(entry.sdk);
    const name = optionalText(entry.name);
    const description = optionalText(entry.description);
    const category = optionalText(entry.category);
    const license = optionalText(entry.license);
    const requires = optionalRequires(entry.requires);
    if (version) out.version = version;
    if (sdk) out.sdk = sdk;
    if (repo) out.repo = repo;
    if (repo && tag) out.tag = tag;
    if (name) out.name = name;
    if (description) out.description = description;
    if (category) out.category = category;
    if (license) out.license = license;
    if (typeof entry.official === "boolean") out.official = entry.official;
    if (requires !== undefined) out.requires = requires;
    filtered[k] = out;
  }
  return filtered;
}
