import path from "node:path";

/** 解析 `--from local[:path]` / `dir:` 或 cwd 为模块根。 */
export function resolveLocalModuleRoot(args: { from?: string | null; cwd: string }): string {
  const raw = (args.from ?? "").trim();
  if (!raw) return path.resolve(args.cwd);
  if (raw === "local") return path.resolve(args.cwd);
  if (raw.startsWith("local:")) {
    const p = raw.slice("local:".length).trim();
    if (!p) return path.resolve(args.cwd);
    return path.isAbsolute(p) ? path.resolve(p) : path.resolve(args.cwd, p);
  }
  if (raw.startsWith("dir:")) {
    const p = raw.slice("dir:".length).trim();
    return path.isAbsolute(p) ? path.resolve(p) : path.resolve(args.cwd, p);
  }
  return path.resolve(args.cwd);
}
