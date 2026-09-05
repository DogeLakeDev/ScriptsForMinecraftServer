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

export const world = {
  afterEvents: {
    worldLoad: { subscribe() {} },
  },
};
