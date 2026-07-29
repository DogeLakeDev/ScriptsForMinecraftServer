// @ts-check
/**
 * tools/lib/link-from.mjs — --link 场景下把 from 规范成 dir: 或报错
 */
import fs from "node:fs";
import path from "node:path";

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
  return {
    ok: false,
    error: `--link only works with --from dir:<path> or --from local[:<dir>] (got ${from})`,
  };
}
