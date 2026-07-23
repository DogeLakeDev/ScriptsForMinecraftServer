import type { ESLint } from "eslint";
import {
  allRules,
  createFlatConfig,
  recommendedRules,
  rules,
} from "./configs/recommended.js";

/**
 * ESLint.Plugin.rules 期望核心 RuleDefinition，而 @typescript-eslint 的 RuleModule
 * 在 create/context 形状上更窄；运行时兼容，此处用断言对齐发布面契约（LSP 边界）。
 */
const plugin = {
  meta: {
    name: "@sfmc-bds/eslint-plugin",
    version: "0.1.0",
  },
  rules,
} as unknown as ESLint.Plugin;

plugin.configs = {
  recommended: createFlatConfig(plugin, recommendedRules),
  all: createFlatConfig(plugin, allRules, "@sfmc-bds/eslint-plugin/all"),
};

export default plugin;
export { allRules, recommendedRules, rules };
