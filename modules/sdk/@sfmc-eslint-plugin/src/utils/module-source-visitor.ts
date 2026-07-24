/**
 * import/export 源字面量访问器 — 规则侧统一入口，避免重复样板（DRY）。
 */
import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export type ModuleSourceDeclaration =
  | TSESTree.ImportDeclaration
  | TSESTree.ExportNamedDeclaration
  | TSESTree.ExportAllDeclaration;

export type ModuleSourceLiteral = TSESTree.StringLiteral;

/**
 * 对 Import/Export* 的字符串 source 逐条回调。
 * @param check (source, sourceNode, declaration)
 */
export function visitModuleSourceLiterals(
  check: (source: string, sourceNode: ModuleSourceLiteral, node: ModuleSourceDeclaration) => void
): TSESLint.RuleListener {
  function onSource(node: ModuleSourceDeclaration): void {
    const src = node.source;
    if (!src || src.type !== "Literal" || typeof src.value !== "string") return;
    check(src.value, src as ModuleSourceLiteral, node);
  }
  return {
    ImportDeclaration: onSource,
    ExportNamedDeclaration: onSource,
    ExportAllDeclaration: onSource,
  };
}
