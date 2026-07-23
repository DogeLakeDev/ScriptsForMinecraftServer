/**
 * AST 小工具：识别 MemberExpression 调用。
 */
import type { TSESTree } from "@typescript-eslint/utils";

export function getMemberCall(
  node: TSESTree.CallExpression
): { object: string; property: string } | null {
  if (node.callee.type !== "MemberExpression" || node.callee.computed) return null;
  const prop = node.callee.property;
  if (prop.type !== "Identifier") return null;
  const obj = node.callee.object;
  if (obj.type !== "Identifier") return null;
  return { object: obj.name, property: prop.name };
}

export function isStringLiteral(
  node: TSESTree.Node | undefined | null
): node is TSESTree.StringLiteral {
  return !!node && node.type === "Literal" && typeof node.value === "string";
}

/** 调用是否已被 await / return / void 包裹 */
export function isPromiseHandled(node: TSESTree.CallExpression): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (parent.type === "AwaitExpression") return true;
  if (parent.type === "ReturnStatement") return true;
  if (parent.type === "UnaryExpression" && parent.operator === "void") return true;
  // Promise chain: .then / .catch
  if (
    parent.type === "MemberExpression" &&
    parent.object === node &&
    parent.property.type === "Identifier" &&
    (parent.property.name === "then" ||
      parent.property.name === "catch" ||
      parent.property.name === "finally")
  ) {
    return true;
  }
  return false;
}
