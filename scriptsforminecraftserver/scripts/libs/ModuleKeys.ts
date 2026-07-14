export const Modules = {
  config: "config",
  command: "command",
  permission: "permission",
  httpdb: "httpdb",
  money: "money",
  chat: "chat",
  coop: "coop",
  land: "land",
  holoprint: "holoprint",
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
} as const;

export type ModuleKey = (typeof Modules)[keyof typeof Modules];
export type ModuleId = keyof typeof Modules;
