import { getMemberCall, isStringLiteral } from "../utils/ast.js";
import { createRule } from "../utils/create-rule.js";
import { loadManifestServices } from "../utils/manifest-catalog.js";

type Options = [
  {
    knownRequires?: string[];
    knownProvides?: string[];
  },
];

/**
 * service.get / tx.call 字面量须在本包 services.requires（自 provides 豁免）
 */
export const requireServiceRequires = createRule<Options, "missingRequires">({
  name: "require-service-requires",
  meta: {
    type: "suggestion",
    docs: {
      description: "调用 service.get/tx.call 前须在 manifest.services.requires 声明",
    },
    messages: {
      missingRequires:
        '调用服务 "{{name}}" 前请在 sapi/manifest.json 的 services.requires 中声明（本包 provides 除外）。',
    },
    schema: [
      {
        type: "object",
        properties: {
          knownRequires: { type: "array", items: { type: "string" } },
          knownProvides: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  defaultOptions: [{}],
  create(context, [options]) {
    const filename = context.filename;
    const fromFile = loadManifestServices(filename);
    // 无 manifest 且无 option → 跳过
    if (!fromFile && !options.knownRequires && !options.knownProvides) {
      return {};
    }

    const requires = new Set([
      ...(fromFile?.requires ?? []),
      ...(options.knownRequires ?? []),
    ]);
    const provides = new Set([
      ...(fromFile?.provides ?? []),
      ...(options.knownProvides ?? []),
    ]);

    function checkName(node: Parameters<typeof isStringLiteral>[0], name: string): void {
      if (provides.has(name) || requires.has(name)) return;
      if (!isStringLiteral(node)) return;
      context.report({ node, messageId: "missingRequires", data: { name } });
    }

    return {
      CallExpression(node) {
        const m = getMemberCall(node);
        if (!m) return;
        const arg0 = node.arguments[0];
        if (!isStringLiteral(arg0)) return;

        if (m.object === "service" && m.property === "get") {
          checkName(arg0, arg0.value);
          return;
        }
        if (m.object === "tx" && m.property === "call") {
          checkName(arg0, arg0.value);
        }
      },
    };
  },
});
