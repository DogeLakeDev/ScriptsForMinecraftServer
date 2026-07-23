import { createRule } from "../utils/create-rule.js";
import { visitModuleSourceLiterals } from "../utils/module-source-visitor.js";

/**
 * 禁止相对路径深挖 SDK 源码
 */
export const noSdkDeepImport = createRule({
  name: "no-sdk-deep-import",
  meta: {
    type: "problem",
    docs: {
      description: "禁止相对路径引用 SDK 源码；只允许 @sfmc-bds/sdk/<export>",
    },
    messages: {
      usePublic:
        "请使用 @sfmc-bds/sdk/<export> 公开入口，勿相对路径引用 SDK 源码（@sfmc-sdk/src 或 modules/sdk）。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return visitModuleSourceLiterals((source, sourceNode) => {
      const v = source.replace(/\\/g, "/");
      if (
        v.includes("@sfmc-sdk/src") ||
        v.includes("modules/sdk/") ||
        /(?:^|\/)@sfmc-sdk(?:\/|$)/.test(v)
      ) {
        if (v.startsWith("@sfmc-bds/sdk")) return;
        context.report({ node: sourceNode, messageId: "usePublic" });
      }
    });
  },
});
