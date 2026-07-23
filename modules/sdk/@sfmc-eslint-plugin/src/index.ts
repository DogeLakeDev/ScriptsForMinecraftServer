import type { ESLint } from "eslint";
import {
  allRules,
  createFlatConfig,
  recommendedRules,
  rules,
} from "./configs/recommended.js";

const plugin: ESLint.Plugin = {
  meta: {
    name: "@sfmc-bds/eslint-plugin",
    version: "0.1.0",
  },
  rules,
};

plugin.configs = {
  recommended: createFlatConfig(plugin, recommendedRules),
  all: createFlatConfig(plugin, allRules, "@sfmc-bds/eslint-plugin/all"),
};

export default plugin;
export { allRules, recommendedRules, rules };
