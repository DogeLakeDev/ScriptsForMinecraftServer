import { noSfmcSdkAlias } from "./no-sfmc-sdk-alias.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-sfmc-sdk-alias", noSfmcSdkAlias, {
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
