/**
 * 从模块根装载真实 SAPI 入口（sapi/src/index.ts），取得 ModuleDescriptor。
 * 对齐扩展 / playground-host 消费面；非 allowlist 玩具入口。
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ModuleDescriptor } from "@sfmc-bds/sdk/module-loader";

const ENTRY_CANDIDATES = ["sapi/src/index.ts", "sapi/src/index.js", "sapi/src/index.mjs"] as const;

/** 解析模块入口文件路径；找不到则抛错。 */
export function resolveModuleEntry(moduleRoot: string): string {
  const root = path.resolve(moduleRoot);
  for (const rel of ENTRY_CANDIDATES) {
    const full = path.join(root, rel);
    if (fs.existsSync(full)) return full;
  }
  throw new Error(
    `找不到模块入口（需 ${ENTRY_CANDIDATES.join(" / ")}）: ${root}`
  );
}

function isDescriptor(v: unknown): v is ModuleDescriptor {
  if (!v || typeof v !== "object") return false;
  const d = v as ModuleDescriptor;
  return typeof d.id === "string" && !!d.id.trim() && !!d.lifecycle && typeof d.lifecycle === "object";
}

/**
 * 动态 import 模块入口并返回 DESCRIPTOR。
 * 使用 cache-bust 查询串，保证「重置场景」能拿到最新源码。
 * 入口副作用可能已 ModuleRegistry.register；调用方在 reset 之后应再 register 一次（按 id 去重）。
 */
export async function loadModuleDescriptor(moduleRoot: string): Promise<ModuleDescriptor> {
  const entryFs = resolveModuleEntry(moduleRoot);
  const url = `${pathToFileURL(entryFs).href}?sfmc=${Date.now()}`;
  let mod: Record<string, unknown>;
  try {
    mod = (await import(url)) as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `装载模块入口失败: ${entryFs}\n${msg}\n提示：.ts 入口需 --import tsx/esm 或 Node strip-types`,
      { cause: e instanceof Error ? e : undefined }
    );
  }
  if (!isDescriptor(mod.DESCRIPTOR)) {
    throw new Error(
      `模块入口须 export const DESCRIPTOR: ModuleDescriptor（与 ModuleRegistry.register 同源）: ${entryFs}`
    );
  }
  return mod.DESCRIPTOR;
}
