import { deepEqual, equal, throws } from "node:assert/strict";
import test from "node:test";
import { assertIdentifier, quoteIdentifier } from "./lib/identifiers.js";
import { parseNodeVersion } from "./lib/runtime.js";

test("parses Node versions", () => {
  deepEqual(parseNodeVersion("22.5.1"), { major: 22, minor: 5, patch: 1 });
  deepEqual(parseNodeVersion("v22.5.1"), { major: 22, minor: 5, patch: 1 });
});

test("accepts only safe SQL identifiers", () => {
  equal(quoteIdentifier("sfmc_players", "table"), '"sfmc_players"');
  throws(() => assertIdentifier("users; DROP TABLE x"), /Invalid SQL/);
});
