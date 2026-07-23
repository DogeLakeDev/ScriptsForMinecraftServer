import { RuleTester } from "@typescript-eslint/rule-tester";
import test from "node:test";
import { noPlayerSendMessage } from "./no-player-send-message.js";
RuleTester.afterAll = () => { };
RuleTester.describe = test;
RuleTester.it = test;
RuleTester.itOnly = test.only;
const ruleTester = new RuleTester({
    languageOptions: {
        parserOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
        },
    },
});
ruleTester.run("no-player-send-message", noPlayerSendMessage, {
    valid: [
        `import { Msg } from "@sfmc-bds/sdk/sapi/runtime"; Msg.info("hi", player);`,
        `foo.bar();`,
    ],
    invalid: [
        {
            code: `player.sendMessage("hi");`,
            errors: [{ messageId: "useMsg" }],
        },
        {
            code: `world.sendMessage({ rawtext: [] });`,
            errors: [{ messageId: "useMsg" }],
        },
    ],
});
