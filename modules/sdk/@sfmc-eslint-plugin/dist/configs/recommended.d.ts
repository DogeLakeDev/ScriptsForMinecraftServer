import type { ESLint, Linter } from "eslint";
/**
 * 规则实现注册表（权威来源）。
 * 新增规则只需：实现 rule → 挂到此处 → 写入 recommended/all 严重级别。
 */
export declare const rules: {
    "no-player-send-message": import("@typescript-eslint/utils/ts-eslint").RuleModule<"useMsg", [], unknown, import("@typescript-eslint/utils/ts-eslint").RuleListener> & {
        name: string;
    };
    "no-sfmc-sdk-alias": import("@typescript-eslint/utils/ts-eslint").RuleModule<"useOfficial", [], unknown, import("@typescript-eslint/utils/ts-eslint").RuleListener> & {
        name: string;
    };
    "no-sdk-deep-import": import("@typescript-eslint/utils/ts-eslint").RuleModule<"usePublic", [], unknown, import("@typescript-eslint/utils/ts-eslint").RuleListener> & {
        name: string;
    };
    "require-module-registry": import("@typescript-eslint/utils/ts-eslint").RuleModule<"missing", [], unknown, import("@typescript-eslint/utils/ts-eslint").RuleListener> & {
        name: string;
    };
};
/** recommended：日常模块/SDK 约定 */
export declare const recommendedRules: Linter.RulesRecord;
/** all：在 recommended 上将 no-player-send-message 升为 error */
export declare const allRules: Linter.RulesRecord;
/**
 * 生成 flat config 片段。
 * 由调用方注入 plugin 实例，避免 configs ↔ index 循环依赖。
 */
export declare function createFlatConfig(plugin: ESLint.Plugin, ruleSeverities: Linter.RulesRecord, name?: string): Linter.Config;
