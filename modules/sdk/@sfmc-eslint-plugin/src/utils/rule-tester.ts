import { RuleTester } from "@typescript-eslint/rule-tester";
import test from "node:test";

/** 统一 RuleTester 与 node:test 桥接，避免各规则测试重复样板（DRY） */
RuleTester.afterAll = () => {};
RuleTester.describe = test;
RuleTester.it = test;
RuleTester.itOnly = test.only;

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
