/**
 * 读本包 sapi/manifest.json（provides / requires / configKey），带简单缓存。
 */
import fs from "node:fs";
import path from "node:path";

export interface ManifestServices {
  provides: string[];
  requires: string[];
  configKey?: string;
  manifestPath?: string;
}

const cache = new Map<string, ManifestServices | null>();

/** 从 filename 向上找 packages/<id>/sapi/manifest.json（或 sapi 目录下的 manifest.json） */
export function findSapiManifestPath(filename: string): string | null {
  let dir = path.dirname(path.resolve(filename));
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(dir, "sapi", "manifest.json");
    if (fs.existsSync(candidate)) return candidate;
    const here = path.join(dir, "manifest.json");
    if (path.basename(dir) === "sapi" && fs.existsSync(here)) return here;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

export function loadManifestServices(filename: string): ManifestServices | null {
  const key = path.resolve(filename);
  if (cache.has(key)) return cache.get(key) ?? null;

  const manifestPath = findSapiManifestPath(filename);
  if (!manifestPath) {
    cache.set(key, null);
    return null;
  }

  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      configKey?: string;
      services?: {
        provides?: Array<{ name?: string } | string>;
        requires?: Array<{ name?: string } | string>;
      };
    };
    const nameOf = (x: { name?: string } | string): string | null => {
      if (typeof x === "string") return x;
      return typeof x.name === "string" ? x.name : null;
    };
    const provides = (raw.services?.provides ?? [])
      .map(nameOf)
      .filter((n): n is string => !!n);
    const requires = (raw.services?.requires ?? [])
      .map(nameOf)
      .filter((n): n is string => !!n);
    const result: ManifestServices = {
      provides,
      requires,
      ...(typeof raw.configKey === "string" ? { configKey: raw.configKey } : {}),
      manifestPath,
    };
    cache.set(key, result);
    return result;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** 测试用：清空缓存 */
export function clearManifestCache(): void {
  cache.clear();
}
