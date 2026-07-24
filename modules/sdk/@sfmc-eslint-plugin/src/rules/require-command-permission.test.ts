import { requireCommandPermission } from "./require-command-permission.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("require-command-permission", requireCommandPermission, {
  valid: [
    `
      Permission.register("afk.use", 0);
      Command.register("afk", "afk.use", () => {});
    `,
    `Command.register("op", 2, () => {});`,
  ],
  invalid: [
    {
      code: `Command.register("afk", "afk.use", () => {});`,
      errors: [{ messageId: "missing" }],
    },
  ],
});
