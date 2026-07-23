import { noPlayerSendMessage } from "../rules/no-player-send-message.js";
import { noSdkDeepImport } from "../rules/no-sdk-deep-import.js";
import { noSfmcSdkAlias } from "../rules/no-sfmc-sdk-alias.js";
import { requireModuleRegistry } from "../rules/require-module-registry.js";
/**
 * 规则实现注册表（权威来源）。
 * 新增规则只需：实现 rule → 挂到此处 → 写入 recommended/all 严重级别。
 */
export const rules = {
    "no-player-send-message": noPlayerSendMessage,
    "no-sfmc-sdk-alias": noSfmcSdkAlias,
    "no-sdk-deep-import": noSdkDeepImport,
    "require-module-registry": requireModuleRegistry,
};
/** recommended：日常模块/SDK 约定 */
export const recommendedRules = {
    "@sfmc-bds/no-player-send-message": "warn",
    "@sfmc-bds/no-sfmc-sdk-alias": "error",
    "@sfmc-bds/no-sdk-deep-import": "error",
    "@sfmc-bds/require-module-registry": "warn",
};
/** all：在 recommended 上将 no-player-send-message 升为 error */
export const allRules = {
    ...recommendedRules,
    "@sfmc-bds/no-player-send-message": "error",
};
/**
 * 生成 flat config 片段。
 * 由调用方注入 plugin 实例，避免 configs ↔ index 循环依赖。
 */
export function createFlatConfig(plugin, ruleSeverities, name = "@sfmc-bds/eslint-plugin/recommended") {
    return {
        name,
        plugins: {
            "@sfmc-bds": plugin,
        },
        rules: ruleSeverities,
    };
}
