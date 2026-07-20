import fs from "node:fs";
import path from "node:path";

export function resolveRuntimeRoot(fallbackRoot: string): string {
  return path.resolve(process.env.SFMC_ROOT || fallbackRoot);
}

export function configDir(runtimeRoot: string): string {
  return path.join(runtimeRoot, "configs");
}

export function configPath(runtimeRoot: string, name: string): string {
  return path.join(configDir(runtimeRoot), name);
}

export function modulePath(runtimeRoot: string, name: string): string {
  return path.join(runtimeRoot, "modules", name);
}

export function readJson<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function resolveRuntimePath(runtimeRoot: string, configuredPath: string): string {
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(runtimeRoot, configuredPath);
}
