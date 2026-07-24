/**
 * 解析模块默认配置 JSON 的顶层字段名。
 */
import fs from "node:fs";
import path from "node:path";
import { loadManifestServices } from "./manifest-catalog.js";

const fieldCache = new Map<string, Set<string> | null>();

function tryLoadJsonKeys(file: string): Set<string> | null {
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    return new Set(Object.keys(raw).filter((k) => k !== "$schema" && !k.startsWith("_")));
  } catch {
    return null;
  }
}

/**
 * 从 lint 文件定位默认配置字段集；找不到返回 null（调用方应跳过检查）。
 */
export function loadConfigFieldKeys(filename: string, cwd?: string): Set<string> | null {
  const key = path.resolve(filename);
  if (fieldCache.has(key)) return fieldCache.get(key) ?? null;

  const svc = loadManifestServices(filename);
  const configKey = svc?.configKey;
  if (!configKey) {
    fieldCache.set(key, null);
    return null;
  }

  const packageRoot = svc?.manifestPath
    ? path.dirname(path.dirname(svc.manifestPath)) // .../pkg  (sapi/manifest → sapi → pkg)
    : null;

  const candidates: string[] = [];
  if (packageRoot) {
    candidates.push(
      path.join(packageRoot, "config.default.json"),
      path.join(packageRoot, "configs-default.json"),
      path.join(packageRoot, "sapi", "config.default.json")
    );
  }
  const root = cwd ?? process.cwd();
  candidates.push(path.join(root, "configs", `${configKey}.json`));

  for (const c of candidates) {
    const keys = tryLoadJsonKeys(c);
    if (keys) {
      fieldCache.set(key, keys);
      return keys;
    }
  }

  /* 平台级 schema 字段名（无运行时 configs 时的回退） */
  const schemaPath = path.join(root, "modules", "sdk", "@sfmc-sdk", "schemas", `${configKey}.schema.json`);
  if (fs.existsSync(schemaPath)) {
    try {
      const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as {
        properties?: Record<string, unknown>;
      };
      if (schema.properties) {
        const keys = new Set(Object.keys(schema.properties).filter((k) => k !== "$schema"));
        if (keys.size > 0) {
          fieldCache.set(key, keys);
          return keys;
        }
      }
    } catch {
      /* ignore */
    }
  }

  fieldCache.set(key, null);
  return null;
}

export function clearConfigFieldCache(): void {
  fieldCache.clear();
}
