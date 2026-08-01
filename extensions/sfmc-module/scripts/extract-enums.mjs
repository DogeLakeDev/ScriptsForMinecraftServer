// @ts-check
/**
 * 一次性脚本：从 node_modules/@minecraft/server/index.d.ts 抽取所有 export enum / export interface（选项型）成员，生成两个静态映射：
 * - ENUM_MEMBERS：枚举类型名 → 成员名列表（select 选项来源）
 * - INTERFACE_MEMBERS：interface/type 别名（形如 *Options）→ { name, type, readonly } 字段列表（嵌套子表单来源）
 *
 * 二者都嵌入到 webview bundle，运行时无需 d.ts / Node fs。
 * 重新生成：升级 @minecraft/server 时跑一次（与根 package.json devDependencies pin 同步）。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DTS = path.resolve(
  ROOT,
  "../../node_modules/@minecraft/server/index.d.ts"
);
const OUT_DIR = path.join(__dirname, "..", "src/playground/graph-ui/metaForm");
const OUT_ENUMS = path.join(OUT_DIR, "enums.generated.ts");
const OUT_INTERFACES = path.join(OUT_DIR, "interfaces.generated.ts");

if (!fs.existsSync(DTS)) {
  console.error(`[extract-type-meta] missing d.ts at ${DTS}`);
  process.exit(1);
}

const source = fs.readFileSync(DTS, "utf8");

/* === enums === */

const enumRe = new RegExp("^export\\s+enum\\s+(\\w+)\\s*\\{(.*?)\\n\\}", "gms");
const enums = {};
for (const m of source.matchAll(enumRe)) {
  const name = m[1];
  const body = m[2];
  /** @type {string[]} */
  const members = [];
  for (const line of body.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("*") || trimmed.startsWith("//")) continue;
    const memberMatch = trimmed.match(/^([A-Za-z_][\w]*)\s*[=,]?/);
    if (memberMatch) members.push(memberMatch[1]);
  }
  if (members.length) enums[name] = members;
}

/* === interfaces (type aliases + interfaces) ===
 * 解析 `export interface Name { ... }` 和 `export type Name = { ... }`，
 * 提取顶层声明的字段。注意：嵌套类型同样会被 flatten 解析。
 * 只识别 *Options / *Payload / *Config / *Description / *Range / *Source 等形参选项类（按后缀启发式），
 * 其它工具类（EntityIterateOptions、BoundingBoxData…）默认也包含，因为提取便宜、消费端按需渲染。
 */

const blockRe = new RegExp(
  "(^export\\s+(?:declare\\s+)?(?:interface|type)\\s+([A-Za-z_][\\w]*)\\s*(?:<[^>]*>)?\\s*(?:extends\\s+\\w+(?:<[^>]*>)?(?:,\\s*\\w+(?:<[^>]*>)?)*\\s*)?(?:=\\s*)?\\{)(.*?)\\n\\}",
  "gms"
);
const interfaces = {};

for (const m of source.matchAll(blockRe)) {
  const name = m[2];
  const body = m[3];
  if (interfaces[name]) continue;
  const fields = parseInterfaceBody(body);
  if (fields.length) interfaces[name] = fields;
}

/**
 * @param {string} body
 * @returns {{ name: string, type: string, readonly: boolean, optional: boolean }[]}
 */
function parseInterfaceBody(body) {
  /** @type {{ name: string, type: string, readonly: boolean, optional: boolean }[]} */
  const fields = [];
  const seen = new Set();
  const lines = body.split(/\n/);
  let pending = false;
  for (let i = 0; i < lines.length; i++) {
    let raw = lines[i];
    let line = raw.trim();
    if (!line || line.startsWith("*") || line.startsWith("//") || line.startsWith("/*")) {
      continue;
    }
    // 处理跨行字段：`propName:` 一行，下行续类型
    let propMatch = line.match(/^(readonly\s+)?([A-Za-z_][\w]*)(\?)?\s*:\s*(.+?)(;|,|\n|$)/);
    if (!propMatch && /^[A-Za-z_][\w]*\??\s*:$/.test(line)) {
      pending = true;
      continue;
    }
    if (pending && !propMatch) {
      line = line.replace(/^/, "");
      propMatch = line.match(/^(readonly\s+)?([A-Za-z_][\w]*)\??\s*:\s*(.+?)(;|,|\n|$)/);
      pending = false;
    }
    if (!propMatch) continue;
    const readonly = Boolean(propMatch[1]);
    const fname = propMatch[2];
    const optional = Boolean(propMatch[3]);
    let ftype = propMatch[4];
    // 处理 union（Foo | Bar）和泛型，抽主干单词
    ftype = ftype.replace(/\s+/g, " ").trim();
    if (!seen.has(fname)) {
      seen.add(fname);
      fields.push({ name: fname, type: ftype, readonly, optional });
    }
  }
  return fields;
}

function writeGenerated(outPath, header, body) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, header + body, "utf8");
}

writeGenerated(
  OUT_ENUMS,
  [
    "/**",
    " * 自动生成（由 scripts/extract-enums.mjs）—— 从 @minecraft/server/index.d.ts 抽取所有 export enum 的成员名。",
    " * 升级 @minecraft/server 时重新跑一次。",
    " */",
    "",
  ].join("\n"),
  [
    "export const ENUM_MEMBERS: Readonly<Record<string, readonly string[]>> = "
      + JSON.stringify(enums, null, 2)
      + ";",
    "",
    "export function getEnumMembers(typeName: string): readonly string[] | null {",
    "  return ENUM_MEMBERS[typeName] ?? null;",
    "}",
    "",
  ].join("\n")
);

writeGenerated(
  OUT_INTERFACES,
  [
    "/**",
    " * 自动生成（由 scripts/extract-enums.mjs）—— 从 @minecraft/server/index.d.ts 抽取 export interface / type 别名 的可渲染字段。",
    " * 嵌套子表单来源；运行时按 typeName 在此表中查得字段列表，未命中则回退 JSON 编辑。",
    " * 升级 @minecraft/server 时重新跑一次。",
    " */",
    "",
    "export interface InterfaceProp {",
    "  name: string;",
    "  type: string;",
    "  readonly: boolean;",
    "  optional: boolean;",
    "}",
    "",
    "export const INTERFACE_MEMBERS: Readonly<Record<string, readonly InterfaceProp[]>> = "
      + JSON.stringify(interfaces, null, 2)
      + ";",
    "",
    "export function getInterfaceProps(typeName: string): readonly InterfaceProp[] | null {",
    "  return INTERFACE_MEMBERS[typeName] ?? null;",
    "}",
    "",
  ].join("\n")
);

console.log(
  `[extract-type-meta] enums=${Object.keys(enums).length} interfaces=${Object.keys(interfaces).length}`
);
