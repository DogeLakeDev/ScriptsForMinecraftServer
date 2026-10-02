import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { parse, type ParseError } from "jsonc-parser";
import type { ConfigDocument } from "@sfmc-bds/management";
import { resolveSdkPackageRoot, ROOT } from "../runtime.js";
import { resolveBdsContext } from "../pack-lifecycle.js";
import { readJson, stripBom } from "./domain.js";

/** 磁盘上的真实文件名。schema 文件仍用下划线（log_filter.schema.json）。 */
const CORE_FILES = ["runtime.json", "db_config.json", "qq_config.json", "bds_updater.json", "permissions.json", "log-filter.json", "module-update.json", "pack-update.json"];
const SCHEMA_STEM: Record<string, string> = {
  "log-filter.json": "log_filter",
  "module-update.json": "module_update",
  "pack-update.json": "pack_update",
};
const ajv = new Ajv2020.default({ allErrors: true, strict: false });
const validators = new Map<string, ReturnType<typeof ajv.compile>>();
export function configFiles(): Map<string, string> {
  const files = new Map(CORE_FILES.map(name => [`core/${name}`, path.join(ROOT, "configs", name)]));
  files.set("bds/server.properties", path.join(resolveBdsContext().bdsRoot, "server.properties"));
  const modules = path.join(ROOT, "modules", "packages");
  if (fs.existsSync(modules)) for (const entry of fs.readdirSync(modules, { withFileTypes: true })) {
    if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
    const configDir = path.join(modules, entry.name, "configs");
    if (!fs.existsSync(configDir)) continue;
    for (const filename of fs.readdirSync(configDir)) if (/^[\w.-]+\.jsonc?$/.test(filename)) files.set(`module/${entry.name}/${filename}`, path.join(configDir, filename));
  }
  // 真实实例的模块配置写在 <SFMC_ROOT>/configs/<configKey>.json，目录名来自 catalog.configKey。
  const catalog = readJson<{ modules?: { id?: string; configKey?: string }[] }>(path.join(ROOT, "modules", "catalog.json"), {});
  const taken = new Set([...files.values()].map(file => path.resolve(file)));
  for (const row of catalog.modules ?? []) {
    if (!row.id || !row.configKey || !/^[\w.-]+$/.test(row.id) || !/^[\w.-]+$/.test(row.configKey)) continue;
    const filename = `${row.configKey}.json`;
    const file = path.join(ROOT, "configs", filename);
    if (!fs.existsSync(file) || taken.has(path.resolve(file))) continue;
    files.set(`module/${row.id}/${filename}`, file);
    taken.add(path.resolve(file));
  }
  return files;
}
export function configPath(key: string): string {
  const file = configFiles().get(key);
  if (!file) throw Object.assign(new Error("配置不在允许编辑的列表中"), { code: "validation" });
  if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error("不能通过配置文件链接写入其他文件");
  return file;
}
export function revision(text: string) { return createHash("sha256").update(text).digest("hex"); }
export function readDocument(key: string): ConfigDocument {
  const file = configPath(key);
  const text = fs.existsSync(file) ? stripBom(fs.readFileSync(file, "utf8")) : "";
  let schema: object | undefined;
  if (key.startsWith("core/")) {
    const name = SCHEMA_STEM[path.basename(file)] ?? path.basename(file, ".json");
    const schemaFile = path.join(resolveSdkPackageRoot(), "schemas", `${name}.schema.json`);
    if (fs.existsSync(schemaFile)) schema = JSON.parse(fs.readFileSync(schemaFile, "utf8")) as object;
  } else if (key.startsWith("module/")) {
    const schemaFile = path.join(path.dirname(file), `${path.basename(file).replace(/\.jsonc?$/, "")}.schema.json`);
    if (fs.existsSync(schemaFile)) schema = JSON.parse(fs.readFileSync(schemaFile, "utf8")) as object;
  }
  return { key, text, revision: revision(text), ...(schema ? { schema } : {}), format: file.endsWith(".properties") ? "properties" : file.endsWith(".jsonc") ? "jsonc" : "json", affectedServices: ["db", "tunnel", "qq", "llbot", "bds"] };
}
export function validateDocument(document: ConfigDocument, text: string) {
  if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error("配置文件过大");
  if (document.format === "properties") {
    for (const line of text.split(/\r?\n/)) if (line.trim() && !line.trim().startsWith("#") && !/^[^=\r\n]+=.*$/.test(line)) throw new Error("server.properties 包含非法配置行");
    return;
  }
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { allowTrailingComma: document.format === "jsonc", disallowComments: document.format === "json" });
  if (errors.length) throw Object.assign(new Error("配置语法错误"), { code: "validation", details: errors });
  if (document.schema) {
    // 保留已有未知字段；只从校验副本排除未修改的未知字段，保存的原文仍完全保留。
    const schemaObject = document.schema as { additionalProperties?: boolean; properties?: Record<string, unknown> };
    if (schemaObject.additionalProperties === false && value && typeof value === "object" && !Array.isArray(value)) {
      const previous = parse(document.text || "{}") as Record<string, unknown>;
      for (const key of Object.keys(value)) if (!(key in (schemaObject.properties ?? {})) && previous && key in previous && JSON.stringify(previous[key]) === JSON.stringify((value as Record<string, unknown>)[key])) delete (value as Record<string, unknown>)[key];
    }
    const hash = revision(JSON.stringify(document.schema));
    let validator = validators.get(hash);
    if (!validator) { const schema = { ...document.schema } as Record<string, unknown>; delete schema.$id; validator = ajv.compile(schema); validators.set(hash, validator); }
    if (!validator(value)) throw Object.assign(new Error("配置不符合 Schema"), { code: "validation", details: validator.errors });
  }
}
export function saveDocument(key: string, expected: string, text: string) {
  const document = readDocument(key);
  if (document.revision !== expected) throw Object.assign(new Error("配置已被其他操作修改，请重新读取"), { code: "conflict" });
  validateDocument(document, text);
  const file = configPath(key); const temp = `${file}.${randomUUID()}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, text, { mode: 0o600 }); fs.renameSync(temp, file);
  return document;
}
