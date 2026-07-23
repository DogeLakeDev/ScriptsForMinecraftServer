import { createRule } from "../utils/create-rule.js";

/**
 * 禁止 player/world.sendMessage — 业务侧应使用 Msg.*
 */
export const noPlayerSendMessage = createRule({
  name: "no-player-send-message",
  meta: {
    type: "suggestion",
    docs: {
      description: "禁止直接调用 sendMessage；请使用 Msg.info/success/error/warning/tips",
    },
    messages: {
      useMsg:
        "勿直接调用 sendMessage()。请使用 Msg.info / Msg.success / Msg.error / Msg.warning / Msg.tips（@sfmc-bds/sdk/sapi/runtime）。",
    },
    schema: [],
  },
  defaultOptions: [],
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.callee.computed) return;
        const prop = node.callee.property;
        if (prop.type !== "Identifier" || prop.name !== "sendMessage") return;
        context.report({ node, messageId: "useMsg" });
      },
    };
  },
});
