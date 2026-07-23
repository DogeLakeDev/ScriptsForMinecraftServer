import { RuleTester } from "@typescript-eslint/rule-tester";
import test from "node:test";
import { noSdkDeepImport } from "./no-sdk-deep-import.js";

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

ruleTester.run("no-sdk-deep-import", noSdkDeepImport, {
  valid: [
    `import { Msg } from "@sfmc-bds/sdk/sapi/runtime";`,
    `import { foo } from "../utils";`,
  ],
  invalid: [
    {
      code: `import { Msg } from "../../../../modules/sdk/@sfmc-sdk/src/sapi/runtime/msg";`,
      errors: [{ messageId: "usePublic" }],
    },
    {
      code: `import x from "../../../@sfmc-sdk/src/index";`,
      errors: [{ messageId: "usePublic" }],
    },
  ],
});
