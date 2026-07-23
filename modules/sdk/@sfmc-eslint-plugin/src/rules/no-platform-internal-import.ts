import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

const DEFAULT_PACKAGES = ["db-server", "qq-bridge", "bds-tools", "@sfmc-bds/db-server", "@sfmc-bds/qq-bridge", "@sfmc-bds/bds-tools", "@sfmc-bds/cli"];
const DEFAULT_FRAGMENTS = [
  "/db-server/",
  "/qq-bridge/",
  "/bds-tools/",
  "/sfmc/src/",
  "/sfmc/dist/",
  "\\db-server\\",
  "\\qq-bridge\\",
  "\\bds-tools\\",
  "\\sfmc\\src\\",
];

type Options = [
  {
    blockedPackages?: string[];
    blockedPathFragments?: string[];
  },
];

/**
 * 禁止业务模块 import 平台内部包/路径
 */
export const noPlatformInternalImport = createRule<Options, "blocked">({
  name: "no-platform-internal-import",
  meta: {
    type: "problem",
    docs: {
      description: "禁止 import db-server/sfmc/bds-tools 等平台内部；请用 SDK / service",
    },
    messages: {
      blocked:
        '禁止直接依赖平台内部 "{{source}}"。请通过 @sfmc-bds/sdk/sapi/*、模块公开 client 或 service.get 交互。',
    },
    schema: [
      {
        type: "object",
        properties: {
          blockedPackages: { type: "array", items: { type: "string" } },
          blockedPathFragments: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const pkgs = options.blockedPackages ?? DEFAULT_PACKAGES;
    const fragments = options.blockedPathFragments ?? DEFAULT_FRAGMENTS;

    function check(source: string, node: TSESTree.Node): void {
      const norm = source.replace(/\\/g, "/");
      for (const p of pkgs) {
        if (norm === p || norm.startsWith(`${p}/`)) {
          context.report({ node, messageId: "blocked", data: { source } });
          return;
        }
      }
      // 裸 sfmc 包名（非 @sfmc-bds/sdk）
      if (norm === "sfmc" || norm.startsWith("sfmc/")) {
        context.report({ node, messageId: "blocked", data: { source } });
        return;
      }
      for (const f of fragments) {
        const frag = f.replace(/\\/g, "/");
        if (norm.includes(frag)) {
          context.report({ node, messageId: "blocked", data: { source } });
          return;
        }
      }
    }

    function onSource(
      node: TSESTree.ImportDeclaration | TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration
    ) {
      const src = node.source;
      if (!src || src.type !== "Literal" || typeof src.value !== "string") return;
      check(src.value, src);
    }

    return {
      ImportDeclaration: onSource,
      ExportNamedDeclaration: onSource,
      ExportAllDeclaration: onSource,
    };
  },
});
