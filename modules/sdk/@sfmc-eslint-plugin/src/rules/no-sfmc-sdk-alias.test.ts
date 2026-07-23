import { RuleTester } from "@typescript-eslint/rule-tester";
import test from "node:test";
import { noSfmcSdkAlias } from "./no-sfmc-sdk-alias.js";

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

ruleTester.run("no-sfmc-sdk-alias", noSfmcSdkAlias, {
  valid: [
    `import { Msg } from "@sfmc-bds/sdk/sapi/runtime";`,
    `import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";`,
  ],
  invalid: [
    {
      code: `import { Msg } from "@sfmc/sdk/sapi/runtime";`,
      errors: [{ messageId: "useOfficial" }],
    },
    {
      code: `import x from "@sfmc/sdk";`,
      errors: [{ messageId: "useOfficial" }],
    },
  ],
});
