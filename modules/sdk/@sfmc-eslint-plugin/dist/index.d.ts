import type { ESLint } from "eslint";
import { allRules, recommendedRules, rules } from "./configs/recommended.js";
declare const plugin: ESLint.Plugin;
export default plugin;
export { allRules, recommendedRules, rules };
