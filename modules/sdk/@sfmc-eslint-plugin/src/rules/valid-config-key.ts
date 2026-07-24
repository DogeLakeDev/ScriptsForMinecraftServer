import { getMemberCall, isStringLiteral } from "../utils/ast.js";
import { createRule } from "../utils/create-rule.js";
import { loadConfigFieldKeys } from "../utils/config-fields.js";

type Options = [{ knownFields?: string[] }];

/**
 * config.get/set 字段须存在于默认配置；onChange 校验 arity
 */
export const validConfigKey = createRule<Options, "unknownField" | "onChangeArity">({
  name: "valid-config-key",
  meta: {
    type: "suggestion",
    docs: {
      description: "config.get/set 字段对照默认配置；onChange 仅接受 handler",
    },
    messages: {
      unknownField:
        '配置字段 "{{key}}" 不在本模块默认配置中。请核对 configKey 对应 JSON 字段名。',
      onChangeArity:
        "config.onChange 签名为 onChange(handler)，不要传入 configKey（旧文档有误）。",
    },
    schema: [
      {
        type: "object",
        properties: {
          knownFields: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const fromFile = loadConfigFieldKeys(context.filename);
    const fields =
      options.knownFields != null
        ? new Set(options.knownFields)
        : fromFile
          ? fromFile
          : null;

    return {
      CallExpression(node) {
        const m = getMemberCall(node);
        if (!m || m.object !== "config") return;

        if (m.property === "onChange") {
          if (node.arguments.length >= 2) {
            context.report({ node, messageId: "onChangeArity" });
          }
          return;
        }

        if (m.property !== "get" && m.property !== "set") return;
        if (!fields) return;
        const arg0 = node.arguments[0];
        if (!isStringLiteral(arg0)) return;
        if (fields.has(arg0.value)) return;
        context.report({
          node: arg0,
          messageId: "unknownField",
          data: { key: arg0.value },
        });
      },
    };
  },
});
