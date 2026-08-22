// @ts-check
/**
 * gen-mc-fake.mjs — 从 @minecraft/server index.d.ts 生成 L0 假导出
 *
 * 用法:
 *   node scripts/gen-mc-fake.mjs
 *   node scripts/gen-mc-fake.mjs --dts <path> --out-dir <dir>
 *
 * 不把 Levi 头文件纳入；契约仅来自 pin 版 .d.ts。
 * 手写 L1–L3 权威：src/testing/engine/overrides/exports.json（生成器跳过同名导出）。
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/** overrides 目录默认路径 */
export const DEFAULT_OVERRIDES_DIR = path.join(PKG_ROOT, "src", "testing", "engine", "overrides");

/**
 * 读取 overrides/exports.json —— 跳过集合的唯一权威来源。
 * @param {string} [overridesDir]
 * @returns {{ server: Set<string>, serverUi: Set<string>, manifestPath: string }}
 */
export function loadOverridesExportNames(overridesDir = DEFAULT_OVERRIDES_DIR) {
  const manifestPath = path.join(overridesDir, "exports.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`[gen-mc-fake] 缺少 overrides 清单: ${manifestPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(raw.server) || !Array.isArray(raw.serverUi)) {
    throw new Error(`[gen-mc-fake] exports.json 须含 server / serverUi 字符串数组`);
  }
  return {
    server: new Set(raw.server),
    serverUi: new Set(raw.serverUi),
    manifestPath,
  };
}

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
  const skip = opts.skip ?? new Set();
  const lines = [
    "/**",
    " * 由 scripts/gen-mc-fake.mjs 生成 — 勿手改。",
    " * L0：可 import；未实现成员硬失败。",
    " */",
    'import { UnimplementedMinecraftApiError } from "../unimplemented-error.js";',
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
 * pnpm 会把 require.resolve 指到 .pnpm store；meta 统一写成 node_modules/<pkg>/index.d.ts 供 CI 稳定比对。
 * @param {string} absPath
 * @param {string} moduleName 如 @minecraft/server
 */
export function normalizeDtsRelForMeta(absPath, moduleName) {
  const posix = absPath.replace(/\\/g, "/");
  const suffix = `${moduleName}/index.d.ts`;
  if (posix.endsWith(suffix) || posix.includes(`/${suffix}`)) {
    return `node_modules/${suffix}`;
  }
  const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  let dtsRel = path.relative(pkgRoot, absPath).replace(/\\/g, "/");
  if (dtsRel.startsWith("..")) {
    const repoRoot = path.resolve(pkgRoot, "../../..");
    dtsRel = path.relative(repoRoot, absPath).replace(/\\/g, "/");
  }
  return dtsRel;
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
  const dtsRel = normalizeDtsRelForMeta(cfg.dtsPath, cfg.module);
  fs.writeFileSync(
    cfg.metaFile,
    JSON.stringify(
      {
        module: cfg.module,
        dtsPath: dtsRel,
        totalValueExports: exports.length,
        generatedNames: names,
        skippedOverrides: [...cfg.skip].sort(),
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

  const overrides = loadOverridesExportNames();

  const server = generateOne({
    module: "@minecraft/server",
    dtsPath: args.dts ? path.resolve(args.dts) : resolveDefaultDtsPath(),
    outFile: path.join(outDir, "server-l0.ts"),
    metaFile: path.join(outDir, "export-names.json"),
    skip: overrides.server,
  });

  const serverUi = generateOne({
    module: "@minecraft/server-ui",
    dtsPath: resolveServerUiDtsPath(),
    outFile: path.join(outDir, "server-ui-l0.ts"),
    metaFile: path.join(outDir, "export-names-ui.json"),
    skip: overrides.serverUi,
  });

  const metaTs = `/**
 * 由 scripts/gen-mc-fake.mjs 生成 — 勿手改。
 * 供 createSandbox().supported.l0 读取覆盖元数据。
 */
export const SERVER_L0_META = {
  module: "@minecraft/server" as const,
  totalValueExports: ${server.total},
  generated: ${server.generated},
  overridesSkipped: ${server.skipped},
};

export const SERVER_UI_L0_META = {
  module: "@minecraft/server-ui" as const,
  totalValueExports: ${serverUi.total},
  generated: ${serverUi.generated},
  overridesSkipped: ${serverUi.skipped},
};
`;
  fs.writeFileSync(path.join(outDir, "l0-meta.ts"), metaTs, "utf8");
  console.log(`[gen-mc-fake] wrote ${path.join(outDir, "l0-meta.ts")}`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
