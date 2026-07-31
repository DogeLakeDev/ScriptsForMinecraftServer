// @ts-check
/**
 * gen-playground-meta.mjs — 从 @minecraft/server .d.ts 生成 Playground 1:1 元数据
 *
 * 产出：
 * - classes：可构造/操作类型 + 全部 Event 类型成员（含 extends 合并）
 * - methods[].parameters：方法形参名/类型/optional（Call 表单权威）
 * - events：四大 hub 信号名列表
 * - eventTypes：hub.signal → Event 类名（emit 表单权威）
 */

import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/** 世界对象侧可操作类型（Event 类型由 hub 反推，不在此手写）。 */
export const TARGET_CLASSES = [
  "Player",
  "Entity",
  "ItemStack",
  "Block",
  "Dimension",
  "World",
  "System",
  "Container",
  "BlockPermutation",
  "Scoreboard",
  "ScoreboardObjective",
];

export const EVENT_HUBS = [
  { hub: "system.beforeEvents", className: "SystemBeforeEvents" },
  { hub: "system.afterEvents", className: "SystemAfterEvents" },
  { hub: "world.beforeEvents", className: "WorldBeforeEvents" },
  { hub: "world.afterEvents", className: "WorldAfterEvents" },
];

/**
 * @param {string} source
 * @param {string} className
 * @returns {string | null}
 */
export function extractClassBody(source, className) {
  const re = new RegExp(`export\\s+(?:declare\\s+)?class\\s+${className}\\b[^{]*\\{`, "m");
  const m = re.exec(source);
  if (!m || m.index == null) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

/**
 * @param {string} source
 * @param {string} className
 * @returns {string | null}
 */
export function extractExtends(source, className) {
  const re = new RegExp(
    `export\\s+(?:declare\\s+)?class\\s+${className}\\b\\s+extends\\s+([A-Za-z_][\\w]*)`,
    "m"
  );
  const m = re.exec(source);
  return m ? m[1] : null;
}

/**
 * @param {string} raw
 * @returns {{ name: string, type: string, optional: boolean, rest: boolean }[]}
 */
export function parseParamList(raw) {
  const text = raw.trim();
  if (!text) return [];
  /** @type {string[]} */
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if ("<{[(".includes(ch)) depth++;
    else if (">}])".includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());

  return parts.map((p) => {
    const rest = p.startsWith("...");
    const s = rest ? p.slice(3).trim() : p;
    const m = s.match(/^([A-Za-z_][\w]*)(\?)?\s*:\s*(.+)$/);
    if (!m) {
      return { name: s.replace(/\?.*$/, "") || "arg", type: "unknown", optional: true, rest };
    }
    return {
      name: m[1],
      optional: Boolean(m[2]) || rest,
      type: m[3].trim().replace(/\s+/g, " "),
      rest,
    };
  });
}

/**
 * @param {string} body
 * @returns {{
 *   properties: { name: string, readonly: boolean, type: string }[],
 *   methods: { name: string, parameters: { name: string, type: string, optional: boolean, rest: boolean }[] }[]
 * }}
 */
export function parseClassMembers(body) {
  const stripped = body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  /** @type {{ name: string, readonly: boolean, type: string }[]} */
  const properties = [];
  /** @type {{ name: string, parameters: { name: string, type: string, optional: boolean, rest: boolean }[] }[]} */
  const methods = [];
  const seenProp = new Set();
  const seenMethod = new Set();

  let i = 0;
  const n = stripped.length;

  const skipWs = () => {
    while (i < n && /\s/.test(stripped[i] ?? "")) i++;
  };

  while (i < n) {
    skipWs();
    if (i >= n) break;

    // 跳过 private / protected 成员至分号（深度 0）
    if (/^(private|protected)\b/.test(stripped.slice(i))) {
      let depth = 0;
      while (i < n) {
        const ch = stripped[i++];
        if ("<{[(".includes(ch)) depth++;
        else if (">}])".includes(ch)) depth = Math.max(0, depth - 1);
        else if (ch === ";" && depth === 0) break;
      }
      continue;
    }

    const readonly = /^readonly\b/.test(stripped.slice(i));
    if (readonly) {
      i += "readonly".length;
      skipWs();
    }

    const nameMatch = stripped.slice(i).match(/^([A-Za-z_][\w]*)/);
    if (!nameMatch) {
      i++;
      continue;
    }
    const name = nameMatch[1];
    i += name.length;
    skipWs();

    // 泛型方法：name<...>(...)
    if (stripped[i] === "<") {
      let depth = 0;
      while (i < n) {
        const ch = stripped[i++];
        if (ch === "<") depth++;
        else if (ch === ">") {
          depth--;
          if (depth === 0) break;
        }
      }
      skipWs();
    }

    if (stripped[i] === "(") {
      // 方法：吃掉配对括号内形参
      i++; // (
      let depth = 1;
      let paramsRaw = "";
      while (i < n && depth > 0) {
        const ch = stripped[i++];
        if (ch === "(") depth++;
        else if (ch === ")") {
          depth--;
          if (depth === 0) break;
        }
        if (depth > 0) paramsRaw += ch;
      }
      // 吃掉返回类型直到 ;
      let depth2 = 0;
      while (i < n) {
        const ch = stripped[i++];
        if ("<{[(".includes(ch)) depth2++;
        else if (">}])".includes(ch)) depth2 = Math.max(0, depth2 - 1);
        else if (ch === ";" && depth2 === 0) break;
      }
      if (name !== "constructor" && !seenMethod.has(name)) {
        seenMethod.add(name);
        methods.push({ name, parameters: parseParamList(paramsRaw) });
      }
      continue;
    }

    if (stripped[i] === "?" || stripped[i] === ":") {
      if (stripped[i] === "?") i++;
      skipWs();
      if (stripped[i] !== ":") continue;
      i++; // :
      skipWs();
      let type = "";
      let depth = 0;
      while (i < n) {
        const ch = stripped[i];
        if ("<{[(".includes(ch)) depth++;
        else if (">}])".includes(ch)) depth = Math.max(0, depth - 1);
        if (ch === ";" && depth === 0) {
          i++;
          break;
        }
        type += ch;
        i++;
      }
      if (!seenProp.has(name)) {
        seenProp.add(name);
        properties.push({
          name,
          readonly,
          type: type.trim().replace(/\s+/g, " "),
        });
      }
      continue;
    }

    // 无法识别：前进
    i++;
  }

  properties.sort((a, b) => a.name.localeCompare(b.name));
  methods.sort((a, b) => a.name.localeCompare(b.name));
  return { properties, methods };
}

/**
 * 合并基类成员；子类同名覆盖。
 * @param {{ properties: any[], methods: any[] }} base
 * @param {{ properties: any[], methods: any[] }} own
 */
export function mergeMembers(base, own) {
  const propMap = new Map();
  for (const p of base.properties) propMap.set(p.name, p);
  for (const p of own.properties) propMap.set(p.name, p);
  const methMap = new Map();
  for (const m of base.methods) methMap.set(m.name, m);
  for (const m of own.methods) methMap.set(m.name, m);
  const properties = [...propMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const methods = [...methMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  return { properties, methods };
}

/**
 * 解析类成员并沿 extends 链合并（避免环）。
 * @param {string} source
 * @param {string} className
 * @param {Set<string>} [seen]
 */
export function resolveClassMembers(source, className, seen = new Set()) {
  if (seen.has(className)) {
    return { properties: [], methods: [] };
  }
  seen.add(className);
  const body = extractClassBody(source, className);
  if (!body) return { properties: [], methods: [] };
  const own = parseClassMembers(body);
  const parent = extractExtends(source, className);
  if (!parent) return own;
  const base = resolveClassMembers(source, parent, seen);
  return mergeMembers(base, own);
}

/**
 * @param {string} source
 * @param {string} className
 */
export function listHubSignals(source, className) {
  const body = extractClassBody(source, className);
  if (!body) return [];
  const { properties } = parseClassMembers(body);
  return properties.map((p) => p.name).sort((a, b) => a.localeCompare(b));
}

/**
 * hub 类属性：信号名 → Signal 类型名
 * @param {string} source
 * @param {string} hubClassName
 * @returns {{ name: string, signalType: string }[]}
 */
export function listHubSignalEntries(source, hubClassName) {
  const body = extractClassBody(source, hubClassName);
  if (!body) return [];
  const { properties } = parseClassMembers(body);
  return properties
    .map((p) => ({ name: p.name, signalType: p.type.replace(/\s+/g, "") }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 从 *EventSignal 类体解析 subscribe 回调参数类型；失败则剥 Signal 后缀。
 * @param {string} source
 * @param {string} signalType
 */
export function resolveEventType(source, signalType) {
  const body = extractClassBody(source, signalType);
  if (body) {
    const m = body.match(/subscribe\s*\(\s*callback\s*:\s*\(\s*arg0\s*:\s*([A-Za-z_][\w]*)/);
    if (m) return m[1];
    const m2 = body.match(/subscribe\s*\([^)]*:\s*\(\s*\w+\s*:\s*([A-Za-z_][\w]*)/);
    if (m2) return m2[1];
  }
  if (signalType.endsWith("Signal")) return signalType.slice(0, -"Signal".length);
  return signalType;
}

/**
 * Fake* 类型 / class 名 → PLAYGROUND_META 类名。
 * 推断规则：overrides 里声明的自有成员 = L2；TARGET 其余默认 L0。
 */
export const OVERRIDE_TYPE_TO_CLASS = {
  FakePlayer: "Player",
  FakeEntity: "Entity",
  FakeWorld: "World",
  FakeSystem: "System",
  FakeDimension: "Dimension",
  FakeBlock: "Block",
  FakeBlockPermutation: "BlockPermutation",
  FakeScoreboard: "Scoreboard",
  FakeScoreboardObjective: "ScoreboardObjective",
  FakeContainer: "Container",
  FakeScreenDisplay: "ScreenDisplay",
  FakeEntityHealthComponent: "EntityHealthComponent",
  ItemStack: "ItemStack",
};

/**
 * 从 type/class 体解析成员名（属性 + 方法）；忽略 `_` 前缀内部字段。
 * @param {string} body
 * @returns {Set<string>}
 */
export function extractOwnMemberNames(body) {
  const { properties, methods } = parseClassMembers(body);
  const names = new Set();
  for (const p of properties) {
    if (!p.name.startsWith("_")) names.add(p.name);
  }
  for (const m of methods) {
    if (!m.name.startsWith("_")) names.add(m.name);
  }
  return names;
}

/**
 * 提取 `export type Name = { ... }` 体。
 * @param {string} source
 * @param {string} typeName
 */
export function extractTypeAliasBody(source, typeName) {
  const re = new RegExp(`export\\s+type\\s+${typeName}\\b[^=]*=\\s*\\{`, "m");
  const m = re.exec(source);
  if (!m || m.index == null) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start + 1, i);
    }
  }
  return null;
}

/**
 * 扫描 overrides 目录，得到 className → L2 成员名集合。
 * Player 合并 Entity 表面（继承）。
 * @param {string} overridesDir
 * @returns {Record<string, Set<string>>}
 */
export function loadL2SurfaceFromOverrides(overridesDir) {
  /** @type {Record<string, Set<string>>} */
  const byClass = {};
  if (!fs.existsSync(overridesDir)) return byClass;

  for (const file of fs.readdirSync(overridesDir)) {
    if (!file.endsWith(".ts")) continue;
    const source = fs.readFileSync(path.join(overridesDir, file), "utf8");
    for (const [typeName, className] of Object.entries(OVERRIDE_TYPE_TO_CLASS)) {
      const body = extractTypeAliasBody(source, typeName) ?? extractClassBody(source, typeName);
      if (!body) continue;
      const names = extractOwnMemberNames(body);
      if (!byClass[className]) byClass[className] = new Set();
      for (const n of names) byClass[className].add(n);
    }
  }

  // Player extends Entity：Entity L2 对 Player 也算 L2
  if (byClass.Entity) {
    if (!byClass.Player) byClass.Player = new Set();
    for (const n of byClass.Entity) byClass.Player.add(n);
  }
  return byClass;
}

/**
 * 读取 l2-skip.json（实现面跳过名单；≠ L0 名面 allowlist）。
 * @param {string} skipPath
 * @returns {Record<string, Set<string>>} className → 成员名
 */
export function loadL2Skip(skipPath) {
  /** @type {Record<string, Set<string>>} */
  const byClass = {};
  if (!fs.existsSync(skipPath)) return byClass;
  const raw = JSON.parse(fs.readFileSync(skipPath, "utf8"));
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  for (const ref of entries) {
    const s = typeof ref === "string" ? ref : ref?.ref;
    if (typeof s !== "string" || !s.includes(".")) continue;
    const dot = s.indexOf(".");
    const className = s.slice(0, dot);
    const member = s.slice(dot + 1);
    if (!className || !member) continue;
    if (!byClass[className]) byClass[className] = new Set();
    byClass[className].add(member);
  }
  // Player extends Entity：Entity skip 对 Player 也算 skip
  if (byClass.Entity) {
    if (!byClass.Player) byClass.Player = new Set();
    for (const n of byClass.Entity) byClass.Player.add(n);
  }
  return byClass;
}

/**
 * @param {string | undefined} className
 * @param {string} member
 * @param {Record<string, Set<string>> | undefined} l2Skip
 */
function isSkipped(className, member, l2Skip) {
  return Boolean(className && l2Skip?.[className]?.has(member));
}

/**
 * 给 TARGET / 已实现类成员打 impl 标记。
 * skip 优先于 l2（黑名单命中 → skip，即便 overrides 误实现）。
 * @param {ReturnType<typeof buildPlaygroundMeta>} meta
 * @param {Record<string, Set<string>>} l2Surface
 * @param {Record<string, Set<string>>} [l2Skip]
 */
export function annotateImpl(meta, l2Surface, l2Skip = {}) {
  for (const [className, entry] of Object.entries(meta.classes)) {
    const surface = l2Surface[className];
    const isEvent = entry.kind === "event";
    entry.properties = entry.properties.map((p) => {
      if (!isEvent && isSkipped(className, p.name, l2Skip)) {
        return { ...p, impl: "skip" };
      }
      return {
        ...p,
        // Event 属性袋视为可填 L2；对象类按 overrides 自有成员推断
        impl: isEvent || (surface && surface.has(p.name)) ? "l2" : "l0",
      };
    });
    entry.methods = (entry.methods ?? []).map((m) => {
      if (isSkipped(className, m.name, l2Skip)) {
        return { ...m, impl: "skip" };
      }
      return {
        ...m,
        impl: surface && surface.has(m.name) ? "l2" : "l0",
      };
    });
  }
  return meta;
}

/**
 * @param {string} source
 * @param {{ l2Surface?: Record<string, Set<string>>, l2Skip?: Record<string, Set<string>> }} [opts]
 */
export function buildPlaygroundMeta(source, opts = {}) {
  /** @type {Record<string, { properties: { name: string, readonly: boolean, type: string, impl?: string }[], methods: { name: string, parameters: { name: string, type: string, optional: boolean, rest: boolean }[], impl?: string }[], kind?: string, extends?: string }>} */
  const classes = {};
  for (const name of TARGET_CLASSES) {
    if (!extractClassBody(source, name)) continue;
    const parent = extractExtends(source, name);
    const members = resolveClassMembers(source, name);
    /** @type {{ properties: typeof members.properties, methods: typeof members.methods, kind: string, extends?: string }} */
    const entry = { ...members, kind: "object" };
    if (parent) entry.extends = parent;
    classes[name] = entry;
  }

  /** @type {Record<string, string[]>} */
  const events = {};
  /** @type {Record<string, { eventType: string, signalType: string }>} */
  const eventTypes = {};

  for (const { hub, className } of EVENT_HUBS) {
    const entries = listHubSignalEntries(source, className);
    events[hub] = entries.map((e) => e.name);
    for (const { name, signalType } of entries) {
      const eventType = resolveEventType(source, signalType);
      eventTypes[`${hub}.${name}`] = { eventType, signalType };
      if (!classes[eventType]) {
        const body = extractClassBody(source, eventType);
        if (body) {
          classes[eventType] = { ...parseClassMembers(body), kind: "event" };
        } else {
          classes[eventType] = { properties: [], methods: [], kind: "event" };
        }
      }
    }
  }

  const meta = {
    generatedAt: "gen-playground-meta",
    classes,
    events,
    eventTypes,
  };

  if (opts.l2Surface || opts.l2Skip) {
    annotateImpl(meta, opts.l2Surface ?? {}, opts.l2Skip ?? {});
  }
  return meta;
}

/**
 * @param {unknown} meta
 */
export function emitPlaygroundMetaTs(meta) {
  return [
    "/**",
    " * 由 scripts/gen-playground-meta.mjs 生成 — 勿手改。",
    " * Playground / sb.objects / sb.events 的 1:1 表面权威。",
    " */",
    "",
    `export const PLAYGROUND_META = ${JSON.stringify(meta, null, 2)} as const;`,
    "",
    "export type PlaygroundMeta = typeof PLAYGROUND_META;",
    "",
  ].join("\n");
}

function resolveDefaultDts() {
  try {
    return require.resolve("@minecraft/server/index.d.ts");
  } catch {
    return path.join(PKG_ROOT, "../../node_modules/@minecraft/server/index.d.ts");
  }
}

function parseArgs(argv) {
  /** @type {{ dts?: string, out?: string }} */
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dts") o.dts = argv[++i];
    else if (argv[i] === "--out") o.out = argv[++i];
  }
  return o;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const dtsPath = args.dts ?? resolveDefaultDts();
  const outPath =
    args.out ?? path.join(PKG_ROOT, "src/testing/engine/generated/playground-meta.ts");
  const overridesDir = path.join(PKG_ROOT, "src/testing/engine/overrides");
  const skipPath = path.join(PKG_ROOT, "src/testing/engine/l2-skip.json");
  const source = fs.readFileSync(dtsPath, "utf8");
  const l2Surface = loadL2SurfaceFromOverrides(overridesDir);
  const l2Skip = loadL2Skip(skipPath);
  // 可选：overrides 不应实现 skip 项（实现面黑名单）
  for (const [className, members] of Object.entries(l2Skip)) {
    const surface = l2Surface[className];
    if (!surface) continue;
    for (const name of members) {
      if (surface.has(name)) {
        console.warn(
          `[gen-playground-meta] warn: ${className}.${name} 在 l2-skip 且 overrides 有实现 — 元数据仍标 skip`
        );
      }
    }
  }
  const meta = buildPlaygroundMeta(source, { l2Surface, l2Skip });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, emitPlaygroundMetaTs(meta), "utf8");
  const classCount = Object.keys(meta.classes).length;
  const eventCount = Object.values(meta.events).reduce((n, a) => n + a.length, 0);
  const eventTypeCount = Object.keys(meta.eventTypes).length;
  const l2Methods = Object.values(meta.classes).reduce(
    (n, c) => n + (c.methods ?? []).filter((m) => m.impl === "l2").length,
    0
  );
  const skipMembers = Object.values(meta.classes).reduce(
    (n, c) =>
      n +
      (c.methods ?? []).filter((m) => m.impl === "skip").length +
      (c.properties ?? []).filter((p) => p.impl === "skip").length,
    0
  );
  console.log(
    `[gen-playground-meta] classes=${classCount} eventSignals=${eventCount} eventTypes=${eventTypeCount} l2Methods=${l2Methods} skipMembers=${skipMembers} → ${outPath}`
  );
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
