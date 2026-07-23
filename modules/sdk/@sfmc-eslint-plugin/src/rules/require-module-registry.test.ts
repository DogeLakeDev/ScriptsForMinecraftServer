import { requireModuleRegistry } from "./require-module-registry.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("require-module-registry", requireModuleRegistry, {
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
