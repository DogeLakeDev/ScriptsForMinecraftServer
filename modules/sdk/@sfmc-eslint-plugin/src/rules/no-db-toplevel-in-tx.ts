import type { TSESTree } from "@typescript-eslint/utils";
import { getMemberCall } from "../utils/ast.js";
import { createRule } from "../utils/create-rule.js";

const FORBIDDEN_DB = new Set([
  "query",
  "get",
  "insert",
  "update",
  "delete",
  "audit",
  "defineTable",
  "tx",
]);

/**
 * db.tx 回调内禁止顶层 db.* / service.get
 */
export const noDbToplevelInTx = createRule({
  name: "no-db-toplevel-in-tx",
  meta: {
    type: "problem",
    docs: {
      description: "db.tx 回调内禁止顶层 db.* 与 service.get；请用 tx.* / tx.call / inTx",
    },
    messages: {
      useTx:
        "事务内勿调用 db.{{method}}()。请使用 tx.{{method}}()（或 tx.call / *.inTx(tx)）。",
      useTxCall:
        "事务内勿调用 service.get()。请使用 tx.call(name, input) 或 typed client 的 inTx(tx)。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    /** 当前所处 db.tx 回调深度 */
    let txDepth = 0;

    function isDbTxCall(node: TSESTree.CallExpression): boolean {
      const m = getMemberCall(node);
      return !!m && m.object === "db" && m.property === "tx";
    }

    function enterIfTxCallback(node: TSESTree.Node): void {
      const parent = node.parent;
      if (!parent || parent.type !== "CallExpression") return;
      if (!isDbTxCall(parent)) return;
      // 回调是第一个参数
      if (parent.arguments[0] === node) txDepth++;
    }

    function exitIfTxCallback(node: TSESTree.Node): void {
      const parent = node.parent;
      if (!parent || parent.type !== "CallExpression") return;
      if (!isDbTxCall(parent)) return;
      if (parent.arguments[0] === node && txDepth > 0) txDepth--;
    }

    return {
      ":function"(node: TSESTree.Node) {
        enterIfTxCallback(node);
      },
      ":function:exit"(node: TSESTree.Node) {
        exitIfTxCallback(node);
      },
      CallExpression(node) {
        if (txDepth === 0) return;
        const m = getMemberCall(node);
        if (!m) return;
        if (m.object === "db" && FORBIDDEN_DB.has(m.property)) {
          context.report({
            node,
            messageId: "useTx",
            data: { method: m.property },
          });
          return;
        }
        if (m.object === "service" && m.property === "get") {
          context.report({ node, messageId: "useTxCall" });
        }
      },
    };
  },
});
