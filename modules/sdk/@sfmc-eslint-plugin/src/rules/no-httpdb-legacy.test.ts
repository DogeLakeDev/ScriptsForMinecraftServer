import { noHttpdbLegacy } from "./no-httpdb-legacy.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-httpdb-legacy", noHttpdbLegacy, {
  valid: [
    `import { db } from "@sfmc-bds/sdk/sapi/db";`,
    `import { service } from "@sfmc-bds/sdk/sapi/service";`,
  ],
  invalid: [
    {
      code: `import { HttpDB } from "@sfmc-bds/sdk/sapi/runtime";`,
      errors: [{ messageId: "legacy" }],
    },
    {
      code: `const x = new HttpDB();`,
      errors: [{ messageId: "legacy" }],
    },
  ],
});
