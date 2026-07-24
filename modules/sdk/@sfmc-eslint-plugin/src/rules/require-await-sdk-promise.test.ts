import { requireAwaitSdkPromise } from "./require-await-sdk-promise.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("require-await-sdk-promise", requireAwaitSdkPromise, {
  valid: [
    `await db.get("lands", 1);`,
    `return service.get("land.byId", {});`,
    `void config.set("a", 1);`,
    `db.get("lands", 1).then(() => {});`,
    `Msg.info("hi", player);`,
    `Permission.register("x", 0);`,
  ],
  invalid: [
    {
      code: `db.get("lands", 1);`,
      errors: [{ messageId: "needAwait" }],
    },
    {
      code: `service.get("land.byId", {});`,
      errors: [{ messageId: "needAwait" }],
    },
    {
      code: `const p = config.get("a");`,
      errors: [{ messageId: "needAwait" }],
    },
  ],
});
