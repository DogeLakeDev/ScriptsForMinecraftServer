import { noDbToplevelInTx } from "./no-db-toplevel-in-tx.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-db-toplevel-in-tx", noDbToplevelInTx, {
  valid: [
    `await db.query("lands");`,
    `await db.tx(async (tx) => { await tx.get("lands", 1); });`,
    `await db.tx(async (tx) => { await tx.call("economy.account.debit", {}); });`,
    `await db.tx(async (tx) => { await economy.account.inTx(tx).debit({}); });`,
    `await service.get("land.byId", {});`,
  ],
  invalid: [
    {
      code: `await db.tx(async () => { await db.query("lands"); });`,
      errors: [{ messageId: "useTx" }],
    },
    {
      code: `await db.tx(async (tx) => { await db.get("lands", 1); });`,
      errors: [{ messageId: "useTx" }],
    },
    {
      code: `await db.tx(async (tx) => { await service.get("economy.account.debit", {}); });`,
      errors: [{ messageId: "useTxCall" }],
    },
    {
      code: `await db.tx(async (tx) => { await db.tx(async () => {}); });`,
      errors: [{ messageId: "useTx" }],
    },
  ],
});
