import { noSdkPrivateExport } from "./no-sdk-private-export.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-sdk-private-export", noSdkPrivateExport, {
  valid: [
    `import { Msg } from "@sfmc-bds/sdk/sapi/runtime";`,
    `import { db } from "@sfmc-bds/sdk/sapi/db";`,
    `import { ModuleRegistry } from "@sfmc-bds/sdk/module-loader";`,
    `import schema from "@sfmc-bds/sdk/schemas/sapi-manifest.v2.schema.json";`,
  ],
  invalid: [
    {
      code: `import x from "@sfmc-bds/sdk";`,
      errors: [{ messageId: "bare" }],
    },
    {
      code: `import { Msg } from "@sfmc-bds/sdk/sapi/runtime/msg";`,
      errors: [{ messageId: "private" }],
    },
    {
      code: `import x from "@sfmc-bds/sdk/src/sapi/runtime/msg.js";`,
      errors: [{ messageId: "private" }],
    },
  ],
});
