/**
 * @sfmc-bds/sdk 公开 exports 白名单。
 * 权威来源：sibling / 已安装 `@sfmc-bds/sdk` 的 package.json#exports（DIP/DRY）；
 * 读不到时回落到与当前 SDK 对齐的静态表。
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** 与当前 SDK exports 对齐的回落表（无 SDK 包时使用） */
export const SDK_PUBLIC_EXPORTS_FALLBACK = [
  "contracts",
  "logs",
  "sapi/sdk",
  "sapi/host",
  "sapi/runtime",
  "sapi/db",
  "sapi/config",
  "sapi/service",
  "node/sdk",
  "node",
  "node/config",
  "module-loader",
  "behavior-pack-build",
  "package.json",
] as const;

const SDK_PREFIX = "@sfmc-bds/sdk";
const require = createRequire(import.meta.url);

let cachedExports: string[] | null = null;

function parseExportsKeys(pkgPath: string): string[] | null {
  try {
    if (!fs.existsSync(pkgPath)) return null;
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
      exports?: Record<string, unknown>;
    };
    const keys = Object.keys(raw.exports ?? {})
      .map((k) => (k === "." ? null : k.replace(/^\.\//, "")))
      .filter((k): k is string => !!k && !k.includes("*"));
    return keys.length > 0 ? keys : null;
  } catch {
    return null;
  }
}

/**
 * 从 monorepo sibling 或已安装的 @sfmc-bds/sdk 解析 exports 子路径。
 * `schemas/*` 由 checkSdkImportPath 前缀放行，不进本列表。
 */
export function loadSdkPublicExports(): readonly string[] {
  if (cachedExports) return cachedExports;

  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates: string[] = [
    // dist/utils 或 src/utils → modules/sdk/@sfmc-sdk/package.json
    path.resolve(here, "..", "..", "..", "@sfmc-sdk", "package.json"),
  ];

  try {
    candidates.unshift(require.resolve("@sfmc-bds/sdk/package.json"));
  } catch {
    // 未安装 SDK 时忽略
  }

  for (const pkgPath of candidates) {
    const keys = parseExportsKeys(pkgPath);
    if (keys) {
      cachedExports = keys;
      return cachedExports;
    }
  }

  cachedExports = [...SDK_PUBLIC_EXPORTS_FALLBACK];
  return cachedExports;
}

/** @deprecated 兼容旧名；请优先 loadSdkPublicExports() */
export const SDK_PUBLIC_EXPORTS = SDK_PUBLIC_EXPORTS_FALLBACK;

/** 测试用：清空 exports 缓存 */
export function clearSdkPublicExportsCache(): void {
  cachedExports = null;
}

/** 检查 import 源是否为合法公开入口；非法返回错误原因，合法返回 null */
export function checkSdkImportPath(
  source: string,
  extraAllowed: string[] = []
): "bare" | "private" | null {
  if (source === SDK_PREFIX) return "bare";
  if (!source.startsWith(`${SDK_PREFIX}/`)) return null;

  const sub = source.slice(SDK_PREFIX.length + 1);
  if (sub.startsWith("schemas/")) return null; // schemas/* 公开

  const allowed = new Set<string>([...loadSdkPublicExports(), ...extraAllowed]);
  if (allowed.has(sub)) return null;
  return "private";
}
