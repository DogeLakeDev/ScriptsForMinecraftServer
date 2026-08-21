// SFMC 模块 ESLint 配置
import sfmc from "@sfmc-bds/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/build/**", "**/*.d.ts"],
  },
  {
    files: ["sapi/**/*.ts", "test/**/*.ts"],
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
    },
  },
  {
    files: ["test/**/*.ts"],
    rules: {
      "@sfmc-bds/no-sdk-private-export": "off",
    },
  },
];
