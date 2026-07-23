import { configPath, patchJson, readJson, type RuntimeConfig } from "@sfmc-bds/sdk/node/config";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./runtime.js";

const PACKAGES_DIRNAME = "packages";

export interface SfmcModulePackage {
  /** packages/ 下的文件夹名（install id） */
  id: string;
  /** 绝对路径 */
  path: string;
  /** manifest 中的逻辑 id，缺省为 feature-<folder> */
  logicalId: string;
  name: string;
}

function isSfmcModulesRoot(dir: string): boolean {
  const packagesDir = path.join(dir, PACKAGES_DIRNAME);
  return existsSync(packagesDir) && existsSync(path.join(dir, "index.json"));
}

/** 自动探测旁路 sfmc-modules（不要求根目录有 package.json）。 */
export function detectSiblingSfmcModulesRoot(): string | null {
  const sibling = path.resolve(ROOT, "..", "sfmc-modules");
  return isSfmcModulesRoot(sibling) ? sibling : null;
}

/** 从 runtime.json 读取曾保存的 sfmc-modules 根。 */
export function readPersistedSfmcModulesRoot(rootDir: string = ROOT): string | null {
  const runtime = readJson<RuntimeConfig>(configPath(rootDir, "runtime.json"));
  const saved = runtime?.sfmc_modules_root;
  if (typeof saved !== "string" || !saved.trim()) return null;
  const resolved = path.resolve(saved);
  return isSfmcModulesRoot(resolved) ? resolved : null;
}

/** 写入 runtime.json，下次免输路径。 */
export function persistSfmcModulesRoot(modulesRoot: string, rootDir: string = ROOT): void {
  const slash = modulesRoot.replace(/\\/g, "/");
  patchJson<RuntimeConfig>(configPath(rootDir, "runtime.json"), { sfmc_modules_root: slash });
}

/**
 * 解析 sfmc-modules 根目录。
 * 优先级：SFMC_MODULES_ROOT 环境变量 → runtime.json → 旁路 ../sfmc-modules
 */
export function resolveSfmcModulesRoot(rootDir: string = ROOT): string | null {
  const fromEnv = process.env.SFMC_MODULES_ROOT;
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (isSfmcModulesRoot(resolved)) return resolved;
  }
  const persisted = readPersistedSfmcModulesRoot(rootDir);
  if (persisted) return persisted;
  return detectSiblingSfmcModulesRoot();
}

/** 枚举 sfmc-modules/packages 下可安装的模块包。 */
export function listSfmcModulePackages(modulesRoot: string): SfmcModulePackage[] {
  const packagesDir = path.join(modulesRoot, PACKAGES_DIRNAME);
  if (!existsSync(packagesDir)) return [];
  const out: SfmcModulePackage[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    const pkgPath = path.join(packagesDir, id);
    const manifestPath = path.join(pkgPath, "sapi", "manifest.json");
    let logicalId = `feature-${id}`;
    let name = id;
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
          id?: string;
          name?: string;
        };
        if (manifest.id) logicalId = manifest.id;
        if (manifest.name) name = manifest.name;
      } catch {
        /* 损坏 manifest 仍列出文件夹 */
      }
    }
    out.push({ id, path: pkgPath, logicalId, name });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

export function packageDirForId(modulesRoot: string, folderId: string): string {
  return path.join(modulesRoot, PACKAGES_DIRNAME, folderId);
}
