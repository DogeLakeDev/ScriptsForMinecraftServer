import path from "node:path";
import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";
import { visitModuleSourceLiterals } from "../utils/module-source-visitor.js";

function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}

/** 纯字符串路径解析（避免 Windows 把 /repo 绑到盘符导致误判） */
function resolvePosix(fromFile: string, rel: string): string {
  const dir = toPosix(path.dirname(fromFile));
  const start = dir.startsWith("/") ? dir.slice(1).split("/") : dir.split("/");
  const parts = [...start.filter(Boolean), ...rel.split("/")];
  const out: string[] = [];
  for (const p of parts) {
    if (p === "." || p === "") continue;
    if (p === "..") out.pop();
    else out.push(p);
  }
  return "/" + out.join("/");
}

function packageRootOf(posixPath: string): string | null {
  const m = toPosix(posixPath).match(/^(.*\/(?:packages|modules\/packages)\/[^/]+)(?:\/|$)/);
  return m ? m[1]! : null;
}

/**
 * 禁止跨模块深挖业务源码；允许 @sfmc-bds/module-* 的公开 client 入口
 */
export const noCrossModuleSourceImport = createRule({
  name: "no-cross-module-source-import",
  meta: {
    type: "problem",
    docs: {
      description: "禁止 import 其它模块 sapi/src；请用公开 client 或 service.get",
    },
    messages: {
      crossSource:
        '禁止深挖其它模块源码 "{{source}}"。请使用 @sfmc-bds/module-*/client 或 service.get，并声明 services.requires。',
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const filename = toPosix(context.filename);
    const own = packageRootOf(filename);

    return visitModuleSourceLiterals((source, sourceNode) => {
      const norm = toPosix(source);

      if (/^@sfmc-bds\/module-[a-z0-9-]+(?:\/|$)/.test(norm)) {
        if (/\/sapi\/src(?:\/|$)/.test(norm)) {
          context.report({ node: sourceNode, messageId: "crossSource", data: { source } });
        }
        return;
      }

      if (norm.startsWith(".")) {
        if (!own) return;
        const resolved = resolvePosix(filename, norm);
        // 仅当落在某包的 sapi/src 下才检查
        if (!/\/(?:packages|modules\/packages)\/[^/]+\/sapi\/src(?:\/|$)/.test(resolved)) {
          return;
        }
        const other = packageRootOf(resolved);
        if (other && other !== own) {
          context.report({ node: sourceNode, messageId: "crossSource", data: { source } });
        }
        return;
      }

      if (/\/(?:packages|modules\/packages)\/[^/]+\/sapi\/src(?:\/|$)/.test(norm)) {
        const hit = packageRootOf(norm);
        if (!own || (hit && hit !== own)) {
          context.report({ node: sourceNode, messageId: "crossSource", data: { source } });
        }
      }
    });
  },
});
