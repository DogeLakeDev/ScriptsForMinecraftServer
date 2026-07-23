// Main repo ESLint — SDK sources + SFMC plugin
import sfmc from "@sfmc-bds/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/build/**",
      "**/*.d.ts",
      "sfmc/dist/**",
      "db-server/dist/**",
      "bds-tools/dist/**",
      "qq-bridge/dist/**",
      "modules/sdk/@sfmc-eslint-plugin/**",
    ],
  },
  {
    files: ["modules/sdk/@sfmc-sdk/src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "@sfmc-bds": sfmc,
    },
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "error",
      ...sfmc.configs.recommended.rules,
      // Msg implementation calls sendMessage
      "@sfmc-bds/no-player-send-message": "off",
      // SDK is not a module entry
      "@sfmc-bds/require-module-registry": "off",
    },
  },
];
