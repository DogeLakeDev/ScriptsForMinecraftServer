var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// scripts/libs/DebugLog.ts
function ts() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(11, 23);
}
function log(level, module, msg, ...args) {
  if (!ENABLED) return;
  if (LEVELS[level] < minLevel) return;
  const extra = args.length ? " | " + args.map((a) => {
    try {
      return typeof a === "object" ? JSON.stringify(a) : String(a);
    } catch {
      return String(a);
    }
  }).join(" ") : "";
  console.log(`[${ts()}[${level}][${module}] ${msg}${extra}`);
}
var ENABLED, LEVELS, minLevel, debug;
var init_DebugLog = __esm({
  "scripts/libs/DebugLog.ts"() {
    "use strict";
    ENABLED = true;
    LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
    minLevel = 0;
    debug = {
      d: (m, msg, ...args) => log("DEBUG", m, msg, ...args),
      i: (m, msg, ...args) => log("INFO", m, msg, ...args),
      w: (m, msg, ...args) => log("WARN", m, msg, ...args),
      e: (m, msg, ...args) => log("ERROR", m, msg, ...args)
    };
  }
});

// scripts/libs/Tools.ts
import { BlockComponentTypes, BlockPermutation, world } from "@minecraft/server";
function pointInArea_2D(x, z, areaStart_x, areaStart_z, areaEnd_x, areaEnd_z) {
  if (areaStart_x < areaEnd_x) {
    if (x < areaStart_x || areaEnd_x < x) {
      return false;
    }
  } else {
    if (x < areaEnd_x || areaStart_x < x) {
      return false;
    }
  }
  if (areaStart_z < areaEnd_z) {
    if (z < areaStart_z || areaEnd_z < z) {
      return false;
    }
  } else {
    if (z < areaEnd_z || areaStart_z < z) {
      return false;
    }
  }
  return true;
}
function getRandomInteger(min = 0, max = 1) {
  return min + Math.floor(Math.random() * (max + 1));
}
function getBase(direction) {
  switch (direction) {
    case 1:
      return [1, 0];
    case -1:
      return [-1, 0];
    case 2:
      return [0, 1];
    case -2:
      return [0, -1];
    default:
      return [1, 0];
  }
}
function getChestCardinal(direction, face) {
  if (direction === -1 || direction === 1) {
    return face > 0 ? "south" : "north";
  }
  return face > 0 ? "east" : "west";
}
function getSignFacing(direction, face) {
  if (direction === -1 || direction === 1) {
    return face > 0 ? 3 : 2;
  }
  return face > 0 ? 5 : 4;
}
function getLayout(start, direction, mainAxis, yOffset, face) {
  const base = getBase(direction);
  const left = {
    x: start[0] + mainAxis * base[0] * 2,
    y: start[1] + yOffset,
    z: start[2] + mainAxis * base[1] * 2
  };
  const right = {
    x: left.x + base[0],
    y: left.y,
    z: left.z + base[1]
  };
  const sign = {
    x: right.x + (base[0] !== 0 ? 0 : face),
    y: right.y,
    z: right.z + (base[1] !== 0 ? 0 : face)
  };
  return { left, right, sign };
}
function ensureDoubleChest(dimension, pos, cardinal, direction) {
  const base = getBase(direction);
  for (const d of [0, 1]) {
    const p = {
      x: pos.x + (base[0] !== 0 ? d * base[0] : 0),
      y: pos.y,
      z: pos.z + (base[1] !== 0 ? d * base[1] : 0)
    };
    const block = dimension.getBlock(p);
    if (!block || block.typeId !== "minecraft:chest") {
      dimension.setBlockPermutation(p, BlockPermutation.resolve("chest", { "minecraft:cardinal_direction": cardinal }));
    }
  }
}
function placeSign(dimension, pos, facing, text) {
  dimension.setBlockPermutation(pos, BlockPermutation.resolve("pale_oak_wall_sign", { facing_direction: facing }));
  try {
    const block = dimension.getBlock(pos);
    const sign = block?.getComponent(BlockComponentTypes.Sign);
    if (sign) sign.setText(text);
  } catch {
  }
}
function getShanghaiTime() {
  const now = /* @__PURE__ */ new Date();
  const offset = 8 * 60;
  const local = new Date(now.getTime() + offset * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    date: `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`,
    time: `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
  };
}
function formatTimestamp(ts2) {
  const offset = 8 * 60;
  const d = new Date(ts2 + offset * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
function registerSystemMsgHandler(handler) {
  _systemMsgHandler = handler;
}
function generateId(type) {
  return `${type}_${Math.random().toString(36).slice(2, 10)}`;
}
function toQueryString(params) {
  const parts = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== void 0 && v !== "") parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length > 0 ? "?" + parts.join("&") : "";
}
function ListFormInfo(str) {
  if (str.length === 0) return "\xA77\u8BF7\u9009\u62E9\u64CD\u4F5C\uFF1A";
  let lines = [];
  lines.push(`[*] ${str[0]}`);
  if (str.length > 1) {
    str.shift();
    for (let line of str) {
      lines.push(`${line}`);
    }
  }
  lines.push("");
  lines.push(`\xA77\u8BF7\u9009\u62E9\u64CD\u4F5C\uFF1A`);
  return lines.join("\n");
}
var _systemMsgHandler, Msg;
var init_Tools = __esm({
  "scripts/libs/Tools.ts"() {
    "use strict";
    _systemMsgHandler = null;
    Msg = {
      info: (msg, player) => {
        player.sendMessage(`\xA7f[*] ${msg}`);
        _systemMsgHandler?.(player, msg);
      },
      error: (msg, player) => {
        player.sendMessage(`\xA7c[x] ${msg}`);
        _systemMsgHandler?.(player, msg);
      },
      success: (msg, player) => {
        player.sendMessage(`\xA7a[\u221A] ${msg}`);
        _systemMsgHandler?.(player, msg);
      },
      warning: (msg, player) => {
        player.sendMessage(`\xA7e[!] ${msg}`);
        _systemMsgHandler?.(player, msg);
      },
      tips: (msg, player) => {
        player.sendMessage(`\xA77[!] ${msg}`);
        _systemMsgHandler?.(player, msg);
      }
    };
  }
});

// scripts/area/CreativeArea.ts
import {
  EntityInitializationCause,
  GameMode,
  system,
  world as world2
} from "@minecraft/server";
var _CreativeArea, CreativeArea;
var init_CreativeArea = __esm({
  "scripts/area/CreativeArea.ts"() {
    "use strict";
    init_ConfigManager();
    init_Permission();
    init_Tools();
    _CreativeArea = class _CreativeArea {
      constructor() {
        this.BORDER_THRESHOLD = 10;
        this.BORDER_WARNING_DISTANCE = 5;
        this.BUFFER_ZONE = 3;
        this.subscriptions = [];
        this.tickRunIds = [];
      }
      static getInstance() {
        if (!_CreativeArea._instance) {
          _CreativeArea._instance = new _CreativeArea();
        }
        return _CreativeArea._instance;
      }
      /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
      registerCommandsAndPermissions() {
        Permission.register("creativearea.place_banned", Permission.Admin);
      }
      /** 注册事件（由 entry.ts 统一调用） */
      registerEvents() {
        if (this.subscriptions.length > 0) return;
        this.subscriptions.push(
          world2.afterEvents.playerSpawn.subscribe((event) => {
            if (!event.initialSpawn) return;
            system.runTimeout(() => {
              const areaName = this.inArea(event.player);
              if (areaName !== void 0) {
                this.enterArea(event.player, areaName);
              } else if (event.player.getGameMode() === GameMode.Creative || event.player.getGameMode() === GameMode.Spectator) {
                event.player.setGameMode(GameMode.Survival);
              }
            }, 60);
          })
        );
        this.subscriptions.push(
          world2.afterEvents.playerDimensionChange.subscribe((event) => {
            if (!_CreativeArea.enable) return;
            system.runTimeout(() => {
              const areaName = this.inArea(event.player);
              const currentArea = event.player.getDynamicProperty("hpbe:creative_area");
              if (currentArea === void 0 && areaName !== void 0) {
                this.enterArea(event.player, areaName);
              } else if (currentArea !== void 0 && areaName === void 0) {
                this.leaveArea(event.player, currentArea);
              }
            }, 10);
          })
        );
        this.subscriptions.push(
          world2.afterEvents.entitySpawn.subscribe((event) => {
            if (!_CreativeArea.enable) return;
            if (!event.entity) return;
            if (event.entity.typeId === "minecraft:player") return;
            if (!this.creativeDims.has(event.entity.dimension.id)) return;
            try {
              if (event.cause === EntityInitializationCause.Spawned) {
                if (this.inArea(event.entity) !== void 0 || this.inBufferZone(event.entity)) {
                  event.entity.remove();
                }
              }
            } catch {
            }
          })
        );
        this.subscriptions.push(
          world2.beforeEvents.playerPlaceBlock.subscribe((event) => {
            if (!_CreativeArea.enable) return;
            const player = event.player;
            if (player.getGameMode() !== GameMode.Creative) return;
            if (!this.inAreaByPos(event.block.location.x, event.block.location.z, player.dimension.id)) {
              event.cancel = true;
              Msg.error(`\u4F60\u53EA\u80FD\u5728\u521B\u9020\u533A\u57DF\u5185\u653E\u7F6E\u65B9\u5757\u3002`, player);
              return;
            }
            if (ConfigManager.getBannedItems().indexOf(event.permutationToPlace.type.id) !== -1) {
              if (!Permission.check(player, "creativearea.place_banned")) {
                event.cancel = true;
                Msg.error(`\u521B\u9020\u533A\u57DF\u5185\u7981\u6B62\u653E\u7F6E ${event.permutationToPlace.type.id}\u3002`, player);
              }
            }
          })
        );
        this.subscriptions.push(
          world2.beforeEvents.playerBreakBlock.subscribe((event) => {
            if (!_CreativeArea.enable) return;
            if (event.player.getGameMode() !== GameMode.Creative) return;
            if (!this.inAreaByPos(event.block.location.x, event.block.location.z, event.player.dimension.id)) {
              event.cancel = true;
              Msg.error(`\u4F60\u53EA\u80FD\u7834\u574F\u521B\u9020\u533A\u57DF\u5185\u7684\u65B9\u5757\u3002`, event.player);
            }
          })
        );
      }
      cleanup() {
        for (const s of this.subscriptions) {
          try {
            s.unsubscribe();
          } catch {
          }
        }
        this.subscriptions = [];
        for (const id of this.tickRunIds) {
          try {
            system.clearRun(id);
          } catch {
          }
        }
        this.tickRunIds = [];
      }
      init() {
        this.startTick();
        this.startBorderFastCheck();
      }
      // ==========================================
      //  区域判定
      // ==========================================
      inArea(entity) {
        for (const area of ConfigManager.getAreas("creative")) {
          if (entity.dimension.id === area.dimension) {
            if (pointInArea_2D(
              entity.location.x,
              entity.location.z,
              area.start[0],
              area.start[1],
              area.end[0],
              area.end[1]
            )) {
              return area.name;
            }
          }
        }
        return void 0;
      }
      inAreaByPos(x, z, dimensionId2) {
        for (const area of ConfigManager.getAreas("creative")) {
          if (dimensionId2 === area.dimension) {
            if (pointInArea_2D(x, z, area.start[0], area.start[1], area.end[0], area.end[1])) {
              return true;
            }
          }
        }
        return false;
      }
      isNearBorder(entity, threshold = this.BORDER_THRESHOLD) {
        for (const area of ConfigManager.getAreas("creative")) {
          if (entity.dimension.id !== area.dimension) continue;
          const minX = Math.min(area.start[0], area.end[0]) - threshold;
          const maxX = Math.max(area.start[0], area.end[0]) + threshold;
          const minZ = Math.min(area.start[1], area.end[1]) - threshold;
          const maxZ = Math.max(area.start[1], area.end[1]) + threshold;
          if (entity.location.x >= minX && entity.location.x <= maxX && entity.location.z >= minZ && entity.location.z <= maxZ)
            return true;
        }
        return false;
      }
      inBufferZone(entity) {
        for (const area of ConfigManager.getAreas("creative")) {
          if (entity.dimension.id !== area.dimension) continue;
          const minX = Math.min(area.start[0], area.end[0]);
          const maxX = Math.max(area.start[0], area.end[0]);
          const minZ = Math.min(area.start[1], area.end[1]);
          const maxZ = Math.max(area.start[1], area.end[1]);
          const x = entity.location.x, z = entity.location.z;
          const inExpanded = x >= minX - this.BUFFER_ZONE && x <= maxX + this.BUFFER_ZONE && z >= minZ - this.BUFFER_ZONE && z <= maxZ + this.BUFFER_ZONE;
          if (!inExpanded) continue;
          if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) continue;
          return true;
        }
        return false;
      }
      get creativeDims() {
        const dims = /* @__PURE__ */ new Set();
        for (const area of ConfigManager.getAreas("creative")) dims.add(area.dimension);
        return dims;
      }
      // ==========================================
      //  进入 / 离开 处理（背包由 InventorySwitcher 接管）
      // ==========================================
      enterArea(player, areaName) {
        this.saveScores(player);
        player.setGameMode(GameMode.Creative);
        player.setDynamicProperty("hpbe:creative_area", areaName);
        Msg.info(`\u8FDB\u5165 \xA7a${areaName}\u521B\u9020\u533A\u57DF\xA7r \uFF0C\u5207\u6362\u4E3A\u521B\u9020\u6A21\u5F0F\u3002`, player);
      }
      leaveArea(player, areaName) {
        this.restoreScores(player);
        player.setGameMode(GameMode.Survival);
        player.setDynamicProperty("hpbe:creative_area", void 0);
        Msg.info(`\u79BB\u5F00 \xA7a${areaName}\u521B\u9020\u533A\u57DF\xA7r \uFF0C\u6062\u590D\u751F\u5B58\u6A21\u5F0F\u3002`, player);
      }
      // ==========================================
      //  计分项保存 / 恢复
      // ==========================================
      saveScores(player) {
        const identity = player.scoreboardIdentity;
        if (!identity) return;
        const scores = {};
        for (const obj of world2.scoreboard.getObjectives()) {
          try {
            const score = obj.getScore(identity);
            if (score !== void 0) scores[obj.id] = score;
          } catch {
          }
        }
        if (Object.keys(scores).length > 0) {
          player.setDynamicProperty("hpbe:creative_scores", JSON.stringify(scores));
        }
      }
      restoreScores(player) {
        const raw = player.getDynamicProperty("hpbe:creative_scores");
        const scores = raw ? JSON.parse(raw) : void 0;
        if (!scores) return;
        const identity = player.scoreboardIdentity;
        if (!identity) return;
        for (const obj of world2.scoreboard.getObjectives()) {
          if (scores[obj.id] !== void 0) {
            try {
              obj.setScore(identity, scores[obj.id]);
            } catch {
            }
          }
        }
        player.setDynamicProperty("hpbe:creative_scores", void 0);
      }
      // ==========================================
      //  定时扫描（进出检测）
      // ==========================================
      startTick() {
        this.tickRunIds.push(
          system.runInterval(() => {
            if (!_CreativeArea.enable) return;
            for (const player of world2.getPlayers()) {
              if (player.getGameMode() === GameMode.Spectator) continue;
              const currentArea = player.getDynamicProperty("hpbe:creative_area");
              if (currentArea === void 0) {
                const areaName = this.inArea(player);
                if (areaName !== void 0) this.enterArea(player, areaName);
              } else {
                if (this.inArea(player) === void 0) this.leaveArea(player, currentArea);
              }
            }
          }, 10)
        );
      }
      // ==========================================
      //  边界快速检测
      // ==========================================
      startBorderFastCheck() {
        this.tickRunIds.push(
          system.runInterval(() => {
            if (!_CreativeArea.enable) return;
            for (const player of world2.getPlayers()) {
              if (player.getGameMode() !== GameMode.Creative) continue;
              if (!this.isNearBorder(player)) continue;
              const currentArea = player.getDynamicProperty("hpbe:creative_area");
              if (currentArea !== void 0 && this.inArea(player) === void 0) {
                this.leaveArea(player, currentArea);
              }
            }
          }, 2)
        );
      }
      // ==========================================
      //  边界视觉警告
      // ==========================================
      startBorderWarning() {
        this.tickRunIds.push(
          system.runInterval(() => {
            if (!_CreativeArea.enable) return;
            for (const player of world2.getPlayers()) {
              for (const area of ConfigManager.getAreas("creative")) {
                if (player.dimension.id !== area.dimension) continue;
                const pos = player.location;
                const minX = Math.min(area.start[0], area.end[0]);
                const maxX = Math.max(area.start[0], area.end[0]);
                const minZ = Math.min(area.start[1], area.end[1]);
                const maxZ = Math.max(area.start[1], area.end[1]);
                const d = this.BORDER_WARNING_DISTANCE;
                if (pos.x < minX - d || pos.x > maxX + d || pos.z < minZ - d || pos.z > maxZ + d) continue;
                const cx = Math.max(minX, Math.min(maxX, pos.x));
                const cz = Math.max(minZ, Math.min(maxZ, pos.z));
                let bx = cx, bz = cz;
                if (cx === pos.x && cz === pos.z) {
                  const dx = Math.min(pos.x - minX, maxX - pos.x);
                  const dz = Math.min(pos.z - minZ, maxZ - pos.z);
                  if (dx < dz) bx = pos.x - minX < maxX - pos.x ? minX : maxX;
                  else bz = pos.z - minZ < maxZ - pos.z ? minZ : maxZ;
                }
                const y = Math.floor(pos.y);
                try {
                  for (let dy = -1; dy <= 2; dy++) {
                    player.dimension.spawnParticle("minecraft:colored_flame_particle", { x: bx, y: y + dy, z: bz });
                  }
                } catch {
                }
                break;
              }
            }
          }, 20)
        );
      }
    };
    /** 连锁开关（同时控制 CreativeArea + SurvivalArea） */
    _CreativeArea.enable = true;
    CreativeArea = _CreativeArea;
  }
});

// scripts/area/Peace.ts
import { EntityInitializationCause as EntityInitializationCause2, world as world3 } from "@minecraft/server";
var Peace;
var init_Peace = __esm({
  "scripts/area/Peace.ts"() {
    "use strict";
    init_ConfigManager();
    init_Tools();
    Peace = class _Peace {
      constructor() {
        this.enable = true;
        this.entitySpawnSub = void 0;
      }
      static getInstance() {
        if (!_Peace._instance) {
          _Peace._instance = new _Peace();
        }
        return _Peace._instance;
      }
      init() {
        this.registerEvents();
      }
      registerEvents() {
        if (this.entitySpawnSub) return;
        this.entitySpawnSub = world3.afterEvents.entitySpawn.subscribe((event) => {
          if (!this.enable) return;
          try {
            if (event.cause === EntityInitializationCause2.Spawned) {
              let entity = event.entity;
              if (this.inPeaceArea(entity) && entity.matches(this.getPeaceEntityQO())) {
                event.entity.remove();
              }
            }
          } catch {
          }
        });
      }
      cleanup() {
        if (this.entitySpawnSub?.unsubscribe) {
          try {
            this.entitySpawnSub.unsubscribe();
          } catch {
          }
        }
        this.entitySpawnSub = void 0;
      }
      /**
       * 实体是否在和平区域内
       */
      inPeaceArea(entity) {
        for (let area of ConfigManager.getAreas("peace")) {
          if (entity.dimension.id === area.dimension) {
            if (pointInArea_2D(
              entity.location.x,
              entity.location.z,
              area.start[0],
              area.start[1],
              area.end[0],
              area.end[1]
            )) {
              return true;
            }
          }
        }
        return false;
      }
      switchPeace() {
        return this.enable = !this.enable;
      }
      getPeaceEntityQO() {
        const filters = ConfigManager.getPeaceFilters();
        const qo = {};
        for (const f of filters) {
          if (f.family) {
            if (!qo.families) qo.families = [];
            qo.families.push(f.family);
          }
          if (f.exclude_family) {
            if (!qo.excludeFamilies) qo.excludeFamilies = [];
            qo.excludeFamilies.push(f.exclude_family);
          }
        }
        return qo;
      }
    };
  }
});

// scripts/libs/HttpDB.ts
var HttpDB_exports = {};
__export(HttpDB_exports, {
  HttpDB: () => HttpDB
});
import { system as system2 } from "@minecraft/server";
import { http, HttpRequest } from "@minecraft/server-net";
var HOST, PORT, BASE_URL, TIMEOUT, _HttpDB, HttpDB;
var init_HttpDB = __esm({
  "scripts/libs/HttpDB.ts"() {
    "use strict";
    HOST = "127.0.0.1";
    PORT = 3001;
    BASE_URL = `http://${HOST}:${PORT}`;
    TIMEOUT = 3;
    _HttpDB = class _HttpDB {
      static setAuthToken(token) {
        this.authToken = token.trim();
      }
      static isAvailable() {
        return this.available;
      }
      static _shouldLogError() {
        const now = Date.now();
        if (now - this._lastErrorLog >= 5e3) {
          this._lastErrorLog = now;
          return true;
        }
        return false;
      }
      static async checkHealth() {
        for (let i = 0; i < 5; i++) {
          try {
            const res = await http.get(`${BASE_URL}/api/health`);
            this.available = res.status === 200;
            if (this.available) {
              console.info(`[HttpDB] \u6570\u636E\u5E93\u670D\u52A1\u8FDE\u63A5\u6210\u529F (${BASE_URL}/api/health)`);
              return true;
            }
            console.error(`[HttpDB] \u6570\u636E\u5E93\u670D\u52A1\u8FD4\u56DE\u5F02\u5E38\u72B6\u6001 ${res.status}`);
          } catch (err) {
            this.available = false;
            if (i < 4) {
              console.info(`[HttpDB] \u8FDE\u63A5\u5931\u8D25\uFF0C2s \u540E\u91CD\u8BD5 (${i + 1}/5)...`);
              await system2.waitTicks(40);
            } else {
              console.error(`[HttpDB] \u8FDE\u63A5\u5931\u8D25 (${BASE_URL}): ${err}`);
            }
          }
        }
        return this.available;
      }
      static async fetchJSON(basePath, id, key) {
        const body = await _HttpDB.get(`${basePath}/${encodeURIComponent(id)}`);
        if (!body) return null;
        try {
          const parsed = JSON.parse(body);
          return parsed[key] ?? null;
        } catch (e) {
          console.warn("[HttpDB] error:", e);
          return null;
        }
      }
      // ---- 通用 HTTP 方法 ----
      static async request(method, path, bodyData) {
        try {
          const req = new HttpRequest(`${BASE_URL}${path}`);
          req.timeout = TIMEOUT;
          req.method = method;
          if (bodyData) {
            req.body = JSON.stringify(bodyData);
            req.addHeader("Content-Type", "application/json");
          }
          if (this.authToken) req.addHeader("Authorization", `Bearer ${this.authToken}`);
          const res = await http.request(req);
          this.available = true;
          return { status: res.status, body: res.body };
        } catch (err) {
          this.available = false;
          if (this._shouldLogError()) {
            console.error(`[HttpDB] ${method} ${path} \u7F51\u7EDC\u9519\u8BEF: ${err}`);
          }
          return { status: 0, body: "" };
        }
      }
      static async requestJSON(method, path, bodyData) {
        return this.request(method, path, bodyData);
      }
      static async typedRequest(method, path, bodyData) {
        const { status, body } = await this.request(method, path, bodyData);
        if (!body) return { ok: false, error: "network_error", status };
        try {
          const parsed = JSON.parse(body);
          if (status === 200 && parsed.ok !== false) return { ok: true, data: parsed, status };
          return { ok: false, error: parsed.error || "request_failed", status, data: parsed };
        } catch {
          return { ok: false, error: "invalid_response", status };
        }
      }
      static async get(path) {
        const { status, body } = await this.request("Get", path);
        if (status !== 200) {
          console.info(`[HttpDB] GET ${path} \u2192 ${status}`);
        }
        return status === 200 ? body : null;
      }
      static async post(path, bodyData) {
        const { status, body } = await this.request("Post", path, bodyData);
        if (status !== 200) {
          console.info(`[HttpDB] POST ${path} \u2192 ${status}`);
        }
        return status === 200;
      }
      static async put(path, bodyData) {
        const { status, body } = await this.request("Put", path, bodyData);
        if (status !== 200) {
          console.info(`[HttpDB] PUT ${path} \u2192 ${status}`);
        }
        return status === 200;
      }
      static async patch(path, bodyData) {
        const { status, body } = await this.request("Patch", path, bodyData);
        if (status !== 200) {
          console.info(`[HttpDB] PATCH ${path} \u2192 ${status}`);
        }
        return status === 200;
      }
      static async del(path) {
        const { status, body } = await this.request("Delete", path);
        if (status !== 200) {
          console.info(`[HttpDB] DELETE ${path} \u2192 ${status}`);
        }
        return status === 200;
      }
    };
    _HttpDB.available = true;
    _HttpDB._lastErrorLog = 0;
    _HttpDB.authToken = "";
    HttpDB = _HttpDB;
  }
});

// scripts/api/ChatApi.ts
async function getChannels(filter) {
  const qs = toQueryString({
    search: filter?.search,
    type: filter?.type,
    ownerId: filter?.ownerId,
    minCreatedAt: filter?.minCreatedAt,
    maxCreatedAt: filter?.maxCreatedAt
  });
  const path = `${PATH_CHANNELS}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    const raw = JSON.parse(body).channels;
    return raw.map(toChannel);
  } catch {
    return null;
  }
}
function toChannel(r) {
  return {
    id: r.id,
    name: r.name,
    type: r.type,
    prefix: r.prefix,
    ownerid: r.owner_id || void 0,
    createdAt: r.created_at,
    config: {
      allowChat: !!r.config_allow_chat,
      slowMode: r.config_slow_mode || 0,
      isBroadcast: !!r.config_is_broadcast
    }
  };
}
function toMessage(r) {
  return {
    id: r.id,
    fromid: r.from_id,
    fromName: r.from_name,
    channelId: r.channel_id,
    type: r.type || "text",
    content: r.content,
    attachment: r.attachment,
    showTimestamp: !!r.show_timestamp,
    timestamp: r.created_at
  };
}
function toRedPacket(r) {
  return {
    id: r.id,
    senderid: r.sender_id,
    senderName: r.sender_name,
    totalAmount: r.total_amount,
    remainingAmount: r.remaining_amount,
    totalCount: r.total_count,
    remainingCount: r.remaining_count,
    receivers: JSON.parse(r.receivers || "[]"),
    targetType: r.target_type,
    targetId: r.target_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at
  };
}
async function getChannel(channelId) {
  const raw = await HttpDB.fetchJSON(PATH_CHANNELS, channelId, "channel");
  if (!raw) return null;
  return toChannel(raw);
}
async function createChannel(channel) {
  return saveChannels([channel]);
}
async function saveChannels(channels) {
  const flat = channels.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    prefix: c.prefix,
    ownerId: c.ownerid,
    createdAt: c.createdAt,
    configAllowChat: c.config?.allowChat,
    configSlowMode: c.config?.slowMode,
    configIsBroadcast: c.config?.isBroadcast
  }));
  return HttpDB.post(PATH_CHANNELS, { channels: flat });
}
async function patchChannel(channelId, data) {
  return HttpDB.patch(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`, data);
}
async function deleteChannel(channelId) {
  return HttpDB.del(`${PATH_CHANNELS}/${encodeURIComponent(channelId)}`);
}
async function getMessages(filter) {
  const qs = toQueryString({
    search: filter?.search,
    type: filter?.type,
    channelId: filter?.channelId,
    from: filter?.from,
    minSentAt: filter?.minSentAt,
    maxSentAt: filter?.maxSentAt
  });
  const path = `${PATH_MESSAGES}${qs}`;
  const body = await HttpDB.get(path);
  if (!body) return null;
  try {
    const raw = JSON.parse(body).messages;
    return raw.map(toMessage);
  } catch {
    return null;
  }
}
async function saveMessages(messages) {
  return HttpDB.post(PATH_MESSAGES, { messages });
}
async function getRedPackets() {
  const body = await HttpDB.get(PATH_REDPACKET);
  if (!body) return [];
  try {
    const parsed = JSON.parse(body);
    const raw = parsed.redpackets || parsed.redpacket || [];
    return raw.map(toRedPacket);
  } catch {
    return [];
  }
}
async function getRedPacket(redpacketId) {
  const raw = await HttpDB.fetchJSON(PATH_REDPACKET, redpacketId, "redpacket");
  if (!raw) return null;
  return toRedPacket(raw);
}
async function saveRedPacket(redpacket) {
  return HttpDB.post(PATH_REDPACKET, { redpacket, actorId: redpacket.senderid });
}
async function claimRedPacket(redpacketId, actorId, actorName) {
  const result = await HttpDB.requestJSON("Post", `${PATH_REDPACKET}/${encodeURIComponent(redpacketId)}/claim`, {
    actorId,
    actorName
  });
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.success, amount: parsed.amount, error: parsed.error };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
var PATH_CHANNELS, PATH_MESSAGES, PATH_REDPACKET;
var init_ChatApi = __esm({
  "scripts/api/ChatApi.ts"() {
    "use strict";
    init_HttpDB();
    init_Tools();
    PATH_CHANNELS = "/api/sfmc/channels";
    PATH_MESSAGES = "/api/sfmc/messages";
    PATH_REDPACKET = "/api/sfmc/redpacket";
  }
});

// scripts/api/CoopAPI.ts
var CoopAPI_exports = {};
__export(CoopAPI_exports, {
  acceptCoopInvite: () => acceptCoopInvite,
  addBankLog: () => addBankLog,
  addMember: () => addMember,
  coopShopBuy: () => coopShopBuy,
  coopShopSell: () => coopShopSell,
  createCoop: () => createCoop,
  deleteCoop: () => deleteCoop,
  deleteShopItem: () => deleteShopItem,
  findPlayerCoop: () => findPlayerCoop,
  getAllCoops: () => getAllCoops,
  getAllShopGroups: () => getAllShopGroups,
  getBankLog: () => getBankLog,
  getCoop: () => getCoop,
  getMembers: () => getMembers,
  getShopItems: () => getShopItems,
  inviteCoopMember: () => inviteCoopMember,
  joinCoop: () => joinCoop,
  leaveCoop: () => leaveCoop,
  removeMember: () => removeMember,
  saveShopGroup: () => saveShopGroup,
  saveShopItem: () => saveShopItem,
  treasury: () => treasury,
  updateCoop: () => updateCoop,
  updateCoopFee: () => updateCoopFee,
  updateMemberRole: () => updateMemberRole
});
async function getAllCoops() {
  debug.i("API", "getAllCoops");
  const body = await HttpDB.get(PATH);
  if (!body) return [];
  try {
    const coops = JSON.parse(body).coops || [];
    debug.i("API", `getAllCoops: ${coops.length} coops`);
    return coops;
  } catch {
    return [];
  }
}
async function getCoop(cid) {
  debug.i("API", `getCoop: cid=${cid}`);
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}`);
  if (!body) return null;
  try {
    return JSON.parse(body).coop || null;
  } catch {
    return null;
  }
}
async function updateCoop(cid, data) {
  debug.i("API", `updateCoop: cid=${cid}`);
  return HttpDB.patch(`${PATH}/${encodeURIComponent(cid)}`, data);
}
async function deleteCoop(cid, actorId) {
  debug.i("API", `deleteCoop: cid=${cid} actorId=${actorId}`);
  const result = await HttpDB.requestJSON("Delete", `${PATH}/${encodeURIComponent(cid)}`, { actorId });
  return result.status === 200;
}
async function updateCoopFee(cid, actorId, feeBps) {
  debug.i("API", `updateCoopFee: cid=${cid} feeBps=${feeBps}`);
  const result = await HttpDB.requestJSON("Patch", `${PATH}/${encodeURIComponent(cid)}/settings`, { actorId, feeBps });
  return result.status === 200;
}
async function inviteCoopMember(cid, actorId, playerId2, playerName, role = "member") {
  debug.i("API", `inviteCoopMember: cid=${cid} player=${playerName} role=${role}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/invites`, {
    actorId,
    playerId: playerId2,
    playerName,
    role
  });
  return result.status === 200;
}
async function acceptCoopInvite(cid, inviteId, playerId2, playerName) {
  debug.i("API", `acceptCoopInvite: cid=${cid} inviteId=${inviteId} player=${playerName}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/invites/accept`, {
    actorId: playerId2,
    inviteId,
    playerName
  });
  return result.status === 200;
}
async function getMembers(cid) {
  debug.i("API", `getMembers: cid=${cid}`);
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/members`);
  if (!body) return [];
  try {
    return JSON.parse(body).members || [];
  } catch {
    return [];
  }
}
async function addMember(cid, actorId, playerId2, playerName) {
  debug.i("API", `addMember: cid=${cid} player=${playerName}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/members`, {
    actorId,
    playerId: playerId2,
    playerName
  });
  return result.status === 200;
}
async function joinCoop(cid, playerId2, playerName) {
  debug.i("API", `joinCoop: cid=${cid} player=${playerName}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/members/join`, {
    actorId: playerId2,
    playerId: playerId2,
    playerName
  });
  return result.status === 200;
}
async function leaveCoop(cid, playerId2) {
  debug.i("API", `leaveCoop: cid=${cid} playerId=${playerId2}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/members/leave`, {
    actorId: playerId2
  });
  return result.status === 200;
}
async function updateMemberRole(cid, actorId, playerId2, role) {
  debug.i("API", `updateMemberRole: cid=${cid} playerId=${playerId2} role=${role}`);
  const result = await HttpDB.requestJSON(
    "Patch",
    `${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(playerId2)}`,
    { actorId, role }
  );
  return result.status === 200;
}
async function removeMember(cid, actorId, playerId2) {
  debug.i("API", `removeMember: cid=${cid} playerId=${playerId2}`);
  const result = await HttpDB.requestJSON(
    "Delete",
    `${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(playerId2)}`,
    { actorId }
  );
  return result.status === 200;
}
async function getShopItems(cid, type) {
  debug.i("API", `getShopItems: cid=${cid} type=${type}`);
  const qs = type !== void 0 ? `?type=${type}` : "";
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/shop_items${qs}`);
  if (!body) return [];
  try {
    return JSON.parse(body).items || [];
  } catch {
    return [];
  }
}
async function saveShopItem(item) {
  debug.i("API", `saveShopItem: cid=${item.cid} id=${item.id} name=${item.name}`);
  return HttpDB.post(`${PATH}/${encodeURIComponent(item.cid)}/shop_items`, item);
}
async function deleteShopItem(cid, id) {
  debug.i("API", `deleteShopItem: cid=${cid} id=${id}`);
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}/shop_items/${encodeURIComponent(id)}`);
}
async function getBankLog(cid) {
  debug.i("API", `getBankLog: cid=${cid}`);
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/bank_log`);
  if (!body) return [];
  try {
    return JSON.parse(body).log || [];
  } catch {
    return [];
  }
}
async function addBankLog(cid, player_name, type, amount, note) {
  debug.i("API", `addBankLog: cid=${cid} player=${player_name} type=${type} amount=${amount}`);
  return HttpDB.post(`${PATH}/${encodeURIComponent(cid)}/bank_log`, { player_name, type, amount, note });
}
async function getAllShopGroups() {
  debug.i("API", "getAllShopGroups");
  const body = await HttpDB.get("/api/sfmc/coop_shop_groups");
  if (!body) return [];
  try {
    return JSON.parse(body).groups || [];
  } catch {
    return [];
  }
}
async function saveShopGroup(group) {
  debug.i("API", `saveShopGroup: groupid=${group.groupid} displayname=${group.displayname}`);
  return HttpDB.post("/api/sfmc/coop_shop_groups", { group });
}
async function findPlayerCoop(playerId2) {
  debug.i("API", `findPlayerCoop: playerId=${playerId2}`);
  const body = await HttpDB.get(`${PATH}/by-player/${encodeURIComponent(playerId2)}`);
  if (!body) return null;
  try {
    return JSON.parse(body).coop?.cid || null;
  } catch {
    return null;
  }
}
async function createCoop(name, cid, actorId, actorName) {
  debug.i("API", `createCoop: name=${name} cid=${cid} actor=${actorName}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/create`, { name, cid, actorId, actorName });
  try {
    const parsed = JSON.parse(result.body);
    return {
      ok: result.status === 200 && parsed.ok !== false,
      coop: parsed.coop,
      balance: parsed.balance,
      error: parsed.error
    };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
async function treasury(cid, actorId, actorName, mode, amount, note = "") {
  debug.i("API", `treasury: cid=${cid} actor=${actorName} mode=${mode} amount=${amount}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/treasury/${mode}`, {
    actorId,
    actorName,
    amount,
    note
  });
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.ok !== false, ...parsed };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
async function coopShopBuy(cid, actorId, actorName, listingId, quantity, idempotencyKey) {
  debug.i("API", `coopShopBuy: cid=${cid} actor=${actorName} listingId=${listingId} qty=${quantity}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/shop/buy`, {
    actorId,
    actorName,
    listingId,
    quantity,
    idempotencyKey
  });
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.ok !== false, ...parsed };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
async function coopShopSell(cid, actorId, actorName, listingId, quantity, idempotencyKey) {
  debug.i("API", `coopShopSell: cid=${cid} actor=${actorName} listingId=${listingId} qty=${quantity}`);
  const result = await HttpDB.requestJSON("Post", `${PATH}/${encodeURIComponent(cid)}/shop/sell`, {
    actorId,
    actorName,
    listingId,
    quantity,
    idempotencyKey
  });
  try {
    const parsed = JSON.parse(result.body);
    return { ok: result.status === 200 && parsed.ok !== false, ...parsed };
  } catch {
    return { ok: false, error: "invalid_response" };
  }
}
var PATH;
var init_CoopAPI = __esm({
  "scripts/api/CoopAPI.ts"() {
    "use strict";
    init_DebugLog();
    init_HttpDB();
    PATH = "/api/sfmc/coops";
  }
});

// scripts/api/EconomyApi.ts
var EconomyApi_exports = {};
__export(EconomyApi_exports, {
  applyEconomyTransaction: () => applyEconomyTransaction,
  getDailyTasks: () => getDailyTasks,
  getEconomyAccount: () => getEconomyAccount,
  getPriceIndex: () => getPriceIndex,
  recalcPriceIndex: () => recalcPriceIndex,
  submitDailyTask: () => submitDailyTask,
  transferEconomy: () => transferEconomy
});
function parseAccount(body) {
  if (!body) return null;
  try {
    return JSON.parse(body).account || null;
  } catch {
    return null;
  }
}
async function getEconomyAccount(playerId2, playerName) {
  debug.i("API", `getEconomyAccount: playerId=${playerId2}`);
  const query = `?playerId=${encodeURIComponent(playerId2)}${playerName ? `&playerName=${encodeURIComponent(playerName)}` : ""}`;
  return parseAccount(await HttpDB.get(`/api/sfmc/economy/account${query}`));
}
async function applyEconomyTransaction(data) {
  debug.i("API", `applyEconomyTransaction: playerId=${data.playerId} amount=${data.amount}`);
  const result = await HttpDB.typedRequest("Post", "/api/sfmc/economy/account", data);
  if (!result.ok) {
    debug.e("API", `applyEconomyTransaction failed: ${result.error}`);
    return { ok: false, error: result.error || "request_failed" };
  }
  const account = result.data?.source ?? result.data?.target;
  return {
    ok: true,
    balance: account?.balance,
    balanceBefore: account?.balanceBefore,
    balanceAfter: account?.balanceAfter,
    version: account?.version,
    transactionId: result.data?.transactionId
  };
}
async function getPriceIndex() {
  debug.i("API", "getPriceIndex");
  const result = await HttpDB.typedRequest("Get", "/api/sfmc/economy/price-index");
  return result.ok ? result.data : null;
}
async function getDailyTasks() {
  debug.i("API", "getDailyTasks");
  const result = await HttpDB.typedRequest("Get", "/api/sfmc/economy/daily-tasks");
  return result.ok ? result.data : null;
}
async function submitDailyTask(taskId, actorId, actorName, quantity) {
  debug.i("API", `submitDailyTask: taskId=${taskId} actor=${actorName} qty=${quantity}`);
  const result = await HttpDB.typedRequest(
    "Post",
    `/api/sfmc/economy/daily-tasks/${encodeURIComponent(taskId)}/submit`,
    { actorId, actorName, quantity }
  );
  if (!result.ok) return { ok: false, error: result.error || "submit_failed" };
  const d = result.data;
  return { ok: true, reward: d.reward, balance: d.balance, balanceVersion: d.balanceVersion, error: d.error };
}
async function recalcPriceIndex(actorId) {
  debug.i("API", `recalcPriceIndex: actorId=${actorId}`);
  const result = await HttpDB.typedRequest("Post", "/api/sfmc/economy/price-index/recalc", { actorId });
  return result.ok;
}
async function transferEconomy(actorId, targetPlayerId, amount, targetPlayerName) {
  debug.i("API", `transferEconomy: from=${actorId} to=${targetPlayerId} amount=${amount}`);
  const result = await HttpDB.typedRequest("Post", "/api/sfmc/economy/transfer", {
    actorId,
    targetPlayerId,
    targetPlayerName,
    amount
  });
  return { ok: result.ok, error: result.error };
}
var init_EconomyApi = __esm({
  "scripts/api/EconomyApi.ts"() {
    "use strict";
    init_DebugLog();
    init_HttpDB();
  }
});

// scripts/api/LandApi.ts
var LandApi_exports = {};
__export(LandApi_exports, {
  acceptInvite: () => acceptInvite,
  createLand: () => createLand,
  declineInvite: () => declineInvite,
  deleteLand: () => deleteLand,
  getAllLands: () => getAllLands,
  getInvites: () => getInvites,
  getLand: () => getLand,
  getLandAt: () => getLandAt,
  getLandAudit: () => getLandAudit,
  getLandsAtBatch: () => getLandsAtBatch,
  getLandsByOwner: () => getLandsByOwner,
  inviteMember: () => inviteMember,
  removeLandMember: () => removeLandMember,
  revokeInvite: () => revokeInvite,
  transferLand: () => transferLand,
  updateLand: () => updateLand,
  updateLandMember: () => updateLandMember,
  validateLand: () => validateLand
});
function parseLand(body) {
  if (!body) return null;
  try {
    return JSON.parse(body).land || null;
  } catch {
    return null;
  }
}
async function getAllLands() {
  debug.i("API", "getAllLands");
  const body = await HttpDB.get(PATH2);
  if (!body) return null;
  try {
    const lands = JSON.parse(body).lands;
    const count = Array.isArray(lands) ? lands.length : 0;
    debug.i("API", `getAllLands: ${count} lands`);
    return Array.isArray(lands) ? lands : null;
  } catch {
    return null;
  }
}
async function getLand(id) {
  debug.i("API", `getLand: id=${id}`);
  return parseLand(await HttpDB.get(`${PATH2}/${encodeURIComponent(id)}`));
}
async function getLandsByOwner(ownerId) {
  debug.i("API", `getLandsByOwner: ownerId=${ownerId}`);
  const body = await HttpDB.get(`${PATH2}/by-owner/${encodeURIComponent(ownerId)}`);
  if (!body) return [];
  try {
    return JSON.parse(body).lands || [];
  } catch {
    return [];
  }
}
async function getLandAt(dimid, pos) {
  debug.i("API", `getLandAt: dimid=${dimid} pos=(${pos.x},${pos.y},${pos.z})`);
  return parseLand(await HttpDB.get(`${PATH2}/at/${dimid}/${pos.x}/${pos.y}/${pos.z}`));
}
async function getLandsAtBatch(points) {
  debug.i("API", `getLandsAtBatch: ${points.length} points`);
  const result = await HttpDB.requestJSON("Post", `${PATH2}/at-batch`, { points });
  if (result.status !== 200) return points.map(() => null);
  try {
    return JSON.parse(result.body).lands || points.map(() => null);
  } catch {
    return points.map(() => null);
  }
}
async function validateLand(request) {
  debug.i("API", `validateLand: owner=${request.ownerId} dimid=${request.dimid}`);
  const result = await HttpDB.requestJSON("Post", `${PATH2}/validate`, request);
  if (result.status === 0) return { ok: false, error: "\u6570\u636E\u5E93\u670D\u52A1\u4E0D\u53EF\u7528\u3002" };
  try {
    return JSON.parse(result.body);
  } catch {
    return { ok: false, error: "\u6570\u636E\u5E93\u54CD\u5E94\u65E0\u6548\u3002" };
  }
}
async function createLand(request) {
  debug.i("API", `createLand: owner=${request.ownerId} dimid=${request.dimid}`);
  const result = await HttpDB.requestJSON("Post", PATH2, request);
  if (result.status !== 200) {
    try {
      const parsed = JSON.parse(result.body);
      return { land: null, error: parsed.error, message: parsed.message, price: parsed.price, balance: parsed.balance };
    } catch {
      return { land: null, error: "\u571F\u5730\u521B\u5EFA\u5931\u8D25\u3002" };
    }
  }
  try {
    const parsed = JSON.parse(result.body);
    return {
      land: parsed.land || null,
      price: parsed.price,
      balance: parsed.balance,
      balanceVersion: parsed.balanceVersion,
      transactionId: parsed.transactionId
    };
  } catch {
    return { land: null, error: "\u6570\u636E\u5E93\u54CD\u5E94\u65E0\u6548\u3002" };
  }
}
async function updateLand(id, data) {
  debug.i("API", `updateLand: id=${id} actorId=${data.actorId} version=${data.expectedVersion}`);
  const result = await HttpDB.requestJSON(
    "Patch",
    `${PATH2}/${encodeURIComponent(id)}`,
    data
  );
  return result.status === 200 ? parseLand(result.body) : null;
}
async function deleteLand(id, actorId, expectedVersion, requestId) {
  debug.i("API", `deleteLand: id=${id} actorId=${actorId} version=${expectedVersion}`);
  const result = await HttpDB.requestJSON("Delete", `${PATH2}/${encodeURIComponent(id)}`, {
    actorId,
    expectedVersion,
    requestId
  });
  let parsed = {};
  try {
    parsed = JSON.parse(result.body || "{}");
  } catch {
  }
  if (result.status !== 200)
    return {
      ok: false,
      error: parsed.error || (result.status === 0 ? "database_unavailable" : "transaction_failed"),
      message: parsed.message,
      status: result.status
    };
  return {
    ok: true,
    refund: parsed.refund || 0,
    balance: parsed.balance,
    balanceVersion: parsed.balanceVersion,
    transactionId: parsed.transactionId
  };
}
async function inviteMember(id, actorId, playerId2, role) {
  debug.i("API", `inviteMember: landId=${id} playerId=${playerId2} role=${role}`);
  const result = await HttpDB.requestJSON("Post", `${PATH2}/${encodeURIComponent(id)}/members`, {
    actorId,
    playerId: playerId2,
    role
  });
  if (result.status !== 200) {
    let parsed2 = {};
    try {
      parsed2 = JSON.parse(result.body || "{}");
    } catch {
    }
    return {
      ok: false,
      error: parsed2.error || (result.status === 0 ? "database_unavailable" : "forbidden"),
      message: parsed2.message
    };
  }
  let parsed = {};
  try {
    parsed = JSON.parse(result.body || "{}");
  } catch {
  }
  return { ok: true, inviteId: parsed.inviteId, expiresAt: parsed.expiresAt };
}
async function removeLandMember(id, actorId, playerId2) {
  debug.i("API", `removeLandMember: landId=${id} playerId=${playerId2}`);
  const result = await HttpDB.requestJSON("Delete", `${PATH2}/${encodeURIComponent(id)}/members`, { actorId, playerId: playerId2 });
  if (result.status !== 200) {
    let parsed = {};
    try {
      parsed = JSON.parse(result.body || "{}");
    } catch {
    }
    return { ok: false, error: parsed.error || "forbidden", message: parsed.message };
  }
  return { ok: true, land: parseLand(result.body) };
}
async function updateLandMember(id, actorId, playerId2, role) {
  debug.i("API", `updateLandMember: landId=${id} playerId=${playerId2} role=${role}`);
  const result = await HttpDB.requestJSON(
    "Patch",
    `${PATH2}/${encodeURIComponent(id)}/members/${encodeURIComponent(playerId2)}`,
    { actorId, role }
  );
  if (result.status !== 200) {
    let parsed = {};
    try {
      parsed = JSON.parse(result.body || "{}");
    } catch {
    }
    return { ok: false, error: parsed.error || "invalid_role", message: parsed.message };
  }
  return { ok: true, land: parseLand(result.body) };
}
async function getInvites(playerId2) {
  debug.i("API", `getInvites: playerId=${playerId2}`);
  const body = await HttpDB.get(`${PATH2}/invites/${encodeURIComponent(playerId2)}`);
  if (!body) return [];
  try {
    return JSON.parse(body).invites || [];
  } catch {
    return [];
  }
}
async function acceptInvite(playerId2, inviteId) {
  debug.i("API", `acceptInvite: playerId=${playerId2} inviteId=${inviteId}`);
  const result = await HttpDB.requestJSON("Post", `${PATH2}/invites/${encodeURIComponent(playerId2)}`, { inviteId });
  return result.status === 200 ? parseLand(result.body) : null;
}
async function declineInvite(playerId2, inviteId) {
  debug.i("API", `declineInvite: playerId=${playerId2} inviteId=${inviteId}`);
  const result = await HttpDB.requestJSON("Post", `${PATH2}/invites/${encodeURIComponent(playerId2)}/decline`, {
    inviteId
  });
  return result.status === 200;
}
async function revokeInvite(id, actorId, inviteId) {
  debug.i("API", `revokeInvite: landId=${id} inviteId=${inviteId}`);
  const result = await HttpDB.requestJSON(
    "Delete",
    `${PATH2}/${encodeURIComponent(id)}/invites/${encodeURIComponent(inviteId)}`,
    { actorId }
  );
  return result.status === 200;
}
async function transferLand(id, actorId, targetId, targetName, expectedVersion, requestId) {
  debug.i("API", `transferLand: id=${id} from=${actorId} to=${targetName}`);
  const result = await HttpDB.requestJSON("Post", `${PATH2}/${encodeURIComponent(id)}/transfer`, {
    actorId,
    targetId,
    targetName,
    expectedVersion,
    requestId
  });
  let parsed = {};
  try {
    parsed = JSON.parse(result.body || "{}");
  } catch {
  }
  if (result.status !== 200)
    return {
      ok: false,
      error: parsed.error || (result.status === 0 ? "database_unavailable" : "transaction_failed"),
      message: parsed.message,
      status: result.status
    };
  return { ok: true, land: parsed.land || null, data: parsed.land || void 0, transactionId: parsed.transactionId };
}
async function getLandAudit(id) {
  debug.i("API", `getLandAudit: id=${id}`);
  const body = await HttpDB.get(`${PATH2}/${encodeURIComponent(id)}/audit`);
  if (!body) return [];
  try {
    return JSON.parse(body).logs || [];
  } catch {
    return [];
  }
}
var PATH2;
var init_LandApi = __esm({
  "scripts/api/LandApi.ts"() {
    "use strict";
    init_DebugLog();
    init_HttpDB();
    PATH2 = "/api/sfmc/lands";
  }
});

// scripts/api/PlayersDataApi.ts
async function savePlayers(players) {
  return HttpDB.post(PATH_PLAYERS, { players });
}
var PATH_PLAYERS;
var init_PlayersDataApi = __esm({
  "scripts/api/PlayersDataApi.ts"() {
    "use strict";
    init_HttpDB();
    init_Tools();
    PATH_PLAYERS = "/api/sfmc/players";
  }
});

// scripts/api/ScoreboardsSyncApi.ts
async function backupScoreboards(entries) {
  return HttpDB.post("/api/sfmc/scoreboards", { entries });
}
async function loadScoreboards(filter) {
  const qs = toQueryString({
    objective: filter?.objective,
    name: filter?.name,
    id: filter?.id
  });
  const body = await HttpDB.get(`/api/sfmc/scoreboards${qs}`);
  if (!body) return null;
  try {
    return JSON.parse(body).entries;
  } catch {
    return null;
  }
}
var init_ScoreboardsSyncApi = __esm({
  "scripts/api/ScoreboardsSyncApi.ts"() {
    "use strict";
    init_HttpDB();
    init_Tools();
  }
});

// scripts/api/WorldDataApi.ts
async function saveWorldData(data) {
  return HttpDB.post("/api/sfmc/world", { data });
}
var init_WorldDataApi = __esm({
  "scripts/api/WorldDataApi.ts"() {
    "use strict";
    init_HttpDB();
  }
});

// scripts/api/index.ts
var init_api = __esm({
  "scripts/api/index.ts"() {
    "use strict";
    init_ChatApi();
    init_CoopAPI();
    init_EconomyApi();
    init_LandApi();
    init_PlayersDataApi();
    init_ScoreboardsSyncApi();
    init_WorldDataApi();
  }
});

// scripts/libs/Money.ts
var Money_exports = {};
__export(Money_exports, {
  Money: () => Money
});
var Money;
var init_Money = __esm({
  "scripts/libs/Money.ts"() {
    "use strict";
    init_EconomyApi();
    init_DebugLog();
    Money = class {
      static get(player) {
        const b = this.getCached(player) ?? 0;
        debug.d("MNY", `get ${player.name}=${b}`);
        return b;
      }
      static getCached(player) {
        return this.cache.get(player.id)?.balance ?? null;
      }
      static getVersion(player) {
        return this.cache.get(player.id)?.version ?? null;
      }
      static setCached(player, balance, version = 0) {
        const previous = this.cache.get(player.id);
        if (previous && version > 0 && previous.version > version) {
          debug.d("MNY", `setCached SKIP ${player.name}: stale ver=${version} < cached=${previous.version}`);
          return;
        }
        this.cache.set(player.id, { balance, version, loadedAt: Date.now(), loading: false });
        debug.d("MNY", `setCached ${player.name}: bal=${balance} ver=${version}`);
      }
      static async load(player) {
        const previous = this.cache.get(player.id);
        if (previous?.loading) return previous.balance;
        if (previous) previous.loading = true;
        debug.i("MNY", `load ${player.name}...`);
        const account = await getEconomyAccount(player.id, player.name);
        const balance = account?.balance ?? previous?.balance ?? 0;
        if (account) {
          this.setCached(player, balance, account.version);
          debug.i("MNY", `load ${player.name}: server bal=${balance} ver=${account.version}`);
        } else if (previous) previous.loading = false;
        return balance;
      }
      /**
       * 设置玩家金钱数量
       */
      /** @deprecated Use add() or a domain transaction. This no longer performs read-modify-write. */
      static async set(player, money) {
        if (!Number.isSafeInteger(money) || money < 0) {
          debug.w("MNY", `set invalid: ${player.name} ${money}`);
          return false;
        }
        this.setCached(player, money, this.getVersion(player) ?? 0);
        debug.w("MNY", `set (deprecated) ${player.name}=${money}`);
        return true;
      }
      static async add(player, money) {
        if (!Number.isSafeInteger(money) || money === 0) return money === 0;
        debug.i("MNY", `add ${player.name} ${money > 0 ? "+" : ""}${money}`);
        const result = await applyEconomyTransaction({
          actorId: player.id,
          sourcePlayerId: money < 0 ? player.id : void 0,
          targetPlayerId: money > 0 ? player.id : void 0,
          amount: Math.abs(money),
          type: money < 0 ? "debit" : "credit"
        });
        if (result.ok) {
          debug.i("MNY", `add OK ${player.name}: bal=${result.balance} ver=${result.version} tx=${result.transactionId}`);
          this.setCached(player, result.balance ?? this.get(player) + money, result.version);
        } else {
          debug.e("MNY", `add FAIL ${player.name} ${money}: ${result.error || "unknown"}`);
        }
        return result.ok;
      }
      /**
       * 初始化计分板
       */
      static initScoreboard() {
      }
    };
    /** 货币单位名称 */
    Money.UNIT = "\u8282\u64CD";
    /**
     * 获取玩家金钱数量
     */
    Money.cache = /* @__PURE__ */ new Map();
  }
});

// scripts/chat/DogeChat.ts
import { system as system3, world as world4 } from "@minecraft/server";
var _DogeChat, DogeChat;
var init_DogeChat = __esm({
  "scripts/chat/DogeChat.ts"() {
    "use strict";
    init_api();
    init_DebugLog();
    init_HttpDB();
    init_Money();
    init_Permission();
    init_Tools();
    _DogeChat = class _DogeChat {
      // ---------- 保留期 ----------
      static getRetention(channel) {
        if (channel.config.isBroadcast) return Infinity;
        switch (channel.type) {
          case "private":
            return 30 * 24 * 60 * 60 * 1e3;
          case "system":
            return 24 * 60 * 60 * 1e3;
          case "public":
          case "custom":
          default:
            return 7 * 24 * 60 * 60 * 1e3;
        }
      }
      // ============================================
      //  频道初始化
      // ============================================
      static async ensureDefaultChannels() {
        debug.i("CHAT", "ensureDefaultChannels");
        for (let i = 0; i < 5; i++) {
          const existing = await getChannels();
          if (existing && existing.length > 0) {
            debug.i("CHAT", `ensureDefaultChannels: ${existing.length} channels exist`);
            return;
          }
          if (i < 4) {
            await system3.waitTicks(40);
            continue;
          }
          const ok = await saveChannels(_DogeChat.DEFAULT_CHANNELS).catch((err) => {
            debug.e("CHAT", `ensureDefaultChannels: save failed: ${err}`);
            return false;
          });
          if (ok) {
            debug.i("CHAT", "ensureDefaultChannels: created default channels");
            return;
          }
          await system3.waitTicks(40);
        }
      }
      static async getPublicChannel() {
        const rows = await getChannels({ type: "public" });
        if (rows && rows.length > 0) return rows[0];
        await this.ensureDefaultChannels();
        const retry = await getChannels({ type: "public" });
        return retry && retry.length > 0 ? retry[0] : null;
      }
      // ============================================
      //  发送频道（!ch 用）
      // ============================================
      static async getActiveChannel(player) {
        debug.i("CHAT", `getActiveChannel: player=${player.name}`);
        const channelId = _DogeChat.activeChannelMap.get(player.id);
        if (channelId) {
          const ch = await getChannel(channelId);
          if (ch) return ch;
        }
        const pub = await this.getPublicChannel();
        if (pub) {
          _DogeChat.activeChannelMap.set(player.id, pub.id);
          this._ensureSubscribed(player.id, pub.id);
          HttpDB.patch(`/api/sfmc/players/${player.id}`, { player: { activeChannel: pub.id } }).catch(
            (e) => console.warn("[DogeChat] error:", e)
          );
        }
        return pub;
      }
      static async setActiveChannel(player, channelId) {
        debug.i("CHAT", `setActiveChannel: player=${player.name} channelId=${channelId}`);
        _DogeChat.activeChannelMap.set(player.id, channelId);
        this._ensureSubscribed(player.id, channelId);
        await HttpDB.patch(`/api/sfmc/players/${player.id}`, { player: { activeChannel: channelId } }).catch(
          (e) => console.warn("[DogeChat] error:", e)
        );
      }
      // ============================================
      //  频道订阅系统
      // ============================================
      static isSubscribed(playerId2, channelId) {
        return this.subscribedChannelsMap.get(playerId2)?.has(channelId) ?? false;
      }
      static getSubscribedChannelIds(playerId2) {
        return Array.from(this.subscribedChannelsMap.get(playerId2) ?? []);
      }
      static async getSubscribedChannels(player) {
        const ids = this.getSubscribedChannelIds(player.id);
        const all = await getChannels();
        if (!all) return [];
        return all.filter((c) => ids.includes(c.id));
      }
      static async toggleSubscription(player, channelId) {
        const subs = this.subscribedChannelsMap.get(player.id);
        if (!subs) {
          this.subscribedChannelsMap.set(player.id, /* @__PURE__ */ new Set([channelId]));
          this._saveSubscriptions(player.id);
          return true;
        }
        if (subs.has(channelId)) {
          subs.delete(channelId);
          if (subs.size === 0) {
            const pub = await this.getPublicChannel();
            if (pub) subs.add(pub.id);
          }
          this._saveSubscriptions(player.id);
          return false;
        }
        subs.add(channelId);
        this._saveSubscriptions(player.id);
        return true;
      }
      static async setSubscriptions(player, channelIds) {
        this.subscribedChannelsMap.set(player.id, new Set(channelIds));
        this._saveSubscriptions(player.id);
      }
      static _ensureSubscribed(playerId2, channelId) {
        if (!this.subscribedChannelsMap.has(playerId2)) {
          this.subscribedChannelsMap.set(playerId2, /* @__PURE__ */ new Set());
        }
        this.subscribedChannelsMap.get(playerId2).add(channelId);
      }
      static _saveSubscriptions(playerId2) {
        const ids = Array.from(this.subscribedChannelsMap.get(playerId2) ?? []);
        HttpDB.patch(`/api/sfmc/players/${playerId2}`, { player: { subscribedChannels: JSON.stringify(ids) } }).catch(
          (e) => console.warn("[DogeChat] error:", e)
        );
      }
      static async loadSubscriptions(player) {
        debug.i("CHAT", `loadSubscriptions: player=${player.name}`);
        const raw = await HttpDB.fetchJSON("/api/sfmc/players", player.id, "player");
        if (raw?.subscribed_channels) {
          try {
            const ids = JSON.parse(raw.subscribed_channels);
            this.subscribedChannelsMap.set(player.id, new Set(ids));
          } catch {
          }
        }
        if (!this.subscribedChannelsMap.has(player.id) || this.subscribedChannelsMap.get(player.id).size === 0) {
          const pub = await this.getPublicChannel();
          if (pub) this.subscribedChannelsMap.set(player.id, /* @__PURE__ */ new Set([pub.id]));
        }
        if (!this.activeChannelMap.has(player.id)) {
          const pub = await this.getPublicChannel();
          if (pub) this.activeChannelMap.set(player.id, pub.id);
        }
      }
      /** 频道在线人数（按订阅统计） */
      static getOnlineCount(channelId) {
        let count = 0;
        for (const p of world4.getPlayers()) {
          if (this.subscribedChannelsMap.get(p.id)?.has(channelId)) count++;
        }
        return count;
      }
      /** 创建新频道 */
      static async createChannel(name, prefix, type, config, owner) {
        debug.i("CHAT", `createChannel: name=${name} prefix=${prefix} type=${type}`);
        const channel = {
          id: generateId("CH"),
          name,
          prefix,
          type,
          ownerid: owner?.id,
          createdAt: Date.now(),
          config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG, ...config }
        };
        const ok = await createChannel(channel);
        return ok ? channel.id : "";
      }
      static async deleteChannel(channelId) {
        debug.i("CHAT", `deleteChannel: channelId=${channelId}`);
        const ch = await getChannel(channelId);
        if (!ch) {
          debug.w("CHAT", "deleteChannel: not found");
          return false;
        }
        if (ch.type === "public") {
          debug.w("CHAT", "deleteChannel: cannot delete public channel");
          return false;
        }
        return deleteChannel(channelId);
      }
      static async updateChannelConfig(channelId, config) {
        const data = {};
        if (config.allowChat !== void 0) data.configAllowChat = config.allowChat ? 1 : 0;
        if (config.slowMode !== void 0) data.configSlowMode = config.slowMode;
        if (config.isBroadcast !== void 0) data.configIsBroadcast = config.isBroadcast ? 1 : 0;
        if (Object.keys(data).length === 0) return false;
        return patchChannel(channelId, data);
      }
      static async updateChannelName(channelId, newName, newPrefix) {
        return patchChannel(channelId, { name: newName, prefix: newPrefix });
      }
      static async getPrivateChannels(player) {
        const rows = await getChannels({ type: "private", ownerId: player.id });
        return rows ?? [];
      }
      // ============================================
      //  系统消息频道
      // ============================================
      static getSystemChannelId(player) {
        return `sys_${player.id}`;
      }
      static async ensureSystemChannel(player) {
        const channelId = this.getSystemChannelId(player);
        const existing = await getChannel(channelId);
        if (existing) return existing;
        const channel = {
          id: channelId,
          name: "\u7CFB\u7EDF\u6D88\u606F",
          type: "system",
          prefix: "SYS",
          ownerid: player.id,
          createdAt: Date.now(),
          config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG, allowChat: false }
        };
        await createChannel(channel).catch((e) => console.warn("[DogeChat] error:", e));
        return channel;
      }
      static async sendSystemMessage(player, content) {
        const channel = await this.ensureSystemChannel(player);
        const msg = {
          id: generateId("M"),
          fromid: "system",
          fromName: "SYS",
          channelId: channel.id,
          type: "text",
          content,
          timestamp: Date.now(),
          showTimestamp: true
        };
        saveMessages([msg]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
      }
      static isPrivateParticipant(channelId, playerId2) {
        if (!channelId.startsWith("priv_")) return false;
        return channelId.includes(playerId2);
      }
      static getPrivateOther(channelId, myId) {
        if (!channelId.startsWith("priv_")) return void 0;
        const parts = channelId.split("_");
        return parts[1] === myId ? parts[2] : parts[1];
      }
      /** 循环切换发送频道（!ch 用），同时订阅目标频道 */
      static async cycleChannel(player) {
        const all = await getChannels();
        if (!all) return null;
        const switchable = all.filter((c) => c.type !== "private");
        if (switchable.length === 0) {
          const pub = await this.getPublicChannel();
          if (pub) await this.setActiveChannel(player, pub.id);
          return pub;
        }
        const currentId = _DogeChat.activeChannelMap.get(player.id);
        const current = all.find((c) => c.id === currentId);
        const idx = current ? switchable.findIndex((c) => c.id === current.id) : -1;
        const next = switchable[(idx + 1) % switchable.length];
        if (next) await this.setActiveChannel(player, next.id);
        return next ?? null;
      }
      // ============================================
      //  消息同步
      // ============================================
      static async getChannelHistory(channelId) {
        const channel = await getChannel(channelId);
        if (!channel) return [];
        const cutoff = Date.now() - this.getRetention(channel);
        const rows = await getMessages({ channelId, minSentAt: cutoff });
        if (rows !== null) return rows;
        return [];
      }
      static async loadChannelHistory(player, channelId) {
        const channel = await getChannel(channelId);
        if (!channel) return;
        const history = await this.getChannelHistory(channelId);
        if (history.length === 0) {
          player.sendMessage(`\xA77--- \xA7f${channel.prefix} \xA77\u9891\u9053\u6682\u65E0\u5386\u53F2\u6D88\u606F ---`);
          return;
        }
        player.sendMessage(`\xA77--- \xA7f${channel.prefix} \xA77\u9891\u9053\u5386\u53F2\u6D88\u606F ---`);
        for (const msg of history) {
          const isBroadcast = channel.config.isBroadcast;
          if (msg.showTimestamp && !isBroadcast) {
            player.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
          }
          let display = msg.content;
          switch (msg.type) {
            case "location":
              display = `\xA7a[\u5B9A\u4F4D] ${display}`;
              break;
            case "teleport_invite":
              display = `\xA7e[\u4F20\u9001\u9080\u8BF7] ${display}`;
              break;
            case "redpacket":
              display = `\xA76[\u7EA2\u5305] ${display}`;
              break;
          }
          player.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${msg.fromName}: ${display}` }] });
        }
        player.sendMessage(`\xA77--- \u4EE5\u4E0A\u4E3A\u5386\u53F2\u6D88\u606F\uFF0C\u5171 ${history.length} \u6761 ---`);
        player.sendMessage("\xA77!lo \xA78\u53D1\u9001\u5B9A\u4F4D \xA77| !tp \xA78\u4F20\u9001\u9080\u8BF7 \xA77| !hb \xA78\u53D1\u9001\u7EA2\u5305");
      }
      // ============================================
      //  发送消息
      // ============================================
      static async sendChannelMessage(from, channelId, content, type = "text", attachment) {
        debug.i("CHAT", `sendChannelMessage: from=${from.name} channelId=${channelId} type=${type}`);
        const channel = await getChannel(channelId);
        if (!channel) {
          Msg.warning("\u9891\u9053\u4E0D\u5B58\u5728\u3002", from);
          return false;
        }
        if (!channel.config?.allowChat) {
          if (channel.type === "system") Msg.warning("\u8BE5\u9891\u9053\u53EA\u8BFB\u3002", from);
          return false;
        }
        if (channel.config?.isBroadcast) {
          const owner = await this.isChannelOwner(from, channelId);
          const isAdmin = Permission.check(from, "chat.admin");
          if (!owner && !isAdmin) {
            Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u6A21\u5F0F\uFF0C\u53EA\u6709\u7BA1\u7406\u5458\u624D\u80FD\u53D1\u8A00\u3002", from);
            return false;
          }
          const msg2 = {
            id: generateId("M"),
            fromid: from.id,
            fromName: from.name,
            channelId,
            type,
            content,
            attachment,
            timestamp: Date.now(),
            showTimestamp: true
          };
          await saveMessages([msg2]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
          from.sendMessage({ rawtext: [{ text: `\xA7a[${channel.prefix}] ${from.name}: ${content}` }] });
          return true;
        }
        if (channel.config?.slowMode && channel.config.slowMode > 0) {
          const playerMap = this.slowModeTracker.get(from.id);
          const lastTs = playerMap?.get(channelId) ?? 0;
          const elapsed = (Date.now() - lastTs) / 1e3;
          if (elapsed < channel.config.slowMode) {
            Msg.warning(
              `\u9891\u9053 ${channel.prefix} \u6162\u901F\u6A21\u5F0F\u4E2D\uFF0C\u8BF7\u7B49\u5F85 ${Math.ceil(channel.config.slowMode - elapsed)} \u79D2\u3002`,
              from
            );
            return false;
          }
        }
        const history = await this.getChannelHistory(channelId);
        const lastMsg = history.length > 0 ? history[history.length - 1] : void 0;
        const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1e3;
        const msg = {
          id: generateId("M"),
          fromid: from.id,
          fromName: from.name,
          channelId,
          type,
          content,
          attachment,
          timestamp: Date.now(),
          showTimestamp
        };
        saveMessages([msg]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
        if (showTimestamp) from.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
        from.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${from.name}: ${content}` }] });
        this._broadcastToSubscribers(channel, msg, showTimestamp, from.id);
        if (channel.config?.slowMode && channel.config.slowMode > 0) {
          if (!this.slowModeTracker.has(from.id)) this.slowModeTracker.set(from.id, /* @__PURE__ */ new Map());
          this.slowModeTracker.get(from.id).set(channelId, Date.now());
        }
        return true;
      }
      /** 广播消息给所有订阅了该频道的玩家 */
      static _broadcastToSubscribers(channel, msg, showTimestamp, excludeId) {
        const isBroadcast = channel.config.isBroadcast;
        for (const p of world4.getPlayers()) {
          if (p.id === excludeId) continue;
          if (!this.isSubscribed(p.id, channel.id)) continue;
          let display = msg.content;
          switch (msg.type) {
            case "location":
              display = `\xA7a[\u5B9A\u4F4D] ${display}`;
              break;
            case "teleport_invite":
              display = `\xA7e[\u4F20\u9001\u9080\u8BF7] ${display}`;
              break;
            case "redpacket":
              display = `\xA76[\u7EA2\u5305] ${display}`;
              break;
          }
          if (showTimestamp && !isBroadcast) p.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
          p.chatNamePrefix = `[${channel.prefix}]`;
          p.sendMessage(`${display}`);
        }
      }
      static async sendPrivateMessage(from, toPlayer, content, type = "text") {
        const channel = await this.ensurePrivateChannel(from.id, toPlayer.id);
        const history = await this.getChannelHistory(channel.id);
        const lastMsg = history.length > 0 ? history[history.length - 1] : void 0;
        const showTimestamp = !lastMsg || Date.now() - lastMsg.timestamp > 5 * 60 * 1e3;
        const msg = {
          id: generateId("M"),
          fromid: from.id,
          fromName: from.name,
          channelId: channel.id,
          type,
          content,
          timestamp: Date.now(),
          showTimestamp
        };
        saveMessages([msg]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
        for (const p of [from, toPlayer]) {
          if (this.isSubscribed(p.id, channel.id)) {
            let display = content;
            switch (type) {
              case "location":
                display = `\xA7a[\u5B9A\u4F4D] ${display}`;
                break;
              case "teleport_invite":
                display = `\xA7e[\u4F20\u9001\u9080\u8BF7] ${display}`;
                break;
              case "redpacket":
                display = `\xA76[\u7EA2\u5305] ${display}`;
                break;
            }
            if (showTimestamp) p.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
            const sender = p.id === from.id ? toPlayer.name : from.name;
            p.sendMessage({ rawtext: [{ text: `\xA7d[\u79C1\u4FE1] \xA7f${sender}: ${display}` }] });
          } else if (p.id !== from.id) {
            Msg.info(`\xA7b${from.name} \u53D1\u6765\u4E00\u6761\u79C1\u4FE1\u3002\u4F7F\u7528 !channel \u5207\u6362\u5230\u79C1\u804A\u9891\u9053\u67E5\u770B\u3002`, p);
          }
        }
        return true;
      }
      static async ensurePrivateChannel(idA, idB) {
        const ids = [idA, idB].sort();
        const channelId = `priv_${ids[0]}_${ids[1]}`;
        const existing = await getChannel(channelId);
        if (existing) return existing;
        const nameB = world4.getPlayers().find((p) => p.id === idB)?.name ?? idB;
        const channel = {
          id: channelId,
          name: `\u4E0E ${nameB} \u7684\u79C1\u804A`,
          type: "private",
          prefix: `\u79C1\u804A-${nameB}`,
          ownerid: idA,
          createdAt: Date.now(),
          config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG }
        };
        await createChannel(channel).catch((e) => console.warn("[DogeChat] error:", e));
        return channel;
      }
      // ============================================
      //  定位 & 传送
      // ============================================
      static createLocationMessage(player) {
        const loc2 = player.location;
        return `${player.dimension.id}:${Math.floor(loc2.x)},${Math.floor(loc2.y)},${Math.floor(loc2.z)}`;
      }
      static sendTeleportInvite(from, toPlayer) {
        const loc2 = from.location;
        const locStr = `${from.dimension.id}:${Math.floor(loc2.x)},${Math.floor(loc2.y)},${Math.floor(loc2.z)}`;
        return this.sendPrivateMessage(from, toPlayer, `${from.name} \u9080\u8BF7\u4F60\u4F20\u9001\u5230\u4ED6\u7684\u4F4D\u7F6E\uFF01(${locStr})`, "teleport_invite");
      }
      // ============================================
      //  红包
      // ============================================
      static async sendRedPacket(sender, amount, count, targetType, targetId) {
        debug.i(
          "CHAT",
          `sendRedPacket: sender=${sender.name} amount=${amount} count=${count} type=${targetType} targetId=${targetId}`
        );
        if (amount <= 0 || count <= 0 || count > amount) {
          Msg.error("\u7EA2\u5305\u53C2\u6570\u65E0\u6548\u3002", sender);
          return false;
        }
        const balance = await Money.load(sender);
        if (balance < amount) {
          Msg.error(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${amount}\uFF0C\u5F53\u524D ${balance}\u3002`, sender);
          return false;
        }
        const packet = {
          id: generateId("RP"),
          senderid: sender.id,
          senderName: sender.name,
          totalAmount: amount,
          remainingAmount: amount,
          totalCount: count,
          remainingCount: count,
          receivers: [],
          targetType,
          targetId,
          createdAt: Date.now(),
          expiresAt: Date.now() + 24 * 60 * 60 * 1e3
        };
        const saved = await saveRedPacket(packet);
        if (!saved) {
          Msg.error("\u7EA2\u5305\u53D1\u9001\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", sender);
          return false;
        }
        await Money.load(sender);
        Msg.success(`${sender.name} \u53D1\u9001\u4E86\u7EA2\u5305\uFF1A${amount} ${Money.UNIT}\uFF08\u5171 ${count} \u4EFD\uFF09\u3002`, sender);
        const channelId = targetType === "group" ? targetId : (await this.ensurePrivateChannel(sender.id, targetId)).id;
        saveMessages([
          {
            id: generateId("M"),
            fromid: sender.id,
            fromName: sender.name,
            channelId,
            type: "redpacket",
            content: `\u53D1\u9001\u4E86 ${amount} ${Money.UNIT} \u7684\u7EA2\u5305\uFF08\u5171 ${count} \u4EFD\uFF09`,
            timestamp: Date.now()
          }
        ]).catch((err) => console.warn(`[DogeChat] \u4FDD\u5B58\u6D88\u606F\u5931\u8D25: ${err}`));
        return true;
      }
      static async claimRedPacket(player, packetId) {
        debug.i("CHAT", `claimRedPacket: player=${player.name} packetId=${packetId}`);
        const packet = await getRedPacket(packetId);
        if (!packet) {
          Msg.error("\u7EA2\u5305\u4E0D\u5B58\u5728\u3002", player);
          return 0;
        }
        if (packet.remainingCount <= 0) {
          Msg.error("\u7EA2\u5305\u5DF2\u88AB\u9886\u5B8C\u3002", player);
          return 0;
        }
        if (packet.receivers.includes(player.id)) {
          Msg.warning("\u4F60\u5DF2\u7ECF\u9886\u53D6\u8FC7\u8FD9\u4E2A\u7EA2\u5305\u4E86\u3002", player);
          return 0;
        }
        if (Date.now() > packet.expiresAt) {
          Msg.error("\u7EA2\u5305\u5DF2\u8FC7\u671F\u3002", player);
          return 0;
        }
        let amount;
        if (packet.remainingCount === 1) {
          amount = packet.remainingAmount;
        } else {
          const max = Math.floor(packet.remainingAmount / packet.remainingCount * 2);
          amount = Math.max(1, Math.floor(Math.random() * (max + 1)));
          amount = Math.min(amount, packet.remainingAmount - (packet.remainingCount - 1));
        }
        const result = await claimRedPacket(packet.id, player.id, player.name);
        if (!result.ok) {
          Msg.error("\u9886\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", player);
          return 0;
        }
        const claimedAmount = result.amount ?? amount;
        await Money.load(player);
        Msg.success(`\u4F60\u9886\u53D6\u4E86 ${packet.senderName} \u7684\u7EA2\u5305\uFF0C\u83B7\u5F97 ${claimedAmount} ${Money.UNIT}\uFF01`, player);
        return claimedAmount;
      }
      static async getAvailableRedPackets(player) {
        const rows = await getRedPackets();
        const now = Date.now();
        return rows.filter((p) => {
          if (p.remainingCount <= 0 || now > p.expiresAt) return false;
          if (p.targetType === "player") return p.targetId === player.id;
          return true;
        });
      }
      static cleanupExpiredRedPackets() {
      }
      // ============================================
      //  权限判断
      // ============================================
      static async isChannelOwner(player, channelId) {
        const ch = await getChannel(channelId);
        return ch?.ownerid === player.id;
      }
      // ============================================
      //  QQ 桥接轮询
      // ============================================
      static startBridgePolling(bridgeChannelId) {
        debug.i("CHAT", `startBridgePolling: channelId=${bridgeChannelId}`);
        if (this._bridgePollStarted) return;
        this._bridgePollStarted = true;
        this._lastBridgeFetch = Date.now();
        this._bridgePollId = system3.runInterval(async () => {
          try {
            const since = this._lastBridgeFetch;
            this._lastBridgeFetch = Date.now();
            const msgs = await getMessages({ channelId: bridgeChannelId, minSentAt: since });
            if (!msgs || msgs.length === 0) return;
            const channel = await getChannel(bridgeChannelId);
            if (!channel) return;
            for (const msg of msgs) {
              if (msg.fromid.startsWith("qq_")) {
                const isBroadcast = channel.config.isBroadcast;
                for (const p of world4.getPlayers()) {
                  if (!this.isSubscribed(p.id, bridgeChannelId)) continue;
                  if (!isBroadcast && msg.timestamp - this._lastBridgeTimestamp > 3e5) {
                    this._lastBridgeTimestamp = msg.timestamp;
                    p.sendMessage(`\xA77${formatTimestamp(msg.timestamp)}`);
                  }
                  p.sendMessage({ rawtext: [{ text: `\xA7b[${channel.prefix}] \xA7f${msg.fromName}: \xA7r${msg.content}` }] });
                }
              }
            }
          } catch {
          }
        }, 600);
      }
      static stopBridgePolling() {
        debug.i("CHAT", "stopBridgePolling");
        if (this._bridgePollId !== void 0) {
          try {
            system3.clearRun(this._bridgePollId);
          } catch {
          }
          this._bridgePollId = void 0;
        }
        this._bridgePollStarted = false;
      }
    };
    _DogeChat.DEFAULT_CHANNEL_CONFIG = {
      allowChat: true,
      slowMode: 0,
      isBroadcast: false
    };
    _DogeChat.DEFAULT_CHANNELS = [
      {
        id: generateId("CH"),
        name: "\u516C\u5171\u9891\u9053",
        type: "public",
        prefix: "PB",
        createdAt: Date.now(),
        config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG }
      },
      {
        id: generateId("CH"),
        name: "\u516C\u544A",
        type: "custom",
        prefix: "BC",
        createdAt: Date.now(),
        config: { ..._DogeChat.DEFAULT_CHANNEL_CONFIG, isBroadcast: true }
      }
    ];
    _DogeChat.slowModeTracker = /* @__PURE__ */ new Map();
    /** 发送频道（玩家输入的消息发送到此频道） */
    _DogeChat.activeChannelMap = /* @__PURE__ */ new Map();
    /** 订阅频道（接收消息的频道列表） */
    _DogeChat.subscribedChannelsMap = /* @__PURE__ */ new Map();
    /** QQ 桥接轮询 */
    _DogeChat._bridgePollStarted = false;
    _DogeChat._bridgePollId = void 0;
    _DogeChat._lastBridgeFetch = Date.now();
    _DogeChat._lastBridgeTimestamp = 0;
    DogeChat = _DogeChat;
  }
});

// scripts/libs/ModuleKeys.ts
var Modules;
var init_ModuleKeys = __esm({
  "scripts/libs/ModuleKeys.ts"() {
    "use strict";
    Modules = {
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
      gui: "gui"
    };
  }
});

// scripts/libs/ModuleRegistry.ts
var ModuleRegistry_exports = {};
__export(ModuleRegistry_exports, {
  ModuleRegistry: () => ModuleRegistry,
  announceLoaded: () => announceLoaded,
  guardEvent: () => guardEvent
});
import { system as system4 } from "@minecraft/server";
function guardEvent() {
  return ConfigManager.isReady();
}
function announceLoaded() {
  const active = descriptors.filter((d) => ModuleRegistry.isActive(d.id)).map((d) => d.id);
  console.log(`[ModuleRegistry] \u5DF2\u542F\u52A8\u6A21\u5757: ${active.join(", ") || "\u65E0"}`);
}
var descriptors, cleanups, booted, lastEnabled, worldLoaded, ModuleRegistry;
var init_ModuleRegistry = __esm({
  "scripts/libs/ModuleRegistry.ts"() {
    "use strict";
    init_Command();
    init_ConfigManager();
    init_ModuleKeys();
    descriptors = [];
    cleanups = /* @__PURE__ */ new Map();
    booted = /* @__PURE__ */ new Set();
    lastEnabled = /* @__PURE__ */ new Map();
    worldLoaded = false;
    ModuleRegistry = class _ModuleRegistry {
      static register(descriptor) {
        descriptors.push(descriptor);
      }
      static list() {
        return [...descriptors];
      }
      static get(id) {
        return descriptors.find((d) => d.id === id);
      }
      static isActive(id) {
        return ConfigManager.isEnabled(Modules[id]);
      }
      static trackCleanup(modId, fn) {
        if (!cleanups.has(modId)) cleanups.set(modId, []);
        cleanups.get(modId).push(fn);
      }
      static trackCommand(modId, name) {
        _ModuleRegistry.trackCleanup(modId, () => Command.unregister(name));
      }
      static trackSystemRun(modId, runId) {
        _ModuleRegistry.trackCleanup(modId, () => {
          try {
            system4.clearRun(runId);
          } catch {
          }
        });
      }
      static clearLastEnabled() {
        lastEnabled.clear();
      }
      static snapshotEnabled() {
        for (const d of descriptors) {
          lastEnabled.set(Modules[d.id], _ModuleRegistry.isActive(d.id));
        }
      }
      /**
       * Compare current enabled state vs last snapshot, call cleanup/boot for changed modules.
       * Returned array: [{ id, action: 'disable'|'enable' }]
       */
      static reconcile() {
        if (!ConfigManager.isReady()) return [];
        const changes = [];
        for (const d of descriptors) {
          const key = Modules[d.id];
          const cur = _ModuleRegistry.isActive(d.id);
          const prev = lastEnabled.has(key) ? lastEnabled.get(key) : cur;
          if (prev === cur) continue;
          if (prev && !cur) {
            try {
              _ModuleRegistry.cleanupModule(d.id);
            } catch (e) {
              console.warn(`[Module:${d.id}] cleanup failed: ${e.message || e}`);
            }
            changes.push({ id: d.id, action: "disable" });
          } else if (!prev && cur) {
            try {
              _ModuleRegistry.bootModule(d.id);
            } catch (e) {
              console.warn(`[Module:${d.id}] boot failed: ${e.message || e}`);
            }
            changes.push({ id: d.id, action: "enable" });
          }
          lastEnabled.set(key, cur);
        }
        return changes;
      }
      static bootAll() {
        if (!ConfigManager.isReady()) return;
        for (const d of descriptors) {
          if (!_ModuleRegistry.isActive(d.id)) continue;
          _ModuleRegistry.bootModule(d.id);
        }
      }
      static bootAfterWorldLoad() {
        if (!ConfigManager.isReady()) return;
        worldLoaded = true;
        for (const d of descriptors) {
          if (!d.afterWorldLoad) continue;
          if (!_ModuleRegistry.isActive(d.id)) continue;
          try {
            d.lifecycle.init?.();
          } catch (e) {
            console.warn(`[Module:${d.id}] init failed: ${e.message || e}`);
          }
        }
      }
      static bootTasks() {
        if (!ConfigManager.isReady()) return;
        for (const d of descriptors) {
          if (d.afterWorldLoad) continue;
          if (!_ModuleRegistry.isActive(d.id)) continue;
          try {
            d.lifecycle.init?.();
          } catch (e) {
            console.warn(`[Module:${d.id}] task start failed: ${e.message || e}`);
          }
        }
      }
      static bootModule(id) {
        const d = _ModuleRegistry.get(id);
        if (!d) return;
        if (!_ModuleRegistry.isActive(id)) return;
        if (booted.has(id)) return;
        try {
          d.lifecycle.registerPermissions?.();
          d.lifecycle.registerCommands?.();
          d.lifecycle.registerEvents?.();
          if (!d.afterWorldLoad || worldLoaded) {
            d.lifecycle.init?.();
          }
          booted.add(id);
        } catch (e) {
          console.warn(`[Module:${id}] boot failed: ${e.message || e}`);
        }
      }
      static cleanupModule(id) {
        const d = _ModuleRegistry.get(id);
        if (!d) return;
        try {
          d.lifecycle.cleanup?.();
        } catch (e) {
          console.warn(`[Module:${id}] cleanup hook failed: ${e.message || e}`);
        }
        try {
          Command.unregisterByModule(Modules[id]);
        } catch {
        }
        const fns = cleanups.get(id);
        if (fns) {
          for (const fn of fns) {
            try {
              fn();
            } catch (e) {
              console.warn(`[Module:${id}] cleanup fn failed: ${e.message || e}`);
            }
          }
          cleanups.set(id, []);
        }
        booted.delete(id);
      }
      static teardown() {
        for (const d of descriptors) {
          try {
            _ModuleRegistry.cleanupModule(d.id);
          } catch {
          }
        }
      }
      static isBooted(id) {
        return booted.has(id);
      }
    };
  }
});

// scripts/libs/ConfigManager.ts
import { system as system5, world as world5 } from "@minecraft/server";
var ConfigManager;
var init_ConfigManager = __esm({
  "scripts/libs/ConfigManager.ts"() {
    "use strict";
    init_CreativeArea();
    init_Peace();
    init_DogeChat();
    init_HttpDB();
    init_Tools();
    ConfigManager = class {
      static async init() {
        if (this._initialized) return;
        this._initialized = true;
        await HttpDB.checkHealth();
        await this.reloadAll();
        HttpDB.setAuthToken(this.getSetting("db_auth_token", ""));
        this._syncRuntimeFlags();
        this._ready = true;
        console.log("[ConfigManager] \u914D\u7F6E\u5DF2\u52A0\u8F7D");
      }
      static isReady() {
        return this._ready;
      }
      static isStale() {
        return this._configStale;
      }
      static getLastErrors() {
        return Object.fromEntries(this._lastErrors);
      }
      static startPolling(intervalTicks = 72e3) {
        system5.runInterval(() => this._poll(), intervalTicks);
      }
      /**
       * 快速信号检查（每 2 秒），检测 _reload_signal → 立即全量重载
       */
      static startFastPoll(intervalTicks = 40) {
        system5.runInterval(() => this._fastPoll(), intervalTicks);
      }
      static isEnabled(module) {
        if (!this._ready) return false;
        return this.cache.modules.get(module) ?? false;
      }
      static getSetting(key, defaultVal) {
        const val = this.cache.settings.get(key);
        if (val === void 0) return defaultVal;
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      static getAreas(module) {
        return this.cache.areas.filter((a) => a.module === module);
      }
      static getPermissions() {
        return { ...this.cache.permissions };
      }
      static getBannedItems() {
        return [...this.cache.bannedItems];
      }
      static getClean() {
        return { ...this.cache.clean };
      }
      static getGrid(name) {
        return this.cache.grids[name] ?? null;
      }
      static getPeaceFilters() {
        return [...this.cache.peaceFilters];
      }
      static getQuestions() {
        return [...this.cache.questions];
      }
      static async reloadAll() {
        if (this._reloadInFlight) return this._reloadInFlight;
        const now = Date.now();
        this._reloadInFlight = (async () => {
          const promises = [
            this._fetchModules(),
            this._fetchSettings(),
            this._fetchAreas(),
            this._fetchPermissions(),
            this._fetchBannedItems(),
            this._fetchClean(),
            this._fetchGrids(),
            this._fetchPeaceFilters(),
            this._fetchQA()
          ];
          await Promise.allSettled(promises);
          this.cache._lastFetch = now;
          this._configStale = this._lastErrors.size > 0;
        })();
        try {
          await this._reloadInFlight;
        } finally {
          this._reloadInFlight = null;
        }
      }
      static async reloadModule(module) {
        await this._fetchSettings();
        await this._fetchAreas();
      }
      // ── Internal fetchers ──
      static async _poll() {
        if (this._pollInFlight) return;
        this._pollInFlight = true;
        try {
          if (!this.cache._lastFetch) return;
          const body = await HttpDB.get(`/api/sfmc/configs/updated-since/${this.cache._lastFetch}`);
          if (!body) return;
          const data = JSON.parse(body);
          const upd = data.updated;
          if (!upd) return;
          this.cache._lastFetch = data.timestamp || Date.now();
          if (upd.modules) await this._fetchModules();
          if (upd.settings) await this._fetchSettings();
          if (upd.areas) await this._fetchAreas();
          if (upd.permissions) await this._fetchPermissions();
          if (upd.banned_items) await this._fetchBannedItems();
          if (upd.clean) await this._fetchClean();
          if (upd.grids) await this._fetchGrids();
          if (upd.peace_filters) await this._fetchPeaceFilters();
          if (upd.qa_questions) await this._fetchQA();
        } catch (e) {
          this._recordError("poll", e);
        } finally {
          this._pollInFlight = false;
        }
      }
      static async _fastPoll() {
        if (this._fastPollInFlight) return;
        this._fastPollInFlight = true;
        try {
          if (!HttpDB.isAvailable()) {
            const ok = await HttpDB.checkHealth();
            if (!ok) return;
            console.warn("[ConfigManager] \u6570\u636E\u5E93\u5DF2\u91CD\u8FDE\uFF0C\u91CD\u65B0\u52A0\u8F7D\u914D\u7F6E");
            await this.reloadAll();
            this._syncRuntimeFlags();
            const bridgeId = this.getSetting("bridge_channel_id", "");
            if (bridgeId) DogeChat.startBridgePolling(bridgeId);
            return;
          }
          const body = await HttpDB.get("/api/sfmc/settings/_reload_signal");
          if (!body) return;
          const { value } = JSON.parse(body);
          if (parseInt(value, 10) > this.cache._lastFetch) {
            console.warn("[ConfigManager] \u6536\u5230\u70ED\u91CD\u8F7D\u4FE1\u53F7\uFF0C\u91CD\u65B0\u52A0\u8F7D\u914D\u7F6E");
            await this.reloadAll();
            this._syncRuntimeFlags();
            const { ModuleRegistry: ModuleRegistry2 } = await Promise.resolve().then(() => (init_ModuleRegistry(), ModuleRegistry_exports));
            const changes = ModuleRegistry2.reconcile();
            if (changes.length > 0) {
              for (const p of world5.getPlayers()) {
                const list = changes.map((c) => `${c.id} ${c.action === "disable" ? "\u5DF2\u7981\u7528" : "\u5DF2\u542F\u7528"}`).join(", ");
                Msg.info(`\u6A21\u5757\u53D8\u66F4: ${list}`, p);
              }
            }
            const bridgeId = this.getSetting("bridge_channel_id", "");
            if (bridgeId) DogeChat.startBridgePolling(bridgeId);
            for (const p of world5.getPlayers()) {
              Msg.info("\u914D\u7F6E\u5DF2\u70ED\u91CD\u8F7D", p);
            }
          }
        } catch (e) {
          console.warn(`[ConfigManager] \u70ED\u91CD\u8F7D\u4FE1\u53F7\u68C0\u67E5\u5931\u8D25: ${e.message || e}`);
        } finally {
          this._fastPollInFlight = false;
        }
      }
      /** 将缓存中的模块开关同步到运行时的模块标志 */
      static _syncRuntimeFlags() {
        CreativeArea.enable = this.isEnabled("creative");
        Peace.getInstance().enable = this.isEnabled("peace");
      }
      static async _fetchModules() {
        try {
          const body = await HttpDB.get("/api/sfmc/modules");
          if (!body) return;
          const { modules } = JSON.parse(body);
          this.cache.modules.clear();
          for (const m of modules) {
            const key = m.config_key || m.configKey || m.name;
            if (key) this.cache.modules.set(key, !!m.enabled && m.installed !== false);
          }
          this._clearError("modules");
        } catch (e) {
          this._recordError("modules", e);
        }
      }
      static async _fetchSettings() {
        try {
          const body = await HttpDB.get("/api/sfmc/settings");
          if (!body) return;
          const { settings } = JSON.parse(body);
          this.cache.settings.clear();
          for (const s of settings) this.cache.settings.set(s.key, s.value);
          this._clearError("settings");
        } catch (e) {
          this._recordError("settings", e);
        }
      }
      static async _fetchAreas() {
        try {
          const body = await HttpDB.get("/api/sfmc/areas");
          if (!body) return;
          this.cache.areas = (JSON.parse(body).areas || []).map((a) => ({
            name: a.name || "",
            dimension: a.dimension,
            module: a.module,
            start: [a.start_x, a.start_z],
            end: [a.end_x, a.end_z]
          }));
          this._clearError("areas");
        } catch (e) {
          this._recordError("areas", e);
        }
      }
      static async _fetchPermissions() {
        try {
          const body = await HttpDB.get("/api/sfmc/permissions");
          if (!body) return;
          const { permissions } = JSON.parse(body);
          this.cache.permissions = {};
          for (const p of permissions) this.cache.permissions[p.player_name] = p.level;
          this._clearError("permissions");
        } catch (e) {
          this._recordError("permissions", e);
        }
      }
      static async _fetchBannedItems() {
        try {
          const body = await HttpDB.get("/api/sfmc/banned_items");
          if (!body) return;
          this.cache.bannedItems = (JSON.parse(body).items || []).map((i) => i.item_id);
          this._clearError("banned_items");
        } catch (e) {
          this._recordError("banned_items", e);
        }
      }
      static async _fetchClean() {
        try {
          const body = await HttpDB.get("/api/sfmc/clean");
          if (!body) return;
          const { clean } = JSON.parse(body);
          if (clean) this.cache.clean = { itemMax: clean.item_max, pollInterval: clean.poll_interval };
          this._clearError("clean");
        } catch (e) {
          this._recordError("clean", e);
        }
      }
      static async _fetchGrids() {
        try {
          const body = await HttpDB.get("/api/sfmc/grids");
          if (!body) return;
          const { grids } = JSON.parse(body);
          this.cache.grids = {};
          for (const g of grids) {
            this.cache.grids[g.name] = {
              ...g,
              size: [g.size_h, g.size_v],
              start: [g.start_x, g.start_y, g.start_z]
            };
          }
          this._clearError("grids");
        } catch (e) {
          this._recordError("grids", e);
        }
      }
      static async _fetchPeaceFilters() {
        try {
          const body = await HttpDB.get("/api/sfmc/peace_filters");
          if (!body) return;
          this.cache.peaceFilters = JSON.parse(body).filters || [];
          this._clearError("peace_filters");
        } catch (e) {
          this._recordError("peace_filters", e);
        }
      }
      static async _fetchQA() {
        try {
          const body = await HttpDB.get("/api/sfmc/qa");
          if (!body) return;
          const { questions } = JSON.parse(body);
          this.cache.questions = questions.map((q) => ({
            weight: q.weight,
            q: q.question,
            a: JSON.parse(q.answers || "[]"),
            msg_right: q.msg_right || "",
            msg_wrong: q.msg_wrong || "",
            d: q.explanation || "",
            seq: [q.min_rank, q.max_rank].filter((v) => v !== null),
            bonus: this._parseQAItems(q.rewards),
            punish: this._parseQAItems(q.punishments)
          }));
          this._clearError("qa");
        } catch (e) {
          this._recordError("qa", e);
        }
      }
      static _parseQAItems(jsonStr) {
        if (!jsonStr) return [];
        try {
          const items = JSON.parse(jsonStr);
          if (!items || items.length === 0) return [];
          if (typeof items[0] === "object" && items[0] !== null) return items;
          return [];
        } catch {
          return [];
        }
      }
      static _recordError(source, error) {
        const message = error?.message || String(error);
        const previous = this._lastErrors.get(source);
        this._lastErrors.set(source, message);
        this._configStale = true;
        if (previous !== message) console.warn(`[ConfigManager] ${source} \u914D\u7F6E\u83B7\u53D6\u5931\u8D25: ${message}`);
      }
      static _clearError(source) {
        this._lastErrors.delete(source);
        this._configStale = this._lastErrors.size > 0;
      }
    };
    ConfigManager.cache = {
      modules: /* @__PURE__ */ new Map(),
      settings: /* @__PURE__ */ new Map(),
      areas: [],
      permissions: {},
      bannedItems: [],
      clean: { itemMax: 192, pollInterval: 60 },
      grids: {},
      peaceFilters: [],
      questions: [],
      _lastFetch: 0
    };
    ConfigManager._initialized = false;
    ConfigManager._ready = false;
    ConfigManager._configStale = false;
    ConfigManager._lastErrors = /* @__PURE__ */ new Map();
    ConfigManager._pollInFlight = false;
    ConfigManager._fastPollInFlight = false;
    ConfigManager._reloadInFlight = null;
  }
});

// scripts/libs/Permission.ts
import { PlayerPermissionLevel } from "@minecraft/server";
var Permission;
var init_Permission = __esm({
  "scripts/libs/Permission.ts"() {
    "use strict";
    init_ConfigManager();
    init_Command();
    init_Tools();
    Permission = class {
      /**
       * 注册一个权限项
       * @param name 权限名（如 "creativearea.toggle"）
       * @param level 所需最低权限等级
       */
      static register(name, level) {
        this.registry.set(name, level);
      }
      /**
       * 检查玩家是否拥有指定权限
       * @param player 玩家对象或玩家名
       * @param permissionName 权限名
       * @returns 是否满足权限要求
       */
      static check(player, permissionName) {
        const required = this.registry.get(permissionName);
        if (required === void 0) {
          console.warn(`[Permission] \u672A\u6CE8\u518C\u7684\u6743\u9650\u88AB\u62D2\u7EDD: ${permissionName}`);
          return false;
        }
        const perms = ConfigManager.getPermissions();
        const playerLevel = typeof player === "string" ? perms[player] ?? this.Member : this.getPermission(player);
        return playerLevel >= required;
      }
      static getPermission(player) {
        const perms = ConfigManager.getPermissions();
        if (perms[player.name] !== void 0) {
          return perms[player.name];
        }
        switch (player.playerPermissionLevel) {
          case PlayerPermissionLevel.Visitor:
            return this.Any;
          case PlayerPermissionLevel.Member:
            return this.Member;
          case PlayerPermissionLevel.Operator:
            return this.OP;
          case PlayerPermissionLevel.Custom:
            return this.Admin;
          default:
            return this.Member;
        }
      }
      /** 注册 permlist 命令 */
      static registerPermlistCommand() {
        Command.register(
          "permlist",
          "permlist.see",
          (player) => {
            if (!player) return;
            const lines = [];
            lines.push(`\u83B7\u53D6\u5230\u5982\u4E0B\u6743\u9650\u9879\uFF1A\xA7r`);
            const byLevel = [
              [this.Any, []],
              [this.Member, []],
              [this.OP, []],
              [this.Admin, []],
              [-1, []]
            ];
            const levelMap = new Map(byLevel);
            for (const [name, level] of this.registry) {
              const bucket = levelMap.get(level);
              if (bucket) bucket.push(name);
              else (levelMap.get(-1) ?? []).push(name);
            }
            const label = {
              [-1]: "\u672A\u77E5",
              [this.Any]: "\xA7a\u8BBF\u5BA2",
              [this.Member]: "\xA7e\u6210\u5458",
              [this.OP]: "\xA76\u7BA1\u7406",
              [this.Admin]: "\xA7c\u81EA\u5B9A\u4E49"
            };
            for (const [level, perms] of byLevel) {
              if (perms.length === 0) continue;
              lines.push(`
${label[level] ?? "\xA77\u5176\u4ED6"} (${level}+):`);
              for (const p of perms) {
                lines.push(`  \xA7f${p}`);
              }
            }
            Msg.success(lines.join("\n"), player);
          },
          "\u67E5\u770B\u6240\u6709\u6743\u9650\u5217\u8868"
        );
      }
    };
    Permission.Guest = -1;
    // 脚本指定的无权限访客
    Permission.Any = 0;
    // 等同于原生 Visitor
    Permission.Member = 1;
    // 等同于原生 Member
    Permission.OP = 2;
    // 等同于原生 Operator
    Permission.Admin = 3;
    // 等同于原生 Custom
    /** 权限注册表：权限名 → 所需最低等级 */
    Permission.registry = /* @__PURE__ */ new Map();
  }
});

// scripts/libs/Command.ts
import { system as system6 } from "@minecraft/server";
function setModuleGuard(guard) {
  moduleGuard = guard;
}
var moduleGuard, Command;
var init_Command = __esm({
  "scripts/libs/Command.ts"() {
    "use strict";
    init_DebugLog();
    init_Permission();
    init_Tools();
    moduleGuard = () => true;
    Command = class {
      /**
       * 注册指令
       * @param name 指令名称
       * @param permission 权限等级(数字) 或 权限名(字符串)
       * @param callback 回调
       * @param description 指令描述
       * @param moduleId 所属模块 ID（可选），用于模块禁用时拦截
       * @param cost 指令费用配置
       */
      static register(name, permission, callback, description, moduleId, cost) {
        this.list[name] = {
          callback,
          permission,
          description: description === void 0 ? name : description,
          moduleId,
          cost
        };
        debug.i("CMD", `register "${name}" perm=${permission} mod=${moduleId || "-"} cost=${cost?.amount || 0}`);
        return true;
      }
      static unregister(name) {
        if (this.list[name] !== void 0) {
          delete this.list[name];
          return true;
        }
        return false;
      }
      static unregisterByModule(moduleId) {
        let n = 0;
        for (const k of Object.keys(this.list)) {
          if (this.list[k].moduleId === moduleId) {
            delete this.list[k];
            n++;
          }
        }
        return n;
      }
      static has(name) {
        return this.list[name] !== void 0;
      }
      static names() {
        return Object.keys(this.list);
      }
      static getModuleId(name) {
        return this.list[name]?.moduleId;
      }
      /**
       * 检查玩家是否有权限执行该命令
       */
      static canExecute(player, permission) {
        if (player === void 0) return true;
        if (typeof permission === "string") {
          return Permission.check(player, permission);
        }
        return Permission.getPermission(player) >= permission;
      }
      /**
       * 触发指令
       * @param player 触发指令的玩家，不指定时使用最高权限执行
       * @param message
       */
      static trigger(player, message) {
        const pname = player?.name || "CONSOLE";
        const pid = player?.id || "N/A";
        debug.i("CMD", `trigger by ${pname}(${pid}): "${message}"`);
        let commandInfo = this.list[message];
        if (commandInfo !== void 0) {
          if (commandInfo.moduleId && !moduleGuard(commandInfo.moduleId)) {
            debug.w("CMD", `blocked: module ${commandInfo.moduleId} disabled for ${pname}`);
            if (player) Msg.error(`\u8BE5\u547D\u4EE4\u6240\u5C5E\u6A21\u5757\u5DF2\u7981\u7528: ${commandInfo.moduleId}`, player);
            return;
          }
          if (!this.canExecute(player, commandInfo.permission)) {
            debug.w("CMD", `permission denied: ${pname} needs ${commandInfo.permission} for "${message}"`);
            if (player) Msg.error(`\u4F60\u6CA1\u6709\u6267\u884C\u6B64\u6761\u6307\u4EE4\u7684\u6743\u9650\u3002`, player);
            return;
          }
          system6.run(async () => {
            if (player && commandInfo.cost && this.deductCost) {
              const ok = await this.deductCost(player, commandInfo.cost.amount, message);
              if (!ok) {
                debug.w("CMD", `cost deduct failed: ${pname} needs ${commandInfo.cost.amount} for "${message}"`);
                Msg.error(`\u4F59\u989D\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u6267\u884C\u8BE5\u6307\u4EE4\uFF08\u9700\u8981 ${commandInfo.cost.amount}\uFF09\u3002`, player);
                return;
              }
              debug.i("CMD", `cost deducted ${commandInfo.cost.amount} from ${pname} for "${message}"`);
            }
            debug.d("CMD", `executing "${message}" for ${pname}`);
            const result = await commandInfo.callback(player);
            if (result !== void 0 && player) debug.d("CMD", `result for "${message}": ${result}`);
            if (result !== void 0 && player) Msg.success(`${result}`, player);
          });
          return;
        }
        debug.w("CMD", `unknown command "${message}" from ${pname}`);
        if (player) Msg.error(`\u672A\u77E5\u7684\u547D\u4EE4! \u53D1\u9001'!help'\u67E5\u8BE2\u6240\u6709\u6307\u4EE4\u3002`, player);
        return;
      }
      /**
       * 注册帮助指令，在初始化时调用
       */
      static registerHelpCommand() {
        this.register(
          "help",
          "help.see",
          (player) => {
            let result = "\u5F53\u524D\u53EF\u7528\u6307\u4EE4\u5217\u8868\u5982\u4E0B\uFF1A\xA7r\n";
            for (let command in this.list) {
              if (this.canExecute(player, this.list[command].permission)) {
                result += `  ${command} - ${this.list[command].description}
`;
              }
            }
            return result;
          },
          "\u83B7\u53D6\u6240\u6709\u6307\u4EE4"
        );
      }
      /**
       * 注册脚本事件，在初始化时调用
       */
      static registerScriptEvent() {
        system6.afterEvents.scriptEventReceive.subscribe(
          (event) => {
            this.trigger(event.sourceEntity, event.id.substring(5));
          },
          { namespaces: ["doge"] }
        );
      }
    };
    Command.list = {};
    Command.deductCost = null;
    Command.registerScriptEvent();
  }
});

// scripts/doge/AFK.ts
import { system as system7, world as world6 } from "@minecraft/server";
function cacheGet(player, key, fallback) {
  const pc = afkCache.get(player.id);
  if (!pc || !pc.has(key)) return fallback;
  return pc.get(key);
}
function cacheSet(player, key, value) {
  let pc = afkCache.get(player.id);
  if (!pc) {
    pc = /* @__PURE__ */ new Map();
    afkCache.set(player.id, pc);
  }
  pc.set(key, value);
}
function cacheDelete(player, key) {
  const pc = afkCache.get(player.id);
  if (pc) pc.delete(key);
}
function reset(player) {
  debug.i("AFK", `reset: player=${player.name}`);
  cacheDelete(player, "afk:last_location");
  cacheDelete(player, "afk:step");
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
function setAFK(player) {
  debug.i("AFK", `setAFK: player=${player.name}`);
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world6.sendMessage(`\xA77* ${player.nameTag} is now AFK. *`);
  cacheSet(player, "afk:step", 0);
  player.addTag("AFK");
}
function locationMoved(lastLocation, nowLocation) {
  let deltaX = lastLocation.x - nowLocation.x;
  if (-1 < deltaX && deltaX < 1) {
    let deltaY = lastLocation.y - nowLocation.y;
    if (-1 < deltaY && deltaY < 1) {
      let deltaZ = lastLocation.z - nowLocation.z;
      if (-1 < deltaZ && deltaZ < 1) {
        return false;
      }
    }
  }
  return true;
}
function startScan() {
  if (scanActive || scanRunId !== void 0) return;
  scanActive = true;
  scanRunId = system7.runInterval(() => {
    for (let player of world6.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
      let lastLoaction = cacheGet(
        player,
        "afk:last_location",
        void 0
      );
      let nowLocation = player.location;
      if (lastLoaction !== void 0) {
        let nowStep = cacheGet(player, "afk:step", void 0);
        if (!locationMoved(lastLoaction, nowLocation)) {
          if (nowStep === void 0) {
            nowStep = 1;
          } else {
            nowStep++;
          }
          if (nowStep * STEP_TIME >= ConfigManager.getSetting("afk_time", 120)) {
            setAFK(player);
          } else {
            cacheSet(player, "afk:step", nowStep);
          }
        } else {
          cacheSet(player, "afk:step", 0);
        }
      }
      cacheSet(player, "afk:last_location", nowLocation);
    }
  }, STEP_TIME * 20);
}
function startAFKScan() {
  if (intervalId !== void 0) {
    return;
  }
  intervalId = system7.runInterval(() => {
    let count = 0;
    for (let id in playerList) {
      let player = world6.getEntity(id);
      if (player === void 0) {
        delete playerList[id];
      } else {
        if (locationMoved(playerList[id], player.location)) {
          world6.sendMessage(`\xA77* ${player.nameTag} is no longer AFK. *`);
          player.removeTag("AFK");
          cacheSet(player, "afk:last_location", player.location);
          cacheSet(player, "afk:step", 0);
          delete playerList[id];
        } else {
          count++;
        }
      }
    }
    if (count === 0) {
      stopAFKScan();
    }
  }, 100);
}
function stopAFKScan() {
  if (intervalId !== void 0) {
    try {
      system7.clearRun(intervalId);
    } catch {
    }
    intervalId = void 0;
  }
}
function stop() {
  debug.i("AFK", "stop");
  if (scanRunId !== void 0) {
    try {
      system7.clearRun(scanRunId);
    } catch {
    }
    scanRunId = void 0;
  }
  scanActive = false;
  stopAFKScan();
  playerList = {};
}
function registerPermissions() {
  Permission.register("afk.use", Permission.Member);
  Permission.register("afk.clear.other", Permission.OP);
}
function registerEvents() {
  world6.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) reset(event.player);
  });
}
function init() {
  debug.i("AFK", "init");
  console.log(`Initializing AFK...`);
  if (!scanActive) startScan();
  for (let player of world6.getAllPlayers()) {
    reset(player);
  }
  console.log(`AFK initialized successfully.`);
}
function registerCommand() {
  debug.i("AFK", "registerCommand");
  Command.register("afk", "afk.use", setAFK, "\u8FDB\u5165AFK\u72B6\u6001", "afk");
  Command.register(
    "noafk",
    "afk.clear.other",
    (pl) => {
      if (pl) pl.addTag("NOAFK");
    },
    "\u4EE4\u73A9\u5BB6\u4E0D\u4F1A\u8FDB\u5165AFK\u72B6\u6001",
    "afk"
  );
}
var afkCache, STEP_TIME, scanRunId, scanActive, intervalId, playerList;
var init_AFK = __esm({
  "scripts/doge/AFK.ts"() {
    "use strict";
    init_Command();
    init_ConfigManager();
    init_DebugLog();
    init_Permission();
    afkCache = /* @__PURE__ */ new Map();
    STEP_TIME = 15;
    scanActive = false;
    intervalId = void 0;
    playerList = {};
  }
});

// scripts/doge/ChatSoundsHelper.ts
import { system as system8, world as world7 } from "@minecraft/server";
var KEYWORDS, ChatSoundsHelper;
var init_ChatSoundsHelper = __esm({
  "scripts/doge/ChatSoundsHelper.ts"() {
    "use strict";
    KEYWORDS = {
      ciallo: "cs.ciallo",
      \u5495\u5495\u560E\u560E: "cs.gugugaga",
      \u6C69\u6C69\u5495: "cs.gugugu",
      baka: "cs.baka",
      yee: "cs.yee",
      \u5E72\u561B: "mob.chicken.hurt",
      huh: "cs.huh"
    };
    ChatSoundsHelper = class _ChatSoundsHelper {
      constructor(keywords) {
        this.cooldownTicks = 200;
        this.cooldownMap = {};
        this.chatSub = void 0;
        this.keywords = keywords;
      }
      static getInstance() {
        if (!_ChatSoundsHelper.instance) {
          _ChatSoundsHelper.instance = new _ChatSoundsHelper(KEYWORDS);
        }
        return _ChatSoundsHelper.instance;
      }
      registerEvent() {
        if (this.chatSub) return;
        this.chatSub = world7.beforeEvents.chatSend.subscribe((event) => {
          const msg = event.message;
          for (const keyWord in this.keywords) {
            if (!msg.toLowerCase().includes(keyWord.toLowerCase())) continue;
            const sender = event.sender;
            if (sender.getGameMode() !== "Creative") {
              const id = sender.id;
              if (this.cooldownMap[id]) return;
              this.cooldownMap[id] = true;
              system8.runTimeout(() => {
                delete this.cooldownMap[id];
              }, this.cooldownTicks);
            }
            const soundId = this.keywords[keyWord];
            system8.run(() => {
              for (const p of world7.getAllPlayers()) {
                try {
                  p.playSound(soundId);
                } catch {
                }
              }
            });
            return;
          }
        });
      }
      stop() {
        if (this.chatSub?.unsubscribe) {
          try {
            this.chatSub.unsubscribe();
          } catch {
          }
        }
        this.chatSub = void 0;
      }
    };
  }
});

// scripts/doge/Clean.ts
import { BlockComponentTypes as BlockComponentTypes2, system as system9, world as world8 } from "@minecraft/server";
function registerCommand2() {
  Permission.register("clean.admin", Permission.OP);
  Command.register(
    "clean",
    "clean.admin",
    () => {
      Clean.getInstance().startClean(void 0);
    },
    "\u5F00\u59CB\u626B\u5730",
    "clean"
  );
}
var _Clean, Clean;
var init_Clean = __esm({
  "scripts/doge/Clean.ts"() {
    "use strict";
    init_Command();
    init_ConfigManager();
    init_DebugLog();
    init_Permission();
    init_Tools();
    _Clean = class _Clean {
      constructor() {
        this.startPoint = [0, 0, 0];
        this.size = [5, 5];
        this.direction = -1;
        // 箱子的朝向
        this.killList = [];
        this.face = -1;
        this.intervalId = void 0;
        this.itemMax = 128;
        this.timeout = 60;
      }
      static getInstance() {
        if (!_Clean._instance) {
          this._instance = new _Clean();
        }
        return this._instance;
      }
      init() {
        debug.i("CLEAN", "Clean.init");
        const cleanCfg = ConfigManager.getClean();
        const recycleBin = ConfigManager.getGrid("clean_recycle_bin");
        if (recycleBin) {
          this.startPoint = [recycleBin.start[0], recycleBin.start[1], recycleBin.start[2]];
          this.size = [recycleBin.size[0], recycleBin.size[1]];
          this.direction = recycleBin.direction;
          this.face = recycleBin.face;
        }
        this.killList = JSON.parse(ConfigManager.getSetting("clean_kill_list", "[]"));
        this.itemMax = cleanCfg.itemMax;
        this.timeout = cleanCfg.pollInterval;
        this.startCleanInterval();
      }
      getCleanIndex() {
        return _Clean.cleanIndex;
      }
      setCleanIndex(index) {
        _Clean.cleanIndex = index;
      }
      /**
       * 将物品放入箱子
       * @param itemProvider 物品给予函数，函数会返回物品的ItemStack，当返回undefined时说明任务结束此时会退出
       * @param isFirstCall 是否是首次调用，如果是，在一次循环后物品没有放完，会重置index，再进行一次循环直到放完
       */
      placeItem(itemProvider, isFirstCall = true) {
        let base = getBase(this.direction);
        let cardinalDirection = getChestCardinal(this.direction, this.face);
        let facingDirection = getSignFacing(this.direction, this.face);
        let index = 0;
        let currentIndex = this.getCleanIndex();
        const dimension = world8.getDimension("overworld");
        for (let mainAxis = 0; mainAxis < this.size[0]; mainAxis++) {
          for (let y = 0; y < this.size[1]; y++) {
            index++;
            if (index < currentIndex) {
              continue;
            }
            let coordinate = {
              x: this.startPoint[0] + mainAxis * base[0] * 2,
              y: this.startPoint[1] + y,
              z: this.startPoint[2] + mainAxis * base[1] * 2
            };
            let coordinate2 = {
              x: coordinate.x + base[0],
              y: coordinate.y,
              z: coordinate.z + base[1]
            };
            let block = dimension.getBlock(coordinate);
            let block2 = dimension.getBlock(coordinate2);
            ensureDoubleChest(dimension, coordinate, cardinalDirection, this.direction);
            let inventory = block.getComponent(BlockComponentTypes2.Inventory);
            if (!inventory || !inventory.container) {
              continue;
            }
            let container = inventory.container;
            if (container.emptySlotsCount === 0) {
              container.clearAll();
            }
            while (container.emptySlotsCount > 0) {
              let item = itemProvider();
              if (!item) {
                return;
              }
              container.addItem(item);
            }
            this.setCleanIndex(index + 1);
            let signCoordinate = {
              x: coordinate2.x + (base[0] !== 0 ? 0 : this.face),
              y: coordinate2.y,
              z: coordinate2.z + (base[1] !== 0 ? 0 : this.face)
            };
            placeSign(dimension, signCoordinate, facingDirection, this.getTimeStr());
          }
        }
        this.setCleanIndex(0);
        if (isFirstCall) {
          this.placeItem(itemProvider, false);
        }
      }
      /**
       * 开始清理
       */
      startClean(entities) {
        debug.i("CLEAN", `startClean: entityCount=${entities?.length || "all"}`);
        let itemEntities = entities ?? this.getAllItemEntities();
        this.placeItem(() => {
          while (itemEntities.length > 0) {
            let itemEntity = itemEntities.pop();
            let stack = itemEntity.getComponent("minecraft:item").itemStack;
            if (!stack) {
              continue;
            }
            if (this.killList.some((value) => value === stack.typeId)) {
              itemEntity.kill();
              continue;
            }
            itemEntity.kill();
            return stack;
          }
          return void 0;
        });
      }
      startCleanInterval() {
        debug.i("CLEAN", "startCleanInterval");
        if (this.intervalId) {
          system9.clearRun(this.intervalId);
          this.intervalId = void 0;
        }
        this.intervalId = system9.runInterval(() => {
          let entities = this.getAllItemEntities();
          if (entities.length > this.itemMax) {
            world8.sendMessage({ rawtext: [{ text: "\u300C\xA76\u8AAD\u7D4C\u3059\u308B\u30E4\u30DE\u30D3\u30B3 ~ \u5E7D\u8C37 \u97FF\u5B50\xA7f\u300D \u8DDD\u79BB\u6E05\u7406\u6389\u843D\u7269\u8FD8\u6709\xA7c 5 \xA7fs" }] });
            system9.runTimeout(() => {
              this.startClean(void 0);
              system9.runTimeout(() => {
                world8.sendMessage({ rawtext: [{ text: "\xA7a* \u5DF2\u6E05\u7406\u6389\u843D\u7269 *" }] });
              }, 5);
            }, 100);
          }
        }, this.timeout * 20);
      }
      stopCleanInterval() {
        debug.i("CLEAN", "stopCleanInterval");
        if (this.intervalId) {
          system9.clearRun(this.intervalId);
          this.intervalId = void 0;
        }
      }
      stop() {
        debug.i("CLEAN", "Clean.stop");
        this.stopCleanInterval();
      }
      /**
       * 获取世界的所有物品
       */
      getAllItemEntities() {
        let itemEntities = world8.getDimension("overworld").getEntities({ type: "item" });
        itemEntities.push(...world8.getDimension("nether").getEntities({ type: "item" }));
        itemEntities.push(...world8.getDimension("the_end").getEntities({ type: "item" }));
        return itemEntities;
      }
      getTimeStr() {
        const { date, time } = getShanghaiTime();
        return `
${date}
${time}`;
      }
    };
    _Clean._instance = void 0;
    _Clean.cleanIndex = 0;
    Clean = _Clean;
  }
});

// scripts/libs/MenuNavigator.ts
import { system as system10 } from "@minecraft/server";
import {
  CustomForm,
  DataDrivenScreenClosedReason,
  MessageBox,
  ObservableBoolean,
  ObservableNumber,
  ObservableString
} from "@minecraft/server-ui";
function obsStr(v = "") {
  return new ObservableString(v, { clientWritable: true });
}
function obsNum(v = 0) {
  return new ObservableNumber(v, { clientWritable: true });
}
function obsBool(v = false) {
  return new ObservableBoolean(v, { clientWritable: true });
}
var MenuNavigator, PageBuilder, FormStatus;
var init_MenuNavigator = __esm({
  "scripts/libs/MenuNavigator.ts"() {
    "use strict";
    init_Tools();
    MenuNavigator = class {
      constructor(player) {
        this.sections = /* @__PURE__ */ new Map();
        this.sectionVis = /* @__PURE__ */ new Map();
        this.history = [];
        this._onRootClose = null;
        this.form = null;
        this.titleObs = new ObservableString("");
        this.backVis = new ObservableBoolean(false);
        this.state = {};
        this._confirmIdx = 0;
        this.taskRunning = false;
        this.sessionToken = 0;
        this.player = player;
      }
      onRootClose(cb) {
        this._onRootClose = cb;
      }
      section(id, title, build) {
        this.sections.set(id, { title, build });
        this.sectionVis.set(id, new ObservableBoolean(false));
        return this;
      }
      async start(sectionId) {
        const token = ++this.sessionToken;
        this.history = [sectionId];
        this.applySection(sectionId);
        this.backVis.setData(false);
        await this.buildAndShow(token);
      }
      async rebuild(targetSection) {
        const token = ++this.sessionToken;
        if (this.form?.isShowing()) this.form.close();
        if (targetSection) {
          this.history.push(targetSection);
          this.applySection(targetSection);
        }
        await this.buildAndShow(token);
      }
      async refresh() {
        await this.rebuild();
      }
      async replace(targetSection) {
        const token = ++this.sessionToken;
        if (this.history.length > 0) this.history[this.history.length - 1] = targetSection;
        else this.history = [targetSection];
        this.applySection(targetSection);
        await this.buildAndShow(token);
      }
      async runTask(status, task, onError = "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002") {
        if (this.taskRunning) return;
        this.taskRunning = true;
        status.info("\u6B63\u5728\u5904\u7406\uFF0C\u8BF7\u7A0D\u5019...");
        try {
          await task();
        } catch (error) {
          console.warn(`[MenuNavigator] task failed: ${error.message || error}`);
          const message = error instanceof Error && error.message ? error.message : onError;
          status.fail(message);
        } finally {
          this.taskRunning = false;
        }
      }
      async confirmMessage(title, body, confirm = "\u786E\u8BA4", cancel = "\u53D6\u6D88") {
        if (this.form?.isShowing()) this.form.close();
        const box = new MessageBox(this.player, title);
        box.body(body).button1(confirm).button2(cancel);
        for (let i = 0; i < 20; i++) {
          try {
            const result = await box.show();
            if (result.closeReason === DataDrivenScreenClosedReason.UserBusy) {
              await system10.waitTicks(10);
              continue;
            }
            return result.closeReason === DataDrivenScreenClosedReason.ClientClosed && result.selection === 0;
          } catch {
            await system10.waitTicks(2);
          }
        }
        return false;
      }
      go(sectionId) {
        this.history.push(sectionId);
        this.applySection(sectionId);
      }
      back() {
        if (this.history.length <= 1) return;
        this.history.pop();
        this.applySection(this.history[this.history.length - 1]);
      }
      leave(target) {
        this.sessionToken++;
        if (this.form?.isShowing()) this.form.close();
        target();
      }
      async confirm(title, body, onConfirm, afterConfirm, onCancel) {
        const confirmId = `_cf${this._confirmIdx++}`;
        this.section(confirmId, title, (page) => {
          page.label(body);
          page.button("\xA7a\u786E\u8BA4", () => {
            onConfirm?.();
            afterConfirm?.();
          });
          page.button("\xA77\u53D6\u6D88", () => {
            onCancel?.();
          });
        });
        await this.rebuild(confirmId);
      }
      async message(title, body) {
        const formWasOpen = this.form?.isShowing() ?? false;
        if (formWasOpen) this.form.close();
        const box = new MessageBox(this.player, title);
        box.body(body);
        box.button1("\xA7a\u786E\u5B9A");
        box.button2("\xA7c\u5173\u95ED");
        let result;
        for (let i = 0; i < 20; i++) {
          try {
            result = await box.show();
            break;
          } catch {
            await system10.waitTicks(10);
          }
        }
        if (formWasOpen && result?.selection === 0) {
          await this.rebuild();
        }
      }
      async buildAndShow(token = this.sessionToken) {
        if (token !== this.sessionToken) return;
        if (this.form?.isShowing()) this.form.close();
        this.form = new CustomForm(this.player, this.titleObs);
        this.form.button("\xA7l\u2190 \u56DE\u5230\u4E0A\u4E00\u7EA7", () => this.back(), { visible: this.backVis });
        for (const [id, def] of this.sections) {
          if (token !== this.sessionToken) return;
          const vis = this.sectionVis.get(id);
          const page = new PageBuilder(this.form, vis);
          await def.build(page, this);
        }
        this.form.closeButton();
        const startTick = system10.currentTick;
        let notified = false;
        while (true) {
          if (system10.currentTick - startTick >= 160) {
            if (notified) Msg.warning("\u83DC\u5355\u5904\u7406\u8D85\u65F6\uFF088\u79D2\uFF09\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u3002", this.player);
            break;
          }
          try {
            const reason = await this.form.show();
            if (token !== this.sessionToken) return;
            if (reason === DataDrivenScreenClosedReason.UserBusy) {
              if (!notified) {
                notified = true;
                Msg.info("\u60A8\u6709\u4E00\u5219\u83DC\u5355\u5904\u7406\uFF0C\u8BF7\u5173\u95ED\u5F53\u524D\u754C\u9762\u540E\u663E\u793A\u3002\xA77\uFF08\u8D85\u65F68\u79D2\uFF09", this.player);
              }
              await system10.waitTicks(10);
              continue;
            }
            break;
          } catch {
            break;
          }
        }
      }
      applySection(sectionId) {
        for (const [id, vis] of this.sectionVis) vis.setData(id === sectionId);
        this.backVis.setData(this.history.length > 1);
        this.updateTitle();
      }
      updateTitle() {
        const parts = this.history.map((id) => this.sections.get(id)?.title ?? id).filter(Boolean);
        this.titleObs.setData(parts.join(" > "));
      }
    };
    PageBuilder = class {
      constructor(form, visible) {
        this.form = form;
        this.visible = visible;
      }
      button(l, onClick, opts) {
        this.form.button(l, onClick, { ...opts, visible: this.visible });
        return this;
      }
      label(t) {
        this.form.label(t, { visible: this.visible });
        return this;
      }
      textField(l, t, o) {
        this.form.textField(l, t, { ...o, visible: this.visible });
        return this;
      }
      toggle(l, t, o) {
        this.form.toggle(l, t, { ...o, visible: this.visible });
        return this;
      }
      dropdown(l, v, items, o) {
        this.form.dropdown(l, v, items, { ...o, visible: this.visible });
        return this;
      }
      slider(l, v, min, max, o) {
        this.form.slider(l, v, min, max, { ...o, visible: this.visible });
        return this;
      }
      divider() {
        this.form.divider({ visible: this.visible });
        return this;
      }
      header(t) {
        this.form.header(t, { visible: this.visible });
        return this;
      }
    };
    FormStatus = class {
      constructor(page) {
        this.text = obsStr("");
        page.label(this.text);
      }
      ok(msg) {
        this.text.setData("\xA7a\u2714 " + msg);
      }
      fail(msg) {
        this.text.setData("\xA7c\u2718 " + msg);
      }
      info(msg) {
        this.text.setData("\xA77" + msg);
      }
      clear() {
        this.text.setData("");
      }
    };
  }
});

// scripts/doge/DailyTask.ts
var DailyTask;
var init_DailyTask = __esm({
  "scripts/doge/DailyTask.ts"() {
    "use strict";
    init_EconomyApi();
    init_Command();
    init_DebugLog();
    init_MenuNavigator();
    init_Money();
    init_Permission();
    init_Tools();
    DailyTask = class _DailyTask {
      static registerCommand() {
        debug.i("TASK", "DailyTask.registerCommand");
        Permission.register("dailytask.use", Permission.Member);
        Command.register(
          "task",
          "dailytask.use",
          (player) => {
            if (!player) return;
            new _DailyTask().show(player);
          },
          "\u6BCF\u65E5\u4EFB\u52A1",
          "task"
        );
      }
      show(player) {
        debug.i("TASK", `DailyTask.show: player=${player.name}`);
        const nav = new MenuNavigator(player);
        nav.section("main", "\u6BCF\u65E5\u4EFB\u52A1", async (page) => {
          const status = new FormStatus(page);
          page.label(ListFormInfo(["\u5B8C\u6210\u6BCF\u65E5\u4EFB\u52A1\u83B7\u5F97\u8282\u64CD\u5956\u52B1\uFF01"]));
          page.button("\u5237\u65B0\u4EFB\u52A1\u5217\u8868", () => nav.rebuild("main"));
          const result = await getDailyTasks();
          const tasks = result?.tasks || [];
          if (tasks.length === 0) {
            page.label("\xA77\u5F53\u524D\u6CA1\u6709\u53EF\u7528\u4EFB\u52A1\u3002");
          } else {
            for (const t of tasks) {
              const remaining = t.target_qty - t.filled_qty;
              if (remaining <= 0) continue;
              page.button(`${t.item_type}
\u8FDB\u5EA6: ${t.filled_qty}/${t.target_qty}  \u5956\u52B1: ${t.unit_reward}\xA7r/\u4E2A`, () => {
                nav.state.taskId = t.id;
                nav.state.taskItemType = t.item_type;
                nav.state.taskItemAux = t.item_aux || 0;
                nav.state.maxQty = remaining;
                nav.state.unitReward = t.unit_reward;
                nav.go("submit");
              });
            }
          }
        });
        nav.section("submit", "\u63D0\u4EA4\u4EFB\u52A1\u7269\u54C1", (page) => {
          const status = new FormStatus(page);
          const taskId = nav.state.taskId;
          const maxQty = nav.state.maxQty;
          const unitReward = nav.state.unitReward;
          const itemType = nav.state.taskItemType;
          if (!taskId || maxQty <= 0) {
            page.label("\u4EFB\u52A1\u6570\u636E\u4E22\u5931\u3002");
            return;
          }
          const obsQty = obsNum(Math.min(1, maxQty));
          page.label(`\u7269\u54C1: ${itemType}
\u53EF\u63D0\u4EA4: ${maxQty}\u4E2A
\u5956\u52B1: ${unitReward} \xA7r/\u4E2A`);
          page.slider("\u6570\u91CF", obsQty, 1, maxQty, { step: 1 });
          page.button("\u63D0\u4EA4", async () => {
            const qty = obsQty.getData();
            if (qty <= 0 || qty > maxQty) {
              status.fail("\u6570\u91CF\u65E0\u6548");
              return;
            }
            try {
              player.runCommand(`clear "${player.name}" ${itemType} ${nav.state.taskItemAux || 0} ${qty}`);
            } catch {
              status.fail("\u4ECE\u80CC\u5305\u6263\u9664\u7269\u54C1\u5931\u8D25\u3002");
              return;
            }
            const result = await submitDailyTask(taskId, player.id, player.name, qty);
            if (!result.ok) {
              try {
                player.runCommand(`give "${player.name}" ${itemType} ${qty} ${nav.state.taskItemAux || 0}`);
              } catch {
              }
              status.fail(result.error || "\u63D0\u4EA4\u5931\u8D25\uFF0C\u7269\u54C1\u5DF2\u8FD4\u8FD8\u3002");
              return;
            }
            if (result.balance !== void 0) Money.setCached(player, result.balance, result.balanceVersion);
            status.ok(`\u63D0\u4EA4\u6210\u529F\uFF01\u83B7\u5F97 ${result.reward} ${Money.UNIT}`);
            nav.rebuild("main");
          });
        });
        nav.start("main");
      }
    };
  }
});

// scripts/doge/TPS.ts
import { system as system11, world as world9 } from "@minecraft/server";
var _TPS, TPS;
var init_TPS = __esm({
  "scripts/doge/TPS.ts"() {
    "use strict";
    init_Command();
    init_DebugLog();
    init_Permission();
    init_Tools();
    _TPS = class _TPS {
      static getTPS() {
        if (_TPS.tickTimes.length < 10) return 20;
        const elapsed = (_TPS.tickTimes[_TPS.tickTimes.length - 1] - _TPS.tickTimes[0]) / 1e3;
        const tickCount = _TPS.tickTimes.length - 1;
        const tps = tickCount / elapsed;
        return Math.round(Math.min(tps, 20) * 100) / 100;
      }
      static getTPSStatus() {
        const tps = this.getTPS();
        let color;
        if (tps >= 19.5) color = "\xA7a";
        else if (tps >= 15) color = "\xA7e";
        else if (tps >= 10) color = "\xA76";
        else color = "\xA7c";
        return `\xA77[TPS] ${color}${tps} \xA77/ 20.00`;
      }
      static init() {
        debug.i("TPS", "init");
        this.startRecord();
      }
      static startRecord() {
        this.recordRunId = system11.runInterval(() => {
          _TPS.tickTimes.push(Date.now());
          if (_TPS.tickTimes.length > _TPS.MAX_SAMPLES) {
            _TPS.tickTimes.shift();
          }
        }, 1);
      }
      static stop() {
        debug.i("TPS", "stop");
        if (this.recordRunId !== void 0) {
          try {
            system11.clearRun(this.recordRunId);
          } catch {
          }
          this.recordRunId = void 0;
        }
      }
      static registerPermissions() {
        Permission.register("tps.see", Permission.Any);
      }
      static registerCommands() {
        debug.i("TPS", "registerCommands");
        Command.register(
          "tps",
          "tps.see",
          (player) => {
            const msg = this.getTPSStatus();
            if (player) {
              Msg.info(msg, player);
            } else {
              world9.sendMessage(msg);
            }
          },
          "\u67E5\u770B\u670D\u52A1\u5668 TPS",
          "tps"
        );
      }
    };
    _TPS.tickTimes = [];
    _TPS.MAX_SAMPLES = 100;
    TPS = _TPS;
  }
});

// scripts/doge/MonitorReporter.ts
import { system as system12, world as world10 } from "@minecraft/server";
var REPORT_INTERVAL, DIMENSIONS, MonitorReporter;
var init_MonitorReporter = __esm({
  "scripts/doge/MonitorReporter.ts"() {
    "use strict";
    init_HttpDB();
    init_TPS();
    REPORT_INTERVAL = 600;
    DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
    MonitorReporter = class {
      static init() {
        if (this.runId !== void 0) return;
        this.runId = system12.runInterval(() => {
          this.report();
        }, REPORT_INTERVAL);
      }
      static stop() {
        if (this.runId !== void 0) {
          try {
            system12.clearRun(this.runId);
          } catch {
          }
          this.runId = void 0;
        }
      }
      static async report() {
        try {
          const tps = TPS.getTPS();
          const entities = {};
          for (const dim of DIMENSIONS) {
            try {
              entities[dim] = world10.getDimension(dim).getEntities().length;
            } catch (e) {
              entities[dim] = 0;
            }
          }
          await HttpDB.post("/api/sfmc/monitor/metrics", { tps, entities });
          const players = world10.getAllPlayers();
          const playerChunks = players.map((p) => {
            const loc2 = p.location;
            const dim = p.dimension?.id || "minecraft:overworld";
            const rd = p.clientSystemInfo?.maxRenderDistance || 8;
            const chunkX = Math.floor(loc2.x / 16);
            const chunkZ = Math.floor(loc2.z / 16);
            const side = rd + 1;
            const estimate = (1 + side) * (1 + side);
            return {
              id: p.id,
              name: p.name,
              dimension: dim,
              pos: { x: Math.round(loc2.x), z: Math.round(loc2.z) },
              renderDistance: rd,
              chunkEstimate: estimate
            };
          });
          await HttpDB.post("/api/sfmc/monitor/player-chunks", { players: playerChunks });
        } catch (e) {
        }
      }
    };
  }
});

// scripts/doge/OnlineTime.ts
import { system as system13, world as world11 } from "@minecraft/server";
var FLUSH_INTERVAL_TICKS, OnlineTime;
var init_OnlineTime = __esm({
  "scripts/doge/OnlineTime.ts"() {
    "use strict";
    init_Command();
    init_DebugLog();
    init_HttpDB();
    init_Permission();
    init_Tools();
    FLUSH_INTERVAL_TICKS = 1200;
    OnlineTime = class _OnlineTime {
      constructor() {
        this.dataMap = /* @__PURE__ */ new Map();
        this.loading = /* @__PURE__ */ new Map();
        this.playerLeaveSub = void 0;
        this.flushInFlight = false;
      }
      static getInstance() {
        if (!_OnlineTime._instance) {
          _OnlineTime._instance = new _OnlineTime();
        }
        return _OnlineTime._instance;
      }
      registerCommandsAndPermissions() {
        debug.i("ONLINE", "registerCommandsAndPermissions");
        Permission.register("onlinetime.see", Permission.Any);
        Command.register(
          "onlinetime",
          "onlinetime.see",
          async (player) => {
            if (!player) {
              world11.sendMessage("\xA7c\u8BE5\u6307\u4EE4\u5FC5\u987B\u7531\u73A9\u5BB6\u6267\u884C\u3002");
              return;
            }
            const data = await this.load(player);
            Msg.info(
              `\u73A9\u5BB6 \xA7a${player.name}\xA7r \u7684\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1:
\xA7e\u672C\u6B21\u5728\u7EBF \xA7f${this.formatTime(data.session)}
\xA7e\u4ECA\u65E5\u5728\u7EBF \xA7f${this.formatTime(data.today)}
\xA7e\u672C\u6708\u5728\u7EBF \xA7f${this.formatTime(data.month)}
\xA7e\u603B\u5728\u7EBF \xA7f${this.formatTime(data.total)}
`,
              player
            );
          },
          "\u67E5\u770B\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1",
          "onlineTime"
        );
      }
      registerEvents() {
        debug.i("ONLINE", "registerEvents");
        if (this.playerLeaveSub) return;
        this.playerLeaveSub = world11.afterEvents.playerSpawn.subscribe((event) => {
          if (event.initialSpawn) {
            this.onPlayerJoin(event.player);
          }
        });
      }
      init() {
        debug.i("ONLINE", "init");
        this.startTick();
        this.flushRunId = system13.runInterval(() => this.flushAll(), FLUSH_INTERVAL_TICKS);
      }
      formatTime(seconds) {
        const d = Math.floor(seconds / 86400);
        const h = Math.floor(seconds % 86400 / 3600);
        const m = Math.floor(seconds % 3600 / 60);
        const s = seconds % 60;
        const parts = [];
        if (d > 0) parts.push(`${d}\u5929`);
        if (h > 0) parts.push(`${h}\u65F6`);
        if (m > 0) parts.push(`${m}\u5206`);
        parts.push(`${s}\u79D2`);
        return parts.join("");
      }
      load(player) {
        const existing = this.dataMap.get(player.id);
        if (existing) return Promise.resolve(existing);
        const pending = this.loading.get(player.id);
        if (pending) return pending;
        const promise = (async () => {
          const raw = await HttpDB.fetchJSON("/api/sfmc/players", player.id, "player");
          const def = (val, fallback) => typeof val === "number" ? val : fallback;
          const data = {
            session: 0,
            today: def(raw?.onlinetime_today, 0),
            month: def(raw?.onlinetime_month, 0),
            total: def(raw?.onlinetime_total, 0),
            lastDate: def(raw?.onlinetime_last_date, (/* @__PURE__ */ new Date()).getDate()),
            lastMonth: def(raw?.onlinetime_last_month, (/* @__PURE__ */ new Date()).getMonth())
          };
          this.dataMap.set(player.id, data);
          return data;
        })();
        this.loading.set(player.id, promise);
        promise.finally(() => this.loading.delete(player.id));
        return promise;
      }
      async persist(playerId2, data) {
        await HttpDB.patch(`/api/sfmc/players/${playerId2}`, {
          player: {
            onlinetimeToday: data.today,
            onlinetimeMonth: data.month,
            onlinetimeTotal: data.total,
            onlinetimeLastDate: data.lastDate,
            onlinetimeLastMonth: data.lastMonth
          }
        }).catch(() => {
        });
      }
      onPlayerJoin(player) {
        debug.i("ONLINE", `onPlayerJoin: player=${player.name}`);
        this.load(player);
      }
      async onPlayerLeave(player) {
        const playerId2 = player.id;
        debug.i("ONLINE", `onPlayerLeave: playerId=${playerId2}`);
        const data = this.dataMap.get(playerId2);
        if (data) {
          await this.persist(playerId2, data);
          this.dataMap.delete(playerId2);
        }
      }
      tickSecond() {
        const now = /* @__PURE__ */ new Date();
        const currentDate = now.getDate();
        const currentMonth = now.getMonth();
        for (const player of world11.getAllPlayers()) {
          const data = this.dataMap.get(player.id);
          if (!data) {
            if (!this.loading.has(player.id)) {
              this.load(player);
            }
            continue;
          }
          if (data.lastDate !== currentDate) {
            data.today = 0;
            data.lastDate = currentDate;
          }
          if (data.lastMonth !== currentMonth) {
            data.month = 0;
            data.lastMonth = currentMonth;
          }
          data.session++;
          data.today++;
          data.month++;
          data.total++;
        }
      }
      async flushAll() {
        if (this.flushInFlight) return;
        this.flushInFlight = true;
        try {
          await Promise.all([...this.dataMap.entries()].map(([id, data]) => this.persist(id, data)));
        } finally {
          this.flushInFlight = false;
        }
      }
      startTick() {
        this.tickRunId = system13.runInterval(() => {
          this.tickSecond();
        }, 20);
      }
      stop() {
        debug.i("ONLINE", "stop");
        if (this.tickRunId !== void 0) {
          try {
            system13.clearRun(this.tickRunId);
          } catch {
          }
          this.tickRunId = void 0;
        }
        if (this.flushRunId !== void 0) {
          try {
            system13.clearRun(this.flushRunId);
          } catch {
          }
          this.flushRunId = void 0;
        }
        if (this.playerLeaveSub?.unsubscribe) {
          try {
            this.playerLeaveSub.unsubscribe();
          } catch {
          }
          this.playerLeaveSub = void 0;
        }
        void this.flushAll();
      }
    };
  }
});

// scripts/doge/QA.ts
import { system as system14, world as world12 } from "@minecraft/server";
var QAManager;
var init_QA = __esm({
  "scripts/doge/QA.ts"() {
    "use strict";
    init_ConfigManager();
    init_DebugLog();
    init_Money();
    init_Tools();
    QAManager = class _QAManager {
      constructor() {
        // 记录玩家答题信息
        this.nowQuestion = void 0;
        this.playerList = {};
        this.rightAmount = 0;
        this.wrongAmount = 0;
        this.timeoutId = void 0;
        this.finishTimeoutId = void 0;
        this.chatSub = void 0;
        // 出题记录，避免短时间重复出题
        this.record = [];
        // 最近出的几个题
        this.recordPtr = 0;
        // 下一个记录写入的位置
        this.recordLimit = Math.max(0, Math.floor(ConfigManager.getQuestions().length - 2));
      }
      /**
       * @returns {QAManager}
       */
      static getInstance() {
        if (_QAManager._instance === void 0) {
          _QAManager._instance = new _QAManager();
        }
        return _QAManager._instance;
      }
      /**
       * 开始答题循环
       */
      start() {
        debug.i("QA", "start");
        if (this.chatSub) return;
        this.chatSub = world12.beforeEvents.chatSend.subscribe((event) => {
          if (event.message.substring(0, 1) === "!" || event.message.substring(0, 1) === "\uFF01") {
            let answer = event.message.substring(1);
            answer = answer.replaceAll(" ");
            if (this.nowQuestion !== void 0) {
              this.answer(event.sender, answer);
              event.cancel = true;
              return;
            }
          }
        });
        this.timeoutId = system14.runTimeout(() => {
          this.nextQuestion();
        }, _QAManager.getNextTimeout());
      }
      stop() {
        debug.i("QA", "stop");
        try {
          if (this.chatSub && typeof this.chatSub.unsubscribe === "function") this.chatSub.unsubscribe();
        } catch {
        }
        this.chatSub = void 0;
        if (this.timeoutId !== void 0) {
          try {
            system14.clearRun(this.timeoutId);
          } catch {
          }
          this.timeoutId = void 0;
        }
        if (this.finishTimeoutId !== void 0) {
          try {
            system14.clearRun(this.finishTimeoutId);
          } catch {
          }
          this.finishTimeoutId = void 0;
        }
        this.nowQuestion = void 0;
      }
      // 下一个问题
      nextQuestion() {
        debug.i("QA", `nextQuestion: current=${this.nowQuestion}`);
        const questions = ConfigManager.getQuestions();
        this.recordLimit = Math.max(0, questions.length - 2);
        if (questions.length === 0) {
          console.warn("[QA] \u6CA1\u6709\u53EF\u7528\u9898\u76EE\uFF0C\u7A0D\u540E\u91CD\u8BD5");
          this.timeoutId = system14.runTimeout(() => this.nextQuestion(), 20 * 60);
          return;
        }
        let questionList = [];
        let totalWeight = 0;
        let startPoints = [];
        for (let i = 0; i < questions.length; i++) {
          if (!this.record.includes(i)) {
            questionList.push(i);
            totalWeight += ConfigManager.getQuestions()[i].weight;
            startPoints.push(totalWeight);
          }
        }
        if (questionList.length === 0 || totalWeight <= 0) {
          this.record = [];
          this.recordPtr = 0;
          this.timeoutId = system14.runTimeout(() => this.nextQuestion(), 20 * 60);
          return;
        }
        let randomNum = getRandomInteger(0, totalWeight - 1);
        for (let i = 0; i < startPoints.length; i++) {
          if (randomNum < startPoints[i]) {
            this.nowQuestion = questionList[i];
            this.pushRecord(this.nowQuestion);
            break;
          }
        }
        world12.sendMessage(
          `\xA7b[Baka Cirno]\xA7r \xA7g${ConfigManager.getQuestions()[this.nowQuestion].q}\xA7r
  \xA7h\u53D1\u9001 \xA7e!\u7B54\u6848\xA7r \xA7h\u6765\u7B54\u9898`
        );
        this.finishTimeoutId = system14.runTimeout(
          () => {
            this.finishTimeoutId = void 0;
            this.finish();
          },
          ConfigManager.getSetting("qa_timeout", 60) * 20
        );
      }
      // 结束答题，揭晓答案
      finish() {
        debug.i("QA", "finish");
        if (this.nowQuestion === void 0) return;
        let question = ConfigManager.getQuestions()[this.nowQuestion];
        world12.sendMessage(
          `\xA7b[Baka Cirno]\xA7r \u6B63\u786E\u7B54\u6848\u662F \xA7e${question.a[0]}\xA7r ! ${question.d !== void 0 ? "\n  " + question.d : ""}`
        );
        this.nowQuestion = void 0;
        this.playerList = {};
        this.rightAmount = 0;
        this.wrongAmount = 0;
        this.timeoutId = system14.runTimeout(() => {
          this.timeoutId = void 0;
          this.nextQuestion();
        }, _QAManager.getNextTimeout());
      }
      /**
       * 玩家答题
       * @returns -2答题未在进行 -1玩家已答过题 0错误 1正确
       */
      answer(pl, str) {
        debug.i("QA", `answer: player=${pl.name} answer=${str}`);
        if (this.nowQuestion !== void 0) {
          if (this.playerList[pl.nameTag] === void 0) {
            let question = ConfigManager.getQuestions()[this.nowQuestion];
            for (let a of question.a) {
              if (str === a) {
                this.rightAmount++;
                this.playerList[pl.nameTag] = true;
                _QAManager.giveBonus(pl, this.rightAmount, question.bonus);
                if (question["msg_right"] !== void 0) {
                  Msg.tips(question["msg_right"], pl);
                } else {
                  Msg.success("\xA7a\u56DE\u7B54\u6B63\u786E\uFF01\xA7r", pl);
                }
                return 1;
              }
            }
            if (question["msg_wrong"] !== void 0) {
              Msg.tips(question["msg_wrong"], pl);
            } else {
              Msg.error("\xA7c\u56DE\u7B54\u9519\u8BEF\uFF01\xA7r", pl);
            }
            this.wrongAmount++;
            if (question.punish !== void 0) {
              _QAManager.giveBonus(pl, this.wrongAmount, question.punish);
            }
            this.playerList[pl.nameTag] = false;
            return 0;
          }
          Msg.tips("\u5DF2\u7ECF\u7B54\u8FC7\u8FD9\u9898\u4E86^ ^\xA7r", pl);
          return -1;
        }
        Msg.tips("\u5F53\u524D\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u7B54\u9898^ ^\xA7r", pl);
        return -2;
      }
      // 最大记录数量
      pushRecord(index) {
        this.record[this.recordPtr] = index;
        this.recordPtr = this.recordPtr < this.recordLimit ? this.recordPtr + 1 : 0;
      }
      // 距离下一个问题的时间(秒)
      static getNextTimeout() {
        let min = ConfigManager.getSetting("qa_interval_min", 600) * 20;
        let max = ConfigManager.getSetting("qa_interval_max", 720) * 20;
        if (max <= min) return min;
        return min + Math.floor(Math.random() * (max - min));
      }
      /**
       * 给予玩家奖励 也可以是惩罚，格式是一样的
       * @param pl 答题者
       * @param seq 顺序(从1开始)
       * @param bonus 奖励列表
       */
      static giveBonus(pl, seq, bonus) {
        if (!bonus) return;
        debug.i("QA", `giveBonus: player=${pl.name} seq=${seq} bonusCount=${bonus.length}`);
        for (let b of bonus) {
          if (b["seq"] === void 0 || b["seq"][0] <= seq && seq <= b["seq"][1]) {
            system14.run(async () => {
              switch (b["type"]) {
                case "money":
                  await Money.add(pl, b["amount"]);
                  break;
                case "item":
                  pl.runCommand(`give @s ${b["itemType"]} ${b["amount"]} ${b["data"] === void 0 ? "" : b["data"]}`);
                  break;
                case "cmd":
                  pl.runCommand(b["cmd"]);
                  break;
                default:
                  Msg.error(`Unknown bonus type: ${b["type"]}`, pl);
                  break;
              }
            });
          }
        }
      }
    };
  }
});

// scripts/doge/SpawnProtect.ts
import { world as world13 } from "@minecraft/server";
var SpawnProtect;
var init_SpawnProtect = __esm({
  "scripts/doge/SpawnProtect.ts"() {
    "use strict";
    SpawnProtect = class _SpawnProtect {
      static setProtect(player) {
        if (player.getEffect("minecraft:resistance") === void 0) {
          player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
        }
      }
      static registerEvents() {
        world13.afterEvents.playerSpawn.subscribe((event) => {
          _SpawnProtect.setProtect(event.player);
        });
      }
    };
  }
});

// scripts/EconomyReport.ts
import { system as system15, world as world14 } from "@minecraft/server";
var EconomyReport;
var init_EconomyReport = __esm({
  "scripts/EconomyReport.ts"() {
    "use strict";
    init_HttpDB();
    init_Money();
    EconomyReport = class {
      static start() {
        const now = /* @__PURE__ */ new Date();
        const msUntilNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 8, 0, 0).getTime() - now.getTime();
        const delay = msUntilNextMonth > 0 ? msUntilNextMonth : 864e5;
        this.runId = system15.runTimeout(
          () => {
            this.publish();
            this.runId = system15.runInterval(() => this.publish(), 30 * 86400 * 20);
          },
          Math.ceil(delay / 50)
        );
      }
      static stop() {
        if (this.runId !== null) {
          system15.clearRun(this.runId);
          this.runId = null;
        }
      }
      static async publish() {
        const result = await HttpDB.typedRequest("Get", "/api/sfmc/economy/stats/monthly");
        if (!result.ok) return;
        const stats = result.data?.stats;
        if (!stats) return;
        const msg = [
          `\xA7e===== \u7ECF\u6D4E\u767D\u76AE\u4E66 (${stats.id}) =====`,
          `\xA77\u603B\u53D1\u884C\u91CF: \xA7f${stats.total_issued} ${Money.UNIT}`,
          `\xA77\u603B\u9500\u6BC1\u91CF: \xA7f${stats.total_destroyed} ${Money.UNIT}`,
          `\xA77\u603B\u6D41\u901A\u91CF: \xA7f${stats.total_supply} ${Money.UNIT}`,
          `\xA77\u6D3B\u8DC3\u8D26\u6237: \xA7f${stats.active_accounts}`,
          `\xA7e==============================`
        ].join("\n");
        world14.sendMessage(msg);
      }
    };
    EconomyReport.runId = null;
  }
});

// scripts/area/Fly.ts
import { GameMode as GameMode2, system as system16, world as world15 } from "@minecraft/server";
function registerPermissions2() {
  Permission.register("fly.use", Permission.Any);
}
function registerEvents2() {
  debug.i("FLY", "registerEvents");
  world15.afterEvents.playerSpawn.subscribe((event) => {
    if (event.initialSpawn) playerJoinEvent(event.player);
  });
}
function playerJoinEvent(player) {
  system16.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      enableFly(player);
      Msg.info(`\u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`, player);
      player.setDynamicProperty("hpbe:dogefly", areaName);
    }
  }, 60);
}
function startScan2() {
  if (scanRunId2 !== void 0) return;
  scanRunId2 = system16.runInterval(() => {
    for (let player of world15.getPlayers({ gameMode: GameMode2.Survival })) {
      let nowArea = player.getDynamicProperty("hpbe:dogefly");
      let areaName = inFlyArea(player);
      if (areaName !== void 0) {
        if (nowArea === void 0) {
          enableFly(player);
          Msg.info(`\u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`, player);
          player.setDynamicProperty("hpbe:dogefly", areaName);
        } else if (nowArea !== areaName) {
          player.setDynamicProperty("hpbe:dogefly", areaName);
        }
      } else {
        if (nowArea !== void 0) {
          disableFly(player);
          Msg.info(`\u79BB\u5F00\u98DE\u884C\u533A ${nowArea}, \u5DF2\u5173\u95ED\u98DE\u884C\u6A21\u5F0F\u3002`, player);
          player.setDynamicProperty("hpbe:dogefly", void 0);
        }
      }
    }
  }, 40);
}
function stop2() {
  if (scanRunId2 !== void 0) {
    try {
      system16.clearRun(scanRunId2);
    } catch {
    }
    scanRunId2 = void 0;
  }
}
function boot() {
  if (scanRunId2 === void 0) startScan2();
}
function inFlyArea(entity) {
  for (let area of ConfigManager.getAreas("fly")) {
    if (entity.dimension.id === area.dimension) {
      if (pointInArea_2D(
        entity.location.x,
        entity.location.z,
        area.start[0],
        area.start[1],
        area.end[0],
        area.end[1]
      )) {
        return area.name;
      }
    }
  }
  return void 0;
}
function enableFly(player) {
  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly true");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch (_) {
    console.warn("\xA7c\u7531\u4E8E\u65B0\u7248\u79FB\u9664\u4E86\u76F8\u5173\u6307\u4EE4\uFF0C\u8BF7\u5728\u4E16\u754C\u4E2D\u5F00\u542F\u6559\u80B2\u6A21\u5F0F\u3002");
  }
}
function disableFly(player) {
  let res = player.dimension.getBlockFromRay(
    player.location,
    { x: 0, y: -1, z: 0 },
    { includeLiquidBlocks: true, includePassableBlocks: false }
  );
  if (res !== void 0) {
    player.teleport({ x: res.block.location.x, y: res.block.location.y + 1, z: res.block.location.z });
  }
  try {
    player.runCommand("gamerule sendcommandfeedback false");
    player.runCommand("ability @s mayfly false");
    player.runCommand("gamemode adventure");
    player.runCommand("gamemode survival");
    player.runCommand("gamerule sendcommandfeedback true");
  } catch (_) {
  }
}
var scanRunId2;
var init_Fly = __esm({
  "scripts/area/Fly.ts"() {
    "use strict";
    init_ConfigManager();
    init_DebugLog();
    init_Permission();
    init_Tools();
    init_Tools();
  }
});

// scripts/area/InventorySwitcher.ts
import {
  BlockComponentTypes as BlockComponentTypes3,
  EquipmentSlot,
  GameMode as GameMode3,
  system as system17,
  world as world16
} from "@minecraft/server";
var _InventorySwitcher, InventorySwitcher;
var init_InventorySwitcher = __esm({
  "scripts/area/InventorySwitcher.ts"() {
    "use strict";
    init_ConfigManager();
    init_Tools();
    _InventorySwitcher = class _InventorySwitcher {
      constructor() {
        this.gameModeSub = void 0;
      }
      static getInstance() {
        if (!_InventorySwitcher._instance) {
          _InventorySwitcher._instance = new _InventorySwitcher();
        }
        return _InventorySwitcher._instance;
      }
      /** 注册事件（由 entry.ts 统一调用） */
      registerEvents() {
        if (this.gameModeSub) return;
        this.gameModeSub = world16.afterEvents.playerGameModeChange.subscribe((event) => {
          const player = event.player;
          system17.run(() => {
            if (player.getGameMode() !== event.toGameMode) return;
            if (event.fromGameMode === GameMode3.Survival && event.toGameMode === GameMode3.Creative) {
              this.saveToChest(player, false);
              this.restoreFromChest(player, true);
            } else if (event.fromGameMode === GameMode3.Creative && event.toGameMode === GameMode3.Survival) {
              this.saveToChest(player, true);
              this.restoreFromChest(player, false);
            }
          });
        });
      }
      cleanup() {
        if (this.gameModeSub?.unsubscribe) {
          try {
            this.gameModeSub.unsubscribe();
          } catch {
          }
        }
        this.gameModeSub = void 0;
      }
      init() {
      }
      /**
       * 获取该索引对应的布局（左箱/右箱/告示牌位置），使用 Tools 工具
       */
      getLayout(index) {
        const cfg = ConfigManager.getGrid("inventory_chest");
        if (!cfg) return { left: { x: 0, y: 0, z: 0 }, sign: { x: 0, y: 0, z: 0 } };
        const mainAxis = Math.floor(index / cfg.size[1]);
        const yOffset = index % cfg.size[1];
        return getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
      }
      /**
       * 获取玩家的箱子索引
       * 每个玩家占 2 个连续索引：survival = base * 2, creative = base * 2 + 1
       */
      getChestIndex(playerId2, forCreative) {
        const key = `invswitcher:player_${playerId2}`;
        let base = _InventorySwitcher.chestMap.get(key);
        if (base === void 0) {
          let nextIdx = world16.getDynamicProperty("hpbe:invswitcher_next");
          if (nextIdx === void 0) nextIdx = 0;
          const grid = ConfigManager.getGrid("inventory_chest");
          if (!grid) return 0;
          const max = grid.size[0] - 2;
          if (nextIdx > max) nextIdx = 0;
          base = nextIdx;
          _InventorySwitcher.chestMap.set(key, base);
          world16.setDynamicProperty("hpbe:invswitcher_next", base + 2);
        }
        return base * 2 + (forCreative ? 1 : 0);
      }
      /**
       * 将玩家背包存入指定箱子
       */
      saveToChest(player, forCreative) {
        const cfg = ConfigManager.getGrid("inventory_chest");
        if (!cfg) return;
        const dim = world16.getDimension("minecraft:overworld");
        const { left, sign } = this.getLayout(this.getChestIndex(player.id, forCreative));
        ensureDoubleChest(dim, left, getChestCardinal(cfg.direction, cfg.face), cfg.direction);
        const { date, time } = getShanghaiTime();
        placeSign(
          dim,
          sign,
          getSignFacing(cfg.direction, cfg.face),
          `${player.nameTag}
${forCreative ? "Creative" : "Survival"}
${date}
${time}`
        );
        const block = dim.getBlock(left);
        if (!block) return;
        const invComp = block.getComponent(BlockComponentTypes3.Inventory);
        if (!invComp?.container) return;
        const container = invComp.container;
        for (let i = 0; i < container.size; i++) container.setItem(i, void 0);
        const playerInv = player.getComponent("inventory");
        if (playerInv?.container) {
          for (let i = 0; i < playerInv.container.size && i < 36; i++) {
            const item = playerInv.container.getItem(i);
            if (item) {
              playerInv.container.setItem(i, void 0);
              container.setItem(i, item);
            }
          }
        }
        const eq = player.getComponent("equippable");
        if (eq) {
          for (const [ai, slot] of [
            EquipmentSlot.Head,
            EquipmentSlot.Chest,
            EquipmentSlot.Legs,
            EquipmentSlot.Feet
          ].entries()) {
            const item = eq.getEquipment(slot);
            if (item) {
              eq.setEquipment(slot, void 0);
              container.setItem(36 + ai, item);
            }
          }
          const offhand = eq.getEquipment(EquipmentSlot.Offhand);
          if (offhand) {
            eq.setEquipment(EquipmentSlot.Offhand, void 0);
            container.setItem(40, offhand);
          }
        }
      }
      /**
       * 从指定箱子恢复玩家背包
       */
      restoreFromChest(player, forCreative) {
        const cfg = ConfigManager.getGrid("inventory_chest");
        if (!cfg) return;
        const dim = world16.getDimension("minecraft:overworld");
        const { left } = this.getLayout(this.getChestIndex(player.id, forCreative));
        ensureDoubleChest(dim, left, getChestCardinal(cfg.direction, cfg.face), cfg.direction);
        const block = dim.getBlock(left);
        if (!block) return;
        const invComp = block.getComponent(BlockComponentTypes3.Inventory);
        if (!invComp?.container) return;
        const container = invComp.container;
        const playerInv = player.getComponent("inventory");
        if (playerInv?.container) {
          for (let i = 0; i < playerInv.container.size; i++) playerInv.container.setItem(i, void 0);
        }
        const eq = player.getComponent("equippable");
        if (eq) {
          eq.setEquipment(EquipmentSlot.Head, void 0);
          eq.setEquipment(EquipmentSlot.Chest, void 0);
          eq.setEquipment(EquipmentSlot.Legs, void 0);
          eq.setEquipment(EquipmentSlot.Feet, void 0);
          eq.setEquipment(EquipmentSlot.Offhand, void 0);
        }
        if (playerInv?.container) {
          for (let i = 0; i < 36; i++) {
            const item = container.getItem(i);
            if (item) {
              container.setItem(i, void 0);
              playerInv.container.setItem(i, item);
            }
          }
        }
        if (eq) {
          for (const [ai, slot] of [
            EquipmentSlot.Head,
            EquipmentSlot.Chest,
            EquipmentSlot.Legs,
            EquipmentSlot.Feet
          ].entries()) {
            const item = container.getItem(36 + ai);
            if (item) {
              container.setItem(36 + ai, void 0);
              eq.setEquipment(slot, item);
            }
          }
          const offhand = container.getItem(40);
          if (offhand) {
            container.setItem(40, void 0);
            eq.setEquipment(EquipmentSlot.Offhand, offhand);
          }
        }
      }
    };
    _InventorySwitcher.chestMap = /* @__PURE__ */ new Map();
    InventorySwitcher = _InventorySwitcher;
  }
});

// scripts/area/SurvivalArea.ts
import {
  GameMode as GameMode4,
  system as system18,
  world as world17
} from "@minecraft/server";
var SurvivalArea;
var init_SurvivalArea = __esm({
  "scripts/area/SurvivalArea.ts"() {
    "use strict";
    init_ConfigManager();
    init_Permission();
    init_Tools();
    init_Tools();
    init_CreativeArea();
    SurvivalArea = class _SurvivalArea {
      constructor() {
        this.enable = true;
        this.subscriptions = [];
      }
      /**
       * @returns {SurvivalArea}
       */
      static getInstance() {
        if (!_SurvivalArea._instance) {
          _SurvivalArea._instance = new _SurvivalArea();
        }
        return _SurvivalArea._instance;
      }
      /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
      registerCommandsAndPermissions() {
        Permission.register("survivalarea.gamemode.bypass", Permission.OP);
      }
      /** 注册事件（由 entry.ts 统一调用） */
      registerEvents() {
        if (this.subscriptions.length > 0) return;
        this.subscriptions.push(
          world17.afterEvents.playerSpawn.subscribe((event) => {
            if (!event.initialSpawn) return;
            if (!CreativeArea.enable) return;
            if (!this.enable) return;
            const player = event.player;
            const mode = player.getGameMode();
            if (mode === GameMode4.Survival || mode === GameMode4.Adventure) return;
            system18.runTimeout(() => {
              if (!this.inCreativeArea(player)) {
                this.forceSurvival(player);
              }
            }, 60);
          })
        );
        this.subscriptions.push(
          world17.beforeEvents.playerGameModeChange.subscribe((event) => {
            if (!CreativeArea.enable) return;
            if (!this.enable) return;
            if (event.toGameMode === GameMode4.Creative || event.toGameMode === GameMode4.Spectator) {
              if (Permission.check(event.player, "survivalarea.gamemode.bypass")) return;
              if (!this.inCreativeArea(event.player)) {
                event.cancel = true;
                Msg.error(`\u4F60\u5F53\u524D\u4E0D\u5728\u521B\u9020\u533A\u57DF\u5185\uFF0C\u65E0\u6CD5\u5207\u6362\u5230\u8BE5\u6A21\u5F0F\u3002`, event.player);
              }
            }
          })
        );
        this.subscriptions.push(
          world17.afterEvents.playerDimensionChange.subscribe((event) => {
            if (!CreativeArea.enable) return;
            if (!this.enable) return;
            const player = event.player;
            const mode = player.getGameMode();
            if (mode === GameMode4.Survival || mode === GameMode4.Adventure) return;
            system18.runTimeout(() => {
              if (!this.inCreativeArea(player)) {
                this.forceSurvival(player);
              }
            }, 10);
          })
        );
      }
      init() {
      }
      cleanup() {
        for (const s of this.subscriptions) {
          try {
            s.unsubscribe();
          } catch {
          }
        }
        this.subscriptions = [];
      }
      inCreativeArea(entity) {
        for (const area of ConfigManager.getAreas("creative")) {
          if (entity.dimension.id === area.dimension) {
            if (pointInArea_2D(
              entity.location.x,
              entity.location.z,
              area.start[0],
              area.start[1],
              area.end[0],
              area.end[1]
            )) {
              return true;
            }
          }
        }
        return false;
      }
      forceSurvival(player) {
        player.setGameMode(GameMode4.Survival);
        Msg.info(`\u5DF2\u79BB\u5F00\u521B\u9020\u533A\u57DF\uFF0C\u5F3A\u5236\u5207\u6362\u4E3A\u751F\u5B58\u6A21\u5F0F\u3002`, player);
      }
    };
  }
});

// scripts/land/defaults.ts
function defaultConfig() {
  return { ...DEFAULT_CONFIG };
}
function defaultPermissions() {
  return { ...DEFAULT_PERMISSIONS };
}
function generateLandId() {
  return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}
var DEFAULT_CONFIG, DEFAULT_PERMISSIONS;
var init_defaults = __esm({
  "scripts/land/defaults.ts"() {
    "use strict";
    DEFAULT_CONFIG = {
      priceFormula: "{square}*8+{height}*20",
      maxLandsPerPlayer: 5,
      minSquare: 4,
      maxSquare: 5e4,
      discount: 1,
      refundRate: 0.7
    };
    DEFAULT_PERMISSIONS = {
      allow_place: false,
      allow_destroy: false,
      attack_entity: false,
      open_container: false
    };
  }
});

// scripts/land/LandRoles.ts
var ROLE_CAPABILITIES;
var init_LandRoles = __esm({
  "scripts/land/LandRoles.ts"() {
    "use strict";
    ROLE_CAPABILITIES = {
      owner: [
        "place",
        "break",
        "container",
        "door",
        "button",
        "redstone",
        "attack_entity",
        "interact_entity",
        "pickup_item",
        "manage_members",
        "manage_permissions",
        "rename",
        "transfer",
        "delete"
      ],
      admin: [
        "place",
        "break",
        "container",
        "door",
        "button",
        "redstone",
        "attack_entity",
        "interact_entity",
        "pickup_item",
        "manage_members",
        "manage_permissions",
        "rename"
      ],
      builder: ["place", "break"],
      container: ["container"],
      visitor: [],
      redstone: ["redstone", "button", "door"],
      entity: ["attack_entity", "interact_entity"]
    };
  }
});

// scripts/land/LandDatabase.ts
function chunkKey(dimid, x, z) {
  return `${dimid}:${Math.floor(x / CHUNK_SIZE)}:${Math.floor(z / CHUNK_SIZE)}`;
}
function landChunkSpan(land) {
  const minX = Math.floor(Math.min(land.posA.x, land.posB.x) / CHUNK_SIZE);
  const maxX = Math.floor(Math.max(land.posA.x, land.posB.x) / CHUNK_SIZE);
  const minZ = Math.floor(Math.min(land.posA.z, land.posB.z) / CHUNK_SIZE);
  const maxZ = Math.floor(Math.max(land.posA.z, land.posB.z) / CHUNK_SIZE);
  const out = [];
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cz = minZ; cz <= maxZ; cz++) {
      out.push({ dimid: land.dimid, cx, cz });
    }
  }
  return out;
}
function isPosInBoundingBox(land, pos) {
  const minX = Math.min(land.posA.x, land.posB.x);
  const maxX = Math.max(land.posA.x, land.posB.x);
  const minY = Math.min(land.posA.y, land.posB.y);
  const maxY = Math.max(land.posA.y, land.posB.y);
  const minZ = Math.min(land.posA.z, land.posB.z);
  const maxZ = Math.max(land.posA.z, land.posB.z);
  return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY && pos.z >= minZ && pos.z <= maxZ;
}
async function fetchServerConfig() {
  try {
    const { HttpDB: HttpDB2 } = await Promise.resolve().then(() => (init_HttpDB(), HttpDB_exports));
    const body = await HttpDB2.get("/api/sfmc/settings/land:config");
    if (!body) return null;
    const parsed = JSON.parse(body);
    if (!parsed || !parsed.value) return null;
    try {
      return JSON.parse(parsed.value);
    } catch {
      return null;
    }
  } catch (error) {
    debug.w("LANDDB", `fetchServerConfig failed: ${error.message}`);
    return null;
  }
}
var CHUNK_SIZE, CONFIG_REFRESH_MS, _configLastFetchedAt, _configInFlight, _Database, Database;
var init_LandDatabase = __esm({
  "scripts/land/LandDatabase.ts"() {
    "use strict";
    init_DebugLog();
    init_defaults();
    init_LandRoles();
    CHUNK_SIZE = 16;
    CONFIG_REFRESH_MS = 5 * 60 * 1e3;
    _configLastFetchedAt = 0;
    _configInFlight = null;
    _Database = class _Database {
      // ── 重建索引 ──
      static rebuildOwnerIndex() {
        const idx = /* @__PURE__ */ new Map();
        if (this._registry) {
          for (const land of this._registry.values()) {
            const list = idx.get(land.ownerplid) || [];
            list.push(land.id);
            idx.set(land.ownerplid, list);
          }
        }
        this._ownerIndex = idx;
      }
      static rebuildChunkIndex() {
        this._chunkIndex.clear();
        if (!this._registry) return;
        for (const land of this._registry.values()) {
          for (const { dimid, cx, cz } of landChunkSpan(land)) {
            const key = chunkKey(dimid, cx * CHUNK_SIZE, cz * CHUNK_SIZE);
            if (!this._chunkIndex.has(key)) this._chunkIndex.set(key, /* @__PURE__ */ new Set());
            this._chunkIndex.get(key).add(land.id);
          }
        }
      }
      static rebuildAll() {
        this.rebuildOwnerIndex();
        this.rebuildChunkIndex();
      }
      // ── 配置 ──
      static getConfig() {
        if (this._config) return this._config;
        this._config = defaultConfig();
        return this._config;
      }
      static replaceConfig(cfg) {
        this._config = cfg;
      }
      /**
       * 5 min 内最多拉一次 server config；失败保留上次缓存/默认。
       * 仅在 Database.refresh() 调用时被动触发，避免无谓请求。
       */
      static async ensureConfigFresh() {
        if (Date.now() - _configLastFetchedAt < CONFIG_REFRESH_MS) return;
        if (_configInFlight) return _configInFlight;
        _configInFlight = (async () => {
          const serverCfg = await fetchServerConfig();
          if (serverCfg) {
            _Database.replaceConfig(serverCfg);
            _configLastFetchedAt = Date.now();
          }
        })().finally(() => {
          _configInFlight = null;
        });
        return _configInFlight;
      }
      // ── 加载 ──
      static async loadFromServer() {
        debug.i("LANDDB", "loadFromServer: loading lands from server");
        if (this._loading) return this._loading;
        this._loading = (async () => {
          const { getAllLands: getAllLands2 } = await Promise.resolve().then(() => (init_LandApi(), LandApi_exports));
          const lands = await getAllLands2();
          if (lands === null) {
            debug.w("LANDDB", "loadFromServer: getAllLands returned null, keeping local cache");
            if (!this._registry) this._registry = /* @__PURE__ */ new Map();
            return;
          }
          this._hasAuthoritativeSnapshot = true;
          this._registry = new Map(lands.map((land) => [land.id, land]));
          this.rebuildAll();
          debug.i("LANDDB", `loadFromServer: loaded ${lands.length} lands`);
        })().finally(() => {
          this._loading = null;
        });
        return this._loading;
      }
      static hasAuthoritativeSnapshot() {
        return this._hasAuthoritativeSnapshot;
      }
      static async refresh() {
        debug.i("LANDDB", "refresh: refreshing land cache");
        await Promise.all([this.loadFromServer(), this.ensureConfigFresh()]);
      }
      // ── 查询 ──
      static getAll() {
        this.ensureLoaded();
        const all = Array.from(this._registry.values());
        debug.i("LANDDB", `getAll: ${all.length} lands`);
        return all;
      }
      static getAt(pos, dimid) {
        this.ensureLoaded();
        const candidates = this._chunkIndex.get(chunkKey(dimid, pos.x, pos.z));
        if (!candidates) return void 0;
        for (const id of candidates) {
          const land = this._registry.get(id);
          if (!land) continue;
          if (isPosInBoundingBox(land, pos)) {
            debug.i("LANDDB", `getAt: found land ${land.id} at (${pos.x},${pos.y},${pos.z}) dimid=${dimid}`);
            return land;
          }
        }
        return void 0;
      }
      static getById(landId) {
        this.ensureLoaded();
        const land = this._registry.get(landId);
        debug.i("LANDDB", `getById: landId=${landId} ${land ? "found" : "not found"}`);
        return land;
      }
      static getByOwner(plid) {
        this.ensureLoaded();
        const list = this._ownerIndex.get(plid) || [];
        debug.i("LANDDB", `getByOwner: plid=${plid} count=${list.length}`);
        return list;
      }
      static getPlayerLandCount(plid) {
        return this.getByOwner(plid).length;
      }
      // ── 写入（先走 server，再更新本地） ──
      static async add(land) {
        debug.i("LANDDB", `add: landId=${land.id} owner=${land.ownerplid} dimid=${land.dimid}`);
        this.ensureLoaded();
        this._registry.set(land.id, land);
        const owners = this._ownerIndex.get(land.ownerplid) || [];
        if (!owners.includes(land.id)) owners.push(land.id);
        this._ownerIndex.set(land.ownerplid, owners);
        for (const { dimid, cx, cz } of landChunkSpan(land)) {
          const key = chunkKey(dimid, cx * CHUNK_SIZE, cz * CHUNK_SIZE);
          if (!this._chunkIndex.has(key)) this._chunkIndex.set(key, /* @__PURE__ */ new Set());
          this._chunkIndex.get(key).add(land.id);
        }
      }
      static upsert(land) {
        debug.i("LANDDB", `upsert: landId=${land.id} owner=${land.ownerplid} version=${land.version}`);
        this.ensureLoaded();
        const current = this._registry.get(land.id);
        if (current && (land.version || 0) < (current.version || 0)) {
          debug.w("LANDDB", `upsert: stale version, skipped landId=${land.id}`);
          return;
        }
        this._registry.set(land.id, land);
        this.rebuildAll();
      }
      static async update(land, actorId = land.ownerplid) {
        debug.i("LANDDB", `update: landId=${land.id} actorId=${actorId} version=${land.version}`);
        const { updateLand: updateLand2 } = await Promise.resolve().then(() => (init_LandApi(), LandApi_exports));
        const updated = await updateLand2(land.id, {
          nickname: land.nickname,
          permissions: land.permissions,
          actorId,
          expectedVersion: land.version
        });
        if (!updated) {
          debug.e("LANDDB", `update: failed landId=${land.id}`);
          return false;
        }
        this.ensureLoaded();
        const current = this._registry.get(updated.id);
        if (current && (updated.version || 0) < (current.version || 0)) return true;
        this._registry.set(updated.id, updated);
        this.rebuildAll();
        debug.i("LANDDB", `update: success landId=${land.id} newVersion=${updated.version}`);
        return true;
      }
      static async delete(landId, actorId, expectedVersion, requestId) {
        debug.i("LANDDB", `delete: landId=${landId} actorId=${actorId} version=${expectedVersion}`);
        const { deleteLand: deleteLand2 } = await Promise.resolve().then(() => (init_LandApi(), LandApi_exports));
        const result = await deleteLand2(landId, actorId, expectedVersion, requestId);
        if (!result.ok) {
          debug.e("LANDDB", `delete: failed landId=${landId} error=${result.error}`);
          return result;
        }
        if (result.balance !== void 0) {
          const { Money: Money2 } = await Promise.resolve().then(() => (init_Money(), Money_exports));
          const players = (await import("@minecraft/server")).world.getPlayers();
          const player = players.find((item) => item.id === actorId);
          if (player) {
            const version = result.balanceVersion ?? 0;
            Money2.setCached(player, result.balance, version);
          }
        }
        this.ensureLoaded();
        const land = this._registry.get(landId);
        if (!land) return { ok: true, refund: result.refund, balance: result.balance };
        this._registry.delete(landId);
        const owners = this._ownerIndex.get(land.ownerplid);
        if (owners) {
          const idx = owners.indexOf(landId);
          if (idx !== -1) owners.splice(idx, 1);
        }
        this.rebuildChunkIndex();
        debug.i("LANDDB", `delete: success landId=${landId} refund=${result.refund}`);
        return result;
      }
      // ── 工厂 ──
      /** 客户端生成初始 LandData（创建后立即送 server，server 返回值替换缓存） */
      static createLandData(ownerplid, ownerName, dimid, posA, posB) {
        return {
          id: generateLandId(),
          ownerplid,
          ownerName,
          managers: [ownerplid],
          dimid,
          posA,
          posB,
          permissions: defaultPermissions(),
          nickname: "",
          createdAt: Date.now()
        };
      }
      static getDefaultPermissions() {
        return defaultPermissions();
      }
      static getDefaultConfig() {
        return defaultConfig();
      }
      static generateId() {
        return generateLandId();
      }
      // ── 内部工具 ──
      static ensureLoaded() {
        if (!this._registry) this._registry = /* @__PURE__ */ new Map();
        if (!this._ownerIndex) this._ownerIndex = /* @__PURE__ */ new Map();
      }
    };
    /** 运行时缓存 */
    _Database._registry = null;
    _Database._ownerIndex = null;
    _Database._chunkIndex = /* @__PURE__ */ new Map();
    _Database._config = null;
    _Database._loading = null;
    _Database._hasAuthoritativeSnapshot = false;
    Database = _Database;
  }
});

// scripts/land/LandCore.ts
function formatCreateError(error) {
  const messages = {
    insufficient_funds: "\u8282\u64CD\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u8D2D\u4E70\u8FD9\u5757\u571F\u5730\u3002",
    land_limit: "\u4F60\u5DF2\u8FBE\u5230\u571F\u5730\u6570\u91CF\u4E0A\u9650\u3002",
    overlap: "\u8BE5\u533A\u57DF\u4E0E\u5176\u4ED6\u571F\u5730\u91CD\u53E0\u3002",
    area_out_of_range: "\u571F\u5730\u9762\u79EF\u4E0D\u7B26\u5408\u9650\u5236\u3002",
    unauthorized: "\u6570\u636E\u5E93\u670D\u52A1\u62D2\u7EDD\u4E86\u672C\u6B21\u64CD\u4F5C\u3002"
  };
  return messages[error || ""] || `\u571F\u5730\u521B\u5EFA\u5931\u8D25\uFF1A${error || "\u6570\u636E\u5E93\u670D\u52A1\u65E0\u54CD\u5E94"}`;
}
var LandCore;
var init_LandCore = __esm({
  "scripts/land/LandCore.ts"() {
    "use strict";
    init_LandApi();
    init_DebugLog();
    init_Money();
    init_LandDatabase();
    LandCore = class {
      // ── 会话管理 ──
      /**
       * @description 获取玩家会话
       * @param plid 玩家 ID
       * @returns 玩家会话或 undefined
       */
      static getSession(plid) {
        debug.i("LAND", `getSession: plid=${plid}`);
        return this.sessions.get(plid);
      }
      /**
       * @description 初始化玩家会话
       * @param plid 玩家 ID
       * @returns 是否成功初始化会话资源
       */
      static initSession(plid) {
        debug.i("LAND", `initSession: plid=${plid}`);
        this.sessions.set(plid, { updatedAt: Date.now() });
        return true;
      }
      /**
       * @description 设置玩家会话中土地的第一点
       * @param plid 玩家 ID
       * @param pos 第一点坐标
       * @returns 玩家会话或 undefined
       */
      static setPos1(plid, pos) {
        debug.i("LAND", `setPos1: plid=${plid} pos=(${pos.x},${pos.y},${pos.z})`);
        let s = this.getSession(plid);
        if (s) {
          s.pos1 = pos;
          s.updatedAt = Date.now();
          this.sessions.set(plid, s);
        }
        return s;
      }
      /**
       * @description 设置玩家会话中土地的第二点
       * @param plid 玩家 ID
       * @param pos 第二点坐标
       * @returns 玩家会话或 undefined
       */
      static setPos2(plid, pos) {
        debug.i("LAND", `setPos2: plid=${plid} pos=(${pos.x},${pos.y},${pos.z})`);
        let s = this.getSession(plid);
        if (s) {
          s.pos2 = pos;
          s.updatedAt = Date.now();
          this.sessions.set(plid, s);
        }
        return s;
      }
      /**
       * @description 释放玩家会话
       * @param plid 玩家 ID
       * @returns 是否成功释放会话资源
       */
      static clearSession(plid) {
        const result = this.sessions.delete(plid);
        debug.i("LAND", `clearSession: plid=${plid} result=${result}`);
        return result;
      }
      /**
       * @description 判断玩家会话中土地是否有第一点和第二点
       * @param plid 玩家 ID
       * @returns 是否有第一点和第二点坐标
       */
      static hasBothPos(plid) {
        const s = this.sessions.get(plid);
        return !!s && !!s.pos1 && !!s.pos2;
      }
      static setDimension(plid, dimensionId2) {
        debug.i("LAND", `setDimension: plid=${plid} dimid=${dimensionId2}`);
        const session = this.getSession(plid);
        if (!session) return void 0;
        session.dimensionId = dimensionId2;
        session.updatedAt = Date.now();
        return session;
      }
      static clearExpiredSessions(maxAgeMs = 30 * 60 * 1e3) {
        const now = Date.now();
        let count = 0;
        for (const [id, session] of this.sessions)
          if (now - session.updatedAt > maxAgeMs) {
            this.sessions.delete(id);
            count++;
          }
        if (count > 0) debug.i("LAND", `clearExpiredSessions: cleared ${count} sessions`);
      }
      // ── 方块信息计算 ──
      /** 标准化坐标：确保 posA 是 min 角，posB 是 max 角 */
      static normalize(posA, posB) {
        return {
          posA: {
            x: Math.min(posA.x, posB.x),
            y: Math.min(posA.y, posB.y),
            z: Math.min(posA.z, posB.z)
          },
          posB: {
            x: Math.max(posA.x, posB.x),
            y: Math.max(posA.y, posB.y),
            z: Math.max(posA.z, posB.z)
          }
        };
      }
      /** 获取立方体信息 */
      static getCubeInfo(posA, posB) {
        const n = this.normalize(posA, posB);
        const w = n.posB.x - n.posA.x + 1;
        const h = n.posB.y - n.posA.y + 1;
        const l = n.posB.z - n.posA.z + 1;
        return {
          length: l,
          width: w,
          height: h,
          square: w * l,
          volume: w * h * l
        };
      }
      /** 计算维度名 */
      static getDimensionName(dimid) {
        return ["\u4E3B\u4E16\u754C", "\u5730\u72F1", "\u672B\u5730"][dimid] ?? "\u672A\u77E5";
      }
      // ── 价格计算 ──
      /** 解析公式并计算价格 */
      static calculatePrice(posA, posB) {
        const cfg = Database.getConfig();
        const info = this.getCubeInfo(posA, posB);
        return Math.max(0, Math.floor((info.square * 8 + info.height * 20) * cfg.discount));
      }
      // ── 土地查询 ──
      /** 判断某点是否在土地范围内 */
      static isPosInLand(pos, dimid, land) {
        if (land.dimid !== dimid) return false;
        const n = this.normalize(land.posA, land.posB);
        return pos.x >= n.posA.x && pos.x <= n.posB.x && pos.y >= n.posA.y && pos.y <= n.posB.y && pos.z >= n.posA.z && pos.z <= n.posB.z;
      }
      /** 获取某位置所在的土地 */
      static getLandByPos(pos, dimid) {
        if (!pos || dimid === void 0) return void 0;
        debug.i("LAND", `getLandByPos: pos=(${pos.x},${pos.y},${pos.z}) dimid=${dimid}`);
        return Database.getAt(pos, dimid);
      }
      /** 获取玩家拥有的所有土地 */
      static getPlayerLands(plid) {
        const ids = Database.getByOwner(plid);
        debug.i("LAND", `getPlayerLands: plid=${plid} count=${ids.length}`);
        return ids.map((id) => Database.getById(id)).filter((l) => !!l);
      }
      // ── 验证 ──
      /** 验证创建条件 */
      static async validateCreation(player, posA, posB, dimid) {
        debug.i(
          "LAND",
          `validateCreation: player=${player.name} posA=(${posA.x},${posA.y},${posA.z}) posB=(${posB.x},${posB.y},${posB.z}) dimid=${dimid}`
        );
        const plid = player.id;
        const cfg = Database.getConfig();
        const info = this.getCubeInfo(posA, posB);
        if (!posA || !posB) {
          return { ok: false, msg: "\xA7c\u8BF7\u5148\u4F7F\u7528 !pos1 \u548C !pos2 \u547D\u4EE4\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002" };
        }
        if (info.square < cfg.minSquare) {
          return { ok: false, msg: `\xA7c\u571F\u5730\u9762\u79EF\u8FC7\u5C0F\uFF01
\u6700\u5C0F\u9762\u79EF\u4E3A ${cfg.minSquare} \u683C\u3002` };
        }
        if (info.square > cfg.maxSquare) {
          return { ok: false, msg: `\xA7c\u571F\u5730\u9762\u79EF\u8FC7\u5927\uFF01
\u6700\u5927\u9762\u79EF\u4E3A ${cfg.maxSquare} \u683C\u3002` };
        }
        const remote = await validateLand({ ownerId: plid, ownerName: player.name, dimid, posA, posB });
        if (!remote.ok) {
          const messages = {
            overlap: "\xA7c\u8BE5\u533A\u57DF\u4E0E\u5176\u4ED6\u571F\u5730\u91CD\u53E0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002",
            land_limit: `\xA7c\u60A8\u5DF2\u8FBE\u5230\u6301\u6709\u571F\u5730\u4E0A\u9650\uFF08${cfg.maxLandsPerPlayer} \u5757\uFF09\uFF01`,
            area_out_of_range: "\xA7c\u571F\u5730\u9762\u79EF\u4E0D\u7B26\u5408\u9650\u5236\u3002"
          };
          return { ok: false, msg: messages[remote.error || ""] || `\xA7c${remote.error || "\u571F\u5730\u9A8C\u8BC1\u5931\u8D25"}` };
        }
        const price = this.calculatePrice(posA, posB);
        const balance = await Money.load(player);
        if (balance < price) {
          return {
            ok: false,
            msg: `\xA7c${Money.UNIT}\u4E0D\u8DB3\uFF01
\u9700\u8981 \xA7e${price} \xA7c${Money.UNIT}\uFF0C\u800C\u5F53\u524D\u6301\u6709 \xA7e${balance} \xA7c${Money.UNIT}\u3002`
          };
        }
        return { ok: true };
      }
      /** 判断两个立方体是否重叠 */
      static cubesOverlap(a, b) {
        return a.posA.x <= b.posB.x && a.posB.x >= b.posA.x && a.posA.y <= b.posB.y && a.posB.y >= b.posA.y && a.posA.z <= b.posB.z && a.posB.z >= b.posA.z;
      }
      // ── 创建/删除 ──
      /** 创建土地（已通过验证后调用） */
      static async createLand(player, posA, posB, dimid) {
        debug.i(
          "LAND",
          `createLand: player=${player.name} posA=(${posA.x},${posA.y},${posA.z}) posB=(${posB.x},${posB.y},${posB.z}) dimid=${dimid}`
        );
        const plid = player.id;
        const n = this.normalize(posA, posB);
        const price = this.calculatePrice(n.posA, n.posB);
        const requestId = `land-create:${plid}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        const result = await createLand({
          ownerId: plid,
          ownerName: player.name,
          dimid,
          posA: n.posA,
          posB: n.posB,
          requestId
        });
        if (!result.land) throw new Error(result.message || formatCreateError(result.error));
        const land = result.land;
        Database.add(land);
        if (result.balance !== void 0) Money.setCached(player, result.balance, result.balanceVersion || 0);
        else await Money.load(player);
        this.clearSession(plid);
        debug.i("LAND", `createLand success: landId=${land.id} price=${price}`);
        return land;
      }
      /** 删除土地（拥有者/管理员） */
      static async deleteLand(landId, player, requestId) {
        debug.i("LAND", `deleteLand: landId=${landId} player=${player.name}`);
        const land = Database.getById(landId);
        if (!land) return { ok: false, error: "not_found", message: "\u571F\u5730\u4E0D\u5B58\u5728\u6216\u7F13\u5B58\u5DF2\u66F4\u65B0\u3002" };
        if (land.ownerplid !== player.id) {
          return { ok: false, error: "forbidden", message: "\u53EA\u6709\u571F\u5730\u6240\u6709\u8005\u53EF\u4EE5\u5220\u9664\u571F\u5730\u3002" };
        }
        return Database.delete(landId, player.id, land.version, requestId);
      }
      /** 检查玩家是否为土地的管理者 */
      static isManager(land, plid) {
        const result = land.managers.includes(plid);
        debug.i("LAND", `isManager: landId=${land.id} plid=${plid} result=${result}`);
        return result;
      }
      /** 检查玩家是否为土地的拥有者 */
      static isOwner(land, plid) {
        const result = land.ownerplid === plid;
        debug.i("LAND", `isOwner: landId=${land.id} plid=${plid} result=${result}`);
        return result;
      }
      /** 检查玩家是否对该土地有完全管理权（拥有者或全局管理员） */
      static isOwnerOrManager(land, plid) {
        const result = this.isOwner(land, plid) || this.isManager(land, plid);
        debug.i("LAND", `isOwnerOrManager: landId=${land.id} plid=${plid} result=${result}`);
        return result;
      }
      // ── 格式化显示 ──
      /** 格式化土地信息文本 */
      static formatLandInfo(posA, posB, dimid) {
        const n = this.normalize(posA, posB);
        const info = this.getCubeInfo(n.posA, n.posB);
        const price = this.calculatePrice(n.posA, n.posB);
        return [
          `[*] \u571F\u5730\u4FE1\u606F\uFF1A`,
          `  - \xA7l\u7EF4\u5EA6: \xA7r${this.getDimensionName(dimid)}`,
          `  - \xA7l\u8D77\u70B9: \xA7r(${n.posA.x}, ${n.posA.y}, ${n.posA.z})`,
          `  - \xA7l\u7EC8\u70B9: \xA7r(${n.posB.x}, ${n.posB.y}, ${n.posB.z})`,
          `  - \xA7l\u9762\u79EF: \xA7r${info.square} \u683C`,
          `  - \xA7l\u4F53\u79EF: \xA7r${info.volume} \u683C`,
          `  - \xA7l\u4EF7\u683C: \xA7r${price} ${Money.UNIT}`
        ].join("\n");
      }
    };
    /** 玩家会话：plid → { pos1, pos2 } */
    LandCore.sessions = /* @__PURE__ */ new Map();
  }
});

// scripts/land/LandPolicy.ts
function getPlayerRole(land, playerId2) {
  if (land.ownerplid === playerId2) return "owner";
  const now = Date.now();
  const member = (land.members || []).find(
    (m) => m.player_id === playerId2 && (m.expires_at == null || m.expires_at > now)
  );
  return member?.role || (land.managers.includes(playerId2) ? "admin" : null);
}
function canManage(land, playerId2, capability) {
  const role = getPlayerRole(land, playerId2);
  return !!role && ROLE_CAPABILITIES[role].includes(capability);
}
function isPublicLand(land) {
  return land.status === "public";
}
function canUse(land, playerId2, capability) {
  if (isPublicLand(land)) return true;
  const role = getPlayerRole(land, playerId2);
  if (role && ROLE_CAPABILITIES[role].includes(capability)) return true;
  const field = CAPABILITY_TO_PERMISSION_FIELD[capability];
  return land.permissions[field] === true;
}
function canUseAt(player, pos, dimid, capability) {
  if (Permission.getPermission(player) >= Permission.OP) return true;
  if (!Database.hasAuthoritativeSnapshot()) return false;
  const land = LandCore.getLandByPos(pos, dimid);
  if (!land) return true;
  if (isPublicLand(land)) return true;
  return canUse(land, player.id, capability);
}
var CAPABILITY_TO_PERMISSION_FIELD;
var init_LandPolicy = __esm({
  "scripts/land/LandPolicy.ts"() {
    "use strict";
    init_Permission();
    init_LandCore();
    init_LandDatabase();
    init_LandRoles();
    CAPABILITY_TO_PERMISSION_FIELD = {
      place: "allow_place",
      break: "allow_destroy",
      container: "open_container",
      door: "use_door",
      button: "use_button",
      redstone: "use_redstone",
      attack_entity: "attack_entity",
      interact_entity: "interact_entity",
      pickup_item: "pickup_item"
    };
  }
});

// scripts/land/LandEvents.ts
import { Player as Player15, system as system19, world as world18 } from "@minecraft/server";
function isContainerBlock(typeId) {
  if (CONTAINER_BLOCKS.has(typeId)) return true;
  return /^minecraft:.*_shulker_box$/.test(typeId);
}
function checkLandPermission(player, pos, dimid, capability) {
  const started = Date.now();
  if (Permission.getPermission(player) >= Permission.OP) {
    recordMetric(Date.now() - started);
    return true;
  }
  const result = canUseAt(player, pos, dimid, capability);
  recordMetric(Date.now() - started);
  return result;
}
function recordMetric(durationMs) {
  LandEvents.recordPermissionMetric(durationMs);
}
var CONTAINER_BLOCKS, LandEvents;
var init_LandEvents = __esm({
  "scripts/land/LandEvents.ts"() {
    "use strict";
    init_DebugLog();
    init_Permission();
    init_Tools();
    init_LandCore();
    init_LandPolicy();
    CONTAINER_BLOCKS = /* @__PURE__ */ new Set([
      "minecraft:chest",
      "minecraft:trapped_chest",
      "minecraft:barrel",
      "minecraft:ender_chest",
      "minecraft:hopper",
      "minecraft:dispenser",
      "minecraft:dropper"
      // 潜影盒用正则匹配
    ]);
    LandEvents = class {
      /** 注册事件（由 entry.ts 统一调用） */
      static registerEvents() {
        debug.i("LAND", "registerEvents");
        if (this.initialized) return;
        this.initialized = true;
        this.scanRunId = system19.runInterval(() => this.scanPlayerBoundaries(), 20);
        world18.afterEvents.playerLeave.subscribe((event) => {
          LandCore.clearSession(event.playerId);
        });
        this.subscribe(world18.beforeEvents.playerPlaceBlock, (ev) => {
          const { player, block } = ev;
          const pos = { x: block.x, y: block.y, z: block.z };
          const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(player, pos, dimid, "place")) {
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u653E\u7F6E\u65B9\u5757\uFF01", player);
            ev.cancel = true;
          }
        });
        this.subscribe(world18.beforeEvents.playerBreakBlock, (ev) => {
          const { player, block } = ev;
          const pos = { x: block.x, y: block.y, z: block.z };
          const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(player, pos, dimid, "break")) {
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u7834\u574F\u65B9\u5757\uFF01", player);
            ev.cancel = true;
          }
        });
        this.subscribe(world18.beforeEvents.playerInteractWithBlock, (ev) => {
          const { player, block } = ev;
          if (!isContainerBlock(block.typeId)) return;
          const pos = { x: block.x, y: block.y, z: block.z };
          const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(player, pos, dimid, "container")) {
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u6253\u5F00\u5BB9\u5668\uFF01", player);
            ev.cancel = true;
          }
        });
        this.subscribe(world18.beforeEvents.playerInteractWithBlock, (ev) => {
          if (isContainerBlock(ev.block.typeId)) return;
          const type = ev.block.typeId;
          const capability = /door|trapdoor|fence_gate/.test(type) ? "door" : /button|lever|pressure_plate/.test(type) ? "button" : /redstone|repeater|comparator|piston|dispenser|dropper|hopper/.test(type) ? "redstone" : null;
          if (!capability) return;
          const pos = { x: ev.block.x, y: ev.block.y, z: ev.block.z };
          const dimid = ev.block.dimension.id === "minecraft:overworld" ? 0 : ev.block.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(ev.player, pos, dimid, capability)) {
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u4F7F\u7528\u6B64\u571F\u5730\u8BBE\u65BD\uFF01", ev.player);
            ev.cancel = true;
          }
        });
        this.subscribe(world18.beforeEvents.playerInteractWithEntity, (ev) => {
          const pos = {
            x: Math.floor(ev.target.location.x),
            y: Math.floor(ev.target.location.y),
            z: Math.floor(ev.target.location.z)
          };
          const dimid = ev.target.dimension.id === "minecraft:overworld" ? 0 : ev.target.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(ev.player, pos, dimid, "interact_entity")) {
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u4E0E\u6B64\u571F\u5730\u5185\u7684\u5B9E\u4F53\u4EA4\u4E92\uFF01", ev.player);
            ev.cancel = true;
          }
        });
        this.subscribe(world18.beforeEvents.entityHurt, (ev) => {
          const source = ev.damageSource.damagingEntity;
          if (!(source instanceof Player15)) return;
          const target = ev.hurtEntity;
          const pos = {
            x: Math.floor(target.location.x),
            y: Math.floor(target.location.y),
            z: Math.floor(target.location.z)
          };
          const dimid = target.dimension.id === "minecraft:overworld" ? 0 : target.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(source, pos, dimid, "attack_entity")) {
            ev.cancel = true;
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u653B\u51FB\u6B64\u571F\u5730\u5185\u7684\u5B9E\u4F53\uFF01", source);
          }
        });
        this.subscribe(world18.beforeEvents.entityItemPickup, (ev) => {
          if (!(ev.entity instanceof Player15)) return;
          const pos = {
            x: Math.floor(ev.item.location.x),
            y: Math.floor(ev.item.location.y),
            z: Math.floor(ev.item.location.z)
          };
          const dimid = ev.item.dimension.id === "minecraft:overworld" ? 0 : ev.item.dimension.id === "minecraft:nether" ? 1 : 2;
          if (!checkLandPermission(ev.entity, pos, dimid, "pickup_item")) {
            ev.cancel = true;
            Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u62FE\u53D6\u6B64\u571F\u5730\u5185\u7684\u7269\u54C1\uFF01", ev.entity);
          }
        });
        this.subscribe(world18.beforeEvents.explosion, (ev) => {
          const blocks = ev.getImpactedBlocks();
          if (blocks.some((block) => {
            const pos = { x: block.x, y: block.y, z: block.z };
            const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
            return LandCore.getLandByPos(pos, dimid) !== void 0;
          }))
            ev.cancel = true;
        });
      }
      static subscribe(signal, callback) {
        this.subscriptions.push({ signal, callback: signal.subscribe(callback) });
      }
      static scanPlayerBoundaries() {
        for (const player of world18.getPlayers()) {
          const pos = {
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y),
            z: Math.floor(player.location.z)
          };
          const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
          const land = LandCore.getLandByPos(pos, dimid);
          const current = land?.id || null;
          const previous = this.lastLandByPlayer.get(player.id);
          if (current !== previous) {
            if (land) {
              Msg.tips(`\u8FDB\u5165\u571F\u5730\uFF1A${land.nickname || land.id}\uFF08\u6240\u6709\u8005\uFF1A${land.ownerName}\uFF09`, player);
              this.spawnShieldParticles(player, land);
            } else if (previous) {
              Msg.tips("\u4F60\u5DF2\u79BB\u5F00\u571F\u5730\u4FDD\u62A4\u8303\u56F4\u3002", player);
            }
            this.lastLandByPlayer.set(player.id, current);
          }
        }
      }
      /** 在土地 8 个角点 + 顶/底中心生成彩色屏障粒子（一次性触发，进入边界时跑一次） */
      static spawnShieldParticles(player, land) {
        const color = this.themeColorFor(land);
        const corners = this.computeCorners(land);
        try {
          for (const c of corners) {
            for (let h = 0; h < 4; h++) {
              player.spawnParticle(color.particle, { x: c.x + 0.5, y: c.y + 1 + h, z: c.z + 0.5 });
            }
          }
        } catch (e) {
        }
      }
      static computeCorners(land) {
        const minX = Math.min(land.posA.x, land.posB.x);
        const maxX = Math.max(land.posA.x, land.posB.x);
        const minY = Math.min(land.posA.y, land.posB.y);
        const maxY = Math.max(land.posA.y, land.posB.y);
        const minZ = Math.min(land.posA.z, land.posB.z);
        const maxZ = Math.max(land.posA.z, land.posB.z);
        const midY = Math.round((minY + maxY) / 2);
        return [
          { x: minX, y: midY, z: minZ },
          { x: maxX, y: midY, z: minZ },
          { x: minX, y: midY, z: maxZ },
          { x: maxX, y: midY, z: maxZ }
        ];
      }
      /** 简单 hash → 颜色。保证每块地视觉上唯一，又不需要额外存储。 */
      static themeColorFor(land) {
        const ids = (land.id || "L").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
        const palette = [
          "minecraft:totem_particle",
          "minecraft:villager_happy",
          "minecraft:heart_particle",
          "minecraft:end_chest",
          "minecraft:sparkler",
          "minecraft:wax_on",
          "minecraft:wax_off"
        ];
        return {
          particle: palette[ids % palette.length],
          hex: "#" + (ids * 2654435761 >>> 0).toString(16).padStart(8, "0").slice(0, 6)
        };
      }
      static getMetrics() {
        return { ...this.metrics, averageMs: this.metrics.count ? this.metrics.totalMs / this.metrics.count : 0 };
      }
      static recordPermissionMetric(durationMs) {
        this.metrics.count++;
        this.metrics.totalMs += durationMs;
        this.metrics.slowestMs = Math.max(this.metrics.slowestMs, durationMs);
      }
      static cleanup() {
        debug.i("LAND", "cleanup");
        if (this.scanRunId !== void 0) system19.clearRun(this.scanRunId);
        this.scanRunId = void 0;
        this.lastLandByPlayer.clear();
        for (const s of this.subscriptions) {
          try {
            s.signal.unsubscribe(s.callback);
          } catch {
          }
        }
        this.subscriptions = [];
        this.initialized = false;
      }
    };
    LandEvents.initialized = false;
    LandEvents.subscriptions = [];
    LandEvents.lastLandByPlayer = /* @__PURE__ */ new Map();
    LandEvents.metrics = { count: 0, totalMs: 0, slowestMs: 0 };
  }
});

// scripts/gui/LandGUI.ts
import { world as world19 } from "@minecraft/server";
function dimensionId(player) {
  return player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
}
function roleText(land, playerId2) {
  const role = getPlayerRole(land, playerId2);
  return role ? ROLE_NAMES[role] : "\u8BBF\u5BA2";
}
function landErrorMessage(error, message) {
  const known = {
    forbidden: "\u4F60\u6CA1\u6709\u6743\u9650\u6267\u884C\u6B64\u64CD\u4F5C\u3002",
    not_found: "\u571F\u5730\u4E0D\u5B58\u5728\u6216\u5DF2\u88AB\u5220\u9664\u3002",
    already_deleted: "\u571F\u5730\u5DF2\u7ECF\u88AB\u5220\u9664\u3002",
    version_conflict: "\u571F\u5730\u6570\u636E\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u8FD4\u56DE\u540E\u91CD\u65B0\u786E\u8BA4\u3002",
    database_unavailable: "\u6570\u636E\u5E93\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
    transaction_failed: "\u670D\u52A1\u5668\u4E8B\u52A1\u5931\u8D25\uFF0C\u571F\u5730\u72B6\u6001\u672A\u6539\u53D8\u3002",
    invalid_target: "\u4E0D\u80FD\u5C06\u571F\u5730\u8F6C\u8BA9\u7ED9\u81EA\u5DF1\u3002"
  };
  return error && known[error] || message || "\u64CD\u4F5C\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
}
var ROLES, ROLE_NAMES, LandGUI;
var init_LandGUI = __esm({
  "scripts/gui/LandGUI.ts"() {
    "use strict";
    init_LandApi();
    init_LandCore();
    init_LandDatabase();
    init_LandPolicy();
    init_DebugLog();
    init_MenuNavigator();
    init_Money();
    init_Tools();
    ROLES = ["builder", "container", "visitor", "redstone", "entity", "admin"];
    ROLE_NAMES = {
      owner: "\u6240\u6709\u8005",
      admin: "\u7BA1\u7406\u5458",
      builder: "\u5EFA\u9020\u8005",
      container: "\u5BB9\u5668\u8BBF\u95EE",
      visitor: "\u8BBF\u5BA2",
      redstone: "\u7EA2\u77F3",
      entity: "\u5B9E\u4F53\u4EA4\u4E92"
    };
    LandGUI = class _LandGUI {
      constructor(player) {
        debug.i("GUI", `LandGUI: constructor player=${player.name}`);
        this.player = player;
        this.nav = new MenuNavigator(player);
        this.nav.state.gui = { invites: [], loading: false };
        this.registerSections();
      }
      static showMainMenu(player) {
        debug.i("GUI", `LandGUI.showMainMenu: player=${player.name}`);
        const gui = new _LandGUI(player);
        const session = LandCore.getSession(player.id);
        if (session)
          gui.nav.state.gui.application = { ...session, dimensionId: session.dimensionId ?? dimensionId(player) };
        void getInvites(player.id).then((invites) => {
          gui.state.invites = invites;
          return gui.nav.start("home");
        }).catch(() => void gui.nav.start("home"));
      }
      static startApplication(player) {
        debug.i("GUI", `LandGUI.startApplication: player=${player.name}`);
        LandCore.initSession(player.id);
        Msg.info("\u8BF7\u4F7F\u7528 !pos1 \u548C !pos2 \u9009\u62E9\u571F\u5730\u8303\u56F4\uFF0C\u7136\u540E\u91CD\u65B0\u6253\u5F00 !land \u786E\u8BA4\u8D2D\u4E70\u3002", player);
      }
      get state() {
        return this.nav.state.gui;
      }
      currentLand() {
        return this.state.selectedLandId ? Database.getById(this.state.selectedLandId) : void 0;
      }
      registerSections() {
        this.nav.section("home", "\u571F\u5730\u4E2D\u5FC3", (page) => this.buildHome(page));
        this.nav.section("current", "\u5F53\u524D\u571F\u5730", (page) => this.buildCurrent(page));
        this.nav.section("landList", "\u6211\u7684\u571F\u5730", (page) => this.buildLandList(page));
        this.nav.section("landDetail", "\u571F\u5730\u8BE6\u60C5", (page) => this.buildLandDetail(page));
        this.nav.section("members", "\u6210\u5458\u4E0E\u9080\u8BF7", (page) => this.buildMembers(page));
        this.nav.section("invite", "\u9080\u8BF7\u6210\u5458", (page) => this.buildInvite(page));
        this.nav.section("memberEdit", "\u6210\u5458\u89D2\u8272", (page) => this.buildMemberEdit(page));
        this.nav.section("invites", "\u6536\u5230\u7684\u9080\u8BF7", (page) => this.buildInvites(page));
        this.nav.section("protection", "\u8BBF\u5BA2\u4FDD\u62A4", (page) => this.buildProtection(page));
        this.nav.section("basic", "\u57FA\u672C\u4FE1\u606F", (page) => this.buildBasic(page));
        this.nav.section("risk", "\u6240\u6709\u6743\u4E0E\u98CE\u9669", (page) => this.buildRisk(page));
        this.nav.section("application", "\u571F\u5730\u7533\u8BF7", (page) => this.buildApplication(page));
        this.nav.section("plaza", "\u516C\u5171\u5E7F\u573A", (page) => void this.buildPlaza(page));
      }
      buildHome(page) {
        debug.i("GUI", "LandGUI.buildHome");
        const land = LandCore.getLandByPos(
          {
            x: Math.floor(this.player.location.x),
            y: Math.floor(this.player.location.y),
            z: Math.floor(this.player.location.z)
          },
          dimensionId(this.player)
        );
        const owned = LandCore.getPlayerLands(this.player.id);
        const application = this.state.application;
        page.label(
          ListFormInfo([
            land ? `\u5F53\u524D\u571F\u5730\uFF1A${land.nickname || land.id} \xB7 ${roleText(land, this.player.id)}` : "\u5F53\u524D\u4E0D\u5728\u571F\u5730\u4FDD\u62A4\u8303\u56F4\u5185\u3002",
            `\u62E5\u6709\u571F\u5730\uFF1A${owned.length} \u5757`,
            application?.pos1 || application?.pos2 ? `\u7533\u8BF7\u72B6\u6001\uFF1A\u5DF2\u9009\u62E9 ${application.pos1 && application.pos2 ? "\u4E24\u70B9\uFF0C\u7B49\u5F85\u786E\u8BA4" : "\u4E00\u70B9"}` : "\u7533\u8BF7\u72B6\u6001\uFF1A\u672A\u5F00\u59CB",
            `\u5F85\u5904\u7406\u9080\u8BF7\uFF1A${this.state.invites.length} \u9879`
          ])
        );
        if (land) page.button("\u5F53\u524D\u571F\u5730", () => this.openLand(land, "current"));
        page.button("\u6211\u7684\u571F\u5730", () => void this.nav.rebuild("landList"));
        page.button("\u{1F3DB}\uFE0F \u516C\u5171\u5E7F\u573A", () => void this.nav.rebuild("plaza"));
        page.button(application?.pos1 || application?.pos2 ? "\u7EE7\u7EED\u7533\u8BF7" : "\u7533\u8BF7\u571F\u5730", () => void this.openApplication());
        page.button(
          `\u6536\u5230\u7684\u9080\u8BF7${this.state.invites.length ? ` (${this.state.invites.length})` : ""}`,
          () => void this.loadInvites()
        );
      }
      async buildPlaza(page) {
        debug.i("GUI", "LandGUI.buildPlaza");
        const status = new FormStatus(page);
        const plaza = Database.getById("PUBLIC-PLAZA");
        if (!plaza) {
          page.label(ListFormInfo(["\xA7c\u516C\u5171\u5E7F\u573A\u5C1A\u672A\u521D\u59CB\u5316\uFF08db-server \u91CD\u542F\u540E\u4F1A\u81EA\u6108\uFF09\u3002", "\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u8054\u7CFB\u7BA1\u7406\u5458\u3002"]));
          return;
        }
        const settings = await this.fetchPlazaSettings();
        const info = LandCore.getCubeInfo(plaza.posA, plaza.posB);
        const role = getPlayerRole(plaza, this.player.id);
        page.label(
          ListFormInfo([
            `\xA7e${settings.name} \xA77\xB7 ${LandCore.getDimensionName(plaza.dimid)}`,
            "",
            `\u8303\u56F4\uFF1A\xA7f${plaza.posA.x}..${plaza.posB.x} \xA78| \xA7f${plaza.posA.z}..${plaza.posB.z}`,
            `\u8986\u76D6\u9762\u79EF\uFF1A\xA7a${info.square} \xA77\u683C`,
            `\u4F60\u7684\u89D2\u8272\uFF1A\xA7b${role ? ROLE_NAMES[role] : "\u8BBF\u5BA2\uFF08\u9ED8\u8BA4\u5F00\u653E\u5EFA\u9020\uFF09"}`,
            "",
            `\xA77${settings.welcome}`,
            "",
            "\xA77\u5728\u8FD9\u91CC\u6240\u6709\u73A9\u5BB6\u90FD\u53EF\u4EE5\u653E\u7F6E\u3001\u7834\u574F\u3001\u4E92\u52A8\u3002",
            "\xA77\u7528\u4F5C\u670D\u52A1\u5668\u8D77\u70B9\u3001\u8BAE\u4E8B\u5385\u3001\u4E34\u65F6\u5EFA\u9020\u3002"
          ])
        );
        page.button(
          "\xA7l\u4F20\u9001\u81F3\u5E7F\u573A\u4E2D\u5FC3",
          () => void this.nav.runTask(status, async () => {
            try {
              await this.player.teleport({ x: 0.5, y: 64, z: 0.5 });
            } catch {
            }
            Msg.success(`\u5DF2\u4F20\u9001\u81F3${settings.name}`, this.player);
          })
        );
        page.button("\u67E5\u770B\u571F\u5730\u8BE6\u60C5", () => this.openLand(plaza, "current"));
        page.button("\u2190 \u8FD4\u56DE\u4E3B\u9875", () => void this.nav.replace("home"));
      }
      async fetchPlazaSettings() {
        try {
          const { HttpDB: HttpDB2 } = await Promise.resolve().then(() => (init_HttpDB(), HttpDB_exports));
          const body = await HttpDB2.get("/api/sfmc/settings/land:plaza");
          if (body) {
            const parsed = JSON.parse(body);
            if (parsed?.value) {
              return {
                name: "\u516C\u5171\u5E7F\u573A",
                welcome: "\u6B22\u8FCE\u6765\u5230\u670D\u52A1\u5668\uFF01\u8FD9\u91CC\u662F\u516C\u5171\u9886\u5730\uFF0C\u6240\u6709\u4EBA\u90FD\u53EF\u4EE5\u5EFA\u9020\u3002",
                dimid: 0,
                range: 32,
                ...JSON.parse(parsed.value)
              };
            }
          }
        } catch {
        }
        return {
          name: "\u516C\u5171\u5E7F\u573A",
          welcome: "\u6B22\u8FCE\u6765\u5230\u670D\u52A1\u5668\uFF01\u8FD9\u91CC\u662F\u516C\u5171\u9886\u5730\uFF0C\u6240\u6709\u4EBA\u90FD\u53EF\u4EE5\u5EFA\u9020\u3002",
          dimid: 0,
          range: 32
        };
      }
      buildCurrent(page) {
        debug.i("GUI", "LandGUI.buildCurrent");
        const land = this.currentLand();
        if (!land) {
          page.label(ListFormInfo(["\u571F\u5730\u6570\u636E\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u8FD4\u56DE\u571F\u5730\u4E2D\u5FC3\u3002"]));
          return;
        }
        this.buildLandSummary(page, land);
        page.button("\u67E5\u770B\u8BE6\u60C5", () => void this.nav.rebuild("landDetail"));
      }
      buildLandList(page) {
        debug.i("GUI", "LandGUI.buildLandList");
        const lands = LandCore.getPlayerLands(this.player.id);
        page.label(ListFormInfo([`\u62E5\u6709 \xA7e${lands.length}\xA7r / ${Database.getConfig().maxLandsPerPlayer} \u5757\u571F\u5730\u3002`]));
        if (!lands.length) {
          page.label("\u4F60\u8FD8\u6CA1\u6709\u571F\u5730\u3002");
          page.button("\u7533\u8BF7\u571F\u5730", () => void this.openApplication());
          return;
        }
        for (const land of lands) {
          const info = LandCore.getCubeInfo(land.posA, land.posB);
          page.button(
            `${land.nickname || land.id}
${LandCore.getDimensionName(land.dimid)} \xB7 ${info.square} \u683C \xB7 ${(land.members || []).length} \u540D\u6210\u5458`,
            () => this.openLand(land, "landDetail")
          );
        }
      }
      buildLandDetail(page) {
        debug.i("GUI", "LandGUI.buildLandDetail");
        const land = this.currentLand();
        if (!land) {
          page.label("\u571F\u5730\u6570\u636E\u5DF2\u66F4\u65B0\uFF0C\u8BF7\u8FD4\u56DE\u91CD\u8BD5\u3002");
          return;
        }
        this.buildLandSummary(page, land);
        if (canManage(land, this.player.id, "manage_members"))
          page.button("\u6210\u5458\u4E0E\u9080\u8BF7", () => void this.nav.rebuild("members"));
        if (canManage(land, this.player.id, "manage_permissions"))
          page.button("\u8BBF\u5BA2\u4FDD\u62A4", () => void this.nav.rebuild("protection"));
        if (canManage(land, this.player.id, "rename")) page.button("\u57FA\u672C\u4FE1\u606F", () => void this.nav.rebuild("basic"));
        if (LandCore.isOwner(land, this.player.id)) page.button("\u6240\u6709\u6743\u4E0E\u98CE\u9669", () => void this.nav.rebuild("risk"));
      }
      buildLandSummary(page, land) {
        const info = LandCore.getCubeInfo(land.posA, land.posB);
        page.label(
          ListFormInfo([
            `\u571F\u5730\uFF1A${land.nickname || land.id}`,
            `\u6240\u6709\u8005\uFF1A${land.ownerName || "\u672A\u77E5"}`,
            `\u4F60\u7684\u89D2\u8272\uFF1A${roleText(land, this.player.id)}`,
            `\u7EF4\u5EA6\uFF1A${LandCore.getDimensionName(land.dimid)}`,
            `\u8303\u56F4\uFF1AX ${land.posA.x}..${land.posB.x} / Y ${land.posA.y}..${land.posB.y} / Z ${land.posA.z}..${land.posB.z}`,
            `\u9762\u79EF\uFF1A${info.square} \u683C \xB7 \u7248\u672C\uFF1A${land.version || 1}`
          ])
        );
      }
      buildMembers(page) {
        debug.i("GUI", "LandGUI.buildMembers");
        const land = this.currentLand();
        if (!land) return;
        page.label(
          ListFormInfo([
            "\u6240\u6709\u8005",
            `${land.ownerName}`,
            "\u6210\u5458\u4E0E\u89D2\u8272",
            ...(land.members || []).filter((m) => m.player_id !== land.ownerplid).map((m) => `${m.player_name_snapshot || m.player_id} \xB7 ${ROLE_NAMES[m.role]}`)
          ])
        );
        if (canManage(land, this.player.id, "manage_members"))
          page.button("\u9080\u8BF7\u6210\u5458", () => void this.nav.rebuild("invite"));
        for (const member of (land.members || []).filter((m) => m.player_id !== land.ownerplid)) {
          const canEdit = member.role !== "admin" || LandCore.isOwner(land, this.player.id);
          if (canEdit)
            page.button(`${member.player_name_snapshot || member.player_id} \xB7 ${ROLE_NAMES[member.role]}`, () => {
              this.nav.state.memberId = member.player_id;
              void this.nav.rebuild("memberEdit");
            });
        }
      }
      buildInvite(page) {
        debug.i("GUI", "LandGUI.buildInvite");
        const land = this.currentLand();
        if (!land) return;
        const status = new FormStatus(page);
        const online = world19.getPlayers().filter((p) => p.id !== land.ownerplid && !(land.members || []).some((m) => m.player_id === p.id));
        const names = online.map((p) => p.name);
        if (!names.length) {
          page.label("\u6CA1\u6709\u53EF\u9080\u8BF7\u7684\u5728\u7EBF\u73A9\u5BB6\u3002");
          return;
        }
        const target = obsNum(0);
        const roleItems = (LandCore.isOwner(land, this.player.id) ? ROLES : ROLES.filter((r) => r !== "admin")).map(
          (role2) => ({ value: role2, label: ROLE_NAMES[role2] })
        );
        const role = obsNum(0);
        page.dropdown(
          "\u73A9\u5BB6",
          target,
          names.map((name, value) => ({ value, label: name }))
        );
        page.dropdown(
          "\u89D2\u8272",
          role,
          roleItems.map((item, value) => ({ value, label: item.label }))
        );
        page.button(
          "\u53D1\u9001\u9080\u8BF7",
          () => void this.nav.runTask(status, async () => {
            const player = online[target.getData()];
            const selectedRole = roleItems[role.getData()]?.value;
            if (!player || !selectedRole) throw new Error("\u8BF7\u9009\u62E9\u73A9\u5BB6\u548C\u89D2\u8272");
            const result = await inviteMember(land.id, this.player.id, player.id, selectedRole);
            if (!result.ok) throw new Error(result.message || result.error || "\u9080\u8BF7\u5931\u8D25");
            status.ok(`\u5DF2\u5411 ${player.name} \u53D1\u9001${ROLE_NAMES[selectedRole]}\u9080\u8BF7\u3002`);
            await Database.refresh();
          })
        );
      }
      buildMemberEdit(page) {
        debug.i("GUI", "LandGUI.buildMemberEdit");
        const land = this.currentLand();
        const memberId = this.nav.state.memberId;
        const member = land?.members?.find((item) => item.player_id === memberId);
        if (!land || !member) return;
        const status = new FormStatus(page);
        const canChangeAdmin = LandCore.isOwner(land, this.player.id);
        const roles = canChangeAdmin ? ROLES : ROLES.filter((r) => r !== "admin");
        const role = obsNum(Math.max(0, roles.indexOf(member.role)));
        page.label(
          ListFormInfo([`\u73A9\u5BB6\uFF1A${member.player_name_snapshot || member.player_id}`, `\u5F53\u524D\u89D2\u8272\uFF1A${ROLE_NAMES[member.role]}`])
        );
        page.dropdown(
          "\u65B0\u89D2\u8272",
          role,
          roles.map((item, value) => ({ value, label: ROLE_NAMES[item] }))
        );
        page.button(
          "\u4FDD\u5B58\u89D2\u8272",
          () => void this.nav.runTask(status, async () => {
            const next = roles[role.getData()];
            const result = await updateLandMember(land.id, this.player.id, member.player_id, next);
            if (!result.ok || !result.land) throw new Error(result.message || result.error || "member update failed");
            Database.upsert(result.land);
            status.ok("\u6210\u5458\u89D2\u8272\u5DF2\u66F4\u65B0\u3002");
          })
        );
        page.button("\u79FB\u9664\u6210\u5458", () => void this.removeMember(land, member.player_id, status));
      }
      buildInvites(page) {
        debug.i("GUI", "LandGUI.buildInvites");
        const status = new FormStatus(page);
        if (!this.state.invites.length) {
          page.label("\u6CA1\u6709\u5F85\u5904\u7406\u9080\u8BF7\u3002");
          return;
        }
        for (const invite of this.state.invites) {
          page.label(
            ListFormInfo([
              `\u571F\u5730\uFF1A${invite.land_id}`,
              `\u89D2\u8272\uFF1A${ROLE_NAMES[invite.role] || invite.role}`,
              `\u9080\u8BF7\u4EBA\uFF1A${invite.inviter_id}`
            ])
          );
          page.button(
            "\u63A5\u53D7",
            () => void this.nav.runTask(status, async () => {
              const land = await acceptInvite(this.player.id, invite.id);
              if (!land) throw new Error("accept failed");
              Database.upsert(land);
              await this.loadInvites();
            })
          );
          page.button(
            "\u62D2\u7EDD",
            () => void this.nav.runTask(status, async () => {
              if (!await declineInvite(this.player.id, invite.id)) throw new Error("decline failed");
              await this.loadInvites();
            })
          );
        }
      }
      buildProtection(page) {
        debug.i("GUI", "LandGUI.buildProtection");
        const land = this.currentLand();
        if (!land) return;
        const status = new FormStatus(page);
        const fields = [
          ["\u5141\u8BB8\u5EFA\u9020", "allow_place", land.permissions.allow_place || land.permissions.allow_destroy],
          ["\u5141\u8BB8\u6253\u5F00\u5BB9\u5668", "open_container", land.permissions.open_container],
          ["\u5141\u8BB8\u4F7F\u7528\u95E8\u548C\u6309\u94AE", "use_door", land.permissions.use_door || land.permissions.use_button],
          ["\u5141\u8BB8\u4F7F\u7528\u7EA2\u77F3", "use_redstone", land.permissions.use_redstone],
          ["\u5141\u8BB8\u4EA4\u4E92\u5B9E\u4F53", "interact_entity", land.permissions.interact_entity],
          ["\u5141\u8BB8\u653B\u51FB\u5B9E\u4F53", "attack_entity", land.permissions.attack_entity],
          ["\u5141\u8BB8\u62FE\u53D6\u7269\u54C1", "pickup_item", land.permissions.pickup_item]
        ];
        const values = fields.map((field) => obsBool(!!field[2]));
        fields.forEach((field, index) => page.toggle(field[0], values[index]));
        page.button(
          "\u4FDD\u5B58\u4FDD\u62A4\u8BBE\u7F6E",
          () => void this.nav.runTask(status, async () => {
            const permissions = {
              ...land.permissions,
              allow_place: values[0].getData(),
              allow_destroy: values[0].getData(),
              open_container: values[1].getData(),
              use_door: values[2].getData(),
              use_button: values[2].getData(),
              use_redstone: values[3].getData(),
              interact_entity: values[4].getData(),
              attack_entity: values[5].getData(),
              pickup_item: values[6].getData()
            };
            const updated = await Database.update({ ...land, permissions }, this.player.id);
            if (!updated) throw new Error("protection update failed");
            status.ok("\u8BBF\u5BA2\u4FDD\u62A4\u5DF2\u4FDD\u5B58\u3002");
          })
        );
      }
      buildBasic(page) {
        debug.i("GUI", "LandGUI.buildBasic");
        const land = this.currentLand();
        if (!land) return;
        const status = new FormStatus(page);
        const name = obsStr(land.nickname || "");
        page.textField("\u571F\u5730\u540D\u79F0", name, { description: "\u7559\u7A7A\u5219\u4F7F\u7528\u571F\u5730\u7F16\u53F7" });
        page.label(
          ListFormInfo([
            `\u8303\u56F4\uFF1A${land.posA.x}..${land.posB.x}, ${land.posA.y}..${land.posB.y}, ${land.posA.z}..${land.posB.z}`,
            `\u521B\u5EFA\u65F6\u95F4\uFF1A${new Date(land.createdAt).toLocaleString()}`
          ])
        );
        page.button(
          "\u4FDD\u5B58\u540D\u79F0",
          () => void this.nav.runTask(status, async () => {
            const updated = await Database.update({ ...land, nickname: name.getData().trim() }, this.player.id);
            if (!updated) throw new Error("name update failed");
            status.ok("\u571F\u5730\u540D\u79F0\u5DF2\u4FDD\u5B58\u3002");
          })
        );
      }
      buildRisk(page) {
        debug.i("GUI", "LandGUI.buildRisk");
        const land = this.currentLand();
        if (!land || !LandCore.isOwner(land, this.player.id)) return;
        const status = new FormStatus(page);
        page.label(
          ListFormInfo([
            "\u8FD9\u4E9B\u64CD\u4F5C\u4F1A\u6539\u53D8\u571F\u5730\u6240\u6709\u6743\u6216\u6C38\u4E45\u5220\u9664\u571F\u5730\u3002",
            "\u8F6C\u8BA9\u7ED9\u5728\u7EBF\u73A9\u5BB6\u4F1A\u7ACB\u523B\u53D8\u66F4\u6240\u6709\u8005\u5E76\u9000\u4F60\u4E3A\u7BA1\u7406\u5458\uFF1B",
            "\u82E5\u76EE\u6807\u73A9\u5BB6\u6682\u65F6\u79BB\u7EBF\uFF0C\u8BF7\u6539\u5728\u300C\u6210\u5458\u4E0E\u9080\u8BF7\u300D\u9080\u8BF7\u5BF9\u65B9\u4E3A\u7BA1\u7406\u5458\u3002",
            "\u5220\u9664\u540E\u571F\u5730\u5C06\u8FDB\u5165\u5DF2\u5220\u9664\u72B6\u6001\u5E76\u6309\u6BD4\u4F8B\u9000\u6B3E\u3002"
          ])
        );
        page.button("\u8F6C\u8BA9\u571F\u5730\uFF08\u5728\u7EBF\uFF09", () => void this.transferLand(land, status));
        page.button("\u5220\u9664\u571F\u5730", () => void this.deleteLand(land, status));
      }
      buildApplication(page) {
        debug.i("GUI", "LandGUI.buildApplication");
        const status = new FormStatus(page);
        const session = LandCore.getSession(this.player.id) || (LandCore.initSession(this.player.id), LandCore.getSession(this.player.id));
        const application = this.state.application || {
          ...session,
          dimensionId: session?.dimensionId ?? dimensionId(this.player)
        };
        this.state.application = application;
        const body = [
          `\u7B2C\u4E00\u70B9\uFF1A${application.pos1 ? `(${application.pos1.x}, ${application.pos1.y}, ${application.pos1.z})` : "\u672A\u8BBE\u7F6E"}`,
          `\u7B2C\u4E8C\u70B9\uFF1A${application.pos2 ? `(${application.pos2.x}, ${application.pos2.y}, ${application.pos2.z})` : "\u672A\u8BBE\u7F6E"}`
        ];
        page.label(ListFormInfo(body));
        if (application.pos1 && application.pos2) {
          const info = LandCore.getCubeInfo(application.pos1, application.pos2);
          void this.refreshPreviewPrice(application.pos1, application.pos2, application.dimensionId, info);
          page.label(
            ListFormInfo([
              `\u9762\u79EF\uFF1A${info.square} \u683C`,
              `\u9884\u4F30\u4EF7\u683C\uFF1A${this.state.previewPrice ?? "-"} ${Money.UNIT}`,
              `\u5F53\u524D\u4F59\u989D\uFF1A${Money.get(this.player)} ${Money.UNIT}`
            ])
          );
          page.button(
            "\u786E\u8BA4\u8D2D\u4E70",
            () => void this.nav.runTask(status, async () => {
              const result = await LandCore.validateCreation(
                this.player,
                application.pos1,
                application.pos2,
                application.dimensionId
              );
              if (!result.ok) throw new Error(result.msg || "validation failed");
              const land = await LandCore.createLand(
                this.player,
                application.pos1,
                application.pos2,
                application.dimensionId
              );
              if (!land) throw new Error("purchase failed");
              this.state.application = void 0;
              this.state.previewPrice = void 0;
              this.state.selectedLandId = land.id;
              await this.nav.replace("landDetail");
              const balance = await Money.load(this.player);
              Msg.success(`\u571F\u5730\u8D2D\u4E70\u6210\u529F\uFF0C\u5DF2\u6263\u9664\u8D39\u7528\u3002\u5F53\u524D\u4F59\u989D\uFF1A${balance} ${Money.UNIT}`, this.player);
            })
          );
        } else {
          page.label("\u8BF7\u5728\u6E38\u620F\u5185\u4F7F\u7528 !pos1 \u548C !pos2 \u8BBE\u7F6E\u4E24\u4E2A\u89D2\u70B9\u3002");
        }
        page.button("\u53D6\u6D88\u7533\u8BF7", () => {
          LandCore.clearSession(this.player.id);
          this.state.application = void 0;
          this.state.previewPrice = void 0;
          void this.nav.replace("home");
        });
      }
      async loadInvites() {
        debug.i("GUI", "LandGUI.loadInvites");
        this.state.invites = await getInvites(this.player.id);
        await this.nav.replace("invites");
      }
      /**
       * 通过服务端 validateLand 拿到权威价；client 公式不再用于报价。
       * 受网络 / 服务端故障时仍降级显示 client 估算，避免 UI 卡死。
       */
      async refreshPreviewPrice(posA, posB, dimid, info) {
        try {
          const { validateLand: validateLand2 } = await Promise.resolve().then(() => (init_LandApi(), LandApi_exports));
          const r = await validateLand2({ ownerId: this.player.id, ownerName: this.player.name, dimid, posA, posB });
          if (r.ok && typeof r.price === "number") {
            if (this.state.previewPrice !== r.price) {
              this.state.previewPrice = r.price;
              void this.nav.refresh();
            }
            return;
          }
        } catch (error) {
          debug.w("GUI", `refreshPreviewPrice fallback: ${error.message}`);
        }
        const cfg = Database.getConfig();
        const local = Math.max(0, Math.floor((info.square * 8 + info.height * 20) * cfg.discount));
        if (this.state.previewPrice !== local) {
          this.state.previewPrice = local;
          void this.nav.refresh();
        }
      }
      openLand(land, section) {
        this.state.selectedLandId = land.id;
        void this.nav.rebuild(section);
      }
      openApplication() {
        if (!LandCore.getSession(this.player.id)) LandCore.initSession(this.player.id);
        const session = LandCore.getSession(this.player.id);
        this.state.application = session ? { ...session, dimensionId: session.dimensionId ?? dimensionId(this.player) } : void 0;
        void this.nav.rebuild("application");
      }
      async removeMember(land, memberId, status) {
        const result = await removeLandMember(land.id, this.player.id, memberId);
        if (!result.ok || !result.land) {
          status.fail(result.message || "\u79FB\u9664\u6210\u5458\u5931\u8D25\u3002");
          return;
        }
        Database.upsert(result.land);
        status.ok("\u6210\u5458\u5DF2\u79FB\u9664\u3002");
        await this.nav.refresh();
      }
      async transferLand(land, status) {
        const target = world19.getPlayers().find((p) => p.id !== this.player.id);
        if (!target) {
          await this.nav.message(
            "\u65E0\u6CD5\u8F6C\u8BA9\u571F\u5730",
            "\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u3002\n\u571F\u5730\u8F6C\u8BA9\u76EE\u524D\u53EA\u80FD\u9009\u62E9\u5728\u7EBF\u73A9\u5BB6\u3002\n\n\u8BF7\u8FD4\u56DE\u540E\u5728\u5176\u4ED6\u73A9\u5BB6\u5728\u7EBF\u65F6\u91CD\u8BD5\u3002"
          );
          return;
        }
        if (!await this.nav.confirmMessage(
          "\u8F6C\u8BA9\u571F\u5730",
          `\u786E\u5B9A\u5C06 ${land.nickname || land.id} \u8F6C\u8BA9\u7ED9 ${target.name} \u5417\uFF1F\u8F6C\u8BA9\u540E\u4F60\u5C06\u6210\u4E3A\u7BA1\u7406\u5458\u3002`,
          "\u786E\u8BA4\u8F6C\u8BA9",
          "\u8FD4\u56DE"
        ))
          return;
        const { transferLand: transferLand2 } = await Promise.resolve().then(() => (init_LandApi(), LandApi_exports));
        await this.nav.runTask(status, async () => {
          const requestId = `land-transfer:${this.player.id}:${land.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
          const result = await transferLand2(land.id, this.player.id, target.id, target.name, land.version, requestId);
          if (!result.ok || !result.land) {
            if (result.error === "version_conflict") {
              await this.refreshAfterConflict();
              return;
            }
            await this.nav.replace("home");
            Msg.error(landErrorMessage(result.error, result.message), this.player);
            return;
          }
          Database.upsert(result.land);
          await this.nav.replace("home");
          Msg.success(`\u571F\u5730\u5DF2\u8F6C\u8BA9\u7ED9 ${target.name}\u3002`, this.player);
        });
      }
      async deleteLand(land, status) {
        if (!await this.nav.confirmMessage(
          "\u5220\u9664\u571F\u5730",
          `\u786E\u5B9A\u5220\u9664 ${land.nickname || land.id} \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF0C\u9000\u6B3E\u7531\u670D\u52A1\u5668\u6309\u89C4\u5219\u8BA1\u7B97\u3002`,
          "\u786E\u8BA4\u5220\u9664",
          "\u8FD4\u56DE"
        ))
          return;
        await this.nav.runTask(status, async () => {
          const requestId = `land-delete:${this.player.id}:${land.id}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
          const deleted = await LandCore.deleteLand(land.id, this.player, requestId);
          if (!deleted.ok) {
            if (deleted.error === "version_conflict") {
              await this.refreshAfterConflict();
              return;
            }
            this.state.selectedLandId = void 0;
            await this.nav.replace("home");
            Msg.error(landErrorMessage(deleted.error, deleted.message), this.player);
            return;
          }
          if (deleted.balance !== void 0) Money.setCached(this.player, deleted.balance, deleted.balanceVersion || 0);
          this.state.selectedLandId = void 0;
          await this.nav.replace("home");
          Msg.success(`\u571F\u5730\u5DF2\u5220\u9664\uFF0C\u83B7\u5F97 ${deleted.refund || 0} ${Money.UNIT}\u3002`, this.player);
        });
      }
      async refreshAfterConflict() {
        await Database.refresh();
        await this.nav.replace("landDetail");
        await this.nav.message("\u571F\u5730\u6570\u636E\u5DF2\u66F4\u65B0", "\u571F\u5730\u6570\u636E\u5DF2\u88AB\u5176\u4ED6\u64CD\u4F5C\u66F4\u65B0\u3002\n\u5DF2\u5237\u65B0\u6700\u65B0\u6570\u636E\uFF0C\u8BF7\u91CD\u65B0\u786E\u8BA4\u672C\u6B21\u64CD\u4F5C\u3002");
      }
    };
  }
});

// scripts/land/LandTax.ts
import { system as system20 } from "@minecraft/server";
var LandTax;
var init_LandTax = __esm({
  "scripts/land/LandTax.ts"() {
    "use strict";
    init_DebugLog();
    init_HttpDB();
    LandTax = class {
      static start() {
        debug.i("LAND", "LandTax.start");
        if (this.intervalId !== null) return;
        this.intervalId = system20.runInterval(() => {
          this.collectAllTaxes();
        }, this.CHECK_INTERVAL);
      }
      static stop() {
        debug.i("LAND", "LandTax.stop");
        if (this.intervalId !== null) {
          system20.clearRun(this.intervalId);
          this.intervalId = null;
        }
      }
      static async collectAllTaxes() {
        debug.i("LAND", "collectAllTaxes: starting tax collection");
        const result = await HttpDB.typedRequest("Get", "/api/sfmc/lands");
        if (!result.ok) {
          debug.e("LAND", "collectAllTaxes: failed to fetch lands");
          return;
        }
        const lands = result.data?.lands || [];
        debug.i("LAND", `collectAllTaxes: processing ${lands.length} lands`);
        for (const land of lands) {
          if (land.tax_rate <= 0) continue;
          if (land.tax_due_at && land.tax_due_at > Date.now()) continue;
          const taxResult = await HttpDB.typedRequest(
            "Post",
            `/api/sfmc/lands/${encodeURIComponent(land.id)}/tax-collect`,
            {
              actorId: "system"
            }
          );
          if (!taxResult.ok && taxResult.data?.frozen) {
            debug.w("LAND", `collectAllTaxes: land ${land.name || land.id} frozen due to tax debt`);
          }
        }
      }
    };
    LandTax.intervalId = null;
    LandTax.CHECK_INTERVAL = 7200;
  }
});

// scripts/land/LandSystem.ts
import { system as system21 } from "@minecraft/server";
function handlePosCommand(player, which) {
  const plid = player.id;
  const pos = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
  const session = LandCore.getSession(plid);
  if (!session) return Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
  if (session.dimensionId !== void 0 && session.dimensionId !== dimid)
    return Msg.error("\u571F\u5730\u9009\u70B9\u4E0D\u80FD\u8DE8\u7EF4\u5EA6\uFF0C\u8BF7\u5728\u540C\u4E00\u7EF4\u5EA6\u91CD\u65B0\u9009\u62E9\u3002", player);
  if (session.dimensionId === void 0) LandCore.setDimension(plid, dimid);
  if (which === 1) {
    LandCore.setPos1(plid, pos);
    Msg.success(`\u5DF2\u8BBE\u7F6E\u7B2C\u4E00\u70B9 \xA7f(${pos.x}, ${pos.y}, ${pos.z})`, player);
  } else {
    LandCore.setPos2(plid, pos);
    Msg.success(`\u5DF2\u8BBE\u7F6E\u7B2C\u4E8C\u70B9 \xA7f(${pos.x}, ${pos.y}, ${pos.z})`, player);
  }
  if (session.pos1 && session.pos2) {
    const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid);
    Msg.info(info, player);
    Msg.tips("\u4F7F\u7528 \xA7a!land \xA77\u6253\u5F00\u83DC\u5355\u786E\u8BA4\u7533\u8BF7\uFF0C\u6216\u4F7F\u7528 \xA7a!land cancel \xA77\u53D6\u6D88", player);
  } else {
    const next = which === 1 ? "2" : "1";
    Msg.tips(`\u8BF7\u4F7F\u7528 \xA7a!pos${next} \xA77\u8BBE\u7F6E\u7B2C${next}\u70B9`, player);
  }
}
var LandSystem;
var init_LandSystem = __esm({
  "scripts/land/LandSystem.ts"() {
    "use strict";
    init_LandGUI();
    init_Command();
    init_DebugLog();
    init_Permission();
    init_Tools();
    init_LandCore();
    init_LandDatabase();
    init_LandTax();
    LandSystem = class {
      /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
      static registerCommandsAndPermissions() {
        debug.i("LAND", "registerCommandsAndPermissions");
        Permission.register("land.use", Permission.Any);
        Command.register(
          "land",
          "land.use",
          (player) => {
            if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
            LandGUI.showMainMenu(player);
          },
          "\u571F\u5730\u7BA1\u7406",
          "land"
        );
        Command.register(
          "land here",
          "land.use",
          (player) => {
            if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
            const pos = {
              x: Math.floor(player.location.x),
              y: Math.floor(player.location.y),
              z: Math.floor(player.location.z)
            };
            const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
            const land = LandCore.getLandByPos(pos, dimid);
            if (!land) return "\u5F53\u524D\u4F4D\u7F6E\u4E0D\u5728\u4EFB\u4F55\u571F\u5730\u5185\u3002";
            return `\u571F\u5730\uFF1A${land.nickname || land.id}\uFF0C\u6240\u6709\u8005\uFF1A${land.ownerName}\uFF0C\u7248\u672C\uFF1A${land.version || 1}`;
          },
          "\u67E5\u8BE2\u5F53\u524D\u571F\u5730",
          "land"
        );
        Command.register(
          "land cancel",
          "land.use",
          (player) => {
            if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
            if (LandCore.clearSession(player.id)) Msg.success("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
            else Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
          },
          "\u53D6\u6D88\u571F\u5730\u7533\u8BF7",
          "land"
        );
        Command.register(
          "pos1",
          "land.use",
          (player) => {
            if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
            handlePosCommand(player, 1);
          },
          "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E00\u70B9",
          "land"
        );
        Command.register(
          "pos2",
          "land.use",
          (player) => {
            if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
            handlePosCommand(player, 2);
          },
          "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E8C\u70B9",
          "land"
        );
      }
      static init() {
        debug.i("LAND", "init");
        void Database.loadFromServer();
        LandTax.start();
        this.refreshRunId = system21.runInterval(() => {
          LandCore.clearExpiredSessions();
          void Database.refresh();
        }, 20 * 60);
      }
      static cleanup() {
        debug.i("LAND", "cleanup");
        LandTax.stop();
        if (this.refreshRunId !== void 0) system21.clearRun(this.refreshRunId);
        this.refreshRunId = void 0;
      }
    };
  }
});

// scripts/gui/AdminGUI.ts
var MODULES, AdminGUI;
var init_AdminGUI = __esm({
  "scripts/gui/AdminGUI.ts"() {
    "use strict";
    init_CreativeArea();
    init_Peace();
    init_ConfigManager();
    init_HttpDB();
    init_MenuNavigator();
    init_Tools();
    MODULES = [
      "fly",
      "creative",
      "survival",
      "peace",
      "inventory_switcher",
      "afk",
      "clean",
      "qa",
      "chat",
      "coop",
      "land",
      "money",
      "tps",
      "online_time",
      "activity_log",
      "scoreboard_sync",
      "spawn_protect",
      "chat_sounds"
    ];
    AdminGUI = class _AdminGUI {
      constructor(player) {
        this.player = player;
        this.nav = new MenuNavigator(player);
        this.nav.section("main", "\u7BA1\u7406\u9762\u677F", (p) => this.buildMain(p));
      }
      static show(player) {
        new _AdminGUI(player).nav.start("main");
      }
      buildMain(page) {
        page.label(ListFormInfo(["\u6A21\u5757\u5F00\u5173"]));
        for (const name of MODULES) {
          const toggle = obsBool(ConfigManager.isEnabled(name));
          toggle.subscribe((val) => {
            if (val !== ConfigManager.isEnabled(name)) this.onToggle(name, val);
          });
          page.toggle(name, toggle);
        }
      }
      async onToggle(name, val) {
        const ok = await HttpDB.patch(`/api/sfmc/modules/${name}`, { enabled: val });
        if (!ok) {
          Msg.error(`${name} \u4FEE\u6539\u5931\u8D25`, this.player);
          return;
        }
        await ConfigManager.reloadAll();
        _AdminGUI.applyRuntimeState(name, val);
        Msg.success(`${name} \u5DF2${val ? "\u542F\u7528" : "\u7981\u7528"}`, this.player);
      }
      static applyRuntimeState(name, enabled) {
        if (name === "creative") CreativeArea.enable = enabled;
        if (name === "peace") Peace.getInstance().enable = enabled;
      }
    };
  }
});

// scripts/gui/ChatGUI.ts
import { world as world20 } from "@minecraft/server";
var ChatGUI;
var init_ChatGUI = __esm({
  "scripts/gui/ChatGUI.ts"() {
    "use strict";
    init_api();
    init_DogeChat();
    init_MenuNavigator();
    init_Money();
    init_Permission();
    init_Tools();
    ChatGUI = class _ChatGUI {
      constructor(player) {
        this.player = player;
        this.nav = new MenuNavigator(player);
        this.registerSections();
      }
      static openChannelPanel(player) {
        const gui = new _ChatGUI(player);
        return gui.nav.start("panel");
      }
      static openRedPacketPanel(player) {
        const gui = new _ChatGUI(player);
        return gui.nav.start("redpacket");
      }
      static openPrivateChatPanel(player) {
        const gui = new _ChatGUI(player);
        return gui.nav.start("private");
      }
      static async sendLocation(player) {
        const channel = await DogeChat.getActiveChannel(player);
        if (!channel) return;
        const loc2 = DogeChat.createLocationMessage(player);
        await DogeChat.sendChannelMessage(player, channel.id, loc2, "location");
      }
      static async sendTeleportInvite(player) {
        const channel = await DogeChat.getActiveChannel(player);
        if (!channel) return;
        if (channel.config.isBroadcast && !await DogeChat.isChannelOwner(player, channel.id)) {
          Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002", player);
          return;
        }
        if (channel.type === "private") {
          const otherid = DogeChat.getPrivateOther(channel.id, player.id);
          if (!otherid) {
            Msg.error("\u65E0\u6CD5\u627E\u5230\u79C1\u804A\u5BF9\u8C61\u3002", player);
            return;
          }
          const target = world20.getPlayers().find((p) => p.id === otherid);
          if (!target) {
            Msg.error("\u5BF9\u65B9\u4E0D\u5728\u7EBF\u3002", player);
            return;
          }
          DogeChat.sendTeleportInvite(player, target);
          return;
        }
        const online = world20.getPlayers().filter((p) => p.id !== player.id);
        if (online.length === 0) {
          Msg.info("\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u53EF\u9080\u8BF7\u3002", player);
          return;
        }
        new _ChatGUI(player).nav.start("invite");
      }
      static async sendRedPacketQuick(player) {
        const channel = await DogeChat.getActiveChannel(player);
        if (!channel) return;
        if (channel.config.isBroadcast && !await DogeChat.isChannelOwner(player, channel.id)) {
          Msg.warning("\u6B64\u9891\u9053\u4E3A\u516C\u544A\u677F\u9891\u9053\uFF0C\u65E0\u6CD5\u53D1\u8A00\u3002", player);
          return;
        }
        if (channel.type === "private") {
          new _ChatGUI(player).nav.start("quickSendPrivate");
        } else {
          new _ChatGUI(player).nav.start("quickSendGroup");
        }
      }
      registerSections() {
        this.nav.section("panel", "DogeChat", (page) => this.buildPanel(page));
        this.nav.section("manager", "\u9891\u9053\u7BA1\u7406", (page) => this.buildManager(page));
        this.nav.section("settings", "\u9891\u9053\u8BBE\u7F6E", (page) => this.buildSettings(page));
        this.nav.section("private", "\u79C1\u804A\u9891\u9053", (page) => this.buildPrivate(page));
        this.nav.section("redpacket", "\u7EA2\u5305", (page) => this.buildRedPacket(page));
        this.nav.section("create", "\u521B\u5EFA\u9891\u9053", (page) => this.buildCreate(page));
        this.nav.section("rename", "\u7F16\u8F91\u9891\u9053", (page) => this.buildRename(page));
        this.nav.section("pickPlayer", "\u9009\u62E9\u73A9\u5BB6", (page) => this.buildPickPlayer(page));
        this.nav.section("send", "\u53D1\u9001\u7EA2\u5305", (page) => this.buildSendRedPacket(page));
        this.nav.section("claim", "\u9886\u53D6\u7EA2\u5305", (page) => this.buildClaimRedPacket(page));
        this.nav.section("invite", "\u4F20\u9001\u9080\u8BF7", (page) => this.buildInvite(page));
        this.nav.section("quickSendPrivate", "\u53D1\u9001\u7EA2\u5305", (page) => this.buildQuickSendPrivate(page));
        this.nav.section("quickSendGroup", "\u53D1\u9001\u7EA2\u5305", (page) => this.buildQuickSendGroup(page));
      }
      async buildPanel(page) {
        const active = await DogeChat.getActiveChannel(this.player);
        if (!active) {
          page.label(ListFormInfo(["\u6570\u636E\u5E93\u8FDE\u63A5\u5931\u8D25\uFF0C\u65E0\u6CD5\u52A0\u8F7D\u9891\u9053\u3002"]));
          return;
        }
        const allChannels = await getChannels() ?? [];
        const displayChannels = allChannels.filter((c) => {
          if (c.type === "private") return false;
          if (c.type === "system") return c.ownerid === this.player.id;
          return true;
        });
        const activeLabel = obsStr(`\u2192 ${active.prefix} - ${active.name}\uFF08\u53D1\u9001\u5230\u6B64\u9891\u9053\uFF09`);
        page.label(activeLabel);
        page.button("\u9891\u9053\u7BA1\u7406", () => this.nav.go("manager"));
        page.button("\u79C1\u804A\u9891\u9053", () => this.nav.go("private"));
        for (const c of displayChannels) {
          const isPublic = c.type === "public";
          const subscribed = isPublic ? true : DogeChat.isSubscribed(this.player.id, c.id);
          const label = obsStr(
            `${subscribed ? "\xA7a\u2611" : "\xA77\u2610"} ${c.prefix} - ${c.name}
\xA7a${DogeChat.getOnlineCount(c.id)} \u4EBA\u5728\u7EBF`
          );
          page.button(label, async () => {
            if (isPublic) {
              if (c.id !== active.id) {
                DogeChat.setActiveChannel(this.player, c.id);
                activeLabel.setData(`\u2192 ${c.prefix} - ${c.name}\uFF08\u53D1\u9001\u5230\u6B64\u9891\u9053\uFF09`);
                await DogeChat.loadChannelHistory(this.player, c.id);
              }
              return;
            }
            const nowSubscribed = DogeChat.isSubscribed(this.player.id, c.id);
            if (nowSubscribed) {
              DogeChat.toggleSubscription(this.player, c.id);
              label.setData(`\xA77\u2610 ${c.prefix} - ${c.name}
\xA7a${DogeChat.getOnlineCount(c.id)} \u4EBA\u5728\u7EBF`);
              if (c.id === active.id) {
                const pub = await DogeChat.getPublicChannel();
                if (pub) {
                  DogeChat.setActiveChannel(this.player, pub.id);
                  activeLabel.setData(`\u2192 ${pub.prefix} - ${pub.name}\uFF08\u53D1\u9001\u5230\u6B64\u9891\u9053\uFF09`);
                }
              }
            } else {
              DogeChat.toggleSubscription(this.player, c.id);
              label.setData(`\xA7a\u2611 ${c.prefix} - ${c.name}
\xA7a${DogeChat.getOnlineCount(c.id)} \u4EBA\u5728\u7EBF`);
              DogeChat.setActiveChannel(this.player, c.id);
              activeLabel.setData(`\u2192 ${c.prefix} - ${c.name}\uFF08\u53D1\u9001\u5230\u6B64\u9891\u9053\uFF09`);
              await DogeChat.loadChannelHistory(this.player, c.id);
            }
          });
        }
      }
      async buildManager(page) {
        const status = new FormStatus(page);
        const allChannels = await getChannels() ?? [];
        const isAdmin = Permission.check(this.player, "chat.admin");
        page.label(ListFormInfo([`\u5171\u6709 ${allChannels.length} \u4E2A\u9891\u9053`]));
        page.button("\u521B\u5EFA\u9891\u9053", () => this.nav.go("create"));
        for (const c of allChannels) {
          page.button(`${c.prefix} - \xA7f${c.name}
\xA77${DogeChat.getOnlineCount(c.id)} \u4EBA\u5728\u7EBF`, async () => {
            if (isAdmin || await DogeChat.isChannelOwner(this.player, c.id)) {
              this.nav.state.channel = c;
              await this.nav.rebuild("settings");
            } else {
              await DogeChat.setActiveChannel(this.player, c.id);
              status.ok(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${c.prefix}`);
              await DogeChat.loadChannelHistory(this.player, c.id);
              await this.nav.rebuild("panel");
            }
          });
        }
      }
      async buildSettings(page) {
        const status = new FormStatus(page);
        const channel = this.nav.state.channel;
        if (!channel) {
          page.label("\u9891\u9053\u6570\u636E\u4E22\u5931\uFF0C\u8BF7\u8FD4\u56DE\u91CD\u8BD5\u3002");
          return;
        }
        const isOwner = await DogeChat.isChannelOwner(this.player, channel.id);
        page.label(
          ListFormInfo([
            `${channel.prefix} - ${channel.name}`,
            `\u7C7B\u578B: ${channel.type}`,
            `\u5728\u7EBF: ${DogeChat.getOnlineCount(channel.id)} \u4EBA`,
            `\u516C\u544A\u677F: ${channel.config.isBroadcast ? "\xA7a\u5F00\u542F" : "\xA7c\u5173\u95ED"}`
          ])
        );
        page.button("\u7F16\u8F91\u9891\u9053", () => {
          this.nav.state.channel = channel;
          this.nav.go("rename");
        });
        page.button(`\u516C\u544A\u677F\u6A21\u5F0F(${channel.config.isBroadcast ? "\u5F00" : "\u5173"})`, async () => {
          const ok = await DogeChat.updateChannelConfig(channel.id, { isBroadcast: !channel.config.isBroadcast });
          if (!ok) {
            status.fail("\u8BBE\u7F6E\u5931\u8D25\uFF0C\u6570\u636E\u5E93\u4E0D\u53EF\u7528\u3002");
            return;
          }
          const updated = await getChannel(channel.id);
          if (updated) {
            this.nav.state.channel = updated;
            status.ok(`\u516C\u544A\u677F\u6A21\u5F0F\u5DF2${updated.config.isBroadcast ? "\u5F00\u542F" : "\u5173\u95ED"}\u3002`);
          }
          await this.nav.rebuild("settings");
        });
        if (isOwner && channel.type !== "public") {
          page.button("\u5220\u9664\u9891\u9053", () => {
            this.nav.confirm(
              "\u5220\u9664\u9891\u9053",
              `\u786E\u8BA4\u5220\u9664\u9891\u9053 "${channel.name}" \u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`,
              () => DogeChat.deleteChannel(channel.id).then(() => status.ok(`\u9891\u9053 "${channel.name}" \u5DF2\u5220\u9664\u3002`)),
              () => this.nav.rebuild("manager")
            );
          });
        }
      }
      async buildPrivate(page) {
        const status = new FormStatus(page);
        const active = await DogeChat.getActiveChannel(this.player);
        const privateChannels = await DogeChat.getPrivateChannels(this.player);
        page.label(ListFormInfo([]));
        page.button("\u65B0\u6D88\u606F", () => this.nav.rebuild("pickPlayer"));
        for (const c of privateChannels) {
          const otherName = c.name.replace("\u4E0E", "").replace(" \u7684\u79C1\u804A", "");
          const mark = c.id === (active?.id ?? "") ? "\u25C0 " : "";
          page.button(`${mark}${otherName}`, async () => {
            if (c.id !== (active?.id ?? "")) {
              await DogeChat.setActiveChannel(this.player, c.id);
              status.ok(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${c.prefix}`);
              await DogeChat.loadChannelHistory(this.player, c.id);
            }
          });
        }
      }
      buildCreate(page) {
        const status = new FormStatus(page);
        const name = obsStr("");
        const prefix = obsStr("");
        page.textField("\u9891\u9053\u540D\u79F0", name, { description: "\u8F93\u5165\u9891\u9053\u540D\u79F0" });
        page.textField("\u663E\u793A\u524D\u7F00", prefix, { description: "\u804A\u5929\u663E\u793A\u7684\u524D\u7F00\uFF0C\u5EFA\u8BAE\u7B80\u77ED" });
        page.button("\u521B\u5EFA", async () => {
          const n = name.getData().trim();
          const p = prefix.getData().trim();
          if (!n || !p) {
            status.fail("\u9891\u9053\u540D\u79F0\u548C\u524D\u7F00\u4E0D\u80FD\u4E3A\u7A7A\u3002");
            return;
          }
          const cid = await DogeChat.createChannel(n, p, "custom", {}, this.player);
          if (cid) {
            await DogeChat.setActiveChannel(this.player, cid);
            status.ok(`\u9891\u9053 "${n}" \u521B\u5EFA\u6210\u529F\uFF0C\u5DF2\u81EA\u52A8\u5207\u6362\u3002`);
            await DogeChat.loadChannelHistory(this.player, cid);
            await this.nav.rebuild("panel");
          } else {
            status.fail("\u521B\u5EFA\u5931\u8D25\uFF0C\u53EF\u80FD\u7684\u539F\u56E0\u662F\u9891\u9053\u540D\u79F0\u5DF2\u5B58\u5728\u3002");
          }
        });
      }
      buildRename(page) {
        const status = new FormStatus(page);
        const channel = this.nav.state.channel;
        if (!channel) {
          page.label("\u9891\u9053\u6570\u636E\u4E22\u5931\u3002");
          return;
        }
        const newName = obsStr(channel.name);
        const newPrefix = obsStr(channel.prefix);
        page.textField("\u9891\u9053\u540D\u79F0", newName, { description: "\u8F93\u5165\u65B0\u540D\u79F0" });
        page.textField("\u663E\u793A\u524D\u7F00", newPrefix, { description: "\u8F93\u5165\u65B0\u524D\u7F00" });
        page.button("\u786E\u8BA4", async () => {
          const nn = newName.getData().trim();
          const np = newPrefix.getData().trim();
          if (!nn || !np) {
            status.fail("\u540D\u79F0\u548C\u524D\u7F00\u4E0D\u80FD\u4E3A\u7A7A\u3002");
            return;
          }
          const ok = await DogeChat.updateChannelName(channel.id, nn, np);
          if (!ok) {
            status.fail("\u4FEE\u6539\u5931\u8D25\uFF0C\u6570\u636E\u5E93\u4E0D\u53EF\u7528\u3002");
            return;
          }
          status.ok(`\u9891\u9053\u5DF2\u91CD\u547D\u540D\u4E3A: ${np} - ${nn}`);
          const updated = await getChannel(channel.id);
          if (updated) this.nav.state.channel = updated;
          await this.nav.rebuild("settings");
        });
      }
      async buildPickPlayer(page) {
        const status = new FormStatus(page);
        const online = this.player.dimension.getPlayers().filter((p) => p.id !== this.player.id);
        if (online.length === 0) {
          page.label(ListFormInfo(["\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u3002"]));
          return;
        }
        page.label(ListFormInfo(["\u9009\u62E9\u8981\u53D1\u9001\u79C1\u804A\u7684\u73A9\u5BB6"]));
        for (const p of online) {
          page.button(p.name, async () => {
            const pc = await DogeChat.ensurePrivateChannel(this.player.id, p.id);
            await DogeChat.setActiveChannel(this.player, pc.id);
            status.ok(`\u5DF2\u5207\u6362\u5230\u4E0E ${p.name} \u7684\u79C1\u804A\u9891\u9053\u3002`);
            await DogeChat.loadChannelHistory(this.player, pc.id);
          });
        }
      }
      async buildRedPacket(page) {
        const available = await DogeChat.getAvailableRedPackets(this.player);
        if (available) {
          page.label(ListFormInfo(available.length > 0 ? [`${available.length} \u4E2A\u7EA2\u5305\u53EF\u9886\u53D6`] : ["\u6682\u65E0\u53EF\u7528\u7EA2\u5305"]));
          page.button("\u53D1\u9001\u7EA2\u5305", () => this.nav.go("send"));
          this.nav.state.redPackets = available;
          if (available.length > 0) {
            page.button("\u9886\u53D6\u7EA2\u5305", () => this.nav.go("claim"));
          }
        }
      }
      buildSendRedPacket(page) {
        const status = new FormStatus(page);
        const amount = obsStr("");
        const count = obsStr("1");
        const targetTypeIdx = obsNum(0);
        const targetPlayer = obsStr("");
        page.textField("\u91D1\u989D", amount, { description: "\u8F93\u5165\u7EA2\u5305\u603B\u91D1\u989D" });
        page.textField("\u4EFD\u6570", count, { description: "\u8F93\u5165\u7EA2\u5305\u4EFD\u6570" });
        page.dropdown("\u76EE\u6807\u7C7B\u578B", targetTypeIdx, [
          { label: "\u5F53\u524D\u9891\u9053", value: 0 },
          { label: "\u6307\u5B9A\u73A9\u5BB6", value: 1 }
        ]);
        page.textField("\u76EE\u6807\u73A9\u5BB6\u540D\uFF08\u6307\u5B9A\u73A9\u5BB6\u65F6\u586B\u5199\uFF09", targetPlayer, { description: "\u7559\u7A7A\u5219\u53D1\u5230\u5F53\u524D\u9891\u9053" });
        page.button("\u53D1\u9001", async () => {
          const amt = parseInt(amount.getData());
          const cnt = parseInt(count.getData());
          const tgtType = targetTypeIdx.getData();
          const tp = targetPlayer.getData().trim();
          if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
            status.fail("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u548C\u4EFD\u6570\u3002");
            return;
          }
          if (tgtType === 0) {
            const active = await DogeChat.getActiveChannel(this.player);
            if (active) {
              const ok = await DogeChat.sendRedPacket(this.player, amt, cnt, "group", active.id);
              if (ok) await this.nav.leave(() => {
              });
              else status.fail("\u53D1\u9001\u5931\u8D25");
            }
          } else {
            const target = this.player.dimension.getPlayers().find((p) => p.name === tp);
            if (!target) {
              status.fail(`\u73A9\u5BB6 "${tp}" \u4E0D\u5728\u7EBF\u3002`);
              return;
            }
            const ok = await DogeChat.sendRedPacket(this.player, amt, cnt, "player", target.id);
            if (ok) await this.nav.leave(() => {
            });
            else status.fail("\u53D1\u9001\u5931\u8D25");
          }
        });
      }
      async buildClaimRedPacket(page) {
        const status = new FormStatus(page);
        const packets = this.nav.state.redPackets;
        if (!packets || packets.length === 0) {
          page.label("\u6682\u65E0\u53EF\u7528\u7EA2\u5305");
          return;
        }
        page.label(ListFormInfo([`\u53EF\u9886\u53D6 ${packets.length} \u4E2A\u7EA2\u5305`]));
        for (const p of packets) {
          page.button(`${p.senderName} \u7684\u7EA2\u5305 \xA77(${p.remainingAmount} \u5269\u4F59)`, async () => {
            const amount = await DogeChat.claimRedPacket(this.player, p.id);
            if (amount > 0) status.ok(`\u9886\u53D6\u4E86 ${amount} ${Money.UNIT}\uFF01`);
            else status.fail("\u9886\u53D6\u5931\u8D25");
          });
        }
      }
      async buildInvite(page) {
        const online = world20.getPlayers().filter((p) => p.id !== this.player.id);
        if (online.length === 0) {
          page.label(ListFormInfo(["\u5F53\u524D\u6CA1\u6709\u5176\u4ED6\u5728\u7EBF\u73A9\u5BB6\u53EF\u9080\u8BF7\u3002"]));
          return;
        }
        page.label(ListFormInfo(["\u9009\u62E9\u8981\u9080\u8BF7\u7684\u73A9\u5BB6"]));
        for (const p of online) {
          page.button(p.name, () => DogeChat.sendTeleportInvite(this.player, p));
        }
      }
      buildQuickSendPrivate(page) {
        const status = new FormStatus(page);
        const amount = obsStr("");
        page.textField("\u91D1\u989D", amount, { description: "\u8F93\u5165\u7EA2\u5305\u91D1\u989D" });
        page.button("\u53D1\u9001", async () => {
          const amt = parseInt(amount.getData());
          if (isNaN(amt) || amt <= 0) {
            status.fail("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u3002");
            return;
          }
          const channel = await DogeChat.getActiveChannel(this.player);
          if (!channel) return;
          const otherid = DogeChat.getPrivateOther(channel.id, this.player.id);
          if (!otherid) {
            status.fail("\u65E0\u6CD5\u627E\u5230\u79C1\u804A\u5BF9\u8C61\u3002");
            return;
          }
          const ok = await DogeChat.sendRedPacket(this.player, amt, 1, "player", otherid);
          if (ok) await this.nav.leave(() => {
          });
          else status.fail("\u53D1\u9001\u5931\u8D25");
        });
      }
      buildQuickSendGroup(page) {
        const status = new FormStatus(page);
        const amount = obsStr("");
        const count = obsStr("1");
        page.textField("\u91D1\u989D", amount, { description: "\u8F93\u5165\u7EA2\u5305\u603B\u91D1\u989D" });
        page.textField("\u4EFD\u6570", count, { description: "\u8F93\u5165\u7EA2\u5305\u4EFD\u6570" });
        page.button("\u53D1\u9001", async () => {
          const amt = parseInt(amount.getData());
          const cnt = parseInt(count.getData());
          if (isNaN(amt) || isNaN(cnt) || amt <= 0 || cnt <= 0) {
            status.fail("\u8BF7\u586B\u5199\u6709\u6548\u7684\u91D1\u989D\u548C\u4EFD\u6570\u3002");
            return;
          }
          const channel = await DogeChat.getActiveChannel(this.player);
          if (!channel) return;
          const ok = await DogeChat.sendRedPacket(this.player, amt, cnt, "group", channel.id);
          if (ok) await this.nav.leave(() => {
          });
          else status.fail("\u53D1\u9001\u5931\u8D25");
        });
      }
    };
  }
});

// scripts/coop/CoopCore.ts
import { world as world21 } from "@minecraft/server";
var CoopCore;
var init_CoopCore = __esm({
  "scripts/coop/CoopCore.ts"() {
    "use strict";
    init_api();
    init_DebugLog();
    init_Money();
    init_Tools();
    CoopCore = class {
      static generateId() {
        return `${Date.now().toString(36)}_${(++this._guidCounter).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      }
      static getConfig() {
        return this.cooperativeConfig;
      }
      static _countItemInInventory(player, typeId) {
        const inv = player.getComponent("inventory");
        if (!inv?.container) return 0;
        let total = 0;
        for (let i = 0; i < inv.container.size; i++) {
          const item = inv.container.getItem(i);
          if (item?.typeId === typeId && item.amount) total += item.amount;
        }
        return total;
      }
      static isNbtItem(item) {
        const cfg = this.cooperativeConfig.shop_setting.nbtgoods_condition;
        if (cfg.type_enum.indexOf(item.typeId) !== -1) return true;
        if (item.getComponent("minecraft:enchantments")) return true;
        for (const reg of cfg.type_reg_enum) {
          if (new RegExp(reg).test(item.typeId)) return true;
        }
        return false;
      }
      static _isBlockType(typeId) {
        const nonBlock = [
          "_sword",
          "_axe",
          "_shovel",
          "_hoe",
          "_pickaxe",
          "bow",
          "arrow",
          "helmet",
          "chestplate",
          "leggings",
          "boots",
          "potion",
          "splash_potion",
          "lingering_potion",
          "spawn_egg",
          "writable_book",
          "enchanted_book",
          "shield",
          "trident",
          "mace",
          "elytra",
          "saddle",
          "horse_armor"
        ];
        for (const suffix of nonBlock) {
          if (typeId.endsWith(suffix)) return false;
        }
        return true;
      }
      static async typeGood(item) {
        const rtv = [];
        const groups = (await getAllShopGroups()).filter((g) => g.type_function);
        for (const g of groups) {
          const tfRaw = g.type_function;
          if (!tfRaw) continue;
          const tf = typeof tfRaw === "string" ? JSON.parse(tfRaw) : tfRaw;
          if (tf.type_enum && tf.type_enum.indexOf(item.typeId) !== -1) {
            rtv.push(g.groupid);
            continue;
          }
          if (tf.mode_enum) {
            for (const mode of tf.mode_enum) {
              if (mode === "default_block" && this._isBlockType(item.typeId)) rtv.push(g.groupid);
              if (mode === "default_item" && !this._isBlockType(item.typeId)) rtv.push(g.groupid);
            }
          }
          if (tf.type_reg_enum) {
            for (const reg of tf.type_reg_enum) {
              if (new RegExp(reg).test(item.typeId)) rtv.push(g.groupid);
            }
          }
        }
        return rtv;
      }
      // ==========================================
      //  合作社操作
      // ==========================================
      static async registerCoop(name, cid, player) {
        debug.i("COOP", `registerCoop: name=${name} cid=${cid} player=${player.name}`);
        const result = await Promise.resolve().then(() => (init_CoopAPI(), CoopAPI_exports)).then(
          (api) => api.createCoop(name.trim(), cid.trim(), player.id, player.name)
        );
        if (!result.ok) {
          debug.w("COOP", `registerCoop: failed name=${name} cid=${cid}`);
          return false;
        }
        if (result.balance !== void 0) Money.setCached(player, result.balance);
        else await Money.load(player);
        debug.i("COOP", `registerCoop: success cid=${cid}`);
        return true;
      }
      static async releaseCoop(cid, actorId) {
        debug.i("COOP", `releaseCoop: cid=${cid} actorId=${actorId}`);
        const ok = await deleteCoop(cid, actorId);
        debug.i("COOP", `releaseCoop: ${ok ? "success" : "failed"} cid=${cid}`);
        return ok;
      }
      static async joinCoop(player, cid) {
        debug.i("COOP", `joinCoop: player=${player.name} cid=${cid}`);
        const data = await getCoop(cid);
        if (!data || (data.members || []).some((m) => m.player_id === player.id)) {
          debug.w("COOP", `joinCoop: already member or not found cid=${cid}`);
          return false;
        }
        if (!await joinCoop(cid, player.id, player.name)) {
          debug.e("COOP", `joinCoop: API failed cid=${cid}`);
          return false;
        }
        this.sendToMembers(cid, `\u6B22\u8FCE ${player.name} \u52A0\u5165\u5408\u4F5C\u793E\uFF01`);
        debug.i("COOP", `joinCoop: success cid=${cid}`);
        return true;
      }
      static async exitCoop(playerId2, cid) {
        debug.i("COOP", `exitCoop: playerId=${playerId2} cid=${cid}`);
        const data = await getCoop(cid);
        if (!data) {
          debug.w("COOP", "exitCoop: coop not found");
          return;
        }
        await leaveCoop(cid, playerId2);
      }
      static async sendToMembers(cid, text) {
        const data = await getCoop(cid);
        if (!data) return;
        let sent = 0;
        for (const member of data.members || []) {
          for (const p of world21.getPlayers())
            if (p.id === member.player_id) {
              Msg.info(`[${data.name}] ${text}`, p);
              sent++;
            }
        }
        debug.i("COOP", `sendToMembers: cid=${cid} sent=${sent}`);
      }
      static async getInfo(cid) {
        const data = await getCoop(cid);
        if (!data) {
          debug.w("COOP", `getInfo: coop not found cid=${cid}`);
          return "\u5408\u4F5C\u793E\u4E0D\u5B58\u5728";
        }
        const ops = (data.members || []).filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.player_name_snapshot).join(", ");
        return `\u516C\u544A\uFF1A
${data.notice}

\u5408\u4F5C\u793E\u540D\u79F0: ${data.name}
\u793E\u957F&\u7BA1\u7406: ${ops}
\u4EBA\u6570: ${(data.members || []).length}
\u94F6\u884C\u7ECF\u6D4E: ${data.account?.balance || 0}`;
      }
      static async getMemberList(cid) {
        const data = await getCoop(cid);
        const list = data ? (data.members || []).map((m) => m.player_name_snapshot) : [];
        debug.i("COOP", `getMemberList: cid=${cid} count=${list.length}`);
        return list;
      }
      static async isOp(playerId2, cid) {
        const data = await getCoop(cid);
        const result = (data?.members || []).find((m) => m.player_id === playerId2)?.role === "owner" || (data?.members || []).find((m) => m.player_id === playerId2)?.role === "admin";
        debug.i("COOP", `isOp: playerId=${playerId2} cid=${cid} result=${result}`);
        return result;
      }
      static async setOp(cid, index) {
        debug.i("COOP", `setOp: cid=${cid} index=${index}`);
        const data = await getCoop(cid);
        if (!data || !data.members || index >= data.members.length) {
          debug.w("COOP", "setOp: invalid index or data");
          return;
        }
        const member = data.members[index];
        await Promise.resolve().then(() => (init_CoopAPI(), CoopAPI_exports)).then(
          (api) => api.updateMemberRole(cid, data.owner_player_id, member.player_id, "admin")
        );
      }
      static async setNotice(cid, text) {
        debug.i("COOP", `setNotice: cid=${cid} text=${text}`);
        const data = await getCoop(cid);
        if (data) await updateCoop(cid, { actorId: data.owner_player_id, notice: text });
      }
      // ==========================================
      //  银行操作
      // ==========================================
      static async bankControl(cid, player, val, note, type) {
        debug.i(
          "COOP",
          `bankControl: cid=${cid} player=${player.name} val=${val} type=${type === 1 ? "deposit" : "withdraw"}`
        );
        const result = await treasury(cid, player.id, player.name, type === 1 ? "deposit" : "withdraw", val, note);
        if (!result.ok) {
          debug.e("COOP", `bankControl: failed ${result.error}`);
          return { ok: false, error: result.error || "\u94F6\u884C\u64CD\u4F5C\u5931\u8D25" };
        }
        if (result.playerBalance !== void 0) Money.setCached(player, result.playerBalance);
        debug.i("COOP", "bankControl: success");
        return { ok: true };
      }
      // ==========================================
      //  排行榜
      // ==========================================
      static async getRankInfo(type) {
        debug.i("COOP", `getRankInfo: type=${type}`);
        const all = await getAllCoops();
        if (type === 1) {
          return all.map((e) => ({ m: e.account?.balance || 0, n: e.name })).sort((a, b) => b.m - a.m).map((e, i) => `
#${i + 1} ${e.n} > ${e.m} ${Money.UNIT}`).join("");
        }
        if (type === 2) {
          return all.map((e) => ({ m: (e.members || []).length, n: e.name })).sort((a, b) => b.m - a.m).map((e, i) => `
#${i + 1} ${e.n} > ${e.m} \u4EBA`).join("");
        }
        return "";
      }
      // ==========================================
      //  商店系统
      // ==========================================
      static async _getAllShopItems() {
        const allCoops = await getAllCoops();
        const items = [];
        for (const c of allCoops) {
          const shopItems = await getShopItems(c.cid);
          items.push(...shopItems);
        }
        return items;
      }
      static async getGoods(list, reverse, type, cid, groupid, onlyTrue = true) {
        debug.i("COOP", `getGoods: list=${list} type=${type} cid=${cid} groupid=${groupid}`);
        let data = await this._getAllShopItems();
        if (onlyTrue) data = data.filter((e) => e.is_true !== false);
        data = data.filter((e) => e.type === type);
        if (cid) data = data.filter((e) => e.cid === cid);
        if (groupid) data = data.filter((e) => e.groups && e.groups.indexOf(groupid) !== -1);
        switch (list) {
          case 1:
            data.sort((a, b) => a.created_at - b.created_at);
            break;
          case 2:
            data.sort((a, b) => a.name.localeCompare(b.name, this.cooperativeConfig.main.compare_language));
            break;
          case 3:
            data.sort((a, b) => a.sv - b.sv);
            break;
          case 4:
            data.sort((a, b) => a.money - b.money);
            break;
        }
        if (reverse) data.reverse();
        return data;
      }
      static async getGroups(customOnly = false) {
        const groups = await getAllShopGroups();
        debug.i("COOP", `getGroups: customOnly=${customOnly} count=${groups.length}`);
        return customOnly ? groups.filter((g) => g.groupid.indexOf("default") === -1) : groups;
      }
      static async buy(gid, num, player) {
        debug.i("COOP", `buy: gid=${gid} num=${num} player=${player.name}`);
        const all = await this._getAllShopItems();
        const good = all.find((e) => e.id === gid);
        if (!good || good.num < num) {
          debug.w("COOP", `buy: insufficient stock gid=${gid}`);
          return { ok: false, error: "\u5546\u54C1\u5E93\u5B58\u4E0D\u8DB3" };
        }
        const idempotencyKey = `buy_${player.id}_${gid}_${num}_${Date.now()}`;
        const result = await coopShopBuy(good.cid, player.id, player.name, gid, num, idempotencyKey);
        if (!result.ok) {
          debug.e("COOP", `buy: API failed ${result.error}`);
          return { ok: false, error: result.error || "\u8D2D\u4E70\u5931\u8D25" };
        }
        try {
          player.runCommand(`give "${player.name}" ${good.item_type} ${num} ${good.item_aux ?? 0}`);
        } catch {
          Msg.error("\u7269\u54C1\u53D1\u653E\u5931\u8D25\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002", player);
          return { ok: false, error: "give_failed" };
        }
        good.sv += num;
        good.num -= num;
        if (result.balance !== void 0) Money.setCached(player, result.balance, result.balanceVersion);
        debug.i("COOP", `buy: success gid=${gid}`);
        return { ok: true };
      }
      static async sell(gid, num, player) {
        debug.i("COOP", `sell: gid=${gid} num=${num} player=${player.name}`);
        const all = await this._getAllShopItems();
        const good = all.find((e) => e.id === gid);
        if (!good || good.num - good.sv < num) {
          debug.w("COOP", `sell: insufficient capacity gid=${gid}`);
          return { ok: false, error: "\u5546\u54C1\u5BB9\u91CF\u4E0D\u8DB3" };
        }
        const has = this._countItemInInventory(player, good.item_type);
        if (has < num) {
          debug.w("COOP", `sell: not enough items in inventory gid=${gid}`);
          return { ok: false, error: "\u80CC\u5305\u7269\u54C1\u4E0D\u8DB3" };
        }
        try {
          player.runCommand(`clear "${player.name}" ${good.item_type} ${good.item_aux ?? 0} ${num}`);
        } catch {
          Msg.error("\u4ECE\u80CC\u5305\u6263\u9664\u7269\u54C1\u5931\u8D25\u3002", player);
          return { ok: false, error: "clear_failed" };
        }
        const idempotencyKey = `sell_${player.id}_${gid}_${num}_${Date.now()}`;
        const result = await coopShopSell(good.cid, player.id, player.name, gid, num, idempotencyKey);
        if (!result.ok) {
          try {
            player.runCommand(`give "${player.name}" ${good.item_type} ${num} ${good.item_aux ?? 0}`);
          } catch {
          }
          Msg.error(`\u51FA\u552E\u5931\u8D25\uFF1A${result.error || "\u670D\u52A1\u5668\u9519\u8BEF"}\uFF0C\u7269\u54C1\u5DF2\u8FD4\u8FD8\u3002`, player);
          debug.e("COOP", `sell: API failed ${result.error}`);
          return { ok: false, error: result.error || "shop_sell_failed" };
        }
        good.sv += num;
        if (result.balance !== void 0) Money.setCached(player, result.balance, result.balanceVersion);
        debug.i("COOP", `sell: success gid=${gid}`);
        return { ok: true };
      }
    };
    // ==========================================
    //  内部工具
    // ==========================================
    CoopCore._guidCounter = 0;
    CoopCore.cooperativeConfig = {
      main: { language: "zh_CN", compare_language: "zh" },
      shop_setting: {
        nbtgoods_condition: {
          type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
          mode_enum: ["it.isEnchanted"],
          type_reg_enum: ["[a-z].+_shulker_box"]
        }
      }
    };
  }
});

// scripts/gui/CoopGUI.ts
function countItemInInventory(player) {
  const inv = player.getComponent("inventory");
  if (!inv?.container) return 0;
  let total = 0;
  for (let i = 0; i < inv.container.size; i++) {
    const item = inv.container.getItem(i);
    if (item?.amount) total += item.amount;
  }
  return total;
}
function _genId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function _fmtGoodBt(name, unit, price, sv, num, isBuy) {
  return isBuy ? `${name} ${unit}${price}
\u5DF2\u552E\uFF1A${sv} \u5E93\u5B58\uFF1A${num}` : `${name} ${unit}${price}
\u53EF\u56DE\u6536\uFF1A${sv}/${num}`;
}
var CoopGUI;
var init_CoopGUI = __esm({
  "scripts/gui/CoopGUI.ts"() {
    "use strict";
    init_api();
    init_CoopCore();
    init_DebugLog();
    init_MenuNavigator();
    init_Money();
    init_Tools();
    CoopGUI = class _CoopGUI {
      constructor(player) {
        debug.i("GUI", `CoopGUI: constructor player=${player.name}`);
        this.player = player;
        this.nav = new MenuNavigator(player);
        this.registerSections();
      }
      async mainPanel() {
        debug.i("GUI", `CoopGUI.mainPanel: player=${this.player.name}`);
        const cid = await findPlayerCoop(this.player.id);
        if (!cid) {
          this.nav.start("noCoop");
          return;
        }
        this.nav.state.cid = cid;
        this.nav.start("coopInfo");
      }
      static async openShopMgr(player) {
        debug.i("GUI", `CoopGUI.openShopMgr: player=${player.name}`);
        const gui = new _CoopGUI(player);
        gui.nav.state.cid = await findPlayerCoop(player.id) ?? "";
        gui.nav.start("shopMgr");
      }
      registerSections() {
        this.nav.section("noCoop", "\u5408\u4F5C\u793E", (p) => this.buildNoCoop(p));
        this.nav.section("coopInfo", "\u5408\u4F5C\u793E", (p) => this.buildCoopInfo(p));
        this.nav.section("joinByCid", "\u52A0\u5165\u5408\u4F5C\u793E", (p) => this.buildJoinByCid(p));
        this.nav.section("coopList", "\u5408\u4F5C\u793E\u5217\u8868", (p) => this.buildCoopList(p));
        this.nav.section("createCoop", "\u521B\u5EFA\u5408\u4F5C\u793E", (p) => this.buildCreateCoop(p));
        this.nav.section("adminPanel", "\u7BA1\u7406\u9762\u677F", (p) => this.buildAdminPanel(p));
        this.nav.section("editNotice", "\u7F16\u8F91\u516C\u544A", (p) => this.buildEditNotice(p));
        this.nav.section("talkToMembers", "\u558A\u8BDD", (p) => this.buildTalkToMembers(p));
        this.nav.section("addAdmin", "\u6DFB\u52A0\u7BA1\u7406", (p) => this.buildAddAdmin(p));
        this.nav.section("bankPanel", "\u94F6\u884C", (p) => this.buildBankPanel(p));
        this.nav.section("bankControl", "\u94F6\u884C\u64CD\u4F5C", (p) => this.buildBankControl(p));
        this.nav.section("rank", "\u6392\u884C\u699C", (p) => this.buildRank(p));
        this.nav.section("log", "\u66F4\u65B0\u65E5\u5FD7", (p) => this.buildLog(p));
        this.nav.section("shopMgr", "\u5546\u5E97\u7BA1\u7406\u540E\u53F0", (p) => this.buildShopMgr(p));
        this.nav.section("shopItemOps", "\u5546\u5E97\u7BA1\u7406\u540E\u53F0", (p) => this.buildShopItemOps(p));
        this.nav.section("shopRestock", "\u8865\u8D27", (p) => this.buildShopRestock(p));
        this.nav.section("shopEdit", "\u7F16\u8F91\u5546\u54C1\u4FE1\u606F", (p) => this.buildShopEdit(p));
        this.nav.section("shopRecycleList", "\u5546\u5E97\u7BA1\u7406\u540E\u53F0", (p) => this.buildShopRecycleList(p));
        this.nav.section("shopRecycleTake", "\u53D6\u51FA\u56DE\u6536\u5E93\u5B58", (p) => this.buildShopRecycleTake(p));
        this.nav.section("shopRecycleReview", "\u56DE\u6536\u62DB\u52DF\u5BA1\u6838\u5217\u8868", (p) => this.buildShopRecycleReview(p));
        this.nav.section("shopAddSelect", "\u4E0A\u67B6\u7269\u54C1", (p) => this.buildShopAddSelect(p));
        this.nav.section("shopAddItem", "\u5546\u54C1\u4FE1\u606F", (p) => this.buildShopAddItem(p));
        this.nav.section("shopAddGroup", "\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4", (p) => this.buildShopAddGroup(p));
      }
      // ── No Coop ──
      buildNoCoop(page) {
        debug.i("GUI", "CoopGUI.buildNoCoop");
        page.label(
          ListFormInfo(["\u4F60\u6CA1\u6709\u52A0\u5165\u4EFB\u4F55\u4E00\u4E2A\u5408\u4F5C\u793E\uFF0C\u8BF7\u9009\u62E9\u64CD\u4F5C\u3002\n\nCiallo\uFF5E(\u2220\u30FB\u03C9\uFF1C)\u2322\u2606"])
        );
        page.button("\u901A\u8FC7 CID \u52A0\u5165\u5408\u4F5C\u793E", () => this.nav.go("joinByCid"));
        page.button("\u67E5\u770B\u6240\u6709\u5408\u4F5C\u793E", () => this.nav.rebuild("coopList"));
        page.button("\u521B\u5EFA\u5408\u4F5C\u793E", () => this.nav.go("createCoop"));
        page.button("\u5408\u4F5C\u793E\u6392\u884C\u699C", () => this.nav.rebuild("rank"));
        page.button("\u63D2\u4EF6\u66F4\u65B0\u65E5\u5FD7", () => this.nav.go("log"));
      }
      async buildJoinByCid(page) {
        debug.i("GUI", "CoopGUI.buildJoinByCid");
        const obsCid = obsStr("");
        const status = obsStr("");
        page.label(status);
        page.textField("CID", obsCid, { description: "\u4EC5\u652F\u6301\u82F1\u6587/\u6570\u5B57" });
        page.button("\u786E\u8BA4", async () => {
          const cid = obsCid.getData()?.trim();
          if (!cid) {
            status.setData("\xA7c\u8BF7\u586B\u5199CID");
            return;
          }
          const data = await getCoop(cid);
          if (!data) {
            status.setData("\xA7c\u8BF7\u68C0\u67E5CID\u662F\u5426\u6B63\u786E");
            return;
          }
          this.nav.state.cid = cid;
          await this.nav.rebuild("coopInfo");
        });
      }
      async buildCoopList(page) {
        debug.i("GUI", "CoopGUI.buildCoopList");
        const all = await getAllCoops();
        if (all.length === 0) {
          page.label(ListFormInfo(["\u8FD8\u6CA1\u6709\u4EFB\u4F55\u5408\u4F5C\u793E"]));
          return;
        }
        for (const c of all) {
          page.button(c.name, () => {
            this.nav.state.cid = c.cid;
            this.nav.rebuild("coopInfo");
          });
        }
      }
      buildCreateCoop(page) {
        debug.i("GUI", "CoopGUI.buildCreateCoop");
        const obsName = obsStr("");
        const obsCid = obsStr("");
        const status = obsStr("");
        page.label(status);
        page.textField("\u5408\u4F5C\u793E\u540D\u79F0", obsName);
        page.textField("CID", obsCid, { description: "\u4EC5\u652F\u6301\u82F1\u6587/\u6570\u5B57\uFF0C\u7528\u4F5C\u9080\u8BF7\u7801" });
        page.button("\u786E\u8BA4", async () => {
          if (!obsName.getData() || !obsCid.getData()) {
            status.setData("\xA7c\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F");
            return;
          }
          if (await CoopCore.registerCoop(obsName.getData(), obsCid.getData(), this.player)) {
            status.setData("\xA7a\u5408\u4F5C\u793E\u521B\u5EFA\u6210\u529F\uFF01");
            this.nav.state.cid = obsCid.getData();
            await this.nav.rebuild("coopInfo");
          } else {
            status.setData(`\xA7c\u4F60\u7684${Money.UNIT}\u4F3C\u4E4E\u4E0D\u591F\u6216CID\u5DF2\u88AB\u5360\u7528\uFF01`);
          }
        });
      }
      // ── Coop Info ──
      async buildCoopInfo(page) {
        debug.i("GUI", "CoopGUI.buildCoopInfo");
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const text = await CoopCore.getInfo(cid);
        const isOp = await CoopCore.isOp(this.player.id, cid);
        const members = await getMembers(cid);
        const isMember = members.some((m) => m.player_id === this.player.id);
        page.label(ListFormInfo([text]));
        if (!isMember) {
          page.button("\u52A0\u5165", async () => {
            if (await CoopCore.joinCoop(this.player, cid)) await this.nav.rebuild("coopInfo");
            else Msg.error("\u52A0\u5165\u5408\u4F5C\u793E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", this.player);
          });
          return;
        }
        page.button("\u96C6\u4F53\u5546\u5E97\u540E\u53F0", () => {
          this.nav.state.cid = cid;
          this.nav.rebuild("shopMgr");
        });
        page.button("\u516C\u6709\u94F6\u884C", () => {
          this.nav.state.cid = cid;
          this.nav.go("bankPanel");
        });
        page.button("\u6210\u5458\u5217\u8868", async () => this.infoPop((await CoopCore.getMemberList(cid)).join(", ")));
        page.button("\u67E5\u770B\u6240\u6709\u5408\u4F5C\u793E", () => this.nav.rebuild("coopList"));
        page.button("\u5408\u4F5C\u793E\u6392\u884C\u699C", () => this.nav.rebuild("rank"));
        page.button(isOp ? "\u89E3\u6563\u6B64\u5408\u4F5C\u793E" : "\u9000\u51FA\u6B64\u5408\u4F5C\u793E", () => this.exitConfirm(cid));
        page.button("\u63D2\u4EF6\u66F4\u65B0\u65E5\u5FD7", () => this.nav.go("log"));
        if (isOp) page.button("\u7BA1\u7406\u9762\u677F", () => this.nav.rebuild("adminPanel"));
      }
      async exitConfirm(cid) {
        const isOp = await CoopCore.isOp(this.player.id, cid);
        this.nav.confirm(
          "\u5408\u4F5C\u793E - \u786E\u8BA4",
          isOp ? "\u786E\u8BA4\u89E3\u6563\u5408\u4F5C\u793E\uFF1F\u6240\u6709\u6210\u5458\u4E5F\u4F1A\u88AB\u8E22\u51FA\u3002\n\u8BF7\u5148\u6E05\u7A7A\u94F6\u884C\u7ECF\u6D4E\u3001\u4E0B\u67B6\u5546\u54C1\u3002" : "\u4F60\u786E\u8BA4\u9000\u51FA\u5408\u4F5C\u793E\u5417\uFF1F",
          async () => {
            if (isOp) {
              await CoopCore.releaseCoop(cid, this.player.id);
              this.infoPop("\u89E3\u6563\u6210\u529F\u3002");
            } else {
              await CoopCore.exitCoop(this.player.id, cid);
              this.infoPop("\u5DF2\u9000\u51FA\u5408\u4F5C\u793E\u3002");
              await CoopCore.sendToMembers(cid, this.player.name + " \u9000\u51FA\u4E86\u5408\u4F5C\u793E\u3002\u62DC\u62DC\uFF5E");
            }
          },
          () => this.nav.rebuild("noCoop")
        );
      }
      // ── Admin ──
      buildAdminPanel(page) {
        debug.i("GUI", "CoopGUI.buildAdminPanel");
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        page.label(ListFormInfo(["\xA76CID:\xA7r " + cid]));
        page.button("\u7F16\u8F91\u516C\u544A", () => this.nav.go("editNotice"));
        page.button("\u5411\u6240\u6709\u6210\u5458\u558A\u8BDD", () => this.nav.go("talkToMembers"));
        page.button("\u6DFB\u52A0\u7BA1\u7406\u6210\u5458", () => this.nav.rebuild("addAdmin"));
      }
      buildEditNotice(page) {
        const status = new FormStatus(page);
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const obsNotice = obsStr("");
        page.textField("\u516C\u544A\u5185\u5BB9", obsNotice);
        page.button("\u786E\u8BA4", async () => {
          await CoopCore.setNotice(cid, obsNotice.getData() || "");
          status.info("\u8BBE\u7F6E\u6210\u529F\u3002");
        });
      }
      buildTalkToMembers(page) {
        const status = new FormStatus(page);
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const obsMsg = obsStr("");
        page.textField("\u558A\u8BDD\u5185\u5BB9", obsMsg, { description: "(\u1D5C \u02F0 \u1D5C)" });
        page.button("\u786E\u8BA4", async () => {
          await CoopCore.sendToMembers(cid, this.player.name + ": " + obsMsg.getData());
          status.info("\u558A\u8BDD\u6210\u529F\u3002");
        });
      }
      async buildAddAdmin(page) {
        debug.i("GUI", "CoopGUI.buildAddAdmin");
        const status = new FormStatus(page);
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const members = await CoopCore.getMemberList(cid);
        if (members.length === 0) {
          page.label("\u6CA1\u6709\u6210\u5458\u3002");
          return;
        }
        const memberItems = members.map((m, i) => ({ label: m, value: i }));
        const obsIdx = obsNum(0);
        page.dropdown("\u5C06\u6210\u5458\u6743\u9650\u63D0\u5347\u81F3\u7BA1\u7406\u5458...", obsIdx, memberItems);
        page.button("\u786E\u8BA4", () => {
          const idx = obsIdx.getData();
          this.nav.confirm(
            "\u5408\u4F5C\u793E - \u786E\u8BA4",
            "\u76EE\u6807\u73A9\u5BB6\u4F1A\u83B7\u5F97\u7BA1\u7406\u9762\u677F\u7684\u4F7F\u7528\u6743\uFF0C\u786E\u8BA4\u64CD\u4F5C\u5417\uFF1F",
            async () => {
              await CoopCore.setOp(cid, idx);
              status.info("\u64CD\u4F5C\u6210\u529F\u3002");
            },
            () => this.nav.rebuild("adminPanel")
          );
        });
      }
      // ── Bank ──
      async buildBankPanel(page) {
        debug.i("GUI", "CoopGUI.buildBankPanel");
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const data = await getCoop(cid);
        if (!data) {
          page.label("\u6570\u636E\u4E22\u5931\u3002");
          return;
        }
        const obsAction = obsNum(0);
        page.dropdown("\u8BF7\u9009\u62E9\u64CD\u4F5C", obsAction, [
          { label: "\u5B58\u5165", value: 0 },
          { label: "\u53D6\u51FA", value: 1 }
        ]);
        const logs = await getBankLog(cid);
        const moneylist = logs.length ? logs.map(
          (l) => `${l.actor_name_snapshot} ${l.type === 1 ? "\u5B58\u5165" : "\u53D6\u51FA"} ${l.amount}${l.note ? ` (${l.note})` : ""}`
        ).join("\n") : "\u6682\u65E0\u8BB0\u5F55";
        page.label("\xA76\u5408\u4F5C\u793E\u94F6\u884C\u7ECF\u6D4E\uFF1A\xA7r" + (data.account?.balance || 0) + "\n\xA76\u8D26\u5355\uFF1A\xA7r\n" + moneylist);
        page.button("\u786E\u8BA4", () => {
          this.nav.state.bankType = obsAction.getData() + 1;
          this.nav.go("bankControl");
        });
      }
      buildBankControl(page) {
        debug.i("GUI", "CoopGUI.buildBankControl");
        const status = new FormStatus(page);
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const type = this.nav.state.bankType;
        const title = type === 1 ? "\u5B58\u5165" + Money.UNIT : "\u53D6\u51FA" + Money.UNIT;
        const obsAmount = obsStr("");
        const obsNote = obsStr("");
        page.textField("\u91D1\u989D", obsAmount);
        page.textField("\u5907\u6CE8(\u53EF\u9009)", obsNote, { description: "\u65E0" });
        page.button("\u786E\u8BA4", async () => {
          const val = parseInt(obsAmount.getData());
          if (isNaN(val) || val <= 0) {
            status.fail("\u91D1\u989D\u586B\u5199\u4E0D\u6B63\u786E");
            return;
          }
          const bcResult = await CoopCore.bankControl(cid, this.player, val, obsNote.getData() || "", type === 1 ? 1 : 2);
          if (bcResult.ok) {
            status.ok((type === 1 ? "\u5B58\u5165" : "\u53D6\u51FA") + "\u6210\u529F\uFF01" + Money.UNIT + "\uFF1A" + val);
          } else {
            status.fail(bcResult.error || "\u64CD\u4F5C\u5931\u8D25");
          }
        });
      }
      // ── Rank & Log ──
      async buildRank(page) {
        debug.i("GUI", "CoopGUI.buildRank");
        const rankType = this.nav.state.rankType ?? 1;
        page.label(await CoopCore.getRankInfo(rankType));
        if (rankType === 1) {
          page.button("\u5207\u6362\u5230\u4EBA\u6570\u6392\u884C", () => {
            this.nav.state.rankType = 2;
            this.nav.rebuild("rank");
          });
        } else {
          page.button("\u5207\u6362\u5230\u94F6\u884C\u7ECF\u6D4E\u6392\u884C", () => {
            this.nav.state.rankType = 1;
            this.nav.rebuild("rank");
          });
        }
      }
      buildLog(page) {
        debug.i("GUI", "CoopGUI.buildLog");
        page.label(ListFormInfo(["\u6682\u65E0\u66F4\u65B0\u65E5\u5FD7\u3002"]));
      }
      // ── Shop Manager ──
      async buildShopMgr(page) {
        debug.i("GUI", "CoopGUI.buildShopMgr");
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const isOp = await CoopCore.isOp(this.player.id, cid);
        const goods = await CoopCore.getGoods(1, true, 1, cid);
        page.label(ListFormInfo(["\u9009\u62E9\u64CD\u4F5C"]));
        page.button("\u4E0A\u67B6\u7269\u54C1", () => this.nav.go("shopAddSelect"));
        page.button("\u56DE\u6536\u7269\u54C1\u7BA1\u7406", () => this.nav.rebuild("shopRecycleList"));
        page.button("\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4", () => this.nav.go("shopAddGroup"));
        if (isOp) {
          page.button("\u56DE\u6536\u62DB\u52DF\u5BA1\u6838", () => this.nav.rebuild("shopRecycleReview"));
        }
        for (const g of goods) {
          page.button(_fmtGoodBt(g.name, Money.UNIT, g.money, g.sv, g.num, true), () => {
            this.nav.state.gid = g.id;
            this.nav.state.good = g;
            this.nav.go("shopItemOps");
          });
        }
      }
      buildShopItemOps(page) {
        debug.i("GUI", "CoopGUI.buildShopItemOps");
        const gid = this.nav.state.gid;
        const good = this.nav.state.good;
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        if (!good) {
          page.label("\u5546\u54C1\u6570\u636E\u4E22\u5931\u3002");
          return;
        }
        const obsAction = obsNum(0);
        page.label("gid:" + gid);
        page.dropdown("\u64CD\u4F5C", obsAction, [
          { label: "\u8865\u8D27", value: 0 },
          { label: "\u4E0B\u67B6", value: 1 },
          { label: "\u7F16\u8F91", value: 2 }
        ]);
        page.button("\u786E\u8BA4", () => {
          const act = obsAction.getData();
          if (act === 0) this.nav.go("shopRestock");
          else if (act === 1) this.doDelist(cid, gid, good);
          else this.nav.go("shopEdit");
        });
      }
      buildShopRestock(page) {
        debug.i("GUI", "CoopGUI.buildShopRestock");
        const status = new FormStatus(page);
        const good = this.nav.state.good;
        if (!good) {
          page.label("\u5546\u54C1\u6570\u636E\u4E22\u5931\u3002");
          return;
        }
        if (good.item_nbt) {
          page.label("NBT\u7269\u54C1\u65E0\u6CD5\u8865\u8D27\u3002");
          return;
        }
        const inv = this.player.getComponent("inventory");
        const firstItem = inv?.container?.getItem(0);
        if (!firstItem || firstItem.typeId !== good.item_type) {
          page.label("\u8BF7\u5C06\u8BE5\u5546\u54C1\u653E\u5728\u7269\u54C1\u680F\u7B2C\u4E00\u683C\u3002");
          return;
        }
        const total = countItemInInventory(this.player);
        const sliderVal = obsNum(1);
        page.label("\u5F53\u524D\u5E93\u5B58\uFF1A" + good.num);
        page.slider("\u8865\u8D27\u6570\u91CF", sliderVal, 1, Math.max(total, 1), { step: 1 });
        page.button("\u786E\u8BA4", async () => {
          const num = sliderVal.getData();
          if (num <= 0) {
            status.fail("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F\uFF01");
            return;
          }
          good.num += num;
          await saveShopItem(good);
          try {
            this.player.runCommand(`clear @s ${good.item_type} ${good.item_aux ?? 0} ${num}`);
          } catch {
            status.fail("\u8865\u8D27\u6263\u9664\u7269\u54C1\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u6E05\u7406\u80CC\u5305\u3002");
            return;
          }
          status.ok("\u8865\u8D27\u6210\u529F\u3002");
          await this.nav.rebuild("shopMgr");
        });
      }
      doDelist(cid, gid, good) {
        this.nav.confirm(
          "\u4E0B\u67B6\u786E\u8BA4",
          "\u786E\u8BA4\u4E0B\u67B6 " + good.name + " \uFF1F\n\u4E0B\u67B6\u540E\u5E93\u5B58\u5C06\u8FD4\u8FD8\u7ED9\u4F60\u3002",
          async () => {
            await deleteShopItem(good.cid, gid);
            try {
              this.player.runCommand(`give @s ${good.item_type} ${good.num} ${good.item_aux ?? 0}`);
            } catch {
              Msg.error("\u7269\u54C1\u8FD4\u8FD8\u5931\u8D25\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002", this.player);
              return;
            }
            Msg.success("\u4E0B\u67B6\u6210\u529F\u3002", this.player);
          },
          () => this.nav.rebuild("shopMgr")
        );
      }
      async buildShopEdit(page) {
        debug.i("GUI", "CoopGUI.buildShopEdit");
        const status = new FormStatus(page);
        const good = this.nav.state.good;
        if (!good) {
          page.label("\u5546\u54C1\u6570\u636E\u4E22\u5931\u3002");
          return;
        }
        const customGroups = await CoopCore.getGroups(true);
        const cgNames = ["\u65E0", ...customGroups.map((g) => g.displayname)];
        const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));
        const obsName = obsStr(good.name);
        const obsDes = obsStr(good.des || "");
        const obsPrice = obsStr(String(good.money));
        const obsGroup = obsNum(0);
        page.textField("\u5546\u54C1\u540D\u79F0", obsName);
        page.textField("\u5546\u54C1\u63CF\u8FF0", obsDes);
        page.textField("\u4EF7\u683C", obsPrice);
        page.dropdown("\u81EA\u5B9A\u4E49\u5206\u7EC4", obsGroup, cgItems);
        page.button("\u786E\u8BA4", async () => {
          good.name = obsName.getData();
          good.des = obsDes.getData();
          good.money = parseInt(obsPrice.getData()) || 0;
          const cgIdx = obsGroup.getData();
          if (cgIdx > 0) {
            const groups = JSON.parse(good.groups || "[]");
            const idx = groups.findIndex((g) => customGroups.some((cg) => cg.groupid === g));
            if (idx !== -1) groups.splice(idx, 1);
            groups.push(customGroups[cgIdx - 1].groupid);
            good.groups = JSON.stringify(groups);
          }
          await saveShopItem(good);
          status.ok("\u4FEE\u6539\u6210\u529F\u3002");
          await this.nav.rebuild("shopMgr");
        });
      }
      async buildShopRecycleList(page) {
        debug.i("GUI", "CoopGUI.buildShopRecycleList");
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const goods2 = await CoopCore.getGoods(1, true, 2, cid);
        for (const g of goods2) {
          page.button(_fmtGoodBt(g.name, Money.UNIT, g.money, g.sv, g.num, false), () => {
            this.nav.state.good = g;
            this.nav.state.gid = g.id;
            this.nav.go("shopRecycleTake");
          });
        }
      }
      buildShopRecycleTake(page) {
        debug.i("GUI", "CoopGUI.buildShopRecycleTake");
        const status = new FormStatus(page);
        const good = this.nav.state.good;
        if (!good || good.sv <= 0) {
          page.label("\u6682\u65F6\u6CA1\u6709\u9700\u8981\u53D6\u51FA\u7684\u5E93\u5B58\u3002");
          return;
        }
        const sliderVal = obsNum(1);
        page.slider("\u53D6\u51FA\u6570\u91CF", sliderVal, 1, good.sv, { step: 1 });
        page.button("\u786E\u8BA4", async () => {
          const num = sliderVal.getData();
          good.sv -= num;
          await saveShopItem(good);
          try {
            this.player.runCommand(`give @s ${good.item_type} ${num} ${good.item_aux ?? 0}`);
          } catch {
            status.fail("\u53D6\u51FA\u7269\u54C1\u5931\u8D25\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002");
            return;
          }
          status.ok("\u53D6\u51FA\u6210\u529F\u3002");
          await this.nav.rebuild("shopRecycleList");
        });
      }
      async buildShopRecycleReview(page) {
        debug.i("GUI", "CoopGUI.buildShopRecycleReview");
        const status = new FormStatus(page);
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const goods1 = await CoopCore.getGoods(1, true, 2, cid, void 0, false);
        if (goods1.length === 0) {
          page.label(ListFormInfo(["\u6CA1\u6709\u5F85\u5BA1\u6838\u7684\u56DE\u6536\u62DB\u52DF"]));
          return;
        }
        for (const g of goods1) {
          page.button(g.name + " " + Money.UNIT + g.money + "\n\u5F85\u5BA1\u6838", () => {
            this.nav.confirm(
              "\u56DE\u6536\u62DB\u52DF\u5BA1\u6838",
              `\u540D\u79F0: ${g.name}
\u63CF\u8FF0: ${g.des || ""}
\u4EF7\u683C: ${g.money}
\u5E93\u5B58: ${g.num}

\u786E\u5B9A\u901A\u8FC7\u5BA1\u6838\uFF1F`,
              async () => {
                g.is_true = true;
                await saveShopItem(g);
                status.ok("\u64CD\u4F5C\u6210\u529F\u3002");
              },
              () => this.nav.rebuild("shopRecycleReview")
            );
          });
        }
      }
      // ── Shop Add ──
      buildShopAddSelect(page) {
        debug.i("GUI", "CoopGUI.buildShopAddSelect");
        const obsSlot = obsNum(0);
        const obsType = obsNum(0);
        page.dropdown("\u8BF7\u9009\u62E9\u7269\u54C1\u680F", obsSlot, [
          { label: "1", value: 0 },
          { label: "2", value: 1 },
          { label: "3", value: 2 },
          { label: "4", value: 3 },
          { label: "5", value: 4 },
          { label: "6", value: 5 },
          { label: "7", value: 6 },
          { label: "8", value: 7 },
          { label: "9", value: 8 }
        ]);
        page.dropdown("\u8BF7\u9009\u62E9\u64CD\u4F5C\u7C7B\u578B", obsType, [
          { label: "\u6C42\u8D2D", value: 0 },
          { label: "\u56DE\u6536", value: 1 }
        ]);
        page.button("\u786E\u8BA4", () => {
          const selType = obsType.getData();
          const slot = obsSlot.getData();
          if (selType === 0) {
            this.nav.state.slot = slot;
            this.nav.go("shopAddItem");
          } else {
            this.errorPop("\u56DE\u6536\u529F\u80FD\u6682\u672A\u5B8C\u5168\u5B9E\u73B0");
          }
        });
      }
      async buildShopAddItem(page) {
        debug.i("GUI", "CoopGUI.buildShopAddItem");
        const status = new FormStatus(page);
        const cid = this.nav.state.cid;
        if (!cid) {
          page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
          return;
        }
        const index = this.nav.state.slot;
        const inv = this.player.getComponent("inventory");
        const item = inv?.container?.getItem(index ?? 0);
        if (!item) {
          page.label("\u8BF7\u786E\u8BA4\u7269\u54C1\u680F\u6709\u7269\u54C1");
          return;
        }
        const customGroups = await CoopCore.getGroups(true);
        const cgNames = ["\u65E0", ...customGroups.map((g) => g.displayname)];
        const cgItems = cgNames.map((n, i) => ({ label: n, value: i }));
        const obsType = obsStr(item.typeId);
        const obsName = obsStr(item.typeId);
        const obsDes = obsStr("");
        const obsPrice = obsStr("0");
        const obsGroup = obsNum(0);
        page.textField("type: " + item.typeId, obsType, { description: item.typeId });
        page.textField("\u5546\u54C1\u540D\u79F0", obsName, { description: item.typeId });
        page.textField("\u5546\u54C1\u63CF\u8FF0", obsDes);
        page.textField("\u4EF7\u683C", obsPrice, { description: "0" });
        page.dropdown("\u81EA\u5B9A\u4E49\u5206\u7EC4", obsGroup, cgItems);
        page.button("\u786E\u8BA4", async () => {
          const money = parseInt(obsPrice.getData()) || 0;
          const cgIdx = obsGroup.getData();
          const gt = [];
          if (cgIdx > 0) gt.push(customGroups[cgIdx - 1].groupid);
          gt.push(...await CoopCore.typeGood(item));
          const newGood = {
            id: CoopCore.generateId(),
            cid,
            name: obsName.getData(),
            item_type: item.typeId,
            item_aux: 0,
            item_nbt: "",
            type: 1,
            groups: JSON.stringify(gt),
            des: obsDes.getData(),
            num: 1,
            sv: 0,
            money,
            is_true: true,
            created_at: Date.now(),
            updated_at: Date.now()
          };
          await saveShopItem(newGood);
          status.ok("\u4E0A\u67B6\u6210\u529F\uFF01");
          await this.nav.rebuild("shopMgr");
        });
      }
      buildShopAddGroup(page) {
        debug.i("GUI", "CoopGUI.buildShopAddGroup");
        const status = new FormStatus(page);
        const obsName = obsStr("");
        page.textField("\u5206\u7EC4\u540D\u79F0", obsName);
        page.button("\u786E\u8BA4", async () => {
          const name = obsName.getData()?.trim();
          if (!name) {
            status.fail("\u8BF7\u586B\u5199\u5B8C\u6574\u4FE1\u606F\uFF01");
            return;
          }
          await saveShopGroup({ groupid: "custom_" + _genId(), displayname: name });
          status.ok("\u64CD\u4F5C\u6210\u529F\u3002");
          await this.nav.rebuild("shopMgr");
        });
      }
      // ── Helpers ──
      errorPop(text) {
        Msg.error(text, this.player);
      }
      tipsPop(text) {
        Msg.tips(text, this.player);
      }
      infoPop(text) {
        Msg.info(text, this.player);
      }
    };
  }
});

// scripts/gui/MainMenu.ts
import { system as system22 } from "@minecraft/server";
var MainMenu;
var init_MainMenu = __esm({
  "scripts/gui/MainMenu.ts"() {
    "use strict";
    init_Command();
    init_DebugLog();
    init_MenuNavigator();
    init_Money();
    init_Tools();
    init_ChatGUI();
    init_CoopGUI();
    init_LandGUI();
    MainMenu = class _MainMenu {
      static registerMenuCommand() {
        debug.i("GUI", "MainMenu.registerMenuCommand");
        Command.register(
          "menu",
          "menu.use",
          (player) => {
            if (player) _MainMenu.show(player);
          },
          "\u4E3B\u83DC\u5355",
          "money"
        );
      }
      static show(player) {
        debug.i("GUI", `MainMenu.show: player=${player.name}`);
        new _MainMenu().showMainMenu(player);
      }
      showMainMenu(player) {
        debug.i("GUI", "MainMenu.showMainMenu");
        const nav = new MenuNavigator(player);
        const balance = Money.get(player);
        nav.section("main", "\u4E3B\u83DC\u5355", (page) => {
          page.label(ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}`]));
          page.button("\u571F\u5730", () => nav.leave(() => LandGUI.showMainMenu(player)));
          page.button("\u5408\u4F5C\u793E", () => nav.leave(() => new CoopGUI(player).mainPanel()));
          page.button("\u9891\u9053", () => nav.leave(() => ChatGUI.openChannelPanel(player)));
          page.button("\u7EA2\u5305", () => nav.leave(() => ChatGUI.openRedPacketPanel(player)));
          page.button("\u8282\u64CD", () => nav.go("economy"));
        });
        nav.section("economy", "\u7ECF\u6D4E\u7CFB\u7EDF", (page) => {
          const balLabel = obsStr(`\xA7f[*] \u5F53\u524D\u4F59\u989D: ${Money.get(player)} ${Money.UNIT}`);
          page.label(balLabel);
          page.button("\u8F6C\u8D26", () => nav.go("transfer"));
        });
        nav.section("transfer", "\u8F6C\u8D26", (page) => {
          const status = obsStr("");
          const targetName = obsStr("");
          const amountStr = obsStr("");
          page.label(status);
          page.label(ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${Money.get(player)} ${Money.UNIT}`]));
          page.textField("\u76EE\u6807\u73A9\u5BB6", targetName, { description: "\u8F93\u5165\u73A9\u5BB6\u540D\u79F0" });
          page.textField("\u91D1\u989D", amountStr, { description: "\u8F93\u5165\u8F6C\u8D26\u91D1\u989D" });
          page.button("\u786E\u8BA4\u8F6C\u8D26", async () => {
            const name = targetName.getData().trim();
            const amount = parseInt(amountStr.getData());
            if (!name || isNaN(amount) || amount <= 0) {
              status.setData("\xA7c\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u91D1\u989D\u3002");
              return;
            }
            const target = player.dimension.getPlayers().find((p) => p.name === name);
            if (!target) {
              status.setData(`\xA7c\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`);
              return;
            }
            const bal = await Money.load(player);
            if (amount > bal) {
              status.setData(`\xA7c\u4F59\u989D\u4E0D\u8DB3\u3002\u5F53\u524D\u4F59\u989D: ${bal} ${Money.UNIT}\uFF0C\u9700\u8981: ${amount} ${Money.UNIT}`);
              return;
            }
            const transferred = await Promise.resolve().then(() => (init_EconomyApi(), EconomyApi_exports)).then(
              ({ transferEconomy: transferEconomy2 }) => transferEconomy2(player.id, target.id, amount, target.name)
            );
            if (!transferred) {
              status.setData("\xA7c\u8F6C\u8D26\u5931\u8D25\uFF0C\u4F59\u989D\u53EF\u80FD\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u8BD5\u3002");
              return;
            }
            await Money.load(player);
            await Money.load(target);
            status.setData(`\xA7a\u6210\u529F\u8F6C\u8D26 ${amount} ${Money.UNIT} \u7ED9 ${name}\u3002`);
            system22.runTimeout(() => nav.rebuild("economy"), 40);
          });
        });
        nav.start("main");
      }
    };
  }
});

// scripts/gui/MoneyGUI.ts
import { world as world22 } from "@minecraft/server";
var MoneyGUI;
var init_MoneyGUI = __esm({
  "scripts/gui/MoneyGUI.ts"() {
    "use strict";
    init_Command();
    init_DebugLog();
    init_MenuNavigator();
    init_Money();
    init_Tools();
    MoneyGUI = class _MoneyGUI {
      static registerCommand() {
        debug.i("GUI", "MoneyGUI.registerCommand");
        Command.register(
          "money",
          "money.admin",
          (player) => {
            if (!player) return;
            new _MoneyGUI().show(player);
          },
          "\u8D27\u5E01\u7BA1\u7406",
          "money"
        );
      }
      show(player) {
        debug.i("GUI", `MoneyGUI.show: player=${player.name}`);
        const nav = new MenuNavigator(player);
        nav.section("main", "\u8D27\u5E01\u7BA1\u7406", (page) => {
          const balance = Money.get(player);
          page.label(ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\u3002`]));
          page.button("\u7ED9\u4E88\u73A9\u5BB6", () => nav.go("give"));
          page.button("\u67E5\u8BE2\u73A9\u5BB6", () => nav.go("query"));
        });
        nav.section("give", "\u7ED9\u4E88\u73A9\u5BB6", (page) => {
          const status = new FormStatus(page);
          const targetName = obsStr("");
          const amountStr = obsStr("");
          page.textField("\u73A9\u5BB6\u540D\u79F0", targetName, { description: "\u8BF7\u8F93\u5165\u73A9\u5BB6\u540D\u79F0" });
          page.textField("\u6570\u91CF", amountStr, { description: "\u8BF7\u8F93\u5165\u8D27\u5E01\u6570\u91CF" });
          page.button("\u786E\u8BA4", async () => {
            const name = targetName.getData().trim();
            const val = parseInt(amountStr.getData());
            if (!name || isNaN(val) || val <= 0) {
              status.fail("\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u6570\u91CF\u3002");
              return;
            }
            const target = world22.getPlayers().find((p) => p.name === name);
            if (!target) {
              status.fail(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`);
              return;
            }
            if (!await Money.add(target, val)) {
              status.fail("\u53D1\u653E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002");
              return;
            }
            status.ok(`\u5DF2\u7ED9\u4E88 ${name} ${val} ${Money.UNIT}\u3002`);
            await nav.rebuild("main");
          });
        });
        nav.section("query", "\u67E5\u8BE2\u73A9\u5BB6", (page) => {
          const status = new FormStatus(page);
          const targetName = obsStr("");
          page.textField("\u73A9\u5BB6\u540D\u79F0", targetName, { description: "\u8BF7\u8F93\u5165\u73A9\u5BB6\u540D\u79F0" });
          page.button("\u67E5\u8BE2", () => {
            const name = targetName.getData().trim();
            if (!name) {
              status.fail("\u8BF7\u8F93\u5165\u6709\u6548\u7684\u73A9\u5BB6\u540D\u79F0\u3002");
              return;
            }
            const target = world22.getPlayers().find((p) => p.name === name);
            if (!target) {
              status.fail(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`);
              return;
            }
            const balance = Money.get(target);
            status.info(`\u73A9\u5BB6 ${name} \u5F53\u524D\u4F59\u989D: ${balance} ${Money.UNIT}\u3002`);
          });
        });
        nav.start("main");
      }
    };
  }
});

// scripts/coop/CoopSystem.ts
var CoopSystem;
var init_CoopSystem = __esm({
  "scripts/coop/CoopSystem.ts"() {
    "use strict";
    init_CoopGUI();
    init_Command();
    init_DebugLog();
    init_Permission();
    CoopSystem = class {
      static init() {
        debug.i("COOP", "init");
        console.log(`Initializing CoopSystem...`);
        console.log(`CoopSystem initialized successfully.`);
      }
      static registerPermissions() {
        debug.i("COOP", "registerPermissions");
        Permission.register("coop.use", Permission.Member);
        Permission.register("coop.admin", Permission.OP);
        Permission.register("coopshop.use", Permission.Member);
      }
      static registerCommands() {
        Command.register(
          "coop",
          "coop.use",
          (player) => {
            if (player) new CoopGUI(player).mainPanel();
          },
          "\u5408\u4F5C\u793E",
          "coop"
        );
        Command.register(
          "coopshop",
          "coopshop.use",
          (player) => {
            if (!player) return;
            CoopGUI.openShopMgr(player);
          },
          "\u5408\u4F5C\u793E\u5546\u5E97",
          "coop"
        );
      }
      static registerEvents() {
      }
    };
  }
});

// scripts/chat/ChatSystem.ts
import { system as system23, world as world23 } from "@minecraft/server";
var _ChatSystem, ChatSystem;
var init_ChatSystem = __esm({
  "scripts/chat/ChatSystem.ts"() {
    "use strict";
    init_ChatGUI();
    init_Command();
    init_ConfigManager();
    init_DebugLog();
    init_HttpDB();
    init_Tools();
    init_DogeChat();
    _ChatSystem = class _ChatSystem {
      static init() {
        debug.i("CHAT", "init");
        console.log(`Initializing ChatSystem...`);
        DogeChat.ensureDefaultChannels();
        HttpDB.checkHealth().then((ok) => {
          if (ok) console.info("[DogeChat] \u5916\u90E8\u6570\u636E\u5E93\u5DF2\u8FDE\u63A5\uFF0C\u6D88\u606F\u5C06\u6301\u4E45\u5316\u5B58\u50A8\u3002");
          else console.warn("[DogeChat] \u5916\u90E8\u6570\u636E\u5E93\u672A\u8FDE\u63A5\u3002");
        });
        registerSystemMsgHandler((player, text) => {
          DogeChat.sendSystemMessage(player, text);
        });
        const bridgeChannelId = ConfigManager.getSetting("bridge_channel_id", "");
        if (bridgeChannelId) {
          DogeChat.startBridgePolling(bridgeChannelId);
        }
        console.log(`ChatSystem initialized successfully.`);
      }
      static registerEvents() {
        _ChatSystem.chatSendSub = world23.beforeEvents.chatSend.subscribe(async (event) => {
          const player = event.sender;
          const message = event.message;
          if (message.startsWith("!") || message.startsWith("\uFF01")) return;
          event.cancel = true;
          const channel = await DogeChat.getActiveChannel(player);
          if (channel) await DogeChat.sendChannelMessage(player, channel.id, message);
        });
        _ChatSystem.playerJoinSub = world23.afterEvents.playerJoin.subscribe((event) => {
          const player = world23.getEntity(event.playerId);
          system23.run(async () => {
            await DogeChat.loadSubscriptions(player);
            const channel = await DogeChat.getActiveChannel(player);
            if (channel) await DogeChat.loadChannelHistory(player, channel.id);
          });
        });
      }
      static cleanup() {
        debug.i("CHAT", "cleanup");
        try {
          if (_ChatSystem.chatSendSub?.unsubscribe) _ChatSystem.chatSendSub.unsubscribe();
        } catch {
        }
        try {
          if (_ChatSystem.playerJoinSub?.unsubscribe) _ChatSystem.playerJoinSub.unsubscribe();
        } catch {
        }
        _ChatSystem.chatSendSub = void 0;
        _ChatSystem.playerJoinSub = void 0;
        try {
          DogeChat.stopBridgePolling?.();
        } catch {
        }
      }
      static registerCommands() {
        Command.register(
          "channel",
          "chat.use",
          (player) => {
            if (player) ChatGUI.openChannelPanel(player);
          },
          "\u9891\u9053\u7BA1\u7406 - \u8BA2\u9605/\u5207\u6362\u9891\u9053",
          "chat"
        );
        Command.register(
          "ch",
          "chat.use",
          async (player) => {
            if (!player) return;
            const next = await DogeChat.cycleChannel(player);
            if (next) await DogeChat.loadChannelHistory(player, next.id);
          },
          "\u5FEB\u901F\u5207\u6362\u9891\u9053",
          "chat"
        );
        Command.register(
          "msg",
          "chat.use",
          (player) => {
            if (player) ChatGUI.openPrivateChatPanel(player);
          },
          "\u5FEB\u6377\u79C1\u804A",
          "chat"
        );
        Command.register(
          "lo",
          "chat.use",
          (player) => {
            if (player) ChatGUI.sendLocation(player);
          },
          "\u53D1\u9001\u5F53\u524D\u4F4D\u7F6E\u5230\u5F53\u524D\u9891\u9053",
          "chat"
        );
        Command.register(
          "tp",
          "chat.use",
          (player) => {
            if (player) ChatGUI.sendTeleportInvite(player);
          },
          "\u53D1\u9001\u4F20\u9001\u9080\u8BF7",
          "chat"
        );
        Command.register(
          "hongbao",
          "chat.use",
          (player) => {
            if (player) ChatGUI.openRedPacketPanel(player);
          },
          "\u7EA2\u5305 - \u67E5\u770B/\u9886\u53D6\u7EA2\u5305",
          "chat"
        );
        Command.register(
          "hb",
          "chat.use",
          (player) => {
            if (player) ChatGUI.sendRedPacketQuick(player);
          },
          "\u53D1\u9001\u7EA2\u5305",
          "chat"
        );
      }
    };
    _ChatSystem.chatSendSub = void 0;
    _ChatSystem.playerJoinSub = void 0;
    ChatSystem = _ChatSystem;
  }
});

// scripts/data/ActivityLog.ts
import { system as system24, world as world24 } from "@minecraft/server";
function enqueue(entry) {
  queue.push(entry);
  if (!flushTimer) {
    flushTimer = system24.runTimeout(flush, FLUSH_INTERVAL / 50);
  }
}
async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    const sent = await HttpDB.post("/api/sfmc/activities/batch", { entries: batch });
    if (!sent) queue = batch.concat(queue);
  } catch {
    queue = batch.concat(queue);
  }
}
function dimId(entityOrBlock) {
  try {
    return entityOrBlock.dimension?.id?.replace("minecraft:", "") || "";
  } catch {
    return "";
  }
}
function loc(v) {
  if (!v) return [0, 0, 0];
  return [v.x, v.y, v.z];
}
function playerId(player) {
  try {
    return player.id || "";
  } catch {
    return "";
  }
}
function playerEntry(player, eventType, extra = {}) {
  const [x, y, z] = loc(player.location);
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    dimension: dimId(player),
    sourceType: "player",
    sourceid: playerId(player),
    sourceName: player.name,
    sourceX: x,
    sourceY: y,
    sourceZ: z,
    eventType,
    targetType: extra.targetType || "",
    targetid: extra.targetid || "",
    targetName: extra.targetName || "",
    targetX: extra.targetX ?? null,
    targetY: extra.targetY ?? null,
    targetZ: extra.targetZ ?? null,
    detail: extra.detail || {}
  };
}
function getTargetPlayerId(entity) {
  if (entity.typeId !== "minecraft:player") return "";
  try {
    return entity.id || "";
  } catch {
    return "";
  }
}
function getTargetPlayerName(entity) {
  if (entity.typeId !== "minecraft:player") return entity.typeId;
  try {
    return entity.name || entity.typeId;
  } catch {
    return entity.typeId;
  }
}
function subscribe() {
  function safeSubscribe(signal, cb) {
    if (signal && typeof signal.subscribe === "function") {
      const sub = signal.subscribe(cb);
      if (sub && typeof sub.unsubscribe === "function") {
        subscriptions.push(sub);
      }
    }
  }
  const AE = world24.afterEvents;
  safeSubscribe(AE.playerSpawn, (event) => {
    if (!event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.join")) return;
    enqueue(playerEntry(event.player, "player.join"));
  });
  safeSubscribe(AE.playerLeave, (event) => {
    if (!ENABLED_EVENTS.has("player.leave")) return;
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension: "",
      sourceType: "player",
      sourceid: "",
      sourceName: event.playerName,
      sourceX: null,
      sourceY: null,
      sourceZ: null,
      eventType: "player.leave",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { playerId: event.playerId }
    });
  });
  safeSubscribe(AE.playerSpawn, (event) => {
    if (event.initialSpawn) return;
    if (!ENABLED_EVENTS.has("player.spawn")) return;
    enqueue(playerEntry(event.player, "player.spawn"));
  });
  safeSubscribe(AE.playerDimensionChange, (event) => {
    if (!ENABLED_EVENTS.has("player.dimension")) return;
    const [fx, fy, fz] = loc(event.fromLocation);
    const [tx, ty, tz] = loc(event.toLocation);
    enqueue(
      playerEntry(event.player, "player.dimension", {
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        detail: {
          from: event.fromDimension.id.replace("minecraft:", ""),
          to: event.toDimension.id.replace("minecraft:", ""),
          fromLoc: { x: fx, y: fy, z: fz },
          toLoc: { x: tx, y: ty, z: tz }
        }
      })
    );
  });
  safeSubscribe(AE.playerGameModeChange, (event) => {
    if (!ENABLED_EVENTS.has("player.gamemode")) return;
    enqueue(
      playerEntry(event.player, "player.gamemode", {
        detail: {
          from: event.fromGameMode,
          to: event.toGameMode
        }
      })
    );
  });
  safeSubscribe(AE.chatSend, (event) => {
    if (!ENABLED_EVENTS.has("player.chat")) return;
    const targets = event.targets?.map((p) => p.name) || [];
    enqueue(
      playerEntry(event.sender, "player.chat", {
        detail: {
          message: event.message,
          targets: targets.length > 0 ? targets : void 0
        }
      })
    );
  });
  safeSubscribe(AE.playerBreakBlock, (event) => {
    if (!ENABLED_EVENTS.has("block.break")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(event.player, "block.break", {
        targetType: "block",
        targetName: event.brokenBlockPermutation.type.id,
        targetX: bx,
        targetY: by,
        targetZ: bz,
        detail: {
          itemBefore: event.itemStackBeforeBreak?.type?.id || null,
          itemAfter: event.itemStackAfterBreak?.type?.id || null
        }
      })
    );
  });
  safeSubscribe(AE.playerPlaceBlock, (event) => {
    if (!ENABLED_EVENTS.has("block.place")) return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(event.player, "block.place", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz,
        detail: {}
      })
    );
  });
  safeSubscribe(AE.entityDie, (event) => {
    if (!ENABLED_EVENTS.has("entity.death")) return;
    const dead = event.deadEntity;
    const [dx, dy, dz] = loc(dead.location);
    const ds = event.damageSource;
    const cause = ds.cause;
    const killer = ds.damagingEntity;
    const targetType = dead.typeId === "minecraft:player" ? "player" : "entity";
    const targetid = getTargetPlayerId(dead);
    const targetName = getTargetPlayerName(dead);
    if (killer && killer.typeId === "minecraft:player") {
      const player = killer;
      const proj = ds.damagingProjectile;
      enqueue(
        playerEntry(player, "entity.death", {
          targetType,
          targetid,
          targetName,
          targetX: dx,
          targetY: dy,
          targetZ: dz,
          detail: { cause, projectile: proj?.typeId || null }
        })
      );
    } else {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(dead),
        sourceType: killer ? "entity" : "world",
        sourceid: "",
        sourceName: killer?.typeId || cause,
        sourceX: killer ? loc(killer.location)[0] : null,
        sourceY: killer ? loc(killer.location)[1] : null,
        sourceZ: killer ? loc(killer.location)[2] : null,
        eventType: "entity.death",
        targetType,
        targetid,
        targetName,
        targetX: dx,
        targetY: dy,
        targetZ: dz,
        detail: { cause, projectile: ds.damagingProjectile?.typeId || null }
      });
    }
  });
  safeSubscribe(AE.entityHitEntity, (event) => {
    if (!ENABLED_EVENTS.has("entity.hit")) return;
    const attacker = event.damagingEntity;
    const victim = event.hitEntity;
    const [ax, ay, az] = loc(attacker.location);
    const [vx, vy, vz] = loc(victim.location);
    if (attacker.typeId === "minecraft:player") {
      enqueue(
        playerEntry(attacker, "entity.hit", {
          targetType: victim.typeId === "minecraft:player" ? "player" : "entity",
          targetid: getTargetPlayerId(victim),
          targetName: getTargetPlayerName(victim),
          targetX: vx,
          targetY: vy,
          targetZ: vz
        })
      );
    }
    if (victim.typeId === "minecraft:player" && attacker.typeId !== "minecraft:player") {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(attacker),
        sourceType: "entity",
        sourceid: "",
        sourceName: attacker.typeId,
        sourceX: ax,
        sourceY: ay,
        sourceZ: az,
        eventType: "entity.hit",
        targetType: "player",
        targetid: getTargetPlayerId(victim),
        targetName: getTargetPlayerName(victim),
        targetX: vx,
        targetY: vy,
        targetZ: vz,
        detail: {}
      });
    }
  });
  safeSubscribe(AE.entityHurt, (event) => {
    if (!ENABLED_EVENTS.has("entity.hurt")) return;
    const hurt = event.hurtEntity;
    const ds = event.damageSource;
    if (hurt.typeId !== "minecraft:player") return;
    const player = hurt;
    enqueue(
      playerEntry(player, "entity.hurt", {
        detail: {
          damage: event.damage,
          cause: ds.cause,
          damager: ds.damagingEntity?.typeId || null,
          projectile: ds.damagingProjectile?.typeId || null
        }
      })
    );
  });
  safeSubscribe(AE.playerInteractWithEntity, (event) => {
    if (!ENABLED_EVENTS.has("entity.interact")) return;
    const target = event.target;
    const [tx, ty, tz] = loc(target.location);
    enqueue(
      playerEntry(event.player, "entity.interact", {
        targetType: target.typeId === "minecraft:player" ? "player" : "entity",
        targetid: getTargetPlayerId(target),
        targetName: getTargetPlayerName(target),
        targetX: tx,
        targetY: ty,
        targetZ: tz,
        detail: {
          item: event.itemStack?.type?.id || null,
          itemBefore: event.beforeItemStack?.type?.id || null
        }
      })
    );
  });
  safeSubscribe(AE.entityTamed, (event) => {
    if (!ENABLED_EVENTS.has("entity.tame")) return;
    const tamer = event.tamingEntity;
    if (!tamer || tamer.typeId !== "minecraft:player") return;
    const target = event.entity;
    const [tx, ty, tz] = loc(target.location);
    enqueue(
      playerEntry(tamer, "entity.tame", {
        targetType: "entity",
        targetName: target.typeId,
        targetX: tx,
        targetY: ty,
        targetZ: tz
      })
    );
  });
  safeSubscribe(AE.entitySpawn, (event) => {
    if (!ENABLED_EVENTS.has("entity.spawn")) return;
    const e = event.entity;
    if (e.typeId === "minecraft:player") return;
    const [ex, ey, ez] = loc(e.location);
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension: dimId(e),
      sourceType: "entity",
      sourceid: "",
      sourceName: e.typeId,
      sourceX: ex,
      sourceY: ey,
      sourceZ: ez,
      eventType: "entity.spawn",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { cause: event.cause }
    });
  });
  safeSubscribe(AE.entityItemDrop, (event) => {
    if (!ENABLED_EVENTS.has("item.drop")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(
        playerEntry(e, "item.drop", {
          detail: {
            items: event.items.map((item) => item.typeId).filter(Boolean)
          }
        })
      );
    } else {
      enqueue({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: Date.now(),
        dimension: dimId(e),
        sourceType: "entity",
        sourceid: "",
        sourceName: e.typeId,
        sourceX: ex,
        sourceY: ey,
        sourceZ: ez,
        eventType: "item.drop",
        targetType: "",
        targetid: "",
        targetName: "",
        targetX: null,
        targetY: null,
        targetZ: null,
        detail: {
          items: event.items.map((item) => item.typeId).filter(Boolean)
        }
      });
    }
  });
  safeSubscribe(AE.entityItemPickup, (event) => {
    if (!ENABLED_EVENTS.has("item.pickup")) return;
    const e = event.entity;
    const [ex, ey, ez] = loc(e.location);
    if (e.typeId === "minecraft:player") {
      enqueue(
        playerEntry(e, "item.pickup", {
          detail: {
            items: event.items.map((item) => item.type.id)
          }
        })
      );
    }
  });
  safeSubscribe(AE.blockContainerOpened, (event) => {
    if (!ENABLED_EVENTS.has("container.open")) return;
    const source = event.openSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(source, "container.open", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz
      })
    );
  });
  safeSubscribe(AE.blockContainerClosed, (event) => {
    if (!ENABLED_EVENTS.has("container.close")) return;
    const source = event.closeSource.entity;
    if (!source || source.typeId !== "minecraft:player") return;
    const [bx, by, bz] = loc(event.block.location);
    enqueue(
      playerEntry(source, "container.close", {
        targetType: "block",
        targetName: event.block.typeId,
        targetX: bx,
        targetY: by,
        targetZ: bz
      })
    );
  });
  safeSubscribe(AE.explosion, (event) => {
    if (!ENABLED_EVENTS.has("world.explosion")) return;
    const source = event.source;
    const dimension = event.dimension.id.replace("minecraft:", "");
    const [sx, sy, sz] = source ? loc(source.location) : [0, 0, 0];
    enqueue({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      dimension,
      sourceType: source ? source.typeId === "minecraft:player" ? "player" : "entity" : "world",
      sourceid: source?.typeId === "minecraft:player" ? playerId(source) : "",
      sourceName: source?.typeId || "unknown",
      sourceX: sx,
      sourceY: sy,
      sourceZ: sz,
      eventType: "world.explosion",
      targetType: "",
      targetid: "",
      targetName: "",
      targetX: null,
      targetY: null,
      targetZ: null,
      detail: { impactedBlocks: event.getImpactedBlocks().length }
    });
  });
}
async function doCleanup() {
  try {
    await HttpDB.post("/api/sfmc/activities/cleanup", { keepDays: KEEP_DAYS, keepAdmin: true });
  } catch {
  }
}
var ENABLED_EVENTS, FLUSH_INTERVAL, CLEANUP_INTERVAL, KEEP_DAYS, queue, flushTimer, initialized, flushIntervalId, cleanupIntervalId, cleanupStartTimeoutId, subscriptions, ActivityLog;
var init_ActivityLog = __esm({
  "scripts/data/ActivityLog.ts"() {
    "use strict";
    init_DebugLog();
    init_HttpDB();
    ENABLED_EVENTS = /* @__PURE__ */ new Set([
      "player.join",
      "player.leave",
      "player.spawn",
      "player.dimension",
      "player.gamemode",
      "player.chat",
      "block.break",
      "block.place",
      "entity.death",
      "entity.hit",
      "entity.hurt",
      "entity.interact",
      "entity.tame",
      "entity.spawn",
      "item.drop",
      "item.pickup",
      "container.open",
      "container.close",
      "world.explosion"
    ]);
    FLUSH_INTERVAL = 2e3;
    CLEANUP_INTERVAL = 6 * 36e5;
    KEEP_DAYS = 30;
    queue = [];
    flushTimer = null;
    initialized = false;
    subscriptions = [];
    ActivityLog = class {
      /** 注册事件（由 entry.ts 统一调用） */
      static registerEvents() {
        debug.i("DATA", "ActivityLog.registerEvents");
        if (subscriptions.length > 0) return;
        subscribe();
      }
      static cleanup() {
        debug.i("DATA", "ActivityLog.cleanup");
        for (const s of subscriptions) {
          try {
            s.unsubscribe();
          } catch {
          }
        }
        subscriptions.length = 0;
        if (flushTimer !== null) {
          try {
            system24.clearRun(flushTimer);
          } catch {
          }
          flushTimer = null;
        }
        if (flushIntervalId !== void 0) {
          try {
            system24.clearRun(flushIntervalId);
          } catch {
          }
          flushIntervalId = void 0;
        }
        if (cleanupStartTimeoutId !== void 0) {
          try {
            system24.clearRun(cleanupStartTimeoutId);
          } catch {
          }
          cleanupStartTimeoutId = void 0;
        }
        if (cleanupIntervalId !== void 0) {
          try {
            system24.clearRun(cleanupIntervalId);
          } catch {
          }
          cleanupIntervalId = void 0;
        }
        initialized = false;
      }
      static init() {
        debug.i("DATA", "ActivityLog.init");
        if (initialized) return;
        initialized = true;
        console.info("[ActivityLog] \u4E8B\u4EF6\u8BA2\u9605\u5B8C\u6210");
        flushIntervalId = system24.runInterval(flush, FLUSH_INTERVAL / 50);
        cleanupStartTimeoutId = system24.runTimeout(() => {
          cleanupStartTimeoutId = void 0;
          doCleanup();
          cleanupIntervalId = system24.runInterval(doCleanup, CLEANUP_INTERVAL / 50);
        }, 72e3 / 50);
      }
    };
  }
});

// scripts/data/Player.ts
async function getPlayerData(player) {
  const data = {
    id: player.id,
    name: player.name,
    clientSystemInfoLocal: player.clientSystemInfo?.locale,
    clientSystemInfoMaxRenderDistance: player.clientSystemInfo?.maxRenderDistance,
    clientSystemInfoMemoryTierLevel: String(player.clientSystemInfo?.memoryTier ?? ""),
    clientSystemInfoPlatformType: player.clientSystemInfo?.platformType,
    graphicsMode: player.graphicsMode,
    dynamicPropertyTotalByteCount: player.getDynamicPropertyTotalByteCount(),
    ping: player.getPing(),
    level: player.level,
    spawnPoint: JSON.stringify(player.getSpawnPoint()),
    tags: player.getTags().toString(),
    totalXp: player.getTotalXp(),
    updatedAt: formatTimestamp(Date.now())
  };
  return data;
}
var init_Player = __esm({
  "scripts/data/Player.ts"() {
    "use strict";
    init_api();
    init_Tools();
  }
});

// scripts/data/Scoreboards.ts
import { world as world25 } from "@minecraft/server";
function ScoreboardsBackup() {
  debug.i("DATA", "ScoreboardsBackup");
  let entries = [];
  world25.scoreboard.getObjectives().forEach((obj, index) => {
    const scores = obj.getScores();
    entries.push({
      id: obj.id,
      displayName: obj.displayName,
      participants: []
    });
    for (const info of scores) {
      const identity = info.participant;
      entries[index].participants?.push({
        id: identity.id,
        type: identity.type,
        name: identity.displayName,
        score: info.score
      });
    }
  });
  backupScoreboards(entries);
}
var ScoreboardSync;
var init_Scoreboards = __esm({
  "scripts/data/Scoreboards.ts"() {
    "use strict";
    init_api();
    init_Command();
    init_DebugLog();
    init_Permission();
    init_Tools();
    ScoreboardSync = class {
      static registerCommands() {
        Permission.register("scoreboard.restore", Permission.Admin);
        Command.register(
          "scoreboard restore",
          "scoreboard.restore",
          async (player) => {
            const result = await this.load();
            const message = `\u8BA1\u5206\u677F\u6062\u590D\u5B8C\u6210\uFF1A\u6210\u529F ${result.success}\uFF0C\u5931\u8D25 ${result.fail}`;
            if (player) Msg.info(message, player);
            else world25.sendMessage(message);
          },
          "\u4ECE\u6570\u636E\u5E93\u6062\u590D\u8BA1\u5206\u677F",
          "scoreboardSync"
        );
      }
      static init() {
        debug.i("DATA", "ScoreboardSync.init");
        ScoreboardsBackup();
        console.info("[ScoreboardSync] \u8BA1\u5206\u677F\u540C\u6B65\u5DF2\u521D\u59CB\u5316");
      }
      /** 恢复：db-server → 游戏 */
      static async load() {
        debug.i("DATA", "ScoreboardSync.load");
        try {
          const entries = await loadScoreboards();
          if (!entries || entries.length === 0) {
            console.info("[ScoreboardSync] \u6570\u636E\u5E93\u65E0\u8BA1\u5206\u677F\u6570\u636E");
            return { success: 0, fail: 0 };
          }
          let success = 0;
          let fail = 0;
          const groups = /* @__PURE__ */ new Map();
          for (const e of entries) {
            const list = groups.get(e.objective_id) || [];
            list.push(e);
            groups.set(e.objective_id, list);
          }
          for (const [objId, objEntries] of groups) {
            let objective = world25.scoreboard.getObjective(objId);
            if (!objective) {
              try {
                objective = world25.scoreboard.addObjective(objId, objEntries[0].objective_display || objId);
              } catch (err) {
                console.warn(`[ScoreboardSync] \u65E0\u6CD5\u521B\u5EFA\u8BB0\u5206\u9879 "${objId}"\uFF1A${err}`);
                fail += objEntries.length;
                continue;
              }
            }
            for (const e of objEntries) {
              try {
                if (e.participant_type === "Player" && e.id) {
                  const player = [...world25.getPlayers()].find((p) => p.id === e.id);
                  if (player?.scoreboardIdentity) {
                    objective.setScore(player.scoreboardIdentity, e.score);
                    success++;
                    continue;
                  }
                }
                objective.setScore(e.participant_name || `#${e.participant_id}`, e.score);
                success++;
              } catch {
                fail++;
              }
            }
          }
          console.info(`[ScoreboardSync] \u6062\u590D\u5B8C\u6210\uFF1A\u6210\u529F ${success}\uFF0C\u5931\u8D25 ${fail}`);
          return { success, fail };
        } catch (err) {
          console.error(`[ScoreboardSync] \u6062\u590D\u51FA\u9519\uFF1A${err}`);
          return { success: 0, fail: 0 };
        }
      }
    };
  }
});

// scripts/data/World.ts
import { world as world26 } from "@minecraft/server";
function serializeGameRules() {
  const g = world26.gameRules;
  const rules = {};
  const props = [
    "commandBlockOutput",
    "doDayLightCycle",
    "doEntityDrops",
    "doFireTick",
    "doImmediateRespawn",
    "doInsomnia",
    "doLimitedCrafting",
    "doMobLoot",
    "doMobSpawning",
    "doTileDrops",
    "doWeatherCycle",
    "drowningDamage",
    "fallDamage",
    "fireDamage",
    "freezeDamage",
    "functionCommandLimit",
    "keepInventory",
    "maxCommandChainLength",
    "mobGriefing",
    "naturalRegeneration",
    "randomTickSpeed",
    "sendCommandFeedback",
    "showBorderEffect",
    "showCoordinates",
    "showDeathMessage",
    "showRecipeMessages",
    "showTags",
    "spawnRadius",
    "tntExplodes"
  ];
  for (const key of props) {
    try {
      rules[key] = g[key];
    } catch {
    }
  }
  return JSON.stringify(rules);
}
async function getWorldData() {
  debug.i("DATA", "getWorldData");
  const data = {
    allowCheats: world26.allowCheats,
    gameRules: serializeGameRules(),
    seed: world26.seed,
    defaultSpawnLocation: JSON.stringify(world26.getDefaultSpawnLocation()),
    difficulty: world26.getDifficulty(),
    day: world26.getDay(),
    tickingAreasCount: world26.tickingAreaManager.chunkCount,
    absoluteTime: world26.getAbsoluteTime(),
    structuresFromAddon: world26.structureManager.getPackStructureIds().toString(),
    structuresFromWorld: world26.structureManager.getWorldStructureIds().toString(),
    MoonPhase: world26.getMoonPhase(),
    dynamicPropertyTotalByteCount: world26.getDynamicPropertyTotalByteCount(),
    updatedAt: getShanghaiTime().date + getShanghaiTime().time
  };
  return data;
}
async function syncWorldData() {
  debug.i("DATA", "syncWorldData");
  const data = await getWorldData();
  await saveWorldData(data);
}
var init_World = __esm({
  "scripts/data/World.ts"() {
    "use strict";
    init_api();
    init_DebugLog();
    init_Tools();
  }
});

// scripts/entry.ts
import { system as system25, world as world27 } from "@minecraft/server";
var AddOnInit;
var init_entry = __esm({
  "scripts/entry.ts"() {
    "use strict";
    init_Command();
    init_ConfigManager();
    init_DebugLog();
    init_ModuleRegistry();
    init_Money();
    init_Permission();
    init_AFK();
    init_ChatSoundsHelper();
    init_Clean();
    init_DailyTask();
    init_MonitorReporter();
    init_OnlineTime();
    init_QA();
    init_SpawnProtect();
    init_TPS();
    init_EconomyReport();
    init_CreativeArea();
    init_Fly();
    init_InventorySwitcher();
    init_Peace();
    init_SurvivalArea();
    init_LandEvents();
    init_LandSystem();
    init_AdminGUI();
    init_MainMenu();
    init_MoneyGUI();
    init_CoopSystem();
    init_ChatSystem();
    init_ActivityLog();
    init_Player();
    init_Scoreboards();
    init_World();
    init_api();
    debug.i("SYS", "register module: config");
    ModuleRegistry.register({
      id: "config",
      afterWorldLoad: false,
      lifecycle: {
        registerCommands: () => {
          Command.register(
            "admin",
            "chat.admin",
            (player) => {
              if (player) AdminGUI.show(player);
            },
            "\u7BA1\u7406\u9762\u677F"
          );
        },
        init: () => {
          ConfigManager.startPolling();
          ConfigManager.startFastPoll();
        }
      }
    });
    debug.i("SYS", "register module: command");
    ModuleRegistry.register({
      id: "command",
      afterWorldLoad: false,
      lifecycle: {
        registerPermissions: () => {
          Permission.register("help.see", Permission.Member);
          Permission.register("permlist.see", Permission.Member);
        },
        registerCommands: () => {
          Command.registerHelpCommand();
          Permission.registerPermlistCommand();
        },
        registerEvents: () => {
          world27.beforeEvents.chatSend.subscribe((event) => {
            if (!guardEvent()) return;
            const firstChar = event.message.substring(0, 1);
            if (firstChar === "!" || firstChar === "\uFF01") {
              Command.trigger(event.sender, event.message.substring(1));
              event.cancel = true;
            }
          });
        }
      }
    });
    debug.i("SYS", "register module: dataBackup");
    ModuleRegistry.register({
      id: "dataBackup",
      afterWorldLoad: false,
      lifecycle: {
        registerEvents: () => {
          world27.afterEvents.playerSpawn.subscribe((event) => {
            if (!guardEvent()) return;
            if (event.initialSpawn) {
              getPlayerData(event.player).then((data) => {
                savePlayers([data]).catch(() => {
                });
              });
            }
          });
          world27.afterEvents.playerLeave.subscribe(async (event) => {
            if (!guardEvent()) return;
            const player = world27.getEntity(event.playerId);
            if (player) {
              try {
                const data = await getPlayerData(player);
                await savePlayers([data]);
              } catch {
              }
            }
          });
        },
        cleanup: () => {
          syncWorldData();
        }
      }
    });
    debug.i("SYS", "register module: gui");
    ModuleRegistry.register({
      id: "gui",
      afterWorldLoad: false,
      lifecycle: {
        registerPermissions: () => {
          Permission.register("menu.use", Permission.Member);
        },
        registerCommands: () => {
          MainMenu.registerMenuCommand();
        }
      }
    });
    debug.i("SYS", "register module: fly");
    ModuleRegistry.register({
      id: "fly",
      afterWorldLoad: false,
      lifecycle: {
        registerPermissions: () => registerPermissions2(),
        registerEvents: () => registerEvents2(),
        init: () => boot(),
        cleanup: () => stop2()
      }
    });
    debug.i("SYS", "register module: onlineTime");
    ModuleRegistry.register({
      id: "onlineTime",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => OnlineTime.getInstance().registerCommandsAndPermissions(),
        registerEvents: () => OnlineTime.getInstance().registerEvents(),
        init: () => OnlineTime.getInstance().init(),
        cleanup: () => OnlineTime.getInstance().stop()
      }
    });
    debug.i("SYS", "register module: creative");
    ModuleRegistry.register({
      id: "creative",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => CreativeArea.getInstance().registerCommandsAndPermissions(),
        registerEvents: () => CreativeArea.getInstance().registerEvents(),
        init: () => CreativeArea.getInstance().init(),
        cleanup: () => CreativeArea.getInstance().cleanup()
      }
    });
    debug.i("SYS", "register module: survival");
    ModuleRegistry.register({
      id: "survival",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => SurvivalArea.getInstance().registerCommandsAndPermissions(),
        registerEvents: () => SurvivalArea.getInstance().registerEvents(),
        init: () => SurvivalArea.getInstance().init(),
        cleanup: () => SurvivalArea.getInstance().cleanup()
      }
    });
    debug.i("SYS", "register module: land");
    ModuleRegistry.register({
      id: "land",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => LandSystem.registerCommandsAndPermissions(),
        registerEvents: () => LandEvents.registerEvents(),
        init: () => LandSystem.init(),
        cleanup: () => {
          LandEvents.cleanup();
          LandSystem.cleanup();
        }
      }
    });
    debug.i("SYS", "register module: money");
    ModuleRegistry.register({
      id: "money",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => Permission.register("money.admin", Permission.OP),
        registerCommands: () => MoneyGUI.registerCommand(),
        registerEvents: () => {
          world27.afterEvents.playerSpawn.subscribe((event) => {
            void Money.load(event.player);
          });
        },
        init: () => {
          Money.initScoreboard();
          Command.deductCost = async (player, amount, commandName) => {
            return Money.add(player, -amount);
          };
          EconomyReport.start();
        },
        cleanup: () => {
          EconomyReport.stop();
        }
      }
    });
    debug.i("SYS", "register module: afk");
    ModuleRegistry.register({
      id: "afk",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => registerPermissions(),
        registerCommands: () => registerCommand(),
        registerEvents: () => registerEvents(),
        init: () => init(),
        cleanup: () => stop()
      }
    });
    debug.i("SYS", "register module: coop");
    ModuleRegistry.register({
      id: "coop",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => CoopSystem.registerPermissions(),
        registerCommands: () => CoopSystem.registerCommands(),
        init: () => CoopSystem.init()
      }
    });
    debug.i("SYS", "register module: chat");
    ModuleRegistry.register({
      id: "chat",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => {
          Permission.register("chat.use", Permission.Member);
          Permission.register("chat.admin", Permission.OP);
        },
        registerCommands: () => ChatSystem.registerCommands(),
        registerEvents: () => ChatSystem.registerEvents(),
        init: () => ChatSystem.init(),
        cleanup: () => ChatSystem.cleanup()
      }
    });
    debug.i("SYS", "register module: tps");
    ModuleRegistry.register({
      id: "tps",
      afterWorldLoad: true,
      lifecycle: {
        registerPermissions: () => TPS.registerPermissions(),
        registerCommands: () => TPS.registerCommands(),
        init: () => TPS.init(),
        cleanup: () => TPS.stop()
      }
    });
    debug.i("SYS", "register module: clean");
    ModuleRegistry.register({
      id: "clean",
      afterWorldLoad: true,
      lifecycle: {
        registerCommands: () => registerCommand2(),
        init: () => Clean.getInstance().init(),
        cleanup: () => Clean.getInstance().stop()
      }
    });
    debug.i("SYS", "register module: priceIndex");
    ModuleRegistry.register({
      id: "priceIndex",
      afterWorldLoad: false,
      lifecycle: {}
    });
    debug.i("SYS", "register module: dailyTask");
    ModuleRegistry.register({
      id: "dailyTask",
      afterWorldLoad: false,
      lifecycle: {
        registerCommands: () => DailyTask.registerCommand()
      }
    });
    debug.i("SYS", "register module: inventorySwitcher");
    ModuleRegistry.register({
      id: "inventorySwitcher",
      afterWorldLoad: true,
      lifecycle: {
        registerEvents: () => InventorySwitcher.getInstance().registerEvents(),
        init: () => InventorySwitcher.getInstance().init(),
        cleanup: () => InventorySwitcher.getInstance().cleanup()
      }
    });
    debug.i("SYS", "register module: activityLog");
    ModuleRegistry.register({
      id: "activityLog",
      afterWorldLoad: true,
      lifecycle: {
        registerEvents: () => ActivityLog.registerEvents(),
        init: () => ActivityLog.init(),
        cleanup: () => ActivityLog.cleanup()
      }
    });
    debug.i("SYS", "register module: scoreboardSync");
    ModuleRegistry.register({
      id: "scoreboardSync",
      afterWorldLoad: true,
      lifecycle: {
        registerCommands: () => ScoreboardSync.registerCommands(),
        init: () => ScoreboardSync.init(),
        cleanup: () => ScoreboardsBackup()
      }
    });
    debug.i("SYS", "register module: chatSounds");
    ModuleRegistry.register({
      id: "chatSounds",
      afterWorldLoad: true,
      lifecycle: {
        init: () => ChatSoundsHelper.getInstance().registerEvent(),
        cleanup: () => ChatSoundsHelper.getInstance().stop()
      }
    });
    debug.i("SYS", "register module: monitor");
    ModuleRegistry.register({
      id: "monitor",
      afterWorldLoad: false,
      lifecycle: {
        init: () => MonitorReporter.init(),
        cleanup: () => MonitorReporter.stop()
      }
    });
    debug.i("SYS", "register module: peace");
    ModuleRegistry.register({
      id: "peace",
      afterWorldLoad: false,
      lifecycle: {
        registerEvents: () => Peace.getInstance().init()
      }
    });
    debug.i("SYS", "register module: qa");
    ModuleRegistry.register({
      id: "qa",
      afterWorldLoad: false,
      lifecycle: {
        init: () => QAManager.getInstance().start(),
        cleanup: () => QAManager.getInstance().stop()
      }
    });
    debug.i("SYS", "register module: spawnProtect");
    ModuleRegistry.register({
      id: "spawnProtect",
      afterWorldLoad: false,
      lifecycle: {
        registerEvents: () => SpawnProtect.registerEvents()
      }
    });
    AddOnInit = class {
      static init() {
        this.registerEvents();
      }
      static registerEvents() {
        system25.beforeEvents.startup.subscribe(async () => {
          system25.run(async () => {
            await ConfigManager.init();
            Permission.register("holorint.menu", Permission.Member);
            Permission.register("holorint.pos1", Permission.Member);
            Permission.register("holorint.pos2", Permission.Member);
            setModuleGuard((moduleId) => {
              const idKey = moduleId;
              return ModuleRegistry.isActive(idKey);
            });
            ModuleRegistry.bootAll();
            ModuleRegistry.snapshotEnabled();
            announceLoaded();
          });
        });
        world27.afterEvents.worldLoad.subscribe(() => {
          if (!guardEvent()) return;
          ModuleRegistry.bootAfterWorldLoad();
          syncWorldData();
        });
        system25.beforeEvents.shutdown.subscribe(() => {
          if (!guardEvent()) return;
          ModuleRegistry.teardown();
        });
      }
      static createTasks() {
        if (!ConfigManager.isReady()) return;
        ModuleRegistry.bootTasks();
      }
    };
  }
});

// scripts/index.ts
var require_index = __commonJS({
  "scripts/index.ts"() {
    init_entry();
    AddOnInit.init();
  }
});
export default require_index();
//# sourceMappingURL=main.js.map
