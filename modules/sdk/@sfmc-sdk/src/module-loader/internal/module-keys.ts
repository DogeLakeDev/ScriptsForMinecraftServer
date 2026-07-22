export const Modules = {
  config: "config",
  command: "command",
  permission: "permission",
  httpdb: "httpdb",
  money: "money",
  chat: "chat",
  coop: "coop",
  land: "land",
  afk: "afk",
  clean: "clean",
  tps: "tps",
  onlineTime: "online_time",
  activityLog: "activity_log",
  scoreboardSync: "scoreboard_sync",
  spawnProtect: "spawn_protect",
  chatSounds: "chat_sounds",
  inventorySwitcher: "inventory_switcher",
  fly: "fly",
  creative: "creative",
  survival: "survival",
  peace: "peace",
  qa: "qa",
  monitor: "monitor",
  dailyTask: "daily_task",
  priceIndex: "price_index",
  dataBackup: "data_backup",
  gui: "gui",
} as const;

export type ModuleKey = (typeof Modules)[keyof typeof Modules];
/**
 * OCP:模块 id 为开放字符串(catalog/manifest id,如 feature-afk);
 * Modules 枚举仅作旧别名,新模块不必改此表。
 */
export type ModuleId = string;
