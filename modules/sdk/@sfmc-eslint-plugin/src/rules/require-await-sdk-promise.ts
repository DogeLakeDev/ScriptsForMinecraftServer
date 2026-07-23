import { getMemberCall, isPromiseHandled } from "../utils/ast.js";
import { createRule } from "../utils/create-rule.js";

const ASYNC_MEMBERS: Record<string, Set<string>> = {
  db: new Set([
    "defineTable",
    "query",
    "get",
    "insert",
    "update",
    "delete",
    "audit",
    "tx",
    "idempotent",
  ]),
  tx: new Set(["query", "get", "insert", "update", "delete", "audit", "call"]),
  service: new Set(["get", "list"]),
  config: new Set(["get", "getAll", "set"]),
  Money: new Set(["load", "add", "set"]),
};

/**
 * 常见 SDK Promise API 须 await / return / void
 */
export const requireAwaitSdkPromise = createRule({
  name: "require-await-sdk-promise",
  meta: {
    type: "suggestion",
    docs: {
      description: "db/service/config/Money 等异步 API 须 await 或显式处理 Promise",
    },
    messages: {
      needAwait:
        "{{object}}.{{method}}() 返回 Promise，请使用 await / return / void，或 .then()。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        const m = getMemberCall(node);
        if (!m) return;
        const methods = ASYNC_MEMBERS[m.object];
        if (!methods || !methods.has(m.property)) return;
        if (isPromiseHandled(node)) return;
        context.report({
          node,
          messageId: "needAwait",
          data: { object: m.object, method: m.property },
        });
      },
    };
  },
});
