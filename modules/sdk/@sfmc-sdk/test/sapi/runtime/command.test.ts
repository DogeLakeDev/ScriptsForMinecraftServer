import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import { Command } from "../../../src/sapi/runtime/command.js";
import { Permission } from "../../../src/sapi/runtime/permission.js";

test("registerHelpCommand 同时声明 /c:help 命令与访客权限", () => {
  Command.unregister("help");
  Permission.clearRegistry();

  Command.registerHelpCommand();

  equal(Command.has("help"), true);
  equal(Permission.entries().find((entry) => entry.name === "help.see")?.level, Permission.Any);
});

test("registerNativeCommands 统一使用 c 命名空间且不拼接模块名", () => {
  Command.list = {};
  Command.register("status", Permission.Any, () => undefined, "平台状态");
  Command.register("pay", Permission.Any, () => undefined, "转账", "economy");
  const commands: Array<{
    name: string;
    description: string;
    permissionLevel: string;
    cheatsRequired: boolean;
  }> = [];

  Command.registerNativeCommands({
    registerCommand(command: { name: string; description: string; permissionLevel: string; cheatsRequired: boolean }) {
      commands.push(command);
    },
  } as never);

  deepEqual(commands, [
    {
      name: "c:status",
      description: "平台状态",
      permissionLevel: "Any",
      cheatsRequired: false,
    },
    {
      name: "c:pay",
      description: "转账 - §7economy",
      permissionLevel: "Any",
      cheatsRequired: false,
    },
  ]);
});
