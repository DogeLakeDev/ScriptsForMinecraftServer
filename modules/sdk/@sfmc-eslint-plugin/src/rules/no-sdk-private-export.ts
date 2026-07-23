import { createRule } from "../utils/create-rule.js";
import { checkSdkImportPath } from "../utils/sdk-public-exports.js";
import { visitModuleSourceLiterals } from "../utils/module-source-visitor.js";

type Options = [{ extraAllowed?: string[] }];

/**
 * @sfmc-bds/sdk 仅允许 package.json#exports 公开子路径
 */
export const noSdkPrivateExport = createRule<Options, "bare" | "private">({
  name: "no-sdk-private-export",
  meta: {
    type: "problem",
    docs: {
      description: "仅允许 @sfmc-bds/sdk 公开 exports 子路径",
    },
    messages: {
      bare:
        "请使用 @sfmc-bds/sdk/<export>（如 sapi/runtime、sapi/db），不要裸 import @sfmc-bds/sdk。",
      private:
        '"{{source}}" 不是公开 exports。请改用 package.json#exports 中的子路径（如 @sfmc-bds/sdk/sapi/runtime）。',
    },
    schema: [
      {
        type: "object",
        properties: {
          extraAllowed: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [options]) {
    return visitModuleSourceLiterals((source, sourceNode) => {
      const kind = checkSdkImportPath(source, options.extraAllowed ?? []);
      if (kind === "bare") context.report({ node: sourceNode, messageId: "bare" });
      else if (kind === "private") {
        context.report({ node: sourceNode, messageId: "private", data: { source } });
      }
    });
  },
});
