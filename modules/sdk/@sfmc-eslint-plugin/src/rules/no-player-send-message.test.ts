import { noPlayerSendMessage } from "./no-player-send-message.js";
import { createRuleTester } from "../utils/rule-tester.js";

createRuleTester().run("no-player-send-message", noPlayerSendMessage, {
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
