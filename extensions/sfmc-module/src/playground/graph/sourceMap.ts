/**
 * 模块入口 source map：扫 sapi/src/index.{ts,js,mjs} 抓每个 export symbol 的 (file, line, column)。
 *
 * 为什么用纯 JS regex 扫而不是 tsx/esm SourceMap API：
 * - Node `--experimental-strip-types` 默认不输出 source map；tsx 输出但不保证运行时挂回 SourceMap。
 * - 入口通常就 1 个文件 + 几个 re-export；用 regex 走 import/export 节点足够稳定。
 * - 失败时返回空 Map（不抛），UI 上 ⓘ hover 仍然显示原失败 message，仅缺 source 链接。
 *
 * 浏览器侧只消费类型 + lookupLocation + appendLocationToMessage；scanModuleSourceMap 仅 Node 端调用。
 * 为避免 webview bundle 把 node:fs 当成可解析依赖，fs/path 在函数体内动态 import。
 */

/** 定位坐标：1-based line, 0-based column（与 vscode.Position 一致）。 */
export type SourceLocation = {
  /** 相对模块根的 POSIX 路径（用作跳转 key；扩展侧拼绝对路径）。 */
  file: string;
  /** 1-based */
  line: number;
  /** 0-based；缺省 0。 */
  column?: number;
  /** symbol 名（便于 hover 显示）。 */
  symbol?: string;
};

const ENTRY_CANDIDATES = ["sapi/src/index.ts", "sapi/src/index.js", "sapi/src/index.mjs"] as const;

type ScanFile = { absPath: string; relPath: string; source: string };

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/**
 * 把绝对路径转为相对模块根的 POSIX 路径；失败则返回绝对路径。
 * 传入 moduleRoot 必须已 resolve；此函数不再 normalize。
 */
function toRelPosix(moduleRoot: string, abs: string): string {
  // 纯字符串处理，不依赖 node:path；以模块根为前缀切分。
  const m = moduleRoot.replace(/\\/g, "/").replace(/\/$/, "");
  const a = abs.replace(/\\/g, "/");
  if (a.toLowerCase().startsWith(m.toLowerCase() + "/")) return a.slice(m.length + 1);
  return a;
}

/** 同 toRelPosix；输入可带反斜杠；此函数不 import node:path。 */
function isAbsolutePath(p: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(p) || p.startsWith("/") || p.startsWith("\\");
}

function dirname(p: string): string {
  const s = p.replace(/\\/g, "/");
  const i = s.lastIndexOf("/");
  return i < 0 ? "" : s.slice(0, i);
}

function joinPath(base: string, rel: string): string {
  if (!rel) return base;
  if (rel.startsWith("/") || /^[a-zA-Z]:/.test(rel)) return rel;
  const b = base.replace(/\\/g, "/").replace(/\/$/, "");
  return `${b}/${rel}`;
}

/**
 * 扫单个源文件，构建 symbol → SourceLocation。
 *
 * 支持的语法：
 * - `export const NAME = …` / `export let NAME` / `export var NAME`
 * - `export function NAME(…)` / `export class NAME {…}` / `export enum NAME {…}`
 * - `export type NAME = …` / `export interface NAME {…}`（带 type 也给位置，便于 hover）
 * - `export { a, b as c }` / `export { default }`
 * - `export default <expr>`（symbol 名为 "default"）
 * - `export * from "./x"`（全部 re-export；下钻扫描）
 * - `export { foo, bar } from "./x"` / `export { foo as bar } from "./x"`（具名 re-export）
 *
 * 不支持：
 * - dynamic import / `export type * from`
 * - 跨文件同名 alias 的所有重命名（只记首次出现的位置）
 */
function scanFileLines(
  moduleRoot: string,
  file: ScanFile,
  into: Map<string, SourceLocation>,
  queue: string[]
): void {
  const lines = file.source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = raw.trim();

    if (line.startsWith("//") || line.startsWith("/*")) continue;

    // export { foo, bar as baz } from "./x";
    let m = /^export\s*\{([^}]+)\}\s*from\s*(["'`])([^"'`]+)\2\s*;?/.exec(line);
    if (m) {
      const list = m[1]!.split(",");
      const target = m[3]!;
      for (const spec of list) {
        const parts = spec.split(/\s+as\s+/);
        const dst = (parts[1] ?? parts[0]!).trim();
        if (!dst) continue;
        if (!into.has(dst)) {
          const col = raw.indexOf("export");
          into.set(dst, { file: file.relPath, line: i + 1, column: col >= 0 ? col : 0, symbol: dst });
        }
      }
      queue.push(target);
      continue;
    }

    // export { foo, bar }（本文件 re-export 已 import 的名；不重新记录，假设 export const 早已落入 into）
    m = /^export\s*\{([^}]+)\}\s*;?/.exec(line);
    if (m) {
      for (const spec of m[1]!.split(",")) {
        const parts = spec.split(/\s+as\s+/);
        const dst = (parts[1] ?? parts[0]!).trim();
        if (!dst || into.has(dst)) continue;
        const col = raw.indexOf("export");
        into.set(dst, { file: file.relPath, line: i + 1, column: col >= 0 ? col : 0, symbol: dst });
      }
      continue;
    }

    // export * from "./x"
    m = /^export\s*\*\s*from\s*(["'`])([^"'`]+)\1\s*;?/.exec(line);
    if (m) {
      queue.push(m[2]!);
      continue;
    }

    // export default <expr>
    if (/^export\s+default\s+/.test(line) && !into.has("default")) {
      const col = raw.indexOf("export");
      into.set("default", {
        file: file.relPath,
        line: i + 1,
        column: col >= 0 ? col : 0,
        symbol: "default",
      });
    }

    // export const/let/var/function/class/enum/type/interface NAME
    m = /^export\s+(?:async\s+)?(?:const|let|var|function\*?|class|enum|type|interface)\s+([A-Za-z_$][\w$]*)/.exec(
      line
    );
    if (m) {
      const name = m[1]!;
      if (!into.has(name)) {
        const col = raw.indexOf(name);
        into.set(name, {
          file: file.relPath,
          line: i + 1,
          column: col >= 0 ? col : 0,
          symbol: name,
        });
      }
      continue;
    }
  }
  void moduleRoot;
}

function resolveAbsSibling(entryAbs: string, spec: string): string | undefined {
  if (!spec) return undefined;
  if (isAbsolutePath(spec)) return spec;
  if (spec.startsWith(".")) return joinPath(dirname(entryAbs), spec);
  return undefined;
}

/**
 * Node 端 fs 桩：把 fs 操作抽出来方便动态 import 时只替换 fs 部分。
 * 浏览器侧永远不调用此模块，仅 import 类型与 lookup helpers。
 */
type NodeFs = typeof import("node:fs");

async function loadFs(): Promise<NodeFs> {
  return await import("node:fs");
}

/** 扫模块入口，构建 symbol → SourceLocation 映射（Node 端）。 */
export async function scanModuleSourceMap(moduleRoot: string): Promise<Map<string, SourceLocation>> {
  const out = new Map<string, SourceLocation>();
  const fs = await loadFs();
  const entryAbs = (() => {
    const root = moduleRoot.replace(/\\/g, "/").replace(/\/$/, "");
    for (const rel of ENTRY_CANDIDATES) {
      const full = `${root}/${rel}`;
      if (fs.existsSync(full)) return full;
    }
    return undefined;
  })();
  if (!entryAbs) return out;

  const seen = new Set<string>();
  const pendingFiles: ScanFile[] = [
    {
      absPath: entryAbs,
      relPath: toRelPosix(moduleRoot, entryAbs),
      source: fs.readFileSync(entryAbs, "utf8"),
    },
  ];
  const reExportQueue: string[] = [];

  while (pendingFiles.length > 0) {
    const file = pendingFiles.shift()!;
    if (seen.has(file.absPath)) continue;
    seen.add(file.absPath);

    const collected = new Map<string, SourceLocation>();
    scanFileLines(moduleRoot, file, collected, reExportQueue);
    for (const [k, v] of collected) {
      if (!out.has(k)) out.set(k, v);
    }
  }

  // 第二轮：把 re-export 到的相对文件读出来再扫一遍
  const moreFiles: ScanFile[] = [];
  for (const spec of reExportQueue) {
    const abs = resolveAbsSibling(entryAbs, spec);
    if (!abs || seen.has(abs)) continue;
    if (!fs.existsSync(abs)) continue;
    moreFiles.push({
      absPath: abs,
      relPath: toRelPosix(moduleRoot, abs),
      source: fs.readFileSync(abs, "utf8"),
    });
  }
  while (moreFiles.length > 0) {
    const file = moreFiles.shift()!;
    if (seen.has(file.absPath)) continue;
    seen.add(file.absPath);
    const collected = new Map<string, SourceLocation>();
    scanFileLines(moduleRoot, file, collected, reExportQueue);
    for (const [k, v] of collected) {
      if (!out.has(k)) out.set(k, v);
    }
  }

  // 额外收录 Command.register("name", …) → `@cmd.<name>` 键，方便 Call 节点失败跳转。
  indexCommandNames(entryAbs, moduleRoot, out, fs);

  return out;
}

/**
 * 扫入口文本里的 Command.register / ModuleRegistry.register，提取字面量字符串名，
 * 落到 `@cmd.<name>` 键上，定位到 register 调用所在行。
 */
function indexCommandNames(
  entryAbs: string,
  moduleRoot: string,
  into: Map<string, SourceLocation>,
  fs: NodeFs
): void {
  const source = fs.readFileSync(entryAbs, "utf8");
  const lines = source.split(/\r?\n/);
  const relPath = toRelPosix(moduleRoot, entryAbs);

  const seenKeys = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const m = /Command\.register\s*\(\s*(["'`])([^"'`]+)\1/.exec(line);
    if (!m) continue;
    const cmd = m[2]!;
    const key = `@cmd.${cmd}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const col = line.indexOf("Command.register");
    into.set(key, { file: relPath, line: i + 1, column: col >= 0 ? col : 0, symbol: cmd });
  }
}

/**
 * 在 source map 中查找：优先精确键，失败回退到 `@cmd.<name>` / `DESCRIPTOR` / `default`。
 * 全部失败返回 undefined。
 */
export function lookupLocation(
  sourceMap: Map<string, SourceLocation>,
  symbol: string
): SourceLocation | undefined {
  if (!symbol) return undefined;
  const direct = sourceMap.get(symbol);
  if (direct) return direct;
  const cmdAlias = sourceMap.get(`@cmd.${symbol}`);
  if (cmdAlias) return cmdAlias;
  return sourceMap.get("DESCRIPTOR") || sourceMap.get("default");
}

/**
 * 给失败 message 追加一行 `→ <file>:<line>`；source map 缺位时原样返回。
 */
export function appendLocationToMessage(message: string, loc?: SourceLocation): string {
  if (!loc) return message;
  const tail = loc.column != null && loc.column > 0 ? `:${loc.column + 1}` : "";
  return `${message}\n→ ${loc.file}:${loc.line}${tail}`;
}