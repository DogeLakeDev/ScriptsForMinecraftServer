import { createRule } from "../utils/create-rule.js";
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
            useOfficial: "请改用 @sfmc-bds/sdk（@sfmc/sdk 仅为本地 alias，发布面以 @sfmc-bds 为准）。",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        function checkSource(node) {
            const src = node.source;
            if (!src || src.type !== "Literal" || typeof src.value !== "string")
                return;
            if (src.value === "@sfmc/sdk" || src.value.startsWith("@sfmc/sdk/")) {
                context.report({ node: src, messageId: "useOfficial" });
            }
        }
        return {
            ImportDeclaration: checkSource,
            ExportNamedDeclaration: checkSource,
            ExportAllDeclaration: checkSource,
        };
    },
});
