import { RuleTester } from "@typescript-eslint/rule-tester";
import { after, describe, it } from "node:test";

/**
 * 统一 RuleTester 与 node:test 桥接（DRY）。
 * 须使用 describe/it（而非顶层 test），否则嵌套用例会被 parent 提前取消。
 */
RuleTester.afterAll = after;
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

export function createRuleTester(): RuleTester {
  return new RuleTester({
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
  });
}
