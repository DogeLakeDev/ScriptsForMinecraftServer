var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  configDir: () => configDir,
  configPath: () => configPath,
  modulePath: () => modulePath,
  readJson: () => readJson,
  resolveRuntimePath: () => resolveRuntimePath,
  resolveRuntimeRoot: () => resolveRuntimeRoot
});
module.exports = __toCommonJS(index_exports);
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path = __toESM(require("node:path"), 1);
function resolveRuntimeRoot(fallbackRoot) {
  return import_node_path.default.resolve(process.env.SFMC_ROOT || fallbackRoot);
}
function configDir(runtimeRoot) {
  return import_node_path.default.join(runtimeRoot, "configs");
}
function configPath(runtimeRoot, name) {
  return import_node_path.default.join(configDir(runtimeRoot), name);
}
function modulePath(runtimeRoot, name) {
  return import_node_path.default.join(runtimeRoot, "modules", name);
}
function readJson(filePath, fallback) {
  try {
    return JSON.parse(import_node_fs.default.readFileSync(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}
function resolveRuntimePath(runtimeRoot, configuredPath) {
  return import_node_path.default.isAbsolute(configuredPath) ? configuredPath : import_node_path.default.resolve(runtimeRoot, configuredPath);
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  configDir,
  configPath,
  modulePath,
  readJson,
  resolveRuntimePath,
  resolveRuntimeRoot
});
//# sourceMappingURL=index.js.map
