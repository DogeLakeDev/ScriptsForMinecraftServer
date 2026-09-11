import { deepEqual, equal, match } from "node:assert/strict";
import test from "node:test";
import { Command } from "../../../src/sapi/runtime/command.js";
import { Permission } from "../../../src/sapi/runtime/permission.js";

test("registerHelpCommand 声明 /c:help、别名与权限子命令", () => {
  Command.unregister("help");
  Permission.clearRegistry();

  Command.registerHelpCommand();

  equal(Command.has("help"), true);
  equal(Command.has("h"), true);
  equal(Permission.entries().find((entry) => entry.name === "help.see")?.level, Permission.Any);
  equal(Permission.entries().find((entry) => entry.name === "permlist.see")?.level, Permission.Admin);
  deepEqual(Command.list.help?.options, {
    aliases: ["h"],
    enumParameter: { name: "section", values: ["permissions"], optional: true },
  });
  match(String(Command.list.help?.callback(undefined)), /\/c:help \[permissions\].*\/c:h \[permissions\]/);
});

test("registerNativeCommands 统一使用 c 命名空间且不拼接模块名", () => {
  Command.list = {};
  Command.register("status", Permission.Any, () => undefined, "平台状态");
  Command.register("pay", Permission.Any, () => undefined, "转账", "economy");
  Command.register("menu", Permission.Any, () => undefined, "打开菜单", "gui", undefined, {
    aliases: ["m"],
    enumParameter: { name: "section", values: ["admin"], optional: true },
  });
  const commands: Array<{
    name: string;
    description: string;
    permissionLevel: string;
    cheatsRequired: boolean;
    optionalParameters?: unknown[];
  }> = [];
  const enums: Array<{ name: string; values: string[] }> = [];

  Command.registerNativeCommands({
    registerCommand(command: { name: string; description: string; permissionLevel: string; cheatsRequired: boolean }) {
      commands.push(command);
    },
    registerEnum(name: string, values: string[]) {
      enums.push({ name, values });
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
    {
      name: "c:menu",
      description: "打开菜单 - §7gui",
      permissionLevel: "Any",
      cheatsRequired: false,
      optionalParameters: [{ name: "section", type: "Enum", enumName: "c:menu_section" }],
    },
    {
      name: "c:m",
      description: "打开菜单 - §7gui",
      permissionLevel: "Any",
      cheatsRequired: false,
      optionalParameters: [{ name: "section", type: "Enum", enumName: "c:menu_section" }],
    },
  ]);
  deepEqual(enums, [{ name: "c:menu_section", values: ["admin"] }]);
  equal(Command.has("m"), true);
  equal(Command.getModuleId("m"), "gui");
});
