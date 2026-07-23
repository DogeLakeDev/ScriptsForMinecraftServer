/**
 * 与 @sfmc-bds/sdk package.json#exports 同步的公开子路径白名单。
 * 更新 SDK exports 时请同步本列表。
 */
export const SDK_PUBLIC_EXPORTS = [
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

/** 检查 import 源是否为合法公开入口；非法返回错误原因，合法返回 null */
export function checkSdkImportPath(
  source: string,
  extraAllowed: string[] = []
): "bare" | "private" | null {
  if (source === SDK_PREFIX) return "bare";
  if (!source.startsWith(`${SDK_PREFIX}/`)) return null;

  const sub = source.slice(SDK_PREFIX.length + 1);
  if (sub.startsWith("schemas/")) return null; // schemas/* 公开

  const allowed = new Set<string>([...SDK_PUBLIC_EXPORTS, ...extraAllowed]);
  if (allowed.has(sub)) return null;
  return "private";
}
