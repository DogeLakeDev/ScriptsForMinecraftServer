// src/index.ts
import fs from "node:fs";
import path from "node:path";
function resolveRuntimeRoot(fallbackRoot) {
  return path.resolve(process.env.SFMC_ROOT || fallbackRoot);
}
function configDir(runtimeRoot) {
  return path.join(runtimeRoot, "configs");
}
function configPath(runtimeRoot, name) {
  return path.join(configDir(runtimeRoot), name);
}
function modulePath(runtimeRoot, name) {
  return path.join(runtimeRoot, "modules", name);
}
function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function resolveRuntimePath(runtimeRoot, configuredPath) {
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(runtimeRoot, configuredPath);
}
export {
  configDir,
  configPath,
  modulePath,
  readJson,
  resolveRuntimePath,
  resolveRuntimeRoot
};
//# sourceMappingURL=index.js.map
