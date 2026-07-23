import { noEconomyPrivateTables } from "./no-economy-private-tables.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-economy-private-tables", noEconomyPrivateTables, {
  valid: [
    `await db.query("sfmc_land_plots");`,
    `await tx.get("lands", 1);`,
    `await service.get("economy.account.get", {});`,
  ],
  invalid: [
    {
      code: `await db.query("sfmc_economy_accounts");`,
      errors: [{ messageId: "useEconomyClient" }],
    },
    {
      code: `await tx.update("sfmc_economy_transactions", 1, {});`,
      errors: [{ messageId: "useEconomyClient" }],
    },
  ],
});
