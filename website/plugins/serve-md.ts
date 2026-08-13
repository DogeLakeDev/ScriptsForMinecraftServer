import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { RspressPlugin } from "@rspress/core";

export type ServeMdOptions = {
  /** docs/ 根（含 zh、en） */
  docsRoot: string;
  /** SSG-MD 输出目录（doc_build） */
  outDir: string;
  /** 与 rspress base 一致，如 /ScriptsForMinecraftServer/ */
  base: string;
};

type ConnectReq = { url?: string };
type ConnectRes = {
  statusCode: number;
  setHeader: (k: string, v: string) => void;
  end: (b?: Buffer | string) => void;
};
type ConnectNext = () => void;

/**
 * 开发/预览态托管「复制 Markdown 链接」指向的伴生 .md / llms.txt。
 * 生产构建已写入 doc_build；dev 默认不生成，直接打开会 404。
 * 优先读 doc_build，否则回落到 docs 源文件（.md / .mdx）。
 */
export function pluginServeMd(opts: ServeMdOptions): RspressPlugin {
  const handler = createServeMdHandler(opts);

  return {
    name: "sfmc-serve-md",
    builderConfig: {
      server: {
        // Rsbuild 2：用 server.setup，不再用已废弃的 setupMiddlewares
        setup: ({ server }) => {
          server.middlewares.use(handler);
        },
      },
    },
  };
}

export function createServeMdHandler(opts: ServeMdOptions) {
  const base = normalizeBase(opts.base);

  return (req: ConnectReq, res: ConnectRes, next: ConnectNext) => {
    const urlPath = (req.url ?? "").split("?")[0] ?? "";
    if (!urlPath.endsWith(".md") && !urlPath.endsWith(".txt")) {
      next();
      return;
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(urlPath);
    } catch {
      next();
      return;
    }

    // rsbuild server.base 下 req.url 可能已去掉 base，两种都兼容
    if (base) {
      if (pathname.startsWith(base)) {
        pathname = `/${pathname.slice(base.length)}`;
      } else if (pathname === base.slice(0, -1)) {
        pathname = "/";
      }
    }
    const rel = pathname.replace(/^\//, "");
    if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
      next();
      return;
    }

    const candidates = [
      path.join(opts.outDir, rel),
      ...resolveSourceCandidates(opts.docsRoot, rel),
    ];

    for (const file of candidates) {
      if (!existsSync(file)) continue;
      const body = readFileSync(file);
      res.statusCode = 200;
      res.setHeader(
        "Content-Type",
        file.endsWith(".txt")
          ? "text/plain; charset=utf-8"
          : "text/markdown; charset=utf-8"
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(body);
      return;
    }

    next();
  };
}

function normalizeBase(base: string): string {
  if (!base || base === "/") return "";
  return base.endsWith("/") ? base : `${base}/`;
}

/** @param rel guide/config.md | en/guide/config.md | llms.txt */
function resolveSourceCandidates(docsRoot: string, rel: string): string[] {
  if (rel.endsWith(".txt")) {
    return [path.join(docsRoot, rel)];
  }
  if (!rel.endsWith(".md")) return [];

  const withoutExt = rel.slice(0, -".md".length);
  const segments = withoutExt.split("/");
  const out: string[] = [];

  const pushPair = (dir: string, name: string) => {
    out.push(path.join(dir, `${name}.md`));
    out.push(path.join(dir, `${name}.mdx`));
  };

  if (segments[0] === "en" || segments[0] === "zh") {
    const lang = segments[0];
    const rest = segments.slice(1).join("/");
    if (rest) {
      pushPair(path.join(docsRoot, lang), rest);
    }
  } else {
    pushPair(path.join(docsRoot, "zh"), withoutExt);
    pushPair(path.join(docsRoot, "en"), withoutExt);
  }

  pushPair(docsRoot, withoutExt);
  return out;
}
