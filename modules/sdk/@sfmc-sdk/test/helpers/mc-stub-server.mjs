/** 测试用 @minecraft/server 薄 stub（仅满足 HttpDB import system）。 */
export const system = {
  clearRun() {},
  runInterval() {
    return 0;
  },
  run() {
    return 0;
  },
  async waitTicks() {},
  beforeEvents: {
    startup: { subscribe() {} },
    shutdown: { subscribe() {} },
  },
};

export class Player {}

export const CommandPermissionLevel = { Any: "Any" };
export const CustomCommandStatus = { Success: 0, Failure: 1 };

export const world = {
  afterEvents: {
    worldLoad: { subscribe() {} },
  },
};
