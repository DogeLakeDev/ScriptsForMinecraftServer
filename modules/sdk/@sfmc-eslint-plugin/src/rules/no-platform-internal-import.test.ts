import { noPlatformInternalImport } from "./no-platform-internal-import.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-platform-internal-import", noPlatformInternalImport, {
  valid: [
    `import { db } from "@sfmc-bds/sdk/sapi/db";`,
    `import { economy } from "@sfmc-bds/module-economy/client";`,
    `import { foo } from "./helper.js";`,
  ],
  invalid: [
    {
      code: `import x from "db-server/dist/index.js";`,
      errors: [{ messageId: "blocked" }],
    },
    {
      code: `import { ROOT } from "../../../sfmc/src/runtime.js";`,
      errors: [{ messageId: "blocked" }],
    },
    {
      code: `import { createBdsManager } from "bds-tools/dist/bds-manager.js";`,
      errors: [{ messageId: "blocked" }],
    },
  ],
});
