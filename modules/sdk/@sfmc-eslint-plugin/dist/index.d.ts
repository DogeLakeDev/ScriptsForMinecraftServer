import type { ESLint } from "eslint";
import { allRules, recommendedRules, rules } from "./configs/recommended.js";
/**
 * ESLint.Plugin.rules 期望核心 RuleDefinition，而 @typescript-eslint 的 RuleModule
 * 在 create/context 形状上更窄；运行时兼容，此处用断言对齐发布面契约（LSP 边界）。
 */
declare const plugin: ESLint.Plugin;
export default plugin;
export { allRules, recommendedRules, rules };
