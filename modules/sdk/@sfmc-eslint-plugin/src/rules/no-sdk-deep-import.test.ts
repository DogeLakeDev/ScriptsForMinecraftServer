import { noSdkDeepImport } from "./no-sdk-deep-import.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-sdk-deep-import", noSdkDeepImport, {
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
