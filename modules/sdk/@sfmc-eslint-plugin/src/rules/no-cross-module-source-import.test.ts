import { noCrossModuleSourceImport } from "./no-cross-module-source-import.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-cross-module-source-import", noCrossModuleSourceImport, {
  valid: [
    {
      filename: "/repo/packages/land/sapi/src/index.ts",
      code: `import { helper } from "./helper.js";`,
    },
    {
      filename: "/repo/packages/land/sapi/src/index.ts",
      code: `import { economy } from "@sfmc-bds/module-economy/client";`,
    },
  ],
  invalid: [
    {
      filename: "/repo/packages/land/sapi/src/index.ts",
      code: `import { x } from "../../../economy/sapi/src/index.js";`,
      errors: [{ messageId: "crossSource" }],
    },
    {
      filename: "/repo/packages/land/sapi/src/index.ts",
      code: `import { x } from "@sfmc-bds/module-economy/sapi/src/foo.js";`,
      errors: [{ messageId: "crossSource" }],
    },
  ],
});
