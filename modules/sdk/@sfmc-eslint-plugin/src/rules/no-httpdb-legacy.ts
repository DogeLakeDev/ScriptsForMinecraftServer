import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

/**
 * HttpDB 为 legacy，模块应使用 db / service / config
 */
export const noHttpdbLegacy = createRule({
  name: "no-httpdb-legacy",
  meta: {
    type: "suggestion",
    docs: {
      description: "禁止 HttpDB；请使用 @sfmc-bds/sdk/sapi/db|service|config",
    },
    messages: {
      legacy:
        "HttpDB 为 legacy。新代码请使用 @sfmc-bds/sdk/sapi/db、sapi/service、sapi/config。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    function checkSource(
      node: TSESTree.ImportDeclaration | TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration
    ) {
      const src = node.source;
      if (!src || src.type !== "Literal" || typeof src.value !== "string") return;
      // 从 runtime 解构 HttpDB
      if (node.type === "ImportDeclaration") {
        for (const s of node.specifiers) {
          if (s.type === "ImportSpecifier" && s.imported.type === "Identifier" && s.imported.name === "HttpDB") {
            context.report({ node: s, messageId: "legacy" });
          }
          if (s.type === "ImportDefaultSpecifier" && s.local.name === "HttpDB") {
            context.report({ node: s, messageId: "legacy" });
          }
        }
      }
    }

    return {
      ImportDeclaration: checkSource,
      ExportNamedDeclaration: checkSource,
      ExportAllDeclaration: checkSource,
      Identifier(node) {
        if (node.name !== "HttpDB") return;
        // 跳过 import 说明符（已在上面报）
        if (node.parent.type === "ImportSpecifier" || node.parent.type === "ImportDefaultSpecifier") {
          return;
        }
        if (node.parent.type === "MemberExpression" && node.parent.property === node) return;
        context.report({ node, messageId: "legacy" });
      },
    };
  },
});
