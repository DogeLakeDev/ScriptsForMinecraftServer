import { requireServiceRequires } from "./require-service-requires.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("require-service-requires", requireServiceRequires, {
  valid: [
    {
      code: `await service.get("economy.account.debit", {});`,
      options: [{ knownRequires: ["economy.account.debit"] }],
    },
    {
      code: `await service.get("land.byId", {});`,
      options: [{ knownProvides: ["land.byId"] }],
    },
    {
      code: `await tx.call("economy.account.debit", {});`,
      options: [{ knownRequires: ["economy.account.debit"] }],
    },
    // 无 catalog 不报
    `await service.get("anything", {});`,
  ],
  invalid: [
    {
      code: `await service.get("economy.account.debit", {});`,
      options: [{ knownRequires: ["land.byId"] }],
      errors: [{ messageId: "missingRequires" }],
    },
    {
      code: `await tx.call("missing.svc", {});`,
      options: [{ knownRequires: [] }],
      errors: [{ messageId: "missingRequires" }],
    },
  ],
});
