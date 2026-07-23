import { getMemberCall, isStringLiteral } from "../utils/ast.js";
import { createRule } from "../utils/create-rule.js";

const TABLE_OPS = new Set([
  "query",
  "get",
  "insert",
  "update",
  "delete",
  "audit",
  "defineTable",
]);

type Options = [{ tablePrefix?: string }];

/**
 * 禁止直接读写 sfmc_economy_* 私有表
 */
export const noEconomyPrivateTables = createRule<Options, "useEconomyClient">({
  name: "no-economy-private-tables",
  meta: {
    type: "problem",
    docs: {
      description: "禁止直接读写 sfmc_economy_*；请用 module-economy client 或 service",
    },
    messages: {
      useEconomyClient:
        '禁止直接访问表 "{{table}}"。请使用 @sfmc-bds/module-economy/client（economy.account.* / inTx），或 service.get / tx.call("economy.account.…")，并在 services.requires 中声明。',
    },
    schema: [
      {
        type: "object",
        properties: {
          tablePrefix: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{ tablePrefix: "sfmc_economy_" }],
  create(context, [options]) {
    const prefix = options.tablePrefix ?? "sfmc_economy_";

    return {
      CallExpression(node) {
        const m = getMemberCall(node);
        if (!m) return;
        if ((m.object !== "db" && m.object !== "tx") || !TABLE_OPS.has(m.property)) {
          return;
        }
        const arg0 = node.arguments[0];
        if (!isStringLiteral(arg0)) return;
        if (!arg0.value.startsWith(prefix)) return;
        context.report({
          node: arg0,
          messageId: "useEconomyClient",
          data: { table: arg0.value },
        });
      },
    };
  },
});
