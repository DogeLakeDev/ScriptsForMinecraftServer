import type { ESLint, Linter } from "eslint";
import { noCrossModuleSourceImport } from "../rules/no-cross-module-source-import.js";
import { noDbToplevelInTx } from "../rules/no-db-toplevel-in-tx.js";
import { noEconomyPrivateTables } from "../rules/no-economy-private-tables.js";
import { noHttpdbLegacy } from "../rules/no-httpdb-legacy.js";
import { noPlatformInternalImport } from "../rules/no-platform-internal-import.js";
import { noPlayerSendMessage } from "../rules/no-player-send-message.js";
import { noSdkDeepImport } from "../rules/no-sdk-deep-import.js";
import { noSdkPrivateExport } from "../rules/no-sdk-private-export.js";
import { noSfmcSdkAlias } from "../rules/no-sfmc-sdk-alias.js";
import { requireAwaitSdkPromise } from "../rules/require-await-sdk-promise.js";
import { requireCommandPermission } from "../rules/require-command-permission.js";
import { requireModuleRegistry } from "../rules/require-module-registry.js";
import { requireServiceRequires } from "../rules/require-service-requires.js";
import { validConfigKey } from "../rules/valid-config-key.js";

/**
 * 规则实现注册表（权威来源）。
 * 新增规则只需：实现 rule → 挂到此处 → 写入 recommended/all 严重级别。
 */
export const rules = {
  "no-player-send-message": noPlayerSendMessage,
  "no-sfmc-sdk-alias": noSfmcSdkAlias,
  "no-sdk-deep-import": noSdkDeepImport,
  "require-module-registry": requireModuleRegistry,
  "no-db-toplevel-in-tx": noDbToplevelInTx,
  "require-command-permission": requireCommandPermission,
  "no-httpdb-legacy": noHttpdbLegacy,
  "require-service-requires": requireServiceRequires,
  "valid-config-key": validConfigKey,
  "require-await-sdk-promise": requireAwaitSdkPromise,
  "no-economy-private-tables": noEconomyPrivateTables,
  "no-platform-internal-import": noPlatformInternalImport,
  "no-cross-module-source-import": noCrossModuleSourceImport,
  "no-sdk-private-export": noSdkPrivateExport,
};

/** recommended：日常模块/SDK 约定 */
export const recommendedRules: Linter.RulesRecord = {
  "@sfmc-bds/no-player-send-message": "warn",
  "@sfmc-bds/no-sfmc-sdk-alias": "error",
  "@sfmc-bds/no-sdk-deep-import": "error",
  "@sfmc-bds/require-module-registry": "warn",
  "@sfmc-bds/no-db-toplevel-in-tx": "error",
  "@sfmc-bds/require-command-permission": "warn",
  "@sfmc-bds/no-httpdb-legacy": "warn",
  "@sfmc-bds/require-service-requires": "warn",
  "@sfmc-bds/valid-config-key": "warn",
  "@sfmc-bds/require-await-sdk-promise": "warn",
  "@sfmc-bds/no-economy-private-tables": "error",
  "@sfmc-bds/no-platform-internal-import": "error",
  "@sfmc-bds/no-cross-module-source-import": "error",
  "@sfmc-bds/no-sdk-private-export": "error",
};

/** all：在 recommended 上将部分 warn 升为 error */
export const allRules: Linter.RulesRecord = {
  ...recommendedRules,
  "@sfmc-bds/no-player-send-message": "error",
  "@sfmc-bds/no-httpdb-legacy": "error",
  "@sfmc-bds/require-await-sdk-promise": "error",
};

/**
 * 生成 flat config 片段。
 * 由调用方注入 plugin 实例，避免 configs ↔ index 循环依赖。
 */
export function createFlatConfig(
  plugin: ESLint.Plugin,
  ruleSeverities: Linter.RulesRecord,
  name = "@sfmc-bds/eslint-plugin/recommended"
): Linter.Config {
  return {
    name,
    plugins: {
      "@sfmc-bds": plugin,
    },
    rules: ruleSeverities,
  };
}
