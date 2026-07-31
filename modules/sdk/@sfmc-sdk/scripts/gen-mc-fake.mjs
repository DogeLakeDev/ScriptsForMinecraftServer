// @ts-check
/**
 * gen-mc-fake.mjs — 从 @minecraft/server index.d.ts 生成 L0 假导出
 *
 * 用法:
 *   node scripts/gen-mc-fake.mjs
 *   node scripts/gen-mc-fake.mjs --dts <path> --out-dir <dir>
 *
 * 不把 Levi 头文件纳入；契约仅来自 pin 版 .d.ts。
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/** 手写桥已提供的运行时导出名（生成物跳过，避免覆盖）。 */
export const HAND_WRITTEN_SERVER = new Set([
  "world",
  "system",
  "Player",
  "PlayerPermissionLevel",
  "GameMode",
  "ItemStack",
  "Entity",
  "BlockComponentTypes",
  "BlockPermutation",
  "Dimension",
  "EntityInventoryComponent",
  "EntityInitializationCause",
  "default",
]);

/** @minecraft/server-ui 手写 L2（其余走 L0 生成）。 */
export const HAND_WRITTEN_SERVER_UI = new Set([
  "ActionFormData",
  "MessageFormData",
  "ModalFormData",
  "CustomForm",
  "MessageBox",
  "FormCancelationReason",
  "DataDrivenScreenClosedReason",
  "ObservableBoolean",
  "ObservableNumber",
  "ObservableString",
  "ObservableUIRawMessage",
  "uiManager",
  "default",
]);

/**
 * @typedef {{ kind: 'enum'|'class'|'function'|'const', name: string, enumBody?: string }} ValueExport
 */

/**
 * 枚举 .d.ts 中的值导出（忽略 type/interface）。
 * @param {string} source
 * @returns {ValueExport[]}
 */
export function listValueExports(source) {
  /** @type {ValueExport[]} */
  const out = [];
  const seen = new Set();

  const push = (/** @type {ValueExport} */ e) => {
    if (seen.has(e.name)) return;
    seen.add(e.name);
    out.push(e);
  };

  // export enum Name { ... }
  for (const m of source.matchAll(/export\s+enum\s+([A-Za-z_][\w]*)\s*\{([\s\S]*?)\}/g)) {
    push({ kind: "enum", name: m[1], enumBody: m[2] });
  }

  // export class Name / export declare class Name
  for (const m of source.matchAll(/export\s+(?:declare\s+)?class\s+([A-Za-z_][\w]*)\b/g)) {
    push({ kind: "class", name: m[1] });
  }

  // export function Name / export declare function Name
  for (const m of source.matchAll(/export\s+(?:declare\s+)?function\s+([A-Za-z_][\w]*)\b/g)) {
    push({ kind: "function", name: m[1] });
  }

  // export const Name
  for (const m of source.matchAll(/export\s+const\s+([A-Za-z_][\w]*)\b/g)) {
    push({ kind: "const", name: m[1] });
  }

  // export { Foo, Bar as Baz } — 仅简单标识
  for (const m of source.matchAll(/export\s*\{([^}]+)\}/g)) {
    const parts = m[1].split(",");
    for (const raw of parts) {
      const bit = raw.trim();
      if (!bit || bit.startsWith("type ")) continue;
      const asMatch = bit.match(/^([A-Za-z_][\w]*)\s+as\s+([A-Za-z_][\w]*)$/);
      const name = asMatch ? asMatch[2] : bit.match(/^([A-Za-z_][\w]*)$/)?.[1];
      if (name) push({ kind: "const", name });
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

/**
 * @param {string} body
 * @returns {Record<string, string|number>}
 */
export function parseEnumMembers(body) {
  /** @type {Record<string, string|number>} */
  const members = {};
  for (const line of body.split("\n")) {
    const t = line.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "").trim();
    if (!t || t === "{" || t === "}") continue;
    const m =
      t.match(/^([A-Za-z_][\w]*)\s*=\s*'([^']*)'\s*,?$/) ||
      t.match(/^([A-Za-z_][\w]*)\s*=\s*"([^"]*)"\s*,?$/) ||
      t.match(/^([A-Za-z_][\w]*)\s*=\s*(-?\d+)\s*,?$/);
    if (m) {
      const raw = m[2];
      members[m[1]] = /^-?\d+$/.test(raw) ? Number(raw) : raw;
      continue;
    }
    const bare = t.match(/^([A-Za-z_][\w]*)\s*,?$/);
    if (bare) members[bare[1]] = bare[1];
  }
  return members;
}

/**
 * @param {ValueExport[]} exports
 * @param {{ skip?: Set<string> }} [opts]
 */
export function emitServerL0Module(exports, opts = {}) {
  const skip = opts.skip ?? HAND_WRITTEN_SERVER;
  const lines = [
    "/**",
    " * 由 scripts/gen-mc-fake.mjs 生成 — 勿手改。",
    " * L0：可 import；未实现成员硬失败。",
    " */",
    'import { UnimplementedMinecraftApiError } from "../allowlist.js";',
    "",
    "function l0Class(apiPath: string) {",
    "  return class {",
    "    constructor(..._args: unknown[]) {",
    "      return new Proxy(this, {",
    "        get(target: object, prop: string | symbol, receiver: unknown) {",
    "          if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);",
    "          if (prop === 'then') return undefined;",
    "          if (prop === 'constructor') return Reflect.get(target, prop, receiver);",
    "          throw new UnimplementedMinecraftApiError(`${apiPath}.${String(prop)}`);",
    "        },",
    "      });",
    "    }",
    "  };",
    "}",
    "",
  ];

  /** @type {string[]} */
  const names = [];

  for (const e of exports) {
    if (skip.has(e.name)) continue;
    names.push(e.name);
    if (e.kind === "enum" && e.enumBody != null) {
      const members = parseEnumMembers(e.enumBody);
      lines.push(`export const ${e.name} = ${JSON.stringify(members, null, 2)};`);
      lines.push("");
    } else if (e.kind === "class") {
      lines.push(`export const ${e.name} = l0Class(${JSON.stringify(e.name)});`);
      lines.push("");
    } else if (e.kind === "function") {
      lines.push(
        `export function ${e.name}(..._args: unknown[]) {`,
        `  throw new UnimplementedMinecraftApiError(${JSON.stringify(e.name)});`,
        `}`
      );
      lines.push("");
    } else {
      // const：占位对象，属性访问硬失败
      lines.push(
        `export const ${e.name} = new Proxy({}, {`,
        `  get(_t: object, prop: string | symbol) {`,
        `    if (typeof prop === 'symbol') return undefined;`,
        `    if (prop === 'then') return undefined;`,
        `    throw new UnimplementedMinecraftApiError(${JSON.stringify(e.name + ".")} + String(prop));`,
        `  },`,
        `});`
      );
      lines.push("");
    }
  }

  lines.push(`export const __sfmcL0ExportNames = ${JSON.stringify(names)};`);
  lines.push("");
  return { code: lines.join("\n"), names };
}

export function resolveDefaultDtsPath() {
  try {
    return require.resolve("@minecraft/server/index.d.ts");
  } catch {
    return path.join(PKG_ROOT, "..", "..", "..", "node_modules", "@minecraft", "server", "index.d.ts");
  }
}

export function resolveServerUiDtsPath() {
  try {
    return require.resolve("@minecraft/server-ui/index.d.ts");
  } catch {
    return path.join(PKG_ROOT, "..", "..", "..", "node_modules", "@minecraft", "server-ui", "index.d.ts");
  }
}

/**
 * @param {{ dtsPath: string, outFile: string, metaFile: string, module: string, skip: Set<string> }} cfg
 */
function generateOne(cfg) {
  if (!fs.existsSync(cfg.dtsPath)) {
    console.error(`[gen-mc-fake] 找不到 .d.ts: ${cfg.dtsPath}`);
    process.exit(1);
  }
  const source = fs.readFileSync(cfg.dtsPath, "utf8");
  const exports = listValueExports(source);
  const { code, names } = emitServerL0Module(exports, { skip: cfg.skip });
  fs.mkdirSync(path.dirname(cfg.outFile), { recursive: true });
  fs.writeFileSync(cfg.outFile, code, "utf8");
  // meta 只保留稳定字段：绝对路径 / 时间戳会让 CI「生成物一致」检查永远失败
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  let dtsRel = path.relative(pkgRoot, cfg.dtsPath).replace(/\\/g, "/");
  if (dtsRel.startsWith("..")) {
    // 解析到仓库根 node_modules 时，相对路径从 monorepo 根写
    const repoRoot = path.resolve(pkgRoot, "../../..");
    dtsRel = path.relative(repoRoot, cfg.dtsPath).replace(/\\/g, "/");
  }
  fs.writeFileSync(
    cfg.metaFile,
    JSON.stringify(
      {
        module: cfg.module,
        dtsPath: dtsRel,
        totalValueExports: exports.length,
        generatedNames: names,
        skippedHandWritten: [...cfg.skip].sort(),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  console.log(`[gen-mc-fake] ${cfg.module}: exports=${exports.length}; generated=${names.length}`);
  console.log(`[gen-mc-fake] wrote ${cfg.outFile}`);
  return { total: exports.length, generated: names.length, skipped: cfg.skip.size };
}

function parseArgs(argv) {
  /** @type {{ dts?: string, outDir?: string }} */
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dts") o.dts = argv[++i];
    else if (argv[i] === "--out-dir") o.outDir = argv[++i];
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.outDir
    ? path.resolve(args.outDir)
    : path.join(PKG_ROOT, "src", "testing", "engine", "generated");

  const server = generateOne({
    module: "@minecraft/server",
    dtsPath: args.dts ? path.resolve(args.dts) : resolveDefaultDtsPath(),
    outFile: path.join(outDir, "server-l0.ts"),
    metaFile: path.join(outDir, "export-names.json"),
    skip: HAND_WRITTEN_SERVER,
  });

  const serverUi = generateOne({
    module: "@minecraft/server-ui",
    dtsPath: resolveServerUiDtsPath(),
    outFile: path.join(outDir, "server-ui-l0.ts"),
    metaFile: path.join(outDir, "export-names-ui.json"),
    skip: HAND_WRITTEN_SERVER_UI,
  });

  const metaTs = `/**
 * 由 scripts/gen-mc-fake.mjs 生成 — 勿手改。
 * 供 createSandbox().supported.l0 读取覆盖元数据。
 */
export const SERVER_L0_META = {
  module: "@minecraft/server" as const,
  totalValueExports: ${server.total},
  generated: ${server.generated},
  handWrittenSkipped: ${server.skipped},
};

export const SERVER_UI_L0_META = {
  module: "@minecraft/server-ui" as const,
  totalValueExports: ${serverUi.total},
  generated: ${serverUi.generated},
  handWrittenSkipped: ${serverUi.skipped},
};
`;
  fs.writeFileSync(path.join(outDir, "l0-meta.ts"), metaTs, "utf8");
  console.log(`[gen-mc-fake] wrote ${path.join(outDir, "l0-meta.ts")}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
