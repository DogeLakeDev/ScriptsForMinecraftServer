import { validConfigKey } from "./valid-config-key.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("valid-config-key", validConfigKey, {
  valid: [
    {
      code: `await config.get("max_lands");`,
      options: [{ knownFields: ["max_lands"] }],
    },
    {
      code: `await config.set("max_lands", 5);`,
      options: [{ knownFields: ["max_lands"] }],
    },
    `config.onChange((key, value) => {});`,
    // 无 catalog 不报
    `await config.get("anything");`,
  ],
  invalid: [
    {
      code: `await config.get("nope");`,
      options: [{ knownFields: ["max_lands"] }],
      errors: [{ messageId: "unknownField" }],
    },
    {
      code: `config.onChange("land", (k, v) => {});`,
      errors: [{ messageId: "onChangeArity" }],
    },
  ],
});
