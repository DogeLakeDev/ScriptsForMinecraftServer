import { deepEqual, equal } from "node:assert/strict";
import test from "node:test";
import { Command } from "../../../src/sapi/runtime/command.js";
import { Permission } from "../../../src/sapi/runtime/permission.js";

test("registerHelpCommand 同时声明 /sfmc:help 命令与访客权限", () => {
  Command.unregister("help");
  Permission.clearRegistry();

  Command.registerHelpCommand();

  equal(Command.has("help"), true);
  equal(Permission.entries().find((entry) => entry.name === "help.see")?.level, Permission.Any);
});

test("registerNativeCommands 统一使用 sfmc 命名空间并为模块添加前缀", () => {
  Command.list = {};
  Command.register("status", Permission.Any, () => undefined, "平台状态");
  Command.register("pay", Permission.Any, () => undefined, "转账", "economy");
  const names: string[] = [];

  Command.registerNativeCommands({
    registerCommand(command: { name: string }) {
      names.push(command.name);
    },
  } as never);

  deepEqual(names, ["sfmc:status", "sfmc:economy_pay"]);
});
