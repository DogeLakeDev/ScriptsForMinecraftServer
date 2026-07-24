import { createRule } from "../utils/create-rule.js";
import { visitModuleSourceLiterals } from "../utils/module-source-visitor.js";

/**
 * 禁止 @sfmc/sdk 别名，统一 @sfmc-bds/sdk
 */
export const noSfmcSdkAlias = createRule({
  name: "no-sfmc-sdk-alias",
  meta: {
    type: "problem",
    docs: {
      description: "禁止 import @sfmc/sdk；请使用 @sfmc-bds/sdk 公开入口",
    },
    messages: {
      useOfficial:
        "请改用 @sfmc-bds/sdk（@sfmc/sdk 仅为本地 alias，发布面以 @sfmc-bds 为准）。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return visitModuleSourceLiterals((source, sourceNode) => {
      if (source === "@sfmc/sdk" || source.startsWith("@sfmc/sdk/")) {
        context.report({ node: sourceNode, messageId: "useOfficial" });
      }
    });
  },
});
