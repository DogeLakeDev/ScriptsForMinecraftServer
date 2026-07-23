import { RuleTester } from "@typescript-eslint/rule-tester";
import test from "node:test";
import { requireModuleRegistry } from "./require-module-registry.js";

RuleTester.afterAll = () => {};
RuleTester.describe = test;
RuleTester.it = test;
RuleTester.itOnly = test.only;

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
  },
});

ruleTester.run("require-module-registry", requireModuleRegistry, {
  valid: [
    {
      filename: "/repo/packages/afk/sapi/src/index.ts",
      code: `
        import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";
        ModuleRegistry.register({ id: "feature-afk", lifecycle: {} });
      `,
    },
    {
      // 非入口文件不检查
      filename: "/repo/packages/afk/sapi/src/helper.ts",
      code: `export const x = 1;`,
    },
  ],
  invalid: [
    {
      filename: "/repo/packages/afk/sapi/src/index.ts",
      code: `export const x = 1;`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
