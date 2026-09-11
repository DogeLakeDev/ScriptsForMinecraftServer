import { Player } from "@minecraft/server";
import { deepEqual, equal, match } from "node:assert/strict";
import test from "node:test";
import { Command, splitHelpMessage } from "../../../src/sapi/runtime/command.js";
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

test("splitHelpMessage 按完整行连续拆分帮助内容", () => {
  deepEqual(splitHelpMessage("标题\n第一条命令\n第二条命令", 10), ["标题\n第一条命令", "第二条命令"]);
  deepEqual(splitHelpMessage("123456789", 4), ["1234", "5678", "9"]);
});

test("help 内容过长时向玩家连续发送多条消息", () => {
  Command.list = {};
  Permission.clearRegistry();
  Command.registerHelpCommand();
  for (let index = 0; index < 20; index++) {
    Command.register(`command-${index}`, Permission.Any, () => undefined, `第 ${index} 条测试命令说明`);
  }
  const sent: string[] = [];
  const player = new Player() as Player & { sendMessage(message: string): void };
  player.sendMessage = (message) => sent.push(message);

  const result = Command.list.help?.callback(player);

  equal(result, undefined);
  equal(sent.length > 1, true);
  equal(
    sent.every((message) => message.length <= 406),
    true
  );
  match(sent.join("\n"), /\/c:command-0/);
  match(sent.join("\n"), /\/c:command-19/);
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
