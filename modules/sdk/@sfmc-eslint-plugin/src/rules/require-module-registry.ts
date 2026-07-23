import type { TSESTree } from "@typescript-eslint/utils";
import { createRule } from "../utils/create-rule.js";

/**
 * 模块入口 index.ts 应调用 ModuleRegistry.register
 */
export const requireModuleRegistry = createRule({
  name: "require-module-registry",
  meta: {
    type: "suggestion",
    docs: {
      description: "sapi/src/index.ts 入口须调用 ModuleRegistry.register",
    },
    messages: {
      missing:
        "模块入口应调用 ModuleRegistry.register({ id, lifecycle, ... })（@sfmc-bds/sdk/module-loader）。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    const filename = context.filename.replace(/\\/g, "/");
    // 仅约束 .../sapi/src/index.ts
    if (!/\/sapi\/src\/index\.ts$/.test(filename)) {
      return {};
    }

    let found = false;

    function isRegisterCall(node: TSESTree.CallExpression): boolean {
      const callee = node.callee;
      if (callee.type !== "MemberExpression" || callee.computed) return false;
      if (callee.property.type !== "Identifier" || callee.property.name !== "register") {
        return false;
      }
      const obj = callee.object;
      return obj.type === "Identifier" && obj.name === "ModuleRegistry";
    }

    return {
      CallExpression(node) {
        if (isRegisterCall(node)) found = true;
      },
      "Program:exit"() {
        if (!found) {
          context.report({ loc: { line: 1, column: 0 }, messageId: "missing" });
        }
      },
    };
  },
});
