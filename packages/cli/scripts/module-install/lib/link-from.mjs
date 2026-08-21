// @ts-check
/**
 * --from 规范化（裸路径 / local: / dir:）
 */
import fs from "node:fs";
import path from "node:path";

/**
 * 是否为带 scheme 的 --from（非裸文件系统路径）。
 * @param {string} from
 */
export function isSchemeFrom(from) {
  return (
    from === "local" ||
    from.startsWith("local:") ||
    from.startsWith("dir:") ||
    from.startsWith("npm:") ||
    from.startsWith("tgz:") ||
    from.startsWith("zip:") ||
    from.startsWith("github:")
  );
}

/**
 * 把裸路径规范成 dir:<abs>（不存在则报错）。
 * @param {string} raw
 * @param {string} [cwd]
 * @returns {{ ok: true, from: string } | { ok: false, error: string }}
 */
export function normalizeBarePathFrom(raw, cwd = process.cwd()) {
  const abs = path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(cwd, raw);
  if (!fs.existsSync(abs)) {
    return { ok: false, error: `--from 路径不存在: ${abs}` };
  }
  const st = fs.lstatSync(abs);
  if (!st.isDirectory()) {
    return {
      ok: false,
      error: `--from 裸路径须为目录（文件请用 --from local:<tgz|zip>）: ${abs}`,
    };
  }
  return { ok: true, from: `dir:${abs}` };
}

/**
 * @param {string} from
 * @param {string} [cwd]
 * @returns {{ ok: true, from: string } | { ok: false, error: string }}
 */
export function normalizeLinkFrom(from, cwd = process.cwd()) {
  if (!from || from === "local" || from.startsWith("local:")) {
    const tail = !from || from === "local" ? "" : from.slice("local:".length);
    const abs =
      !tail || tail === "." || tail === "./"
        ? path.resolve(cwd)
        : path.isAbsolute(tail)
          ? path.resolve(tail)
          : path.resolve(cwd, tail);
    if (!fs.existsSync(abs)) {
      return { ok: false, error: `--from local target not found: ${abs}` };
    }
    const st = fs.lstatSync(abs);
    if (st.isDirectory()) return { ok: true, from: `dir:${abs}` };
    return {
      ok: false,
      error: `--link 仅支持目录源；tgz/zip 请去掉 --link 使用 copy 安装`,
    };
  }
  if (from.startsWith("dir:")) return { ok: true, from };
  /* 约定写法：mod install <id> --from <路径> --link */
  if (!isSchemeFrom(from)) {
    const bare = normalizeBarePathFrom(from, cwd);
    if (!bare.ok) return bare;
    return bare;
  }
  return {
    ok: false,
    error: `--link only works with --from <path> / dir:<path> / local[:<dir>] (got ${from})`,
  };
}
