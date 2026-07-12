// scripts/entry.ts
import { system as system24, world as world29 } from "@minecraft/server";

// scripts/libs/Money.ts
import { world } from "@minecraft/server";
var MONEY_NAME = "money";
var Money = class {
  static {
    /** 货币单位名称 */
    this.UNIT = "\u8282\u64CD";
  }
  /**
   * 获取玩家金钱数量
   */
  static get(player) {
    let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
    if (!scoreboard) return 0;
    try {
      let score = scoreboard.getScore(player);
      if (score !== void 0) {
        return score;
      }
    } catch (_) {
    }
    if (scoreboard) {
      scoreboard.setScore(player, 0);
    }
    return 0;
  }
  /**
   * 设置玩家金钱数量
   */
  static set(player, money) {
    let scoreboard = world.scoreboard.getObjective(MONEY_NAME);
    if (!scoreboard) {
      world.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
      scoreboard = world.scoreboard.getObjective(MONEY_NAME);
    }
    return scoreboard.setScore(player, money);
  }
  /**
   * 给予玩家金钱
   */
  static add(player, money) {
    return this.set(player, this.get(player) + money);
  }
  /**
   * 初始化计分板
   */
  static initScoreboard() {
    if (!world.scoreboard.getObjective(MONEY_NAME)) {
      world.getDimension("overworld").runCommand(`scoreboard objectives add ${MONEY_NAME} dummy ${MONEY_NAME}`);
    }
  }
};

// scripts/libs/Command.ts
import { system as system5 } from "@minecraft/server";

// scripts/libs/Permission.ts
import { PlayerPermissionLevel } from "@minecraft/server";

// scripts/libs/ConfigManager.ts
import { system as system4, world as world6 } from "@minecraft/server";

// scripts/libs/HttpDB.ts
import { http, HttpRequest } from "@minecraft/server-net";
import { system } from "@minecraft/server";
var HOST = "127.0.0.1";
var PORT = 3001;
var BASE_URL = `http://${HOST}:${PORT}`;
var TIMEOUT = 3;
var HttpDB = class _HttpDB {
  static {
    this.available = true;
  }
  static {
    this._lastErrorLog = 0;
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
          await system.waitTicks(40);
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
  // ---- Holoprint 投影 ----
  static async uploadHoloStructure(projection, structureBase64) {
    return this.post("/api/hpbe/upload", { projection, structure: structureBase64 });
  }
  static async getHoloProjections(ownerId, visibility) {
    const qs = [];
    if (ownerId) qs.push(`owner_id=${encodeURIComponent(ownerId)}`);
    if (visibility) qs.push(`visibility=${encodeURIComponent(visibility)}`);
    const query = qs.length > 0 ? "?" + qs.join("&") : "";
    const body = await this.get(`/api/hpbe/projections${query}`);
    if (!body) return null;
    try {
      return JSON.parse(body).projections;
    } catch (e) {
      console.warn("[HttpDB] error:", e);
      return null;
    }
  }
  static async getHoloProjection(id) {
    const body = await this.get(`/api/hpbe/projections/${encodeURIComponent(id)}`);
    if (!body) return null;
    try {
      return JSON.parse(body).projection;
    } catch (e) {
      console.warn("[HttpDB] error:", e);
      return null;
    }
  }
  static async updateHoloProjection(id, settings) {
    return this.post(`/api/hpbe/projections/${encodeURIComponent(id)}`, { settings });
  }
  static async deleteHoloProjection(id) {
    return this.del(`/api/hpbe/projections/${encodeURIComponent(id)}`);
  }
  static async getHoloPackVersion() {
    const body = await this.get("/api/hpbe/pack-version");
    if (!body) return null;
    try {
      return JSON.parse(body).version;
    } catch (e) {
      console.warn("[HttpDB] error:", e);
      return null;
    }
  }
  static async getHoloMaterials(projectionId) {
    const body = await this.get(`/api/hpbe/materials/${encodeURIComponent(projectionId)}`);
    if (!body) return null;
    try {
      return JSON.parse(body).materials;
    } catch (e) {
      console.warn("[HttpDB] error:", e);
      return null;
    }
  }
};

// scripts/libs/Tools.ts
import { world as world2, BlockPermutation, BlockComponentTypes } from "@minecraft/server";
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
function formatTimestamp(ts) {
  const offset = 8 * 60;
  const d = new Date(ts + offset * 60 * 1e3);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
var _systemMsgHandler = null;
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
var Msg = {
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

// scripts/area/CreativeArea.ts
import {
  system as system2,
  world as world3,
  GameMode,
  EntityInitializationCause
} from "@minecraft/server";
var CreativeArea = class _CreativeArea {
  constructor() {
    this.BORDER_THRESHOLD = 10;
    this.BORDER_WARNING_DISTANCE = 5;
    this.BUFFER_ZONE = 3;
  }
  static getInstance() {
    if (!_CreativeArea._instance) {
      _CreativeArea._instance = new _CreativeArea();
    }
    return _CreativeArea._instance;
  }
  static {
    /** 连锁开关（同时控制 CreativeArea + SurvivalArea） */
    this.enable = true;
  }
  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  registerCommandsAndPermissions() {
    Permission.register("creativearea.place_banned", Permission.Admin);
  }
  /** 注册事件（由 entry.ts 统一调用） */
  registerEvents() {
    world3.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      system2.runTimeout(() => {
        const areaName = this.inArea(event.player);
        if (areaName !== void 0) {
          this.enterArea(event.player, areaName);
        } else if (event.player.getGameMode() === GameMode.Creative || event.player.getGameMode() === GameMode.Spectator) {
          event.player.setGameMode(GameMode.Survival);
        }
      }, 60);
    });
    world3.afterEvents.playerDimensionChange.subscribe((event) => {
      if (!_CreativeArea.enable) return;
      system2.runTimeout(() => {
        const areaName = this.inArea(event.player);
        const currentArea = event.player.getDynamicProperty("hpbe:creative_area");
        if (currentArea === void 0 && areaName !== void 0) {
          this.enterArea(event.player, areaName);
        } else if (currentArea !== void 0 && areaName === void 0) {
          this.leaveArea(event.player, currentArea);
        }
      }, 10);
    });
    world3.afterEvents.entitySpawn.subscribe((event) => {
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
    });
    world3.beforeEvents.playerPlaceBlock.subscribe((event) => {
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
    });
    world3.beforeEvents.playerBreakBlock.subscribe((event) => {
      if (!_CreativeArea.enable) return;
      if (event.player.getGameMode() !== GameMode.Creative) return;
      if (!this.inAreaByPos(event.block.location.x, event.block.location.z, event.player.dimension.id)) {
        event.cancel = true;
        Msg.error(`\u4F60\u53EA\u80FD\u7834\u574F\u521B\u9020\u533A\u57DF\u5185\u7684\u65B9\u5757\u3002`, event.player);
      }
    });
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
  inAreaByPos(x, z, dimensionId) {
    for (const area of ConfigManager.getAreas("creative")) {
      if (dimensionId === area.dimension) {
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
    for (const obj of world3.scoreboard.getObjectives()) {
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
    for (const obj of world3.scoreboard.getObjectives()) {
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
    system2.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world3.getPlayers()) {
        if (player.getGameMode() === GameMode.Spectator) continue;
        const currentArea = player.getDynamicProperty("hpbe:creative_area");
        if (currentArea === void 0) {
          const areaName = this.inArea(player);
          if (areaName !== void 0) this.enterArea(player, areaName);
        } else {
          if (this.inArea(player) === void 0) this.leaveArea(player, currentArea);
        }
      }
    }, 10);
  }
  // ==========================================
  //  边界快速检测
  // ==========================================
  startBorderFastCheck() {
    system2.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world3.getPlayers()) {
        if (player.getGameMode() !== GameMode.Creative) continue;
        if (!this.isNearBorder(player)) continue;
        const currentArea = player.getDynamicProperty("hpbe:creative_area");
        if (currentArea !== void 0 && this.inArea(player) === void 0) {
          this.leaveArea(player, currentArea);
        }
      }
    }, 2);
  }
  // ==========================================
  //  边界视觉警告
  // ==========================================
  startBorderWarning() {
    system2.runInterval(() => {
      if (!_CreativeArea.enable) return;
      for (const player of world3.getPlayers()) {
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
    }, 20);
  }
};

// scripts/area/Peace.ts
import { world as world4, EntityInitializationCause as EntityInitializationCause2 } from "@minecraft/server";
var Peace = class _Peace {
  constructor() {
    this.enable = true;
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
    world4.afterEvents.entitySpawn.subscribe((event) => {
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

// scripts/chat/DogeChat.ts
import { world as world5, system as system3 } from "@minecraft/server";

// scripts/api/ChatApi.ts
var PATH_CHANNELS = "/api/sfmc/channels";
var PATH_MESSAGES = "/api/sfmc/messages";
var PATH_REDPACKET = "/api/sfmc/redpacket";
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
  return HttpDB.post(PATH_REDPACKET, { redpacket });
}
async function updateRedPacket(redpacketId, redpacketModify) {
  return HttpDB.patch(`${PATH_REDPACKET}/${encodeURIComponent(redpacketId)}`, redpacketModify);
}

// scripts/api/CoopAPI.ts
var PATH = "/api/sfmc/coops";
async function getAllCoops() {
  const body = await HttpDB.get(PATH);
  if (!body) return [];
  try {
    return JSON.parse(body).coops || [];
  } catch {
    return [];
  }
}
async function getCoop(cid) {
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}`);
  if (!body) return null;
  try {
    return JSON.parse(body).coop || null;
  } catch {
    return null;
  }
}
async function createCoop(coop) {
  return HttpDB.post(PATH, { coop });
}
async function updateCoop(cid, data) {
  return HttpDB.patch(`${PATH}/${encodeURIComponent(cid)}`, data);
}
async function deleteCoop(cid) {
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}`);
}
async function getMembers(cid) {
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/members`);
  if (!body) return [];
  try {
    return JSON.parse(body).members || [];
  } catch {
    return [];
  }
}
async function addMember(cid, player_name, is_op) {
  return HttpDB.post(`${PATH}/${encodeURIComponent(cid)}/members`, { player_name, is_op });
}
async function removeMember(cid, player_name) {
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}/members/${encodeURIComponent(player_name)}`);
}
async function getShopItems(cid, type) {
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
  return HttpDB.post(`${PATH}/${encodeURIComponent(item.cid)}/shop_items`, item);
}
async function deleteShopItem(cid, id) {
  return HttpDB.del(`${PATH}/${encodeURIComponent(cid)}/shop_items/${encodeURIComponent(id)}`);
}
async function getBankLog(cid) {
  const body = await HttpDB.get(`${PATH}/${encodeURIComponent(cid)}/bank_log`);
  if (!body) return [];
  try {
    return JSON.parse(body).log || [];
  } catch {
    return [];
  }
}
async function addBankLog(cid, player_name, type, amount, note) {
  return HttpDB.post(`${PATH}/${encodeURIComponent(cid)}/bank_log`, { player_name, type, amount, note });
}
async function getAllShopGroups() {
  const body = await HttpDB.get("/api/sfmc/coop_shop_groups");
  if (!body) return [];
  try {
    return JSON.parse(body).groups || [];
  } catch {
    return [];
  }
}
async function saveShopGroup(group) {
  return HttpDB.post("/api/sfmc/coop_shop_groups", { group });
}
async function findPlayerCoop(playerName) {
  const all = await getAllCoops();
  for (const c of all) {
    const members = await getMembers(c.cid);
    if (members.some((m) => m.player_name === playerName)) return c.cid;
  }
  return null;
}

// scripts/api/PlayersDataApi.ts
var PATH_PLAYERS = "/api/sfmc/players";
async function savePlayers(players) {
  return HttpDB.post(PATH_PLAYERS, { players });
}

// scripts/api/WorldDataApi.ts
async function saveWorldData(data) {
  return HttpDB.post("/api/sfmc/world", { data });
}

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

// scripts/chat/DogeChat.ts
var DogeChat = class _DogeChat {
  static {
    this.DEFAULT_CHANNEL_CONFIG = {
      allowChat: true,
      slowMode: 0,
      isBroadcast: false
    };
  }
  static {
    this.DEFAULT_CHANNELS = [
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
  }
  static {
    this.slowModeTracker = /* @__PURE__ */ new Map();
  }
  static {
    /** 发送频道（玩家输入的消息发送到此频道） */
    this.activeChannelMap = /* @__PURE__ */ new Map();
  }
  static {
    /** 订阅频道（接收消息的频道列表） */
    this.subscribedChannelsMap = /* @__PURE__ */ new Map();
  }
  static {
    /** QQ 桥接轮询 */
    this._bridgePollStarted = false;
  }
  static {
    this._lastBridgeFetch = Date.now();
  }
  static {
    this._lastBridgeTimestamp = 0;
  }
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
    for (let i = 0; i < 5; i++) {
      const existing = await getChannels();
      if (existing && existing.length > 0) return;
      if (i < 4) {
        await system3.waitTicks(40);
        continue;
      }
      const ok = await saveChannels(_DogeChat.DEFAULT_CHANNELS).catch((err) => {
        console.warn(`[DogeChat] \u4FDD\u5B58\u9ED8\u8BA4\u9891\u9053\u5931\u8D25: ${err}`);
        return false;
      });
      if (ok) return;
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
    for (const p of world5.getPlayers()) {
      if (this.subscribedChannelsMap.get(p.id)?.has(channelId)) count++;
    }
    return count;
  }
  /** 创建新频道 */
  static async createChannel(name, prefix, type, config, owner) {
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
    const ch = await getChannel(channelId);
    if (!ch) return false;
    if (ch.type === "public") return false;
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
    for (const p of world5.getPlayers()) {
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
    const nameB = world5.getPlayers().find((p) => p.id === idB)?.name ?? idB;
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
    if (amount <= 0 || count <= 0 || count > amount) {
      Msg.error("\u7EA2\u5305\u53C2\u6570\u65E0\u6548\u3002", sender);
      return false;
    }
    const balance = Money.get(sender);
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
    Money.set(sender, balance - amount);
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
    const updated = await updateRedPacket(packet.id, {
      remainingAmount: packet.remainingAmount - amount,
      remainingCount: packet.remainingCount - 1,
      receivers: [...packet.receivers, player.id]
    });
    if (!updated) {
      Msg.error("\u9886\u53D6\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002", player);
      return 0;
    }
    Money.add(player, amount);
    Msg.success(`\u4F60\u9886\u53D6\u4E86 ${packet.senderName} \u7684\u7EA2\u5305\uFF0C\u83B7\u5F97 ${amount} ${Money.UNIT}\uFF01`, player);
    return amount;
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
    if (this._bridgePollStarted) return;
    this._bridgePollStarted = true;
    this._lastBridgeFetch = Date.now();
    system3.runInterval(async () => {
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
            for (const p of world5.getPlayers()) {
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
    }, 20);
  }
};

// scripts/libs/ConfigManager.ts
var ConfigManager = class {
  static {
    this.cache = {
      modules: /* @__PURE__ */ new Map(),
      settings: /* @__PURE__ */ new Map(),
      areas: [],
      permissions: {},
      bannedItems: [],
      clean: { itemMax: 192, pollInterval: 60 },
      grids: {},
      peaceFilters: [],
      questions: [],
      shopCategories: [],
      shopItems: [],
      _lastFetch: 0
    };
  }
  static {
    this._initialized = false;
  }
  static async init() {
    if (this._initialized) return;
    this._initialized = true;
    await HttpDB.checkHealth();
    await this.reloadAll();
    this._syncRuntimeFlags();
    console.log("[ConfigManager] \u914D\u7F6E\u5DF2\u52A0\u8F7D");
  }
  static startPolling(intervalTicks = 72e3) {
    system4.runInterval(() => this._poll(), intervalTicks);
  }
  /**
   * 快速信号检查（每 2 秒），检测 _reload_signal → 立即全量重载
   */
  static startFastPoll(intervalTicks = 40) {
    system4.runInterval(() => this._fastPoll(), intervalTicks);
  }
  static isEnabled(module) {
    return this.cache.modules.get(module) ?? true;
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
  static getShopCategories() {
    return [...this.cache.shopCategories];
  }
  static getShopItems() {
    return [...this.cache.shopItems];
  }
  static async reloadAll() {
    const now = Date.now();
    const promises = [
      this._fetchModules(),
      this._fetchSettings(),
      this._fetchAreas(),
      this._fetchPermissions(),
      this._fetchBannedItems(),
      this._fetchClean(),
      this._fetchGrids(),
      this._fetchPeaceFilters(),
      this._fetchQA(),
      this._fetchShop()
    ];
    await Promise.allSettled(promises);
    this.cache._lastFetch = now;
  }
  static async reloadModule(module) {
    await this._fetchSettings();
    await this._fetchAreas();
  }
  // ── Internal fetchers ──
  static async _poll() {
    if (!this.cache._lastFetch) return;
    try {
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
      if (upd.shop_categories || upd.shop_items) await this._fetchShop();
    } catch {
    }
  }
  static async _fastPoll() {
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
        const bridgeId = this.getSetting("bridge_channel_id", "");
        if (bridgeId) DogeChat.startBridgePolling(bridgeId);
        for (const p of world6.getPlayers()) {
          Msg.info("\u914D\u7F6E\u5DF2\u70ED\u91CD\u8F7D", p);
        }
      }
    } catch (e) {
      console.warn(`[ConfigManager] \u70ED\u91CD\u8F7D\u4FE1\u53F7\u68C0\u67E5\u5931\u8D25: ${e.message || e}`);
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
      for (const m of modules) this.cache.modules.set(m.name, !!m.enabled);
    } catch (e) {
      console.warn(`[ConfigManager] \u83B7\u53D6\u6A21\u5757\u914D\u7F6E\u5931\u8D25: ${e.message || e}`);
    }
  }
  static async _fetchSettings() {
    try {
      const body = await HttpDB.get("/api/sfmc/settings");
      if (!body) return;
      const { settings } = JSON.parse(body);
      this.cache.settings.clear();
      for (const s of settings) this.cache.settings.set(s.key, s.value);
    } catch {
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
    } catch {
    }
  }
  static async _fetchPermissions() {
    try {
      const body = await HttpDB.get("/api/sfmc/permissions");
      if (!body) return;
      const { permissions } = JSON.parse(body);
      this.cache.permissions = {};
      for (const p of permissions) this.cache.permissions[p.player_name] = p.level;
    } catch {
    }
  }
  static async _fetchBannedItems() {
    try {
      const body = await HttpDB.get("/api/sfmc/banned_items");
      if (!body) return;
      this.cache.bannedItems = (JSON.parse(body).items || []).map((i) => i.item_id);
    } catch {
    }
  }
  static async _fetchClean() {
    try {
      const body = await HttpDB.get("/api/sfmc/clean");
      if (!body) return;
      const { clean } = JSON.parse(body);
      if (clean) this.cache.clean = { itemMax: clean.item_max, pollInterval: clean.poll_interval };
    } catch {
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
    } catch {
    }
  }
  static async _fetchPeaceFilters() {
    try {
      const body = await HttpDB.get("/api/sfmc/peace_filters");
      if (!body) return;
      this.cache.peaceFilters = JSON.parse(body).filters || [];
    } catch {
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
    } catch {
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
  static async _fetchShop() {
    try {
      const body = await HttpDB.get("/api/sfmc/shop");
      if (!body) return;
      const { categories, items } = JSON.parse(body);
      this.cache.shopCategories = categories || [];
      this.cache.shopItems = items || [];
    } catch {
    }
  }
};

// scripts/libs/Permission.ts
var Permission = class {
  static {
    this.Guest = -1;
  }
  static {
    // 脚本指定的无权限访客
    this.Any = 0;
  }
  static {
    // 等同于原生 Visitor
    this.Member = 1;
  }
  static {
    // 等同于原生 Member
    this.OP = 2;
  }
  static {
    // 等同于原生 Operator
    this.Admin = 3;
  }
  static {
    // 等同于原生 Custom
    /** 权限注册表：权限名 → 所需最低等级 */
    this.registry = /* @__PURE__ */ new Map();
  }
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
    if (required === void 0) return true;
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

// scripts/libs/Command.ts
var Command = class {
  static {
    this.list = {};
  }
  /**
   * 注册指令
   * @param name 指令名称
   * @param permission 权限等级(数字) 或 权限名(字符串)
   * @param callback 回调
   * @param description 指令描述
   */
  static register(name, permission, callback, description) {
    if (this.list[name] === void 0) {
      this.list[name] = {
        callback,
        permission,
        description: description === void 0 ? name : description
      };
    }
    return false;
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
    let commandInfo = this.list[message];
    if (commandInfo !== void 0) {
      if (this.canExecute(player, commandInfo.permission)) {
        system5.run(async () => {
          const result = await commandInfo.callback(player);
          if (result !== void 0 && player) Msg.success(`${result}`, player);
        });
        return;
      }
      if (player) Msg.error(`\u4F60\u6CA1\u6709\u6267\u884C\u6B64\u6761\u6307\u4EE4\u7684\u6743\u9650\u3002`, player);
      return;
    }
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
    system5.afterEvents.scriptEventReceive.subscribe(
      (event) => {
        this.trigger(event.sourceEntity, event.id.substring(5));
      },
      { namespaces: ["doge"] }
    );
  }
};
Command.registerScriptEvent();

// scripts/doge/QA.ts
import { system as system6, world as world7 } from "@minecraft/server";
var QAManager = class _QAManager {
  constructor() {
    // 记录玩家答题信息
    this.nowQuestion = void 0;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;
    this.timeoutId = void 0;
    // 出题记录，避免短时间重复出题
    this.record = [];
    // 最近出的几个题
    this.recordPtr = 0;
    // 下一个记录写入的位置
    this.recordLimit = Math.floor(ConfigManager.getQuestions().length - 2);
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
    world7.beforeEvents.chatSend.subscribe((event) => {
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
    system6.runTimeout(() => {
      this.nextQuestion();
    }, _QAManager.getNextTimeout());
  }
  // 下一个问题
  nextQuestion() {
    let questionList = [];
    let totalWeight = 0;
    let startPoints = [];
    for (let i = 0; i < ConfigManager.getQuestions().length; i++) {
      if (!this.record.includes(i)) {
        questionList.push(i);
        totalWeight += ConfigManager.getQuestions()[i].weight;
        startPoints.push(totalWeight);
      }
    }
    let randomNum = getRandomInteger(0, totalWeight - 1);
    for (let i = 0; i < startPoints.length; i++) {
      if (randomNum < startPoints[i]) {
        this.nowQuestion = questionList[i];
        this.pushRecord(i);
        break;
      }
    }
    world7.sendMessage(
      `\xA7b[Baka Cirno]\xA7r \xA7g${ConfigManager.getQuestions()[this.nowQuestion].q}\xA7r
  \xA7h\u53D1\u9001 \xA7e!\u7B54\u6848\xA7r \xA7h\u6765\u7B54\u9898`
    );
    system6.runTimeout(
      () => {
        this.finish();
      },
      ConfigManager.getSetting("qa_timeout", 60) * 20
    );
  }
  // 结束答题，揭晓答案
  finish() {
    let question = ConfigManager.getQuestions()[this.nowQuestion];
    world7.sendMessage(
      `\xA7b[Baka Cirno]\xA7r \u6B63\u786E\u7B54\u6848\u662F \xA7e${question.a[0]}\xA7r ! ${question.d !== void 0 ? "\n  " + question.d : ""}`
    );
    this.nowQuestion = void 0;
    this.playerList = {};
    this.rightAmount = 0;
    this.wrongAmount = 0;
    this.timeoutId = system6.runTimeout(() => {
      this.nextQuestion();
    }, _QAManager.getNextTimeout());
  }
  /**
   * 玩家答题
   * @returns -2答题未在进行 -1玩家已答过题 0错误 1正确
   */
  answer(pl, str) {
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
    return min + Math.floor(Math.random() * max);
  }
  /**
   * 给予玩家奖励 也可以是惩罚，格式是一样的
   * @param pl 答题者
   * @param seq 顺序(从1开始)
   * @param bonus 奖励列表
   */
  static giveBonus(pl, seq, bonus) {
    if (!bonus) return;
    for (let b of bonus) {
      if (b["seq"] === void 0 || b["seq"][0] <= seq && seq <= b["seq"][1]) {
        system6.run(() => {
          switch (b["type"]) {
            case "money":
              Money.add(pl, b["amount"]);
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

// scripts/area/Fly.ts
import { system as system7, world as world8, GameMode as GameMode2 } from "@minecraft/server";
function init() {
  Permission.register("fly.use", Permission.Any);
}
function playerJoinEvent(player) {
  system7.runTimeout(() => {
    let areaName = inFlyArea(player);
    if (areaName !== void 0) {
      enableFly(player);
      Msg.info(`\u5F53\u524D\u5904\u4E8E\u98DE\u884C\u533A ${areaName}, \u5DF2\u6253\u5F00\u98DE\u884C\u6A21\u5F0F\u3002`, player);
      player.setDynamicProperty("hpbe:dogefly", areaName);
    }
  }, 60);
}
system7.runInterval(() => {
  for (let player of world8.getPlayers({ gameMode: GameMode2.Survival })) {
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

// scripts/doge/AFK.ts
import { system as system8, world as world9 } from "@minecraft/server";
var afkCache = /* @__PURE__ */ new Map();
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
function init2() {
  console.log(`Initializing AFK...`);
  for (let player of world9.getAllPlayers()) {
    reset(player);
  }
  console.log(`AFK initialized successfully.`);
}
function reset(player) {
  cacheDelete(player, "afk:last_location");
  cacheDelete(player, "afk:step");
  player.removeTag("AFK");
  player.removeTag("NOAFK");
}
function setAFK(player) {
  player.removeTag("NOAFK");
  startAFKScan();
  playerList[player.id] = player.location;
  world9.sendMessage(`\xA77* ${player.nameTag} is now AFK. *`);
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
var STEP_TIME = 15;
system8.runInterval(() => {
  for (let player of world9.getPlayers({ excludeTags: ["AFK", "NOAFK"] })) {
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
var intervalId = void 0;
var playerList = {};
function startAFKScan() {
  if (intervalId !== void 0) {
    return;
  }
  intervalId = system8.runInterval(() => {
    let count = 0;
    for (let id in playerList) {
      let player = world9.getEntity(id);
      if (player === void 0) {
        delete playerList[id];
      } else {
        if (locationMoved(playerList[id], player.location)) {
          world9.sendMessage(`\xA77* ${player.nameTag} is no longer AFK. *`);
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
  system8.clearRun(intervalId);
  intervalId = void 0;
}
function registerCommand() {
  Command.register("afk", "afk.use", setAFK, "\u8FDB\u5165AFK\u72B6\u6001");
  Command.register(
    "noafk",
    "afk.clear.other",
    (pl) => {
      if (pl) pl.addTag("NOAFK");
    },
    "\u4EE4\u73A9\u5BB6\u4E0D\u4F1A\u8FDB\u5165AFK\u72B6\u6001"
  );
}

// scripts/doge/SpawnProtect.ts
var SpawnProtect = class {
  static setProtect(player) {
    if (player.getEffect("minecraft:resistance") === void 0) {
      player.addEffect("minecraft:resistance", 3, { amplifier: 5 });
    }
  }
};

// scripts/doge/Clean.ts
import { system as system9, world as world10, BlockComponentTypes as BlockComponentTypes2 } from "@minecraft/server";
var Clean = class _Clean {
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
  static {
    this._instance = void 0;
  }
  static getInstance() {
    if (!_Clean._instance) {
      this._instance = new _Clean();
    }
    return this._instance;
  }
  static {
    this.cleanIndex = 0;
  }
  init() {
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
    const dimension = world10.getDimension("overworld");
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
    if (this.intervalId) {
      system9.clearRun(this.intervalId);
      this.intervalId = void 0;
    }
    this.intervalId = system9.runInterval(() => {
      let entities = this.getAllItemEntities();
      if (entities.length > this.itemMax) {
        world10.sendMessage({ rawtext: [{ text: "\u300C\xA76\u8AAD\u7D4C\u3059\u308B\u30E4\u30DE\u30D3\u30B3 ~ \u5E7D\u8C37 \u97FF\u5B50\xA7f\u300D \u8DDD\u79BB\u6E05\u7406\u6389\u843D\u7269\u8FD8\u6709\xA7c 5 \xA7fs" }] });
        system9.runTimeout(() => {
          this.startClean(void 0);
          system9.runTimeout(() => {
            world10.sendMessage({ rawtext: [{ text: "\xA7a* \u5DF2\u6E05\u7406\u6389\u843D\u7269 *" }] });
          }, 5);
        }, 100);
      }
    }, this.timeout * 20);
  }
  stopCleanInterval() {
    if (this.intervalId) {
      system9.clearRun(this.intervalId);
      this.intervalId = void 0;
    }
  }
  /**
   * 获取世界的所有物品
   */
  getAllItemEntities() {
    let itemEntities = world10.getDimension("overworld").getEntities({ type: "item" });
    itemEntities.push(...world10.getDimension("nether").getEntities({ type: "item" }));
    itemEntities.push(...world10.getDimension("the_end").getEntities({ type: "item" }));
    return itemEntities;
  }
  getTimeStr() {
    const { date, time } = getShanghaiTime();
    return `
${date}
${time}`;
  }
};
function registerCommand2() {
  Permission.register("clean.admin", Permission.OP);
  Command.register(
    "clean",
    "clean.admin",
    () => {
      Clean.getInstance().startClean(void 0);
    },
    "\u5F00\u59CB\u626B\u5730"
  );
}

// scripts/libs/MenuNavigator.ts
import { system as system10 } from "@minecraft/server";
import {
  CustomForm,
  MessageBox,
  DataDrivenScreenClosedReason,
  ObservableString,
  ObservableBoolean,
  ObservableNumber
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
var MenuNavigator = class {
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
    this.history = [sectionId];
    this.applySection(sectionId);
    this.backVis.setData(false);
    await this.buildAndShow();
  }
  async rebuild(targetSection) {
    if (this.form?.isShowing()) this.form.close();
    if (targetSection) {
      this.history.push(targetSection);
      this.applySection(targetSection);
    }
    await this.buildAndShow();
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
  async buildAndShow() {
    if (this.form?.isShowing()) this.form.close();
    this.form = new CustomForm(this.player, this.titleObs);
    this.form.button("\xA7l\u2190 \u56DE\u5230\u4E0A\u4E00\u7EA7", () => this.back(), { visible: this.backVis });
    for (const [id, def] of this.sections) {
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
var PageBuilder = class {
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
var FormStatus = class {
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

// scripts/coop/CoopCore.ts
import { world as world11 } from "@minecraft/server";
var CoopCore = class {
  static {
    // ==========================================
    //  内部工具
    // ==========================================
    this._guidCounter = 0;
  }
  static {
    this.cooperativeConfig = {
      main: { language: "zh_CN", compare_language: "zh" },
      shop_setting: {
        monetary_unit: "\xA5",
        nbtgoods_condition: {
          type_enum: ["minecraft:writable_book", "minecraft:field_masoned_banner_pattern", "minecraft:filled_map"],
          mode_enum: ["it.isEnchanted"],
          type_reg_enum: ["[a-z].+_shulker_box"]
        }
      }
    };
  }
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
    const all = await getAllCoops();
    if (all.some((e) => e.cid === cid)) return false;
    if (Money.get(player) < 1e3) return false;
    const coop = {
      cid,
      name,
      owner_name: player.name,
      members: [{ player_name: player.name, is_op: true, joined_at: Date.now() }],
      notice: "\u793E\u957F\u5F88\u61D2\uFF0C\u6CA1\u6709\u5199\u516C\u544A\uFF5E",
      money: 0,
      created_at: Date.now(),
      updated_at: Date.now()
    };
    Money.set(player, Money.get(player) - 1e3);
    await createCoop(coop);
    return true;
  }
  static async releaseCoop(cid) {
    await deleteCoop(cid);
  }
  static async joinCoop(player, cid) {
    const data = await getCoop(cid);
    if (!data || (data.members || []).some((m) => m.player_name === player.name)) return;
    await addMember(cid, player.name, false);
    this.sendToMembers(cid, `\u6B22\u8FCE ${player.name} \u52A0\u5165\u5408\u4F5C\u793E\uFF01`);
  }
  static async exitCoop(playerName, cid) {
    const data = await getCoop(cid);
    if (!data) return;
    await removeMember(cid, playerName);
  }
  static async sendToMembers(cid, text) {
    const data = await getCoop(cid);
    if (!data) return;
    for (const member of data.members || []) {
      for (const p of world11.getPlayers({ name: member.player_name })) {
        Msg.info(`[${data.name}] ${text}`, p);
      }
    }
  }
  static async getInfo(cid) {
    const data = await getCoop(cid);
    if (!data) return "\u5408\u4F5C\u793E\u4E0D\u5B58\u5728";
    const ops = (data.members || []).filter((m) => m.is_op).map((m) => m.player_name).join(", ");
    return `\u516C\u544A\uFF1A
${data.notice}

\u5408\u4F5C\u793E\u540D\u79F0: ${data.name}
\u793E\u957F&\u7BA1\u7406: ${ops}
\u4EBA\u6570: ${(data.members || []).length}
\u94F6\u884C\u7ECF\u6D4E: ${data.money}`;
  }
  static async getMemberList(cid) {
    const data = await getCoop(cid);
    return data ? (data.members || []).map((m) => m.player_name) : [];
  }
  static async isOp(playerName, cid) {
    const data = await getCoop(cid);
    return (data?.members || []).find((m) => m.player_name === playerName)?.is_op ?? false;
  }
  static async setOp(cid, index) {
    const data = await getCoop(cid);
    if (!data || !data.members || index >= data.members.length) return;
    const members = data.members.map((m, i) => i === index ? { ...m, is_op: true } : m);
    await updateCoop(cid, { members });
  }
  static async setNotice(cid, text) {
    const data = await getCoop(cid);
    if (!data) return;
    await updateCoop(cid, { notice: text });
  }
  // ==========================================
  //  银行操作
  // ==========================================
  static async bankControl(cid, player, val, note, type) {
    const data = await getCoop(cid);
    if (!data) return false;
    if (type === 1) {
      const plMoney = Money.get(player);
      if (plMoney < val) return false;
      Money.set(player, plMoney - val);
      await updateCoop(cid, { money: (data.money || 0) + val });
      await addBankLog(cid, player.name, 1, val, note);
    } else if (type === 2) {
      if ((data.money || 0) < val) return false;
      Money.set(player, Money.get(player) + val);
      await updateCoop(cid, { money: (data.money || 0) - val });
      await addBankLog(cid, player.name, 2, val, note);
    } else return false;
    return true;
  }
  // ==========================================
  //  排行榜
  // ==========================================
  static async getRankInfo(type) {
    const all = await getAllCoops();
    if (type === 1) {
      return all.map((e) => ({ m: e.money || 0, n: e.name })).sort((a, b) => b.m - a.m).map((e, i) => `
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
    return customOnly ? groups.filter((g) => g.groupid.indexOf("default") === -1) : groups;
  }
  static async buy(gid, num, player) {
    const all = await this._getAllShopItems();
    const good = all.find((e) => e.id === gid);
    if (!good || good.num < num) return false;
    const total = good.money * num;
    if (!await this.bankControl(good.cid, player, total, `\u8D2D\u4E70 ${good.name}*${num}`, 1)) return false;
    player.runCommand(`give "${player.name}" ${good.item_type} ${num} ${good.item_aux ?? 0}`);
    good.sv += num;
    good.num -= num;
    await saveShopItem(good);
    return true;
  }
  static async sell(gid, num, player) {
    const all = await this._getAllShopItems();
    const good = all.find((e) => e.id === gid);
    if (!good || good.num - good.sv < num) return false;
    const has = this._countItemInInventory(player, good.item_type);
    if (has < num) return false;
    const total = good.money * num;
    if (!await this.bankControl(good.cid, player, total, `\u51FA\u552E ${good.name}*${num}`, 2)) return false;
    player.runCommand(`clear "${player.name}" ${good.item_type} ${good.item_aux ?? 0} ${num}`);
    good.sv += num;
    await saveShopItem(good);
    return true;
  }
};

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
var CoopGUI = class _CoopGUI {
  constructor(player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }
  async mainPanel() {
    const cid = await findPlayerCoop(this.player.name);
    if (!cid) {
      this.nav.start("noCoop");
      return;
    }
    this.nav.state.cid = cid;
    this.nav.start("coopInfo");
  }
  static async openShopMgr(player) {
    const gui = new _CoopGUI(player);
    gui.nav.state.cid = await findPlayerCoop(player.name) ?? "";
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
      this.nav.rebuild("coopInfo");
    });
  }
  async buildCoopList(page) {
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
    const cid = this.nav.state.cid;
    if (!cid) {
      page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
      return;
    }
    const text = await CoopCore.getInfo(cid);
    const isOp = await CoopCore.isOp(this.player.name, cid);
    const members = await getMembers(cid);
    const isMember = members.some((m) => m.player_name === this.player.name);
    page.label(ListFormInfo([text]));
    if (!isMember) {
      page.button("\u52A0\u5165", async () => {
        await CoopCore.joinCoop(this.player, cid);
        this.nav.rebuild("coopInfo");
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
    const isOp = await CoopCore.isOp(this.player.name, cid);
    this.nav.confirm(
      "\u5408\u4F5C\u793E - \u786E\u8BA4",
      isOp ? "\u786E\u8BA4\u89E3\u6563\u5408\u4F5C\u793E\uFF1F\u6240\u6709\u6210\u5458\u4E5F\u4F1A\u88AB\u8E22\u51FA\u3002\n\u8BF7\u5148\u6E05\u7A7A\u94F6\u884C\u7ECF\u6D4E\u3001\u4E0B\u67B6\u5546\u54C1\u3002" : "\u4F60\u786E\u8BA4\u9000\u51FA\u5408\u4F5C\u793E\u5417\uFF1F",
      async () => {
        if (isOp) {
          await CoopCore.releaseCoop(cid);
          this.infoPop("\u89E3\u6563\u6210\u529F\u3002");
        } else {
          await CoopCore.exitCoop(this.player.name, cid);
          this.infoPop("\u5DF2\u9000\u51FA\u5408\u4F5C\u793E\u3002");
          await CoopCore.sendToMembers(cid, this.player.name + " \u9000\u51FA\u4E86\u5408\u4F5C\u793E\u3002\u62DC\u62DC\uFF5E");
        }
      },
      () => this.nav.rebuild("noCoop")
    );
  }
  // ── Admin ──
  buildAdminPanel(page) {
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
    const moneylist = logs.length ? logs.map((l) => `${l.player_name} ${l.type === 1 ? "\u5B58\u5165" : "\u53D6\u51FA"} ${l.amount}${l.note ? ` (${l.note})` : ""}`).join("\n") : "\u6682\u65E0\u8BB0\u5F55";
    page.label("\xA76\u5408\u4F5C\u793E\u94F6\u884C\u7ECF\u6D4E\uFF1A\xA7r" + data.money + "\n\xA76\u8D26\u5355\uFF1A\xA7r\n" + moneylist);
    page.button("\u786E\u8BA4", () => {
      this.nav.state.bankType = obsAction.getData() + 1;
      this.nav.go("bankControl");
    });
  }
  buildBankControl(page) {
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
      if (await CoopCore.bankControl(cid, this.player, val, obsNote.getData() || "", type === 1 ? 1 : 2)) {
        status.ok((type === 1 ? "\u5B58\u5165" : "\u53D6\u51FA") + "\u6210\u529F\uFF01" + Money.UNIT + "\uFF1A" + val);
      } else {
        status.fail("\u91D1\u989D\u586B\u5199\u4E0D\u6B63\u786E");
      }
    });
  }
  // ── Rank & Log ──
  async buildRank(page) {
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
    page.label(ListFormInfo(["\u6682\u65E0\u66F4\u65B0\u65E5\u5FD7\u3002"]));
  }
  // ── Shop Manager ──
  async buildShopMgr(page) {
    const cid = this.nav.state.cid;
    if (!cid) {
      page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
      return;
    }
    const unit = CoopCore.getConfig().shop_setting.monetary_unit;
    const isOp = await CoopCore.isOp(this.player.name, cid);
    const goods = await CoopCore.getGoods(1, true, 1, cid);
    page.label(ListFormInfo(["\u9009\u62E9\u64CD\u4F5C"]));
    page.button("\u4E0A\u67B6\u7269\u54C1", () => this.nav.go("shopAddSelect"));
    page.button("\u56DE\u6536\u7269\u54C1\u7BA1\u7406", () => this.nav.rebuild("shopRecycleList"));
    page.button("\u6DFB\u52A0\u81EA\u5B9A\u4E49\u5206\u7EC4", () => this.nav.go("shopAddGroup"));
    if (isOp) {
      page.button("\u56DE\u6536\u62DB\u52DF\u5BA1\u6838", () => this.nav.rebuild("shopRecycleReview"));
    }
    for (const g of goods) {
      page.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, true), () => {
        this.nav.state.gid = g.id;
        this.nav.state.good = g;
        this.nav.go("shopItemOps");
      });
    }
  }
  buildShopItemOps(page) {
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
      this.player.runCommand(
        'clear "' + this.player.name + '" ' + good.item_type + " " + (good.item_aux ?? 0) + " " + num
      );
      status.ok("\u8865\u8D27\u6210\u529F\u3002");
      this.nav.rebuild("shopMgr");
    });
  }
  doDelist(cid, gid, good) {
    this.nav.confirm(
      "\u4E0B\u67B6\u786E\u8BA4",
      "\u786E\u8BA4\u4E0B\u67B6 " + good.name + " \uFF1F\n\u4E0B\u67B6\u540E\u5E93\u5B58\u5C06\u8FD4\u8FD8\u7ED9\u4F60\u3002",
      async () => {
        await deleteShopItem(good.cid, gid);
        this.player.runCommand(
          'give "' + this.player.name + '" ' + good.item_type + " " + good.num + " " + (good.item_aux ?? 0)
        );
        Msg.success("\u4E0B\u67B6\u6210\u529F\u3002", this.player);
      },
      () => this.nav.rebuild("shopMgr")
    );
  }
  async buildShopEdit(page) {
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
      this.nav.rebuild("shopMgr");
    });
  }
  async buildShopRecycleList(page) {
    const cid = this.nav.state.cid;
    if (!cid) {
      page.label("\u8BF7\u5148\u52A0\u5165\u4E00\u4E2A\u5408\u4F5C\u793E\u3002");
      return;
    }
    const unit = CoopCore.getConfig().shop_setting.monetary_unit;
    const goods2 = await CoopCore.getGoods(1, true, 2, cid);
    for (const g of goods2) {
      page.button(_fmtGoodBt(g.name, unit, g.money, g.sv, g.num, false), () => {
        this.nav.state.good = g;
        this.nav.state.gid = g.id;
        this.nav.go("shopRecycleTake");
      });
    }
  }
  buildShopRecycleTake(page) {
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
      this.player.runCommand(
        'give "' + this.player.name + '" ' + good.item_type + " " + num + " " + (good.item_aux ?? 0)
      );
      status.ok("\u53D6\u51FA\u6210\u529F\u3002");
      this.nav.rebuild("shopRecycleList");
    });
  }
  async buildShopRecycleReview(page) {
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
      page.button(g.name + " " + CoopCore.getConfig().shop_setting.monetary_unit + g.money + "\n\u5F85\u5BA1\u6838", () => {
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
      this.nav.rebuild("shopMgr");
    });
  }
  buildShopAddGroup(page) {
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
      this.nav.rebuild("shopMgr");
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

// scripts/coop/CoopSystem.ts
var CoopSystem = class {
  static init() {
    console.log(`Initializing CoopSystem...`);
    console.log(`CoopSystem initialized successfully.`);
  }
  static registerPermissions() {
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
      "\u5408\u4F5C\u793E"
    );
    Command.register(
      "coopshop",
      "coopshop.use",
      (player) => {
        if (!player) return;
        CoopGUI.openShopMgr(player);
      },
      "\u5408\u4F5C\u793E\u5546\u5E97"
    );
  }
  static registerEvents() {
  }
};

// scripts/chat/ChatSystem.ts
import { world as world13, system as system12 } from "@minecraft/server";

// scripts/gui/ChatGUI.ts
import { world as world12 } from "@minecraft/server";
var ChatGUI = class _ChatGUI {
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
      const target = world12.getPlayers().find((p) => p.id === otherid);
      if (!target) {
        Msg.error("\u5BF9\u65B9\u4E0D\u5728\u7EBF\u3002", player);
        return;
      }
      DogeChat.sendTeleportInvite(player, target);
      return;
    }
    const online = world12.getPlayers().filter((p) => p.id !== player.id);
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
          this.nav.rebuild("settings");
        } else {
          await DogeChat.setActiveChannel(this.player, c.id);
          status.ok(`\u5DF2\u5207\u6362\u5230\u9891\u9053: ${c.prefix}`);
          await DogeChat.loadChannelHistory(this.player, c.id);
          this.nav.rebuild("panel");
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
      this.nav.rebuild("settings");
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
        this.nav.rebuild("panel");
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
      this.nav.rebuild("settings");
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
          if (ok) this.nav.leave(() => {
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
        if (ok) this.nav.leave(() => {
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
    const online = world12.getPlayers().filter((p) => p.id !== this.player.id);
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
      if (ok) this.nav.leave(() => {
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
      if (ok) this.nav.leave(() => {
      });
      else status.fail("\u53D1\u9001\u5931\u8D25");
    });
  }
};

// scripts/chat/ChatSystem.ts
var ChatSystem = class {
  static init() {
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
    world13.beforeEvents.chatSend.subscribe(async (event) => {
      const player = event.sender;
      const message = event.message;
      if (message.startsWith("!") || message.startsWith("\uFF01")) return;
      event.cancel = true;
      const channel = await DogeChat.getActiveChannel(player);
      if (channel) await DogeChat.sendChannelMessage(player, channel.id, message);
    });
    world13.afterEvents.playerJoin.subscribe((event) => {
      const player = world13.getEntity(event.playerId);
      system12.run(async () => {
        await DogeChat.loadSubscriptions(player);
        const channel = await DogeChat.getActiveChannel(player);
        if (channel) await DogeChat.loadChannelHistory(player, channel.id);
      });
    });
  }
  static registerCommands() {
    Command.register(
      "channel",
      "chat.use",
      (player) => {
        if (player) ChatGUI.openChannelPanel(player);
      },
      "\u9891\u9053\u7BA1\u7406 - \u8BA2\u9605/\u5207\u6362\u9891\u9053"
    );
    Command.register(
      "ch",
      "chat.use",
      async (player) => {
        if (!player) return;
        const next = await DogeChat.cycleChannel(player);
        if (next) await DogeChat.loadChannelHistory(player, next.id);
      },
      "\u5FEB\u901F\u5207\u6362\u9891\u9053"
    );
    Command.register(
      "msg",
      "chat.use",
      (player) => {
        if (player) ChatGUI.openPrivateChatPanel(player);
      },
      "\u5FEB\u6377\u79C1\u804A"
    );
    Command.register(
      "lo",
      "chat.use",
      (player) => {
        if (player) ChatGUI.sendLocation(player);
      },
      "\u53D1\u9001\u5F53\u524D\u4F4D\u7F6E\u5230\u5F53\u524D\u9891\u9053"
    );
    Command.register(
      "tp",
      "chat.use",
      (player) => {
        if (player) ChatGUI.sendTeleportInvite(player);
      },
      "\u53D1\u9001\u4F20\u9001\u9080\u8BF7"
    );
    Command.register(
      "hongbao",
      "chat.use",
      (player) => {
        if (player) ChatGUI.openRedPacketPanel(player);
      },
      "\u7EA2\u5305 - \u67E5\u770B/\u9886\u53D6\u7EA2\u5305"
    );
    Command.register(
      "hb",
      "chat.use",
      (player) => {
        if (player) ChatGUI.sendRedPacketQuick(player);
      },
      "\u53D1\u9001\u7EA2\u5305"
    );
  }
};

// scripts/doge/TPS.ts
import { system as system13, world as world14 } from "@minecraft/server";
var TPS = class _TPS {
  static {
    this.tickTimes = [];
  }
  static {
    this.MAX_SAMPLES = 100;
  }
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
    this.startRecord();
  }
  static startRecord() {
    system13.runInterval(() => {
      _TPS.tickTimes.push(Date.now());
      if (_TPS.tickTimes.length > _TPS.MAX_SAMPLES) {
        _TPS.tickTimes.shift();
      }
    }, 1);
  }
  static registerCommands() {
    Command.register(
      "tps",
      "tps.see",
      (player) => {
        const msg = this.getTPSStatus();
        if (player) {
          Msg.info(msg, player);
        } else {
          world14.sendMessage(msg);
        }
      },
      "\u67E5\u770B\u670D\u52A1\u5668 TPS"
    );
  }
};

// scripts/doge/OnlineTime.ts
import { system as system14, world as world15 } from "@minecraft/server";
var OnlineTime = class _OnlineTime {
  constructor() {
    this.dataMap = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_OnlineTime._instance) {
      _OnlineTime._instance = new _OnlineTime();
    }
    return _OnlineTime._instance;
  }
  registerCommandsAndPermissions() {
    Permission.register("onlinetime.see", Permission.Any);
    Command.register(
      "onlinetime",
      "onlinetime.see",
      async (player) => {
        if (!player) {
          world15.sendMessage("\xA7c\u8BE5\u6307\u4EE4\u5FC5\u987B\u7531\u73A9\u5BB6\u6267\u884C\u3002");
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
      "\u67E5\u770B\u5728\u7EBF\u65F6\u95F4\u7EDF\u8BA1"
    );
  }
  registerEvents() {
    world15.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        this.onPlayerJoin(event.player);
      }
    });
  }
  init() {
    this.startTick();
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
  /** 从 DB 加载玩家在线时间数据 */
  async load(player) {
    const existing = this.dataMap.get(player.id);
    if (existing) return existing;
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
  }
  /** 持久化在线时间到 DB（排除 session，仅持久化跨重启字段） */
  async persist(player, data) {
    await HttpDB.patch(`/api/sfmc/players/${player.id}`, {
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
    this.load(player).then((data) => {
      data.session = 0;
    });
  }
  onPlayerLeave(player) {
    const data = this.dataMap.get(player.id);
    if (data) {
      this.persist(player, data).catch(() => {
      });
      this.dataMap.delete(player.id);
    }
  }
  tickSecond() {
    const now = /* @__PURE__ */ new Date();
    const currentDate = now.getDate();
    const currentMonth = now.getMonth();
    for (const player of world15.getAllPlayers()) {
      const data = this.dataMap.get(player.id);
      if (!data) {
        this.load(player).then((d) => {
          d.session++;
          d.today++;
          d.month++;
          d.total++;
        });
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
      this.persist(player, data).catch(() => {
      });
    }
  }
  startTick() {
    system14.runInterval(() => {
      this.tickSecond();
    }, 20);
  }
};

// scripts/area/SurvivalArea.ts
import {
  system as system15,
  world as world16,
  GameMode as GameMode3
} from "@minecraft/server";
var SurvivalArea = class _SurvivalArea {
  constructor() {
    this.enable = true;
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
    world16.afterEvents.playerSpawn.subscribe((event) => {
      if (!event.initialSpawn) return;
      if (!CreativeArea.enable) return;
      if (!this.enable) return;
      const player = event.player;
      const mode = player.getGameMode();
      if (mode === GameMode3.Survival || mode === GameMode3.Adventure) return;
      system15.runTimeout(() => {
        if (!this.inCreativeArea(player)) {
          this.forceSurvival(player);
        }
      }, 60);
    });
    world16.beforeEvents.playerGameModeChange.subscribe((event) => {
      if (!CreativeArea.enable) return;
      if (!this.enable) return;
      if (event.toGameMode === GameMode3.Creative || event.toGameMode === GameMode3.Spectator) {
        if (Permission.check(event.player, "survivalarea.gamemode.bypass")) return;
        if (!this.inCreativeArea(event.player)) {
          event.cancel = true;
          Msg.error(`\u4F60\u5F53\u524D\u4E0D\u5728\u521B\u9020\u533A\u57DF\u5185\uFF0C\u65E0\u6CD5\u5207\u6362\u5230\u8BE5\u6A21\u5F0F\u3002`, event.player);
        }
      }
    });
    world16.afterEvents.playerDimensionChange.subscribe((event) => {
      if (!CreativeArea.enable) return;
      if (!this.enable) return;
      const player = event.player;
      const mode = player.getGameMode();
      if (mode === GameMode3.Survival || mode === GameMode3.Adventure) return;
      system15.runTimeout(() => {
        if (!this.inCreativeArea(player)) {
          this.forceSurvival(player);
        }
      }, 10);
    });
  }
  init() {
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
    player.setGameMode(GameMode3.Survival);
    Msg.info(`\u5DF2\u79BB\u5F00\u521B\u9020\u533A\u57DF\uFF0C\u5F3A\u5236\u5207\u6362\u4E3A\u751F\u5B58\u6A21\u5F0F\u3002`, player);
  }
};

// scripts/area/InventorySwitcher.ts
import {
  system as system16,
  world as world17,
  GameMode as GameMode4,
  EquipmentSlot,
  BlockComponentTypes as BlockComponentTypes3
} from "@minecraft/server";
var InventorySwitcher = class _InventorySwitcher {
  static {
    this.chestMap = /* @__PURE__ */ new Map();
  }
  static getInstance() {
    if (!_InventorySwitcher._instance) {
      _InventorySwitcher._instance = new _InventorySwitcher();
    }
    return _InventorySwitcher._instance;
  }
  /** 注册事件（由 entry.ts 统一调用） */
  registerEvents() {
    world17.afterEvents.playerGameModeChange.subscribe((event) => {
      const player = event.player;
      system16.run(() => {
        if (player.getGameMode() !== event.toGameMode) return;
        if (event.fromGameMode === GameMode4.Survival && event.toGameMode === GameMode4.Creative) {
          this.saveToChest(player, false);
          this.restoreFromChest(player, true);
        } else if (event.fromGameMode === GameMode4.Creative && event.toGameMode === GameMode4.Survival) {
          this.saveToChest(player, true);
          this.restoreFromChest(player, false);
        }
      });
    });
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
      let nextIdx = world17.getDynamicProperty("hpbe:invswitcher_next");
      if (nextIdx === void 0) nextIdx = 0;
      const grid = ConfigManager.getGrid("inventory_chest");
      if (!grid) return 0;
      const max = grid.size[0] - 2;
      if (nextIdx > max) nextIdx = 0;
      base = nextIdx;
      _InventorySwitcher.chestMap.set(key, base);
      world17.setDynamicProperty("hpbe:invswitcher_next", base + 2);
    }
    return base * 2 + (forCreative ? 1 : 0);
  }
  /**
   * 将玩家背包存入指定箱子
   */
  saveToChest(player, forCreative) {
    const cfg = ConfigManager.getGrid("inventory_chest");
    if (!cfg) return;
    const dim = world17.getDimension("minecraft:overworld");
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
    const dim = world17.getDimension("minecraft:overworld");
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

// scripts/land/LandDatabase.ts
var DEFAULT_CONFIG = {
  priceFormula: "{square}*8+{height}*20",
  maxLandsPerPlayer: 5,
  minSquare: 4,
  maxSquare: 5e4,
  discount: 1,
  refundRate: 0.7
};
var DEFAULT_PERMISSIONS = {
  allow_place: false,
  allow_destroy: false,
  attack_entity: false,
  open_container: false
};
var Database = class {
  static {
    this.KEY_CONFIG = "land:config";
  }
  static {
    this.KEY_REGISTRY = "land:registry";
  }
  static {
    /** 运行时缓存 */
    this._config = null;
  }
  static {
    this._registry = null;
  }
  static {
    // landId → LandData
    this._ownerIndex = null;
  }
  static {
    // plid → landId[]
    // ── 内部工具 ──
    this.memoryStore = /* @__PURE__ */ new Map();
  }
  static readJSON(key, fallback) {
    if (this.memoryStore.has(key)) return this.memoryStore.get(key);
    this.memoryStore.set(key, fallback);
    return fallback;
  }
  static writeJSON(key, value) {
    this.memoryStore.set(key, value);
  }
  /** 重建 owner 索引 */
  static rebuildOwnerIndex() {
    this._ownerIndex = /* @__PURE__ */ new Map();
    if (!this._registry) return;
    for (const [, land] of this._registry) {
      const list = this._ownerIndex.get(land.ownerplid) || [];
      list.push(land.id);
      this._ownerIndex.set(land.ownerplid, list);
    }
  }
  // ── 配置 ──
  static getConfig() {
    if (this._config) return this._config;
    this._config = this.readJSON(this.KEY_CONFIG, { ...DEFAULT_CONFIG });
    return this._config;
  }
  static saveConfig(cfg) {
    this._config = cfg;
    this.writeJSON(this.KEY_CONFIG, cfg);
  }
  // ── 土地数据 ──
  /** 确保 registry 已加载 */
  static ensureLoaded() {
    if (this._registry) return;
    const raw = this.readJSON(this.KEY_REGISTRY, {});
    this._registry = new Map(Object.entries(raw));
    this.rebuildOwnerIndex();
  }
  /** 将 registry 序列化写入数据库中 */
  static flush() {
    if (!this._registry) return;
    const obj = {};
    for (const [id, data] of this._registry) {
      obj[id] = data;
    }
    this.writeJSON(this.KEY_REGISTRY, obj);
  }
  /** 获取所有土地 */
  static getAll() {
    this.ensureLoaded();
    return Array.from(this._registry.values());
  }
  /** 根据 ID 获取土地 */
  static getById(landId) {
    this.ensureLoaded();
    return this._registry.get(landId);
  }
  /** 获取玩家所有土地 ID */
  static getByOwner(plid) {
    this.ensureLoaded();
    return this._ownerIndex.get(plid) || [];
  }
  /** 生成唯一土地 ID */
  static generateId() {
    return "L" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  /** 添加土地 */
  static add(land) {
    this.ensureLoaded();
    this._registry.set(land.id, land);
    const list = this._ownerIndex.get(land.ownerplid) || [];
    list.push(land.id);
    this._ownerIndex.set(land.ownerplid, list);
    this.flush();
  }
  /** 更新土地 */
  static update(land) {
    this.ensureLoaded();
    this._registry.set(land.id, land);
    this.flush();
  }
  /** 删除土地 */
  static delete(landId) {
    this.ensureLoaded();
    const land = this._registry.get(landId);
    if (!land) return;
    this._registry.delete(landId);
    const list = this._ownerIndex.get(land.ownerplid) || [];
    const idx = list.indexOf(landId);
    if (idx !== -1) list.splice(idx, 1);
    this._ownerIndex.set(land.ownerplid, list);
    this.flush();
  }
  /** 获取玩家的土地数量 */
  static getPlayerLandCount(plid) {
    return this.getByOwner(plid).length;
  }
  // ── 辅助工具 ──
  /** 创建新的土地数据对象（不含 id 和创建时间） */
  static createLandData(ownerplid, ownerName, dimid, posA, posB) {
    return {
      id: this.generateId(),
      ownerplid,
      ownerName,
      managers: [ownerplid],
      dimid,
      posA,
      posB,
      permissions: { ...DEFAULT_PERMISSIONS },
      nickname: "",
      createdAt: Date.now()
    };
  }
  /** 默认权限对象 */
  static getDefaultPermissions() {
    return { ...DEFAULT_PERMISSIONS };
  }
  /** 默认配置对象 */
  static getDefaultConfig() {
    return { ...DEFAULT_CONFIG };
  }
};

// scripts/land/LandCore.ts
var LandCore = class {
  static {
    /** 玩家会话：plid → { pos1, pos2 } */
    this.sessions = /* @__PURE__ */ new Map();
  }
  // ── 会话管理 ──
  /**
   * @description 获取玩家会话
   * @param plid 玩家 ID
   * @returns 玩家会话或 undefined
   */
  static getSession(plid) {
    return this.sessions.get(plid);
  }
  /**
   * @description 初始化玩家会话
   * @param plid 玩家 ID
   * @returns 是否成功初始化会话资源
   */
  static initSession(plid) {
    return this.sessions.set(plid, {}) ? true : false;
  }
  /**
   * @description 设置玩家会话中土地的第一点
   * @param plid 玩家 ID
   * @param pos 第一点坐标
   * @returns 玩家会话或 undefined
   */
  static setPos1(plid, pos) {
    let s = this.getSession(plid);
    if (s) {
      s.pos1 = pos;
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
    let s = this.getSession(plid);
    if (s) {
      s.pos2 = pos;
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
    return this.sessions.delete(plid);
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
    const formula = cfg.priceFormula;
    let expr = formula.replace(/\{square\}/g, String(info.square)).replace(/\{height\}/g, String(info.height)).replace(/\{length\}/g, String(info.length)).replace(/\{width\}/g, String(info.width)).replace(/\{volume\}/g, String(info.volume));
    let price;
    try {
      price = Function(`"use strict"; return (${expr});`)();
    } catch {
      price = info.square * 8 + info.height * 20;
    }
    price = Math.max(0, Math.floor(price * cfg.discount));
    return price;
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
    return Database.getAll().find((land) => this.isPosInLand(pos, dimid, land));
  }
  /** 获取玩家拥有的所有土地 */
  static getPlayerLands(plid) {
    const ids = Database.getByOwner(plid);
    return ids.map((id) => Database.getById(id)).filter((l) => !!l);
  }
  // ── 验证 ──
  /** 验证创建条件 */
  static validateCreation(player, posA, posB, dimid) {
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
    const allLands = Database.getAll();
    const candidates = allLands.filter((l) => l.dimid === dimid);
    for (const land of candidates) {
      if (this.cubesOverlap(this.normalize(posA, posB), { posA: land.posA, posB: land.posB })) {
        return { ok: false, msg: "\xA7c\u8BE5\u533A\u57DF\u4E0E\u5176\u4ED6\u571F\u5730\u91CD\u53E0\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002" };
      }
    }
    const count = Database.getPlayerLandCount(plid);
    if (count >= cfg.maxLandsPerPlayer) {
      return { ok: false, msg: `\xA7c\u60A8\u5DF2\u8FBE\u5230\u6301\u6709\u571F\u5730\u4E0A\u9650\uFF08${cfg.maxLandsPerPlayer} \u5757\uFF09\uFF01` };
    }
    const price = this.calculatePrice(posA, posB);
    const balance = Money.get(player);
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
  static createLand(player, posA, posB, dimid) {
    const plid = player.id;
    const n = this.normalize(posA, posB);
    const price = this.calculatePrice(n.posA, n.posB);
    const balance = Money.get(player);
    const land = Database.createLandData(plid, player.name, dimid, n.posA, n.posB);
    Database.add(land);
    Money.set(player, balance - price);
    this.clearSession(plid);
    return land;
  }
  /** 删除土地（拥有者/管理员） */
  static deleteLand(landId, player) {
    const land = Database.getById(landId);
    if (!land) return false;
    if (land.ownerplid !== player.id && !land.managers.includes(player.id)) {
      return false;
    }
    const cfg = Database.getConfig();
    const price = this.calculatePrice(land.posA, land.posB);
    const refund = Math.floor(price * cfg.refundRate);
    Database.delete(landId);
    Money.add(player, refund);
    return true;
  }
  /** 检查玩家是否为土地的管理者 */
  static isManager(land, plid) {
    return land.managers.includes(plid);
  }
  /** 检查玩家是否为土地的拥有者 */
  static isOwner(land, plid) {
    return land.ownerplid === plid;
  }
  /** 检查玩家是否对该土地有完全管理权（拥有者或全局管理员） */
  static isOwnerOrManager(land, plid) {
    return this.isOwner(land, plid) || this.isManager(land, plid);
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

// scripts/gui/LandGUI.ts
import { world as world18 } from "@minecraft/server";
var LandGUI = class _LandGUI {
  constructor(player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }
  static showMainMenu(player) {
    const id = player.id;
    const session = LandCore.getSession(id);
    const gui = new _LandGUI(player);
    if (session) {
      gui.nav.state.session = session;
      gui.nav.start("stateDialog");
    } else {
      gui.nav.start("home");
    }
  }
  static startApplication(player) {
    const plid = player.id;
    LandCore.initSession(plid);
    Msg.info(
      [
        `\u53EF\u5728\u804A\u5929\u6846\u8F93\u5165\u4EE5\u4E0B\u547D\u4EE4\u5B8C\u6210\u571F\u5730\u7533\u8BF7\u6D41\u7A0B\uFF1A`,
        `  [1] \xA76\xA7l!pos1\xA7r \xA7f- \u8BBE\u7F6E\u7B2C\u4E00\u70B9\uFF08\u7AD9\u5728\u5BF9\u5E94\u4F4D\u7F6E\u8F93\u5165\uFF09`,
        `  [2] \xA76\xA7l!pos2\xA7r \xA7f- \u8BBE\u7F6E\u7B2C\u4E8C\u70B9`,
        `  [3] \xA76\xA7l!land\xA7r \xA7f- \u6253\u5F00\u83DC\u5355\u8FDB\u884C\xA7e\u9A8C\u8BC1\u4E0E\u786E\u8BA4\xA7r`
      ].join("\n"),
      player
    );
    Msg.tips("\u5728\u786E\u8BA4\u571F\u5730\u524D\uFF0C\u53EF\u91CD\u590D\u8F93\u5165 !pos1 \u548C !pos2 \u547D\u4EE4\uFF0C\u6765\u4FEE\u6539\u5408\u9002\u7684\u571F\u5730\u8303\u56F4\u3002", player);
  }
  registerSections() {
    this.nav.section("home", "\u571F\u5730", (page) => this.buildHome(page));
    this.nav.section("landList", "\u6211\u7684\u571F\u5730", (page) => this.buildLandList(page));
    this.nav.section("landManage", "\u571F\u5730\u7BA1\u7406", (page) => this.buildLandManage(page));
    this.nav.section("permEditor", "\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E", (page) => this.buildPermEditor(page));
    this.nav.section("managerEditor", "\u7BA1\u7406\u8005\u7BA1\u7406", (page) => this.buildManagerEditor(page));
    this.nav.section("addManager", "\u6DFB\u52A0\u7BA1\u7406\u8005", (page) => this.buildAddManager(page));
    this.nav.section("removeManager", "\u79FB\u9664\u7BA1\u7406\u8005", (page) => this.buildRemoveManager(page));
    this.nav.section("renameDialog", "\u8BBE\u7F6E\u571F\u5730\u540D\u79F0", (page) => this.buildRenameDialog(page));
    this.nav.section("stateDialog", "\u571F\u5730\u7533\u8BF7", (page) => this.buildStateDialog(page));
  }
  buildHome(page) {
    const plid = this.player.id;
    const lands = LandCore.getPlayerLands(plid);
    page.label(ListFormInfo([`\u5F53\u524D\u62E5\u6709 \xA7e${lands.length}\xA7r \u5757\u571F\u5730\u3002`]));
    page.button("\u7533\u8BF7\u571F\u5730", () => this.nav.leave(() => _LandGUI.startApplication(this.player)));
    if (lands.length > 0) {
      page.button("\u6211\u7684\u571F\u5730", () => this.nav.rebuild("landList"));
    }
  }
  buildLandList(page) {
    const lands = LandCore.getPlayerLands(this.player.id);
    if (lands.length === 0) {
      page.label(ListFormInfo(["\u4F60\u8FD8\u6CA1\u6709\u4EFB\u4F55\u571F\u5730\u3002"]));
      return;
    }
    page.label(ListFormInfo([`\u5F53\u524D\u62E5\u6709 \xA7e${lands.length}\xA7r \u5757\u571F\u5730\u3002`]));
    for (const land of lands) {
      const name = land.nickname || land.id;
      const info = LandCore.getCubeInfo(land.posA, land.posB);
      page.button(`${name}
${info.square} \u683C | ${LandCore.getDimensionName(land.dimid)}`, () => {
        this.nav.state.land = land;
        this.nav.rebuild("landManage");
      });
    }
  }
  buildLandManage(page) {
    const land = this.nav.state.land;
    if (!land) {
      page.label("\u571F\u5730\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const plid = this.player.id;
    const isOwner = LandCore.isOwner(land, plid);
    const isMgr = LandCore.isManager(land, plid);
    const canManage = isOwner || isMgr;
    const name = land.nickname || land.id;
    const info = LandCore.getCubeInfo(land.posA, land.posB);
    const ownerName = land.ownerName || "\xA77\u672A\u77E5\xA7r";
    page.label(
      ListFormInfo([
        `\u571F\u5730\u4FE1\u606F\uFF1A`,
        `  \xA77- \u571F\u5730\u540D\u79F0: \xA7r${name}\xA77(${land.id})`,
        `  \xA77- \u62E5\u6709\u8005: \xA7r${ownerName}`,
        `  \xA77- \u9762\u79EF: \xA7r ${info.square}\xA77 \u683C | \u4F53\u79EF: \xA7r ${info.volume} \xA77\u683C`,
        `  \xA77- \u7EF4\u5EA6: \xA7r${LandCore.getDimensionName(land.dimid)}`,
        `  \xA77- \u7BA1\u7406\u8005: \xA7r${land.managers.length} \u4EBA`
      ])
    );
    if (!canManage) {
      page.label("\u4F60\u6CA1\u6709\u6743\u9650\u7BA1\u7406\u6B64\u571F\u5730\u3002");
      return;
    }
    page.button("\u571F\u5730\u4FDD\u62A4", () => this.nav.rebuild("permEditor"));
    page.button("\u7BA1\u7406\u8005\u7BA1\u7406", () => this.nav.rebuild("managerEditor"));
    page.button("\u8BBE\u7F6E\u540D\u79F0", () => this.nav.rebuild("renameDialog"));
    page.button("\u5220\u9664\u571F\u5730", () => this.showDeleteConfirm(land, page));
  }
  buildPermEditor(page) {
    const status = new FormStatus(page);
    const land = this.nav.state.land;
    if (!land) {
      page.label("\u571F\u5730\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const perm = land.permissions;
    const allowPlace = obsBool(perm.allow_place);
    const allowDestroy = obsBool(perm.allow_destroy);
    const attackEntity = obsBool(perm.attack_entity);
    const openContainer = obsBool(perm.open_container);
    page.label(ListFormInfo([]));
    page.toggle("\u5141\u8BB8\u8BBF\u5BA2\xA76\u653E\u7F6E\u65B9\u5757", allowPlace);
    page.toggle("\u5141\u8BB8\u8BBF\u5BA2\xA76\u7834\u574F\u65B9\u5757", allowDestroy);
    page.toggle("\u5141\u8BB8\u8BBF\u5BA2\xA76\u653B\u51FB\u5B9E\u4F53", attackEntity);
    page.toggle("\u5141\u8BB8\u8BBF\u5BA2\xA76\u6253\u5F00\u5BB9\u5668", openContainer);
    page.button("\u786E\u8BA4", () => {
      land.permissions.allow_place = allowPlace.getData();
      land.permissions.allow_destroy = allowDestroy.getData();
      land.permissions.attack_entity = attackEntity.getData();
      land.permissions.open_container = openContainer.getData();
      Database.update(land);
      status.ok("\u571F\u5730\u4FDD\u62A4\u8BBE\u7F6E\u5DF2\u66F4\u65B0\u3002");
      this.nav.rebuild("landManage");
    });
  }
  buildManagerEditor(page) {
    const land = this.nav.state.land;
    if (!land) {
      page.label("\u571F\u5730\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const plid = this.player.id;
    page.label(
      ListFormInfo([
        "\u5F53\u524D\u7BA1\u7406\u8005\uFF1A",
        ...land.managers.map((m) => {
          if (m === land.ownerplid) return `  - ${land.ownerName} (\u62E5\u6709\u8005)`;
          const p = world18.getPlayers().find((pl) => pl.id === m);
          return p ? `  - ${p.name}` : `  - ${m.substring(0, 8)}...`;
        })
      ])
    );
    page.button("\u6DFB\u52A0\u7BA1\u7406\u8005", () => this.nav.rebuild("addManager"));
    if (LandCore.isOwner(land, plid) && land.managers.length > 1) {
      page.button("\u79FB\u9664\u7BA1\u7406\u8005", () => this.nav.rebuild("removeManager"));
    }
  }
  buildAddManager(page) {
    const status = new FormStatus(page);
    const land = this.nav.state.land;
    if (!land) {
      page.label("\u571F\u5730\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const online = world18.getPlayers().filter((p) => p.id !== this.player.id && !land.managers.includes(p.id));
    if (online.length === 0) {
      page.label(ListFormInfo(["\u6CA1\u6709\u53EF\u6DFB\u52A0\u7684\u5728\u7EBF\u73A9\u5BB6\u3002"]));
      return;
    }
    page.label(ListFormInfo(["\u9009\u62E9\u8981\u6DFB\u52A0\u4E3A\u7BA1\u7406\u8005\u7684\u73A9\u5BB6\u3002"]));
    for (const p of online) {
      page.button(p.name, () => {
        if (land.managers.includes(p.id)) {
          status.fail("\u8BE5\u73A9\u5BB6\u5DF2\u7ECF\u662F\u7BA1\u7406\u8005\u3002");
          return;
        }
        land.managers.push(p.id);
        Database.update(land);
        status.ok(`\u5DF2\u5C06 ${p.name} \u6DFB\u52A0\u4E3A\u7BA1\u7406\u8005\u3002`);
        this.nav.rebuild("managerEditor");
      });
    }
  }
  buildRemoveManager(page) {
    const status = new FormStatus(page);
    const land = this.nav.state.land;
    if (!land) {
      page.label("\u571F\u5730\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const nonOwnerMgrs = land.managers.filter((m) => m !== land.ownerplid);
    if (nonOwnerMgrs.length === 0) {
      page.label(ListFormInfo(["\u6CA1\u6709\u53EF\u79FB\u9664\u7684\u7BA1\u7406\u8005\u3002"]));
      return;
    }
    page.label(ListFormInfo(["\u9009\u62E9\u8981\u79FB\u9664\u7684\u7BA1\u7406\u8005\u3002"]));
    for (const m of nonOwnerMgrs) {
      const p = world18.getPlayers().find((pl) => pl.id === m);
      page.button(p ? p.name : m.substring(0, 8) + "...", () => {
        const idx = land.managers.indexOf(m);
        if (idx !== -1) {
          land.managers.splice(idx, 1);
          Database.update(land);
          status.ok("\u5DF2\u79FB\u9664\u8BE5\u7BA1\u7406\u8005\u3002");
        }
        this.nav.rebuild("managerEditor");
      });
    }
  }
  buildRenameDialog(page) {
    const status = new FormStatus(page);
    const land = this.nav.state.land;
    if (!land) {
      page.label("\u571F\u5730\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const name = obsStr(land.nickname || "");
    page.textField("\u571F\u5730\u540D\u79F0", name, { description: "\u8F93\u5165\u65B0\u540D\u79F0\uFF08\u7559\u7A7A\u6062\u590D\u9ED8\u8BA4\uFF09" });
    page.button("\u786E\u8BA4", () => {
      const val = name.getData().trim();
      land.nickname = val;
      Database.update(land);
      status.ok(val ? `\u571F\u5730\u5DF2\u91CD\u547D\u540D\u4E3A ${val}\u3002` : "\u571F\u5730\u540D\u79F0\u5DF2\u6062\u590D\u9ED8\u8BA4\u3002");
      this.nav.rebuild("landManage");
    });
  }
  buildStateDialog(page) {
    const status = new FormStatus(page);
    const session = this.nav.state.session;
    const hasPos1 = !!session?.pos1;
    const hasPos2 = !!session?.pos2;
    const bothSet = hasPos1 && hasPos2;
    if (!bothSet) {
      const body = ["\u8BF7\u5148\u5B8C\u6574\u9009\u62E9\u571F\u5730\u8303\u56F4\u3002"];
      if (hasPos1 && !hasPos2) body.push("  \xA76!pos2 \xA7r- \u7EE7\u7EED\u8BBE\u7F6E\u7B2C\u4E8C\u70B9");
      if (hasPos2 && !hasPos1) body.push("  \xA76!pos1 \xA7r- \u7EE7\u7EED\u8BBE\u7F6E\u7B2C\u4E00\u70B9");
      page.label(ListFormInfo(body));
      page.button("\u53D6\u6D88\u7533\u8BF7", () => {
        LandCore.clearSession(this.player.id);
        status.fail("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002");
        this.nav.leave(() => {
        });
      });
    } else {
      const dimid = this.player.dimension.id === "minecraft:overworld" ? 0 : this.player.dimension.id === "minecraft:nether" ? 1 : 2;
      const info = LandCore.formatLandInfo(session.pos1, session.pos2, dimid).replace(/§[cef6]/g, "");
      page.label(ListFormInfo([info, "\xA77\u786E\u8BA4\u7533\u8BF7\u8BE5\u571F\u5730\uFF1F"]));
      page.button("\u786E\u8BA4\u7533\u8BF7", () => this.handleApply(session.pos1, session.pos2, dimid, page));
      page.button("\u53D6\u6D88\u7533\u8BF7", () => {
        if (LandCore.clearSession(this.player.id)) {
          status.fail("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002");
        } else {
          status.fail("\u571F\u5730\u7533\u8BF7\u53D6\u6D88\u5931\u8D25\u3002");
        }
        this.nav.leave(() => {
        });
      });
    }
  }
  showDeleteConfirm(land, page) {
    const status = new FormStatus(page);
    if (!LandCore.isOwner(land, this.player.id) && !LandCore.isManager(land, this.player.id)) {
      status.fail("\u4F60\u6CA1\u6709\u6743\u9650\u5220\u9664\u6B64\u571F\u5730\u3002");
      return;
    }
    const price = LandCore.calculatePrice(land.posA, land.posB);
    const cfg = Database.getConfig();
    const refund = Math.floor(price * cfg.refundRate);
    const name = land.nickname || land.id;
    const body = [
      `\xA7c\u786E\u5B9A\u8981\u5220\u9664\u571F\u5730 \xA7r${name} \xA7c\u5417\uFF1F`,
      `  \xA77- \u9762\u79EF: \xA7a${LandCore.getCubeInfo(land.posA, land.posB).square} \xA77\u683C`,
      `  \xA77- \u9000\u6B3E: \xA7a${refund} \xA77${Money.UNIT}`,
      ``,
      `\xA7c\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF01`
    ].join("\n");
    this.nav.confirm(
      "\u5220\u9664\u571F\u5730",
      body,
      () => {
        if (LandCore.deleteLand(land.id, this.player)) {
          status.ok(`\u571F\u5730\u5DF2\u5220\u9664\uFF0C\u83B7\u5F97 ${refund} ${Money.UNIT}\u3002`);
        } else {
          status.fail("\u5220\u9664\u5931\u8D25\u3002");
        }
      },
      () => this.nav.rebuild("landList")
    );
  }
  async handleApply(pos1, pos2, dimid, page) {
    const status = new FormStatus(page);
    const result = LandCore.validateCreation(this.player, pos1, pos2, dimid);
    if (!result.ok) {
      status.fail(result.msg ?? "\u9A8C\u8BC1\u5931\u8D25\u3002");
      return;
    }
    const land = LandCore.createLand(this.player, pos1, pos2, dimid);
    if (land) {
      status.ok(
        `\u571F\u5730\u521B\u5EFA\u6210\u529F\uFF01
\u571F\u5730\u7F16\u53F7: ${land.id}
\u9762\u79EF: ${LandCore.getCubeInfo(land.posA, land.posB).square} \u683C`
      );
      this.nav.leave(() => {
      });
    } else {
      status.fail("\u571F\u5730\u521B\u5EFA\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002");
    }
  }
};

// scripts/land/LandSystem.ts
var LandSystem = class {
  /** 注册命令和权限（由 entry.ts 在 startup 阶段调用） */
  static registerCommandsAndPermissions() {
    Permission.register("land.use", Permission.Any);
    Command.register(
      "land",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
        LandGUI.showMainMenu(player);
      },
      "\u571F\u5730\u7BA1\u7406"
    );
    Command.register(
      "land cancel",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C\u3002";
        if (LandCore.clearSession(player.id)) Msg.success("\u571F\u5730\u7533\u8BF7\u5DF2\u53D6\u6D88\u3002", player);
        else Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
      },
      "\u53D6\u6D88\u571F\u5730\u7533\u8BF7"
    );
    Command.register(
      "pos1",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
        handlePosCommand(player, 1);
      },
      "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E00\u70B9"
    );
    Command.register(
      "pos2",
      "land.use",
      (player) => {
        if (!player) return "\xA7c\u8BE5\u6307\u4EE4\u53EA\u80FD\u7531\u73A9\u5BB6\u6267\u884C";
        handlePosCommand(player, 2);
      },
      "\u8BBE\u7F6E\u571F\u5730\u7B2C\u4E8C\u70B9"
    );
  }
  static init() {
  }
};
function handlePosCommand(player, which) {
  const plid = player.id;
  const pos = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
  const dimid = player.dimension.id === "minecraft:overworld" ? 0 : player.dimension.id === "minecraft:nether" ? 1 : 2;
  const session = LandCore.getSession(plid);
  if (!session) return Msg.error("\u4F60\u6CA1\u6709\u6B63\u5728\u8FDB\u884C\u7684\u571F\u5730\u7533\u8BF7\u3002", player);
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

// scripts/land/LandEvents.ts
import { world as world19 } from "@minecraft/server";
var CONTAINER_BLOCKS = /* @__PURE__ */ new Set([
  "minecraft:chest",
  "minecraft:trapped_chest",
  "minecraft:barrel"
  // 潜影盒用正则匹配
]);
function isContainerBlock(typeId) {
  if (CONTAINER_BLOCKS.has(typeId)) return true;
  return /^minecraft:.*_shulker_box$/.test(typeId);
}
function checkLandPermission(player, pos, dimid, permField) {
  if (player.hasTag("op") || player.hasTag("admin")) return true;
  const land = LandCore.getLandByPos(pos, dimid);
  if (!land) return true;
  if (LandCore.isOwnerOrManager(land, player.id)) return true;
  return land.permissions[permField] === true;
}
var LandEvents = class {
  static {
    this.initialized = false;
  }
  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents() {
    if (this.initialized) return;
    this.initialized = true;
    world19.beforeEvents.playerPlaceBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "allow_place")) {
        Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u653E\u7F6E\u65B9\u5757\uFF01", player);
        ev.cancel = true;
      }
    });
    world19.beforeEvents.playerBreakBlock.subscribe((ev) => {
      const { player, block } = ev;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "allow_destroy")) {
        Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u7834\u574F\u65B9\u5757\uFF01", player);
        ev.cancel = true;
      }
    });
    world19.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
      const { player, block } = ev;
      if (!isContainerBlock(block.typeId)) return;
      const pos = { x: block.x, y: block.y, z: block.z };
      const dimid = block.dimension.id === "minecraft:overworld" ? 0 : block.dimension.id === "minecraft:nether" ? 1 : 2;
      if (!checkLandPermission(player, pos, dimid, "open_container")) {
        Msg.error("\u4F60\u6CA1\u6709\u6743\u9650\u5728\u6B64\u571F\u5730\u6253\u5F00\u5BB9\u5668\uFF01", player);
        ev.cancel = true;
      }
    });
  }
};

// scripts/gui/MoneyGUI.ts
import { world as world20 } from "@minecraft/server";
var MoneyGUI = class _MoneyGUI {
  static registerCommand() {
    Command.register(
      "money",
      "money.admin",
      (player) => {
        if (!player) return;
        new _MoneyGUI().show(player);
      },
      "\u8D27\u5E01\u7BA1\u7406"
    );
  }
  show(player) {
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
      page.button("\u786E\u8BA4", () => {
        const name = targetName.getData().trim();
        const val = parseInt(amountStr.getData());
        if (!name || isNaN(val) || val <= 0) {
          status.fail("\u8F93\u5165\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u73A9\u5BB6\u540D\u79F0\u548C\u6570\u91CF\u3002");
          return;
        }
        const target = world20.getPlayers().find((p) => p.name === name);
        if (!target) {
          status.fail(`\u672A\u627E\u5230\u73A9\u5BB6\u300C${name}\u300D\u3002`);
          return;
        }
        Money.add(target, val);
        status.ok(`\u5DF2\u7ED9\u4E88 ${name} ${val} ${Money.UNIT}\u3002`);
        nav.rebuild("main");
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
        const target = world20.getPlayers().find((p) => p.name === name);
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

// scripts/gui/MainMenu.ts
import { system as system17 } from "@minecraft/server";
var MainMenu = class _MainMenu {
  static registerMenuCommand() {
    Command.register(
      "menu",
      "menu.use",
      (player) => {
        if (player) _MainMenu.show(player);
      },
      "\u4E3B\u83DC\u5355"
    );
  }
  static show(player) {
    new _MainMenu().showMainMenu(player);
  }
  showMainMenu(player) {
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
      page.button("\u786E\u8BA4\u8F6C\u8D26", () => {
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
        const bal = Money.get(player);
        if (amount > bal) {
          status.setData(`\xA7c\u4F59\u989D\u4E0D\u8DB3\u3002\u5F53\u524D\u4F59\u989D: ${bal} ${Money.UNIT}\uFF0C\u9700\u8981: ${amount} ${Money.UNIT}`);
          return;
        }
        Money.add(player, -amount);
        Money.add(target, amount);
        status.setData(`\xA7a\u6210\u529F\u8F6C\u8D26 ${amount} ${Money.UNIT} \u7ED9 ${name}\u3002`);
        system17.runTimeout(() => nav.rebuild("economy"), 40);
      });
    });
    nav.start("main");
  }
};

// scripts/gui/AdminGUI.ts
var MODULES = [
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
  "shop",
  "form_shop",
  "land",
  "holoprint",
  "money",
  "tps",
  "online_time",
  "activity_log",
  "scoreboard_sync",
  "spawn_protect",
  "chat_sounds"
];
var AdminGUI = class _AdminGUI {
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
      this.nav.message("\u5931\u8D25", `\xA7c\u2718 ${name} \u4FEE\u6539\u5931\u8D25`);
      return;
    }
    await ConfigManager.reloadAll();
    _AdminGUI.applyRuntimeState(name, val);
    this.nav.message("\u6210\u529F", `\xA7a\u2714 ${name} \u5DF2${val ? "\u542F\u7528" : "\u7981\u7528"}`);
  }
  static applyRuntimeState(name, enabled) {
    if (name === "creative") CreativeArea.enable = enabled;
    if (name === "peace") Peace.getInstance().enable = enabled;
  }
};

// scripts/shop/ShopSystem.ts
import {
  world as world21,
  BlockComponentTypes as BlockComponentTypes4
} from "@minecraft/server";

// scripts/gui/ShopGUI.ts
var ShopGUI = class _ShopGUI {
  constructor(player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }
  static show(player) {
    new _ShopGUI(player).nav.start("category");
  }
  registerSections() {
    this.nav.section("category", "\u5546\u5E97", (p) => this.buildCategory(p));
    this.nav.section("itemDetail", "\u5546\u54C1\u8BE6\u60C5", (p) => this.buildItemDetail(p));
    this.nav.section("quantityInput", "\u6570\u91CF", (p) => this.buildQuantityInput(p));
  }
  buildCategory(page) {
    const cfg = ConfigManager.getGrid("shop_chest");
    const totalShops = cfg.size[0] * cfg.size[1];
    page.label(ListFormInfo(["\u9009\u62E9\u8981\u6D4F\u89C8\u7684\u5546\u54C1\u5206\u7C7B"]));
    for (let i = 0; i < totalShops; i++) {
      const idx = i;
      page.button(ShopSystem.getShopName(i), () => {
        this.nav.state.catIdx = idx;
        this.nav.rebuild("itemDetail");
      });
    }
  }
  async buildItemDetail(page) {
    const catIdx = this.nav.state.catIdx;
    const items = ShopSystem.getChestItems(catIdx);
    const priceData = ShopSystem.getPriceData();
    const shopName = ShopSystem.getShopName(catIdx);
    page.label(ListFormInfo([`\u5F53\u524D\u4F59\u989D: ${Money.get(this.player)} ${Money.UNIT}`]));
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      if (!item) continue;
      const buyPrice = priceData.prices[`${catIdx}:${j}`];
      const sellPrice = priceData.sellPrices[`${catIdx}:${j}`];
      const label = `${item.typeId} \xA77x${item.amount}\xA7r`;
      const prices = `${buyPrice ? `\xA7a\u4E70:${buyPrice} ${Money.UNIT}\xA7r` : ""} ${sellPrice ? `\xA76\u5356:${sellPrice} ${Money.UNIT}\xA7r` : ""}`;
      page.button(`${label}
${prices}`, () => {
        this.nav.state.catIdx = catIdx;
        this.nav.state.slotIdx = j;
        this.nav.state.item = item;
        this.nav.state.buyPrice = buyPrice;
        this.nav.state.sellPrice = sellPrice;
        this.nav.go("quantityInput");
      });
    }
  }
  buildQuantityInput(page) {
    const status = new FormStatus(page);
    const catIdx = this.nav.state.catIdx;
    const slotIdx = this.nav.state.slotIdx;
    const item = this.nav.state.item;
    const buyPrice = this.nav.state.buyPrice;
    const sellPrice = this.nav.state.sellPrice;
    if (!item) {
      page.label("\u7269\u54C1\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const bodyParts = [`\xA77\u7269\u54C1: \xA7f${item.typeId}`, `\xA77\u5E93\u5B58: \xA7f${item.amount}`];
    if (buyPrice) bodyParts.push(`\xA7a\u8D2D\u4E70\u4EF7: ${buyPrice} ${Money.UNIT}/\u4E2A`);
    if (sellPrice) bodyParts.push(`\xA76\u56DE\u6536\u4EF7: ${sellPrice} ${Money.UNIT}/\u4E2A`);
    bodyParts.push(`\xA77\u5F53\u524D\u4F59\u989D: ${Money.get(this.player)} ${Money.UNIT}`);
    page.label(bodyParts.join("\n"));
    if (buyPrice) {
      page.button(`\xA7a\u8D2D\u4E70 \xA77(${buyPrice} ${Money.UNIT}/\u4E2A)`, () => {
        this.nav.state.action = "buy";
        this.nav.rebuild("quantityInput");
      });
    }
    if (sellPrice) {
      page.button(`\xA76\u56DE\u6536 \xA77(${sellPrice} ${Money.UNIT}/\u4E2A)`, () => {
        this.nav.state.action = "sell";
        this.nav.rebuild("quantityInput");
      });
    }
    const amountObs = obsStr("");
    page.textField("\u6570\u91CF", amountObs);
    page.button("\u786E\u8BA4", () => {
      const action = this.nav.state.action;
      const amountStr = amountObs.getData();
      const amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
        status.fail("\u65E0\u6548\u7684\u6570\u91CF\u3002");
        return;
      }
      if (action === "buy") {
        const shopItem = ShopSystem.getChestItems(catIdx)?.[slotIdx];
        if (amount > (shopItem?.amount ?? 0)) {
          status.fail(`\u5E93\u5B58\u4E0D\u8DB3\uFF0C\u4EC5\u5269 ${shopItem?.amount ?? 0} \u4E2A\u3002`);
          return;
        }
        const total = amount * buyPrice;
        if (Money.get(this.player) < total) {
          status.fail(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${total}\uFF0C\u5F53\u524D ${Money.get(this.player)}`);
          return;
        }
        ShopSystem.buy(this.player, catIdx, slotIdx, amount);
      } else {
        const playerInv = this.player.getComponent("inventory");
        if (!playerInv?.container) {
          status.fail("\u65E0\u6CD5\u83B7\u53D6\u80CC\u5305\u4FE1\u606F\u3002");
          return;
        }
        let totalFound = 0;
        for (let i = 0; i < playerInv.container.size; i++) {
          const invItem = playerInv.container.getItem(i);
          if (invItem && invItem.typeId === item.typeId) totalFound += invItem.amount;
        }
        if (totalFound < amount) {
          status.fail(`\u80CC\u5305\u4E2D\u4E0D\u8DB3\uFF0C\u4EC5\u6709 ${totalFound} \u4E2A\u3002`);
          return;
        }
        ShopSystem.sell(this.player, catIdx, slotIdx, item.typeId, amount);
      }
    });
  }
};

// scripts/shop/ShopSystem.ts
var ShopSystem = class {
  static registerCommand() {
    Command.register(
      "shop",
      "shop.use",
      (player) => {
        if (player) this.showShop(player);
      },
      "\u5546\u5E97"
    );
  }
  /** 委托给 ShopGUI 打开商店主菜单 */
  static showShop(player) {
    ShopGUI.show(player);
  }
  // ── 布局工具 ──
  /** 获取第 catIdx 个商店箱子的 { left, right, sign } 布局 */
  static getChestLayout(catIdx) {
    const cfg = ConfigManager.getGrid("shop_chest");
    const mainAxis = Math.floor(catIdx / cfg.size[1]);
    const yOffset = catIdx % cfg.size[1];
    return getLayout(cfg.start, cfg.direction, mainAxis, yOffset, cfg.face);
  }
  /** 获取第 catIdx 个商店的名称（从告示牌读取） */
  static getShopName(catIdx) {
    const { sign } = this.getChestLayout(catIdx);
    const dim = world21.getDimension("minecraft:overworld");
    const block = dim.getBlock(sign);
    if (!block) return `\u5546\u5E97 #${catIdx + 1}`;
    try {
      const signComp = block.getComponent(BlockComponentTypes4.Sign);
      if (signComp?.getText) {
        const text = signComp.getText(true);
        if (text && text.rawtext?.[0]?.text) return text.rawtext[0].text;
      }
    } catch {
    }
    return `\u5546\u5E97 #${catIdx + 1}`;
  }
  /** 获取某个商店箱子里所有物品（实际库存） */
  static getChestItems(catIdx) {
    const dim = world21.getDimension("minecraft:overworld");
    const { left } = this.getChestLayout(catIdx);
    const block = dim.getBlock(left);
    if (!block) return [];
    const cfg = ConfigManager.getGrid("shop_chest");
    ensureDoubleChest(dim, left, getChestCardinal(cfg.direction, cfg.face), cfg.direction);
    const invComp = block.getComponent(BlockComponentTypes4.Inventory);
    if (!invComp?.container) return [];
    const items = [];
    for (let i = 0; i < invComp.container.size; i++) {
      items.push(invComp.container.getItem(i));
    }
    return items;
  }
  // ── 价格管理 ──
  static getPriceData() {
    let pricesData = world21.getDynamicProperty("hpbe:shop_prices");
    let prices = {};
    if (typeof pricesData === "string") prices = JSON.parse(pricesData);
    let stocksData = world21.getDynamicProperty("hpbe:shop_stocks");
    let sellPrices = {};
    if (typeof stocksData === "string") sellPrices = JSON.parse(stocksData);
    return {
      prices,
      sellPrices
    };
  }
  static setPrice(catIdx, slotIdx, buyPrice, sellPrice) {
    const data = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    if (buyPrice > 0) data.prices[key] = buyPrice;
    else delete data.prices[key];
    if (sellPrice > 0) data.sellPrices[key] = sellPrice;
    else delete data.sellPrices[key];
    world21.setDynamicProperty("hpbe:shop_prices", JSON.stringify(data.prices));
    world21.setDynamicProperty("hpbe:shop_stocks", JSON.stringify(data.sellPrices));
  }
  // ── 购买 ──
  static buy(player, catIdx, slotIdx, amount) {
    const data = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    const price = data.prices[key];
    if (!price || price <= 0) {
      Msg.error("\u8BE5\u7269\u54C1\u672A\u8BBE\u7F6E\u4EF7\u683C\u3002", player);
      return false;
    }
    const dim = world21.getDimension("minecraft:overworld");
    const { left } = this.getChestLayout(catIdx);
    const cfg = ConfigManager.getGrid("shop_chest");
    ensureDoubleChest(dim, left, getChestCardinal(cfg.direction, cfg.face), cfg.direction);
    const block = dim.getBlock(left);
    if (!block) return false;
    const invComp = block.getComponent(BlockComponentTypes4.Inventory);
    if (!invComp?.container) return false;
    const container = invComp.container;
    const item = container.getItem(slotIdx);
    if (!item) {
      Msg.error("\u5E93\u5B58\u4E0D\u8DB3\u3002", player);
      return false;
    }
    if (item.amount < amount) {
      Msg.error(`\u5E93\u5B58\u4E0D\u8DB3\uFF0C\u4EC5\u5269 ${item.amount} \u4E2A\u3002`, player);
      return false;
    }
    const total = price * amount;
    const bal = Money.get(player);
    if (bal < total) {
      Msg.error(`${Money.UNIT}\u4E0D\u8DB3\uFF0C\u9700\u8981 ${total}\uFF0C\u5F53\u524D ${bal}`, player);
      return false;
    }
    Money.set(player, bal - total);
    if (item.amount === amount) {
      container.setItem(slotIdx, void 0);
    } else {
      item.amount -= amount;
      container.setItem(slotIdx, item);
    }
    try {
      const itemName = item.typeId;
      const aux = item.data ?? 0;
      player.runCommand(`give "${player.name}" ${itemName} ${amount} ${aux}`);
    } catch (e) {
      Msg.error("\u7ED9\u4E88\u7269\u54C1\u65F6\u51FA\u9519\uFF0C\u8BF7\u8054\u7CFB\u7BA1\u7406\u5458\u3002", player);
      return false;
    }
    Msg.success(`\u8D2D\u4E70\u6210\u529F\uFF01\u82B1\u8D39 ${total} ${Money.UNIT}`, player);
    return true;
  }
  // ── 出售 ──
  static sell(player, catIdx, slotIdx, itemTypeId, amount) {
    const data = this.getPriceData();
    const key = `${catIdx}:${slotIdx}`;
    const price = data.sellPrices[key];
    if (!price || price <= 0) {
      Msg.error("\u8BE5\u4F4D\u7F6E\u4E0D\u652F\u6301\u56DE\u6536\u3002", player);
      return false;
    }
    const playerInv = player.getComponent("inventory");
    if (!playerInv?.container) {
      Msg.error("\u65E0\u6CD5\u83B7\u53D6\u80CC\u5305\u4FE1\u606F\u3002", player);
      return false;
    }
    let totalFound = 0;
    for (let i = 0; i < playerInv.container.size; i++) {
      const invItem = playerInv.container.getItem(i);
      if (invItem && invItem.typeId === itemTypeId) {
        totalFound += invItem.amount;
      }
    }
    if (totalFound < amount) {
      Msg.error(`\u80CC\u5305\u4E2D ${itemTypeId} \u4E0D\u8DB3\uFF0C\u4EC5\u6709 ${totalFound} \u4E2A\u3002`, player);
      return false;
    }
    let remaining = amount;
    for (let i = 0; i < playerInv.container.size && remaining > 0; i++) {
      const invItem = playerInv.container.getItem(i);
      if (invItem && invItem.typeId === itemTypeId) {
        if (invItem.amount <= remaining) {
          remaining -= invItem.amount;
          playerInv.container.setItem(i, void 0);
        } else {
          invItem.amount -= remaining;
          playerInv.container.setItem(i, invItem);
          remaining = 0;
        }
      }
    }
    const total = price * amount;
    Money.add(player, total);
    Msg.success(`\u56DE\u6536\u6210\u529F\uFF01\u83B7\u5F97 ${total} ${Money.UNIT}`, player);
    return true;
  }
  // ── 检测商店方块 ──
  /** 检测某个坐标是否为商店箱子区域，返回 catIdx，否则返回 -1 */
  static detectShopChest(location) {
    const cfg = ConfigManager.getGrid("shop_chest");
    for (let catIdx = 0; catIdx < cfg.size[0] * cfg.size[1]; catIdx++) {
      const { left, right } = this.getChestLayout(catIdx);
      for (const pos of [left, right]) {
        if (pos.x === Math.floor(location.x) && pos.y === Math.floor(location.y) && pos.z === Math.floor(location.z)) {
          return catIdx;
        }
      }
    }
    return -1;
  }
};

// scripts/data/Scoreboards.ts
import { world as world22 } from "@minecraft/server";
function ScoreboardsBackup() {
  let entries = [];
  world22.scoreboard.getObjectives().forEach((obj, index) => {
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
var ScoreboardSync = class {
  static init() {
    ScoreboardsBackup();
    console.info("[ScoreboardSync] \u8BA1\u5206\u677F\u540C\u6B65\u5DF2\u521D\u59CB\u5316");
  }
  /** 恢复：db-server → 游戏 */
  static async load() {
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
        let objective = world22.scoreboard.getObjective(objId);
        if (!objective) {
          try {
            objective = world22.scoreboard.addObjective(objId, objEntries[0].objective_display || objId);
          } catch (err) {
            console.warn(`[ScoreboardSync] \u65E0\u6CD5\u521B\u5EFA\u8BB0\u5206\u9879 "${objId}"\uFF1A${err}`);
            fail += objEntries.length;
            continue;
          }
        }
        for (const e of objEntries) {
          try {
            if (e.participant_type === "Player" && e.id) {
              const player = [...world22.getPlayers()].find((p) => p.id === e.id);
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

// scripts/data/ActivityLog.ts
import { world as world23, system as system19 } from "@minecraft/server";
var ENABLED_EVENTS = /* @__PURE__ */ new Set([
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
var FLUSH_INTERVAL = 2e3;
var CLEANUP_INTERVAL = 6 * 36e5;
var KEEP_DAYS = 30;
var queue = [];
var flushTimer = null;
var initialized = false;
function enqueue(entry) {
  queue.push(entry);
  if (!flushTimer) {
    flushTimer = system19.runTimeout(flush, FLUSH_INTERVAL / 50);
  }
}
async function flush() {
  flushTimer = null;
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  try {
    await HttpDB.post("/api/sfmc/activities/batch", { entries: batch });
  } catch {
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
      signal.subscribe(cb);
    }
  }
  const AE = world23.afterEvents;
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
var ActivityLog = class {
  /** 注册事件（由 entry.ts 统一调用） */
  static registerEvents() {
    subscribe();
  }
  static init() {
    if (initialized) return;
    initialized = true;
    console.info("[ActivityLog] \u4E8B\u4EF6\u8BA2\u9605\u5B8C\u6210");
    system19.runInterval(flush, FLUSH_INTERVAL / 50);
    system19.runTimeout(() => {
      doCleanup();
      system19.runInterval(doCleanup, CLEANUP_INTERVAL / 50);
    }, 72e3 / 50);
  }
};

// scripts/data/World.ts
import { world as world24 } from "@minecraft/server";
function serializeGameRules() {
  const g = world24.gameRules;
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
  const data = {
    allowCheats: world24.allowCheats,
    gameRules: serializeGameRules(),
    seed: world24.seed,
    defaultSpawnLocation: JSON.stringify(world24.getDefaultSpawnLocation()),
    difficulty: world24.getDifficulty(),
    day: world24.getDay(),
    tickingAreasCount: world24.tickingAreaManager.chunkCount,
    absoluteTime: world24.getAbsoluteTime(),
    structuresFromAddon: world24.structureManager.getPackStructureIds().toString(),
    structuresFromWorld: world24.structureManager.getWorldStructureIds().toString(),
    MoonPhase: world24.getMoonPhase(),
    dynamicPropertyTotalByteCount: world24.getDynamicPropertyTotalByteCount(),
    updatedAt: getShanghaiTime().date + getShanghaiTime().time
  };
  return data;
}
async function syncWorldData() {
  const data = await getWorldData();
  await saveWorldData(data);
}

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

// scripts/holo/HoloEntity.ts
import { world as world25, Player as Player23 } from "@minecraft/server";
var HOLOGRAM_ENTITY_ID = "sfmc:hologram";
var DP_PROJECTION_ID = "hpbe_projection_id";
var DP_OWNER_ID = "hpbe_owner_id";
var DP_SCALE = "hpbe_scale";
var DP_OPACITY = "hpbe_opacity";
var DP_ROTATION = "hpbe_rotation";
var DP_VISIBLE = "hpbe_visible";
var DP_LAYER = "hpbe_layer";
var DP_OFFSET_X = "hpbe_offset_x";
var DP_OFFSET_Y = "hpbe_offset_y";
var DP_OFFSET_Z = "hpbe_offset_z";
var HoloEntity = class {
  static {
    /** projectionId → ActiveHologram */
    this.activeHolograms = /* @__PURE__ */ new Map();
  }
  // ──────── 公开方法 ────────
  /**
   * 在世界中生成全息实体
   * @param player    所属玩家
   * @param projectionId  投影 ID
   * @param location  生成位置
   * @returns 生成的 Entity，失败返回 null
   */
  static spawnProjection(player, projectionId, location) {
    try {
      const dimension = player.dimension;
      const entity = dimension.spawnEntity(HOLOGRAM_ENTITY_ID, location);
      entity.setDynamicProperty(DP_PROJECTION_ID, projectionId);
      entity.setDynamicProperty(DP_OWNER_ID, player.id);
      this.activeHolograms.set(projectionId, {
        entity,
        projectionId,
        ownerId: player.id
      });
      console.info(`[HoloEntity] \u5DF2\u751F\u6210\u6295\u5F71 ${projectionId} \u4E8E ${location.x},${location.y},${location.z}`);
      return entity;
    } catch (err) {
      console.error(`[HoloEntity] \u751F\u6210\u6295\u5F71\u5931\u8D25 ${projectionId}: ${err}`);
      return null;
    }
  }
  /**
   * 移除指定投影实体
   * @param projectionId  投影 ID
   * @returns 是否成功移除
   */
  static removeProjection(projectionId) {
    const entry = this.activeHolograms.get(projectionId);
    if (!entry) {
      console.warn(`[HoloEntity] \u6295\u5F71 ${projectionId} \u4E0D\u5B58\u5728\u4E8E\u6D3B\u8DC3\u6620\u5C04\u4E2D`);
      return false;
    }
    try {
      entry.entity.remove();
      this.activeHolograms.delete(projectionId);
      console.info(`[HoloEntity] \u5DF2\u79FB\u9664\u6295\u5F71 ${projectionId}`);
      return true;
    } catch (err) {
      console.error(`[HoloEntity] \u79FB\u9664\u6295\u5F71\u5931\u8D25 ${projectionId}: ${err}`);
      this.activeHolograms.delete(projectionId);
      return false;
    }
  }
  /**
   * 更新实体属性（透明度、比例等）
   *
   * 实体的几何体由资源包渲染控制器驱动，此处仅更新动态属性，
   * 渲染控制器通过 Molang 查询这些属性来调节视觉效果。
   *
   * @param projectionId  投影 ID
   * @param settings      要更新的设置字段
   * @returns 是否成功更新
   */
  static updateProjection(projectionId, settings) {
    const entry = this.activeHolograms.get(projectionId);
    if (!entry) {
      console.warn(`[HoloEntity] \u6295\u5F71 ${projectionId} \u4E0D\u5B58\u5728\uFF0C\u65E0\u6CD5\u66F4\u65B0`);
      return false;
    }
    try {
      const entity = entry.entity;
      if (settings.scale !== void 0) entity.setDynamicProperty(DP_SCALE, settings.scale);
      if (settings.opacity !== void 0) entity.setDynamicProperty(DP_OPACITY, settings.opacity);
      if (settings.rotation !== void 0) entity.setDynamicProperty(DP_ROTATION, settings.rotation);
      if (settings.visible !== void 0) entity.setDynamicProperty(DP_VISIBLE, settings.visible);
      if (settings.layer !== void 0) entity.setDynamicProperty(DP_LAYER, settings.layer);
      if (settings.offsetX !== void 0) entity.setDynamicProperty(DP_OFFSET_X, settings.offsetX);
      if (settings.offsetY !== void 0) entity.setDynamicProperty(DP_OFFSET_Y, settings.offsetY);
      if (settings.offsetZ !== void 0) entity.setDynamicProperty(DP_OFFSET_Z, settings.offsetZ);
      return true;
    } catch (err) {
      console.error(`[HoloEntity] \u66F4\u65B0\u6295\u5F71\u5931\u8D25 ${projectionId}: ${err}`);
      return false;
    }
  }
  /**
   * 获取玩家操作的投影 ID
   * @param entity  全息实体实例
   * @returns 投影 ID 或 null
   */
  static getProjectionForEntity(entity) {
    const projectionId = entity.getDynamicProperty(DP_PROJECTION_ID);
    return projectionId ?? null;
  }
  /**
   * 注册事件（由 entry.ts 统一调用）
   */
  static registerEvents() {
    world25.afterEvents.entityHitEntity.subscribe((event) => {
      const { damagingEntity, hitEntity } = event;
      if (hitEntity.typeId !== HOLOGRAM_ENTITY_ID) return;
      if (!(damagingEntity instanceof Player23)) return;
      const projectionId = hitEntity.getDynamicProperty(DP_PROJECTION_ID);
      if (!projectionId) return;
      console.info(`[HoloEntity] \u73A9\u5BB6 ${damagingEntity.name} \u70B9\u51FB\u4E86\u5168\u606F\u6295\u5F71 ${projectionId}`);
    });
  }
  /**
   * 初始化所有活跃全息实体
   *
   * 在 worldLoad 时调用，扫描所有已存在的 sfmc:hologram 实体并重新注册
   */
  static init() {
    try {
      const dimensions = ["overworld", "nether", "the_end"];
      let count = 0;
      for (const dimId2 of dimensions) {
        const dim = world25.getDimension(dimId2);
        const entities = dim.getEntities({ type: HOLOGRAM_ENTITY_ID });
        for (const entity of entities) {
          const projectionId = entity.getDynamicProperty(DP_PROJECTION_ID);
          const ownerId = entity.getDynamicProperty(DP_OWNER_ID);
          if (projectionId && ownerId) {
            this.activeHolograms.set(projectionId, { entity, projectionId, ownerId });
            count++;
          }
        }
      }
      console.info(`[HoloEntity] \u521D\u59CB\u5316\u5B8C\u6210\uFF0C\u5DF2\u6CE8\u518C ${count} \u4E2A\u6D3B\u8DC3\u5168\u606F\u5B9E\u4F53`);
    } catch (err) {
      console.error(`[HoloEntity] \u521D\u59CB\u5316\u626B\u63CF\u5931\u8D25: ${err}`);
    }
  }
};

// scripts/holo/HoloCore.ts
import { world as world26 } from "@minecraft/server";

// scripts/data/HoloPrint.ts
var COLOR_PRESETS = [
  { name: "\u767D\u8272", value: "255 255 255", hex: "#FFFFFF" },
  { name: "\u7EA2\u8272", value: "255 85 85", hex: "#FF5555" },
  { name: "\u6A59\u8272", value: "255 170 0", hex: "#FFAA00" },
  { name: "\u9EC4\u8272", value: "255 255 85", hex: "#FFFF55" },
  { name: "\u7EFF\u8272", value: "85 255 85", hex: "#55FF55" },
  { name: "\u9752\u8272", value: "85 255 255", hex: "#55FFFF" },
  { name: "\u84DD\u8272", value: "85 85 255", hex: "#5555FF" },
  { name: "\u7D2B\u8272", value: "170 0 170", hex: "#AA00AA" },
  { name: "\u7C89\u8272", value: "255 85 255", hex: "#FF55FF" },
  { name: "\u7070\u8272", value: "170 170 170", hex: "#AAAAAA" }
];
var DEFAULT_HOLO_SETTINGS = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  rotation: 0,
  opacity: 1,
  layer: 0,
  visible: true,
  spawnAnimation: false,
  blockInspect: false,
  overlayTint: false,
  overlayTintOpacity: 0,
  overlayTintColor: "",
  textureOutlineWidth: 0,
  textureOutlineColor: "",
  textureOutlineOpacity: 0,
  layerMode: "all"
};

// scripts/holo/HoloCore.ts
var STRUCTURE_ID_PREFIX = "hpbe:";
var HoloCore = class {
  static {
    /**
     * 玩家选区状态
     * key: player.id
     */
    this.playerSelections = /* @__PURE__ */ new Map();
  }
  // ──────── 选区操作 ────────
  /**
   * 设置玩家选区点
   * @param player    当前玩家
   * @param posNumber 1 = pos1, 2 = pos2
   */
  static setPos(player, posNumber) {
    const loc2 = player.location;
    const point = { x: Math.floor(loc2.x), y: Math.floor(loc2.y), z: Math.floor(loc2.z) };
    let sel = this.playerSelections.get(player.id);
    if (!sel) {
      sel = { pos1: null, pos2: null };
      this.playerSelections.set(player.id, sel);
    }
    if (posNumber === 1) {
      sel.pos1 = point;
      player.sendMessage(`\xA7a[HPBE] \u5DF2\u8BBE\u7F6E\u4F4D\u7F6E1: ${point.x}, ${point.y}, ${point.z}`);
    } else {
      sel.pos2 = point;
      player.sendMessage(`\xA7a[HPBE] \u5DF2\u8BBE\u7F6E\u4F4D\u7F6E2: ${point.x}, ${point.y}, ${point.z}`);
    }
  }
  // ──────── 上传流程 ────────
  /**
   * 执行上传流程
   *
   * 1. 检查选区完整性
   * 2. 使用 StructureManager 保存方块区域为临时结构
   * 3. 通过 HttpDB 上传结构元数据到 db-server
   * 4. 清理临时结构
   *
   * @param player  当前玩家
   * @param config  上传配置（名称、作者、描述、可见性）
   */
  static async startUpload(player, config) {
    try {
      const sel = this.playerSelections.get(player.id);
      if (!sel || !sel.pos1 || !sel.pos2) {
        player.sendMessage("\xA7c[HPBE] \u8BF7\u5148\u4F7F\u7528 !hpbe pos1 \u548C !hpbe pos2 \u8BBE\u7F6E\u9009\u533A");
        return;
      }
      const min = {
        x: Math.min(sel.pos1.x, sel.pos2.x),
        y: Math.min(sel.pos1.y, sel.pos2.y),
        z: Math.min(sel.pos1.z, sel.pos2.z)
      };
      const max = {
        x: Math.max(sel.pos1.x, sel.pos2.x),
        y: Math.max(sel.pos1.y, sel.pos2.y),
        z: Math.max(sel.pos1.z, sel.pos2.z)
      };
      const sizeX = max.x - min.x + 1;
      const sizeY = max.y - min.y + 1;
      const sizeZ = max.z - min.z + 1;
      if (sizeX <= 0 || sizeY <= 0 || sizeZ <= 0) {
        player.sendMessage("\xA7c[HPBE] \u9009\u533A\u65E0\u6548\uFF0C\u8BF7\u91CD\u65B0\u8BBE\u7F6E");
        return;
      }
      const timestamp = Date.now();
      const structureId = `${STRUCTURE_ID_PREFIX}${player.id}_${timestamp}`;
      try {
        world26.structureManager.createFromWorld(structureId, player.dimension, min, max);
      } catch (err) {
        player.sendMessage("\xA7c[HPBE] \u4FDD\u5B58\u7ED3\u6784\u5931\u8D25\uFF0C\u9009\u533A\u53EF\u80FD\u5305\u542B\u672A\u52A0\u8F7D\u533A\u5757");
        console.error(`[HoloCore] createFromWorld \u5931\u8D25: ${err}`);
        return;
      }
      const projectionData = {
        name: config.name,
        author: config.author,
        description: config.description,
        ownerId: player.id,
        visibility: config.visibility,
        scale: DEFAULT_HOLO_SETTINGS.scale,
        opacity: DEFAULT_HOLO_SETTINGS.opacity,
        sizeX,
        sizeY,
        sizeZ,
        blockCount: 0
      };
      const success = await HttpDB.uploadHoloStructure(projectionData, "");
      this.playerSelections.delete(player.id);
      if (success) {
        player.sendMessage(`\xA7a[HPBE] \u6295\u5F71 "${config.name}" \u4E0A\u4F20\u6210\u529F\uFF01`);
        console.info(`[HoloCore] \u73A9\u5BB6 ${player.name} \u4E0A\u4F20\u4E86\u6295\u5F71 ${config.name}`);
      } else {
        player.sendMessage("\xA7c[HPBE] \u4E0A\u4F20\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u8FDE\u63A5");
      }
    } catch (err) {
      player.sendMessage("\xA7c[HPBE] \u4E0A\u4F20\u8FC7\u7A0B\u4E2D\u53D1\u751F\u5F02\u5E38");
      console.error(`[HoloCore] startUpload \u5F02\u5E38: ${err}`);
    }
  }
  // ──────── 加载流程 ────────
  /**
   * 获取并返回投影列表数据（公共 + 玩家私有）
   *
   * @param player  当前玩家
   * @returns 投影数据数组，用于 GUI 展示
   */
  static async loadProjectionList(player) {
    try {
      const [privateProjections, publicProjections] = await Promise.all([
        HttpDB.getHoloProjections(player.id, "private"),
        HttpDB.getHoloProjections(void 0, "public")
      ]);
      const all = [];
      if (privateProjections && Array.isArray(privateProjections)) {
        all.push(...privateProjections.map(this.normalizeProjection));
      }
      const privateIds = new Set(privateProjections?.map((p) => p.id) ?? []);
      if (publicProjections && Array.isArray(publicProjections)) {
        for (const proj of publicProjections) {
          if (!privateIds.has(proj.id)) {
            all.push(this.normalizeProjection(proj));
          }
        }
      }
      if (all.length === 0) {
        player.sendMessage("\xA7e[HPBE] \u6CA1\u6709\u53EF\u7528\u7684\u6295\u5F71");
        return [];
      }
      return all;
    } catch (err) {
      console.error(`[HoloCore] \u52A0\u8F7D\u6295\u5F71\u5217\u8868\u5931\u8D25: ${err}`);
      player.sendMessage("\xA7c[HPBE] \u83B7\u53D6\u6295\u5F71\u5217\u8868\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5668\u8FDE\u63A5");
      return null;
    }
  }
  // ──────── 操作执行 ────────
  /**
   * 执行投影操作
   *
   * @param player        操作玩家
   * @param projectionId  投影 ID
   * @param operation     操作名
   * @param value         操作参数（可选）
   */
  static async executeOperation(player, projectionId, operation, value) {
    try {
      switch (operation) {
        case "materials":
          await this.handleMaterials(player, projectionId);
          break;
        case "toggle_visibility":
          await this.handleToggle(player, projectionId, "visible", value);
          break;
        case "set_scale":
          await this.handleSet(player, projectionId, "scale", value);
          break;
        case "set_opacity":
          await this.handleSet(player, projectionId, "opacity", value);
          break;
        case "set_rotation":
          await this.handleSet(player, projectionId, "rotation", value);
          break;
        case "move":
          await this.handleMove(player, projectionId, value);
          break;
        case "set_layer":
          await this.handleSet(player, projectionId, "layer", value);
          break;
        case "toggle_inspect":
          await this.handleToggle(player, projectionId, "blockInspect", value);
          break;
        case "delete":
          await this.handleDelete(player, projectionId);
          break;
        default:
          player.sendMessage(`\xA7c[HPBE] \u672A\u77E5\u64CD\u4F5C: ${operation}`);
      }
    } catch (err) {
      console.error(`[HoloCore] \u6267\u884C\u64CD\u4F5C ${operation} \u5931\u8D25: ${err}`);
      player.sendMessage(`\xA7c[HPBE] \u64CD\u4F5C\u6267\u884C\u5931\u8D25: ${err}`);
    }
  }
  // ──────── 内部操作方法 ────────
  /** 获取并显示方块清单 */
  static async handleMaterials(player, projectionId) {
    const materials = await HttpDB.getHoloMaterials(projectionId);
    if (!materials || materials.length === 0) {
      player.sendMessage("\xA7e[HPBE] \u8BE5\u6295\u5F71\u6CA1\u6709\u65B9\u5757\u6E05\u5355\u6570\u636E");
      return;
    }
    player.sendMessage(`\xA7a[HPBE] \u5171 ${materials.length} \u79CD\u65B9\u5757`);
  }
  /** 切换布尔属性 */
  static async handleToggle(player, projectionId, field, value) {
    const currentValue = typeof value === "boolean" ? value : value === true;
    const newValue = !currentValue;
    const success = await HttpDB.updateHoloProjection(projectionId, { [field]: newValue });
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u66F4\u65B0\u5931\u8D25");
      return;
    }
    HoloEntity.updateProjection(projectionId, { [field]: newValue });
    player.sendMessage(`\xA7a[HPBE] ${field} \u5DF2\u5207\u6362\u4E3A ${newValue}`);
  }
  /** 设置数值属性 */
  static async handleSet(player, projectionId, field, value) {
    if (value === void 0) {
      player.sendMessage("\xA7c[HPBE] \u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u6570\u503C\u53C2\u6570");
      return;
    }
    const settings = { [field]: value };
    const success = await HttpDB.updateHoloProjection(projectionId, settings);
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u66F4\u65B0\u5931\u8D25");
      return;
    }
    HoloEntity.updateProjection(projectionId, settings);
    player.sendMessage(`\xA7a[HPBE] ${field} \u5DF2\u66F4\u65B0\u4E3A ${value}`);
  }
  /** 移动投影（偏移量） */
  static async handleMove(player, projectionId, value) {
    if (!value || typeof value.x !== "number" || typeof value.y !== "number" || typeof value.z !== "number") {
      player.sendMessage("\xA7c[HPBE] \u8BF7\u63D0\u4F9B\u6709\u6548\u7684\u504F\u79FB\u91CF (x, y, z)");
      return;
    }
    const success = await HttpDB.updateHoloProjection(projectionId, {
      offsetX: value.x,
      offsetY: value.y,
      offsetZ: value.z
    });
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u66F4\u65B0\u504F\u79FB\u5931\u8D25");
      return;
    }
    HoloEntity.updateProjection(projectionId, {
      offsetX: value.x,
      offsetY: value.y,
      offsetZ: value.z
    });
    player.sendMessage(`\xA7a[HPBE] \u5DF2\u79FB\u52A8\u6295\u5F71\u5230\u504F\u79FB ${value.x}, ${value.y}, ${value.z}`);
  }
  /** 删除投影 */
  static async handleDelete(player, projectionId) {
    const success = await HttpDB.deleteHoloProjection(projectionId);
    if (!success) {
      player.sendMessage("\xA7c[HPBE] \u5220\u9664\u6295\u5F71\u5931\u8D25");
      return;
    }
    HoloEntity.removeProjection(projectionId);
    player.sendMessage(`\xA7a[HPBE] \u6295\u5F71\u5DF2\u5220\u9664`);
    console.info(`[HoloCore] \u73A9\u5BB6 ${player.name} \u5220\u9664\u4E86\u6295\u5F71 ${projectionId}`);
  }
  // ──────── 工具 ────────
  /**
   * 将 API 返回的原始数据规整为 ProjectionData
   */
  static normalizeProjection(raw) {
    if (raw.settings && raw.ownerId !== void 0) {
      return raw;
    }
    return {
      id: raw.id,
      name: raw.name,
      author: raw.author ?? "",
      description: raw.description ?? "",
      ownerId: raw.owner_id ?? raw.ownerId ?? "",
      isPublic: !!(raw.is_public ?? raw.isPublic ?? false),
      visibility: raw.visibility ?? (raw.isPublic ? "public" : "private"),
      settings: {
        scale: raw.scale ?? raw.settings?.scale ?? 1,
        offsetX: raw.offset_x ?? raw.settings?.offsetX ?? 0,
        offsetY: raw.offset_y ?? raw.settings?.offsetY ?? 0,
        offsetZ: raw.offset_z ?? raw.settings?.offsetZ ?? 0,
        rotation: raw.rotation ?? raw.settings?.rotation ?? 0,
        opacity: raw.opacity ?? raw.settings?.opacity ?? 1,
        layer: raw.layer ?? raw.settings?.layer ?? 0,
        visible: !!(raw.visible ?? raw.settings?.visible ?? true),
        spawnAnimation: !!(raw.spawn_animation ?? raw.settings?.spawnAnimation ?? false),
        blockInspect: !!(raw.block_inspect ?? raw.settings?.blockInspect ?? false),
        overlayTint: !!(raw.overlay_tint ?? raw.settings?.overlayTint ?? false),
        overlayTintOpacity: raw.overlay_tint_opacity ?? raw.settings?.overlayTintOpacity ?? 0,
        overlayTintColor: raw.overlay_tint_color ?? raw.settings?.overlayTintColor ?? "",
        textureOutlineWidth: raw.texture_outline_width ?? raw.settings?.textureOutlineWidth ?? 0,
        textureOutlineColor: raw.texture_outline_color ?? raw.settings?.textureOutlineColor ?? "",
        textureOutlineOpacity: raw.texture_outline_opacity ?? raw.settings?.textureOutlineOpacity ?? 0,
        layerMode: raw.layer_mode ?? raw.settings?.layerMode ?? "all"
      },
      dbVersion: raw.db_version ?? raw.dbVersion ?? 1,
      geometryFile: raw.geometry_file ?? raw.geometryFile ?? "",
      blockCount: raw.block_count ?? raw.blockCount ?? 0,
      sizeX: raw.size_x ?? raw.sizeX ?? 0,
      sizeY: raw.size_y ?? raw.sizeY ?? 0,
      sizeZ: raw.size_z ?? raw.sizeZ ?? 0,
      structureData: raw.structure_data ?? raw.structureData ?? "",
      palette: raw.palette ?? "",
      blocks: "",
      blockEntities: raw.block_entities ?? "",
      fromWorld: !!(raw.from_world ?? raw.fromWorld ?? false),
      materials: raw.materials ?? [],
      createdAt: raw.created_at ?? raw.createdAt ?? 0,
      updatedAt: raw.updated_at ?? raw.updatedAt ?? 0
    };
  }
};

// scripts/holo/HoloGUI.ts
var HoloGUI = class _HoloGUI {
  constructor(player) {
    this.player = player;
    this.nav = new MenuNavigator(player);
    this.registerSections();
  }
  static registerCommand() {
    Command.register(
      "holorint",
      "holorint.menu",
      (player) => {
        if (player) new _HoloGUI(player).nav.start("main");
      },
      "\u5168\u606F\u6295\u5F71"
    );
    Command.register(
      "hpbe pos1",
      "holorint.pos1",
      (player) => {
        if (player) HoloCore.setPos(player, 1);
      },
      "\u8BBE\u7F6E\u9009\u533A\u70B91"
    );
    Command.register(
      "hpbe pos2",
      "holorint.pos2",
      (player) => {
        if (player) HoloCore.setPos(player, 2);
      },
      "\u8BBE\u7F6E\u9009\u533A\u70B92"
    );
  }
  // ── 外部调用入口 ──
  static async showProjectionList(player, privateList, publicList) {
    const gui = new _HoloGUI(player);
    gui.nav.state.privateList = privateList;
    gui.nav.state.publicList = publicList;
    await gui.nav.start("load");
  }
  static async showOperationMenu(player, projection) {
    const gui = new _HoloGUI(player);
    gui.nav.state.projection = projection;
    await gui.nav.start("operation");
  }
  static async showMaterialList(player, materials) {
    const gui = new _HoloGUI(player);
    gui.nav.state.materials = materials;
    await gui.nav.start("materials");
  }
  static showVersionWarning(player) {
    const gui = new _HoloGUI(player);
    gui.nav.state._title = "\u7248\u672C\u4E0D\u5339\u914D";
    gui.nav.confirm(
      "\u7248\u672C\u4E0D\u5339\u914D",
      "\u68C0\u6D4B\u5230\u63D2\u4EF6\u7248\u672C\u4E0E\u670D\u52A1\u5668\u7AEF\u4E0D\u5339\u914D\uFF0C\u90E8\u5206\u6295\u5F71\u53EF\u80FD\u65E0\u6CD5\u6B63\u5E38\u663E\u793A\u3002\n\n\u8BF7\u91CD\u65B0\u52A0\u5165\u6E38\u620F\u4EE5\u83B7\u53D6\u66F4\u65B0\u540E\u7684\u6295\u5F71\u3002",
      () => {
      }
    );
  }
  // ── Sections ──
  registerSections() {
    this.nav.section("main", "\u5168\u606F\u6295\u5F71", (p) => this.buildMain(p));
    this.nav.section("upload", "\u4E0A\u4F20\u6295\u5F71", (p) => this.buildUpload(p));
    this.nav.section("load", "\u52A0\u8F7D\u6295\u5F71", (p) => this.buildLoad(p));
    this.nav.section("operation", "\u64CD\u4F5C\u83DC\u5355", (p) => this.buildOperation(p));
    this.nav.section("materials", "\u7269\u54C1\u6E05\u5355", (p) => this.buildMaterials(p));
    this.nav.section("numInput", "\u6570\u503C", (p) => this.buildNumInput(p));
    this.nav.section("colorPicker", "\u989C\u8272\u9009\u62E9", (p) => this.buildColorPicker(p));
    this.nav.section("moveInput", "\u79FB\u52A8\u6295\u5F71", (p) => this.buildMoveInput(p));
    this.nav.section("layerMode", "\u5C42\u6A21\u5F0F", (p) => this.buildLayerMode(p));
  }
  buildMain(page) {
    page.label("\u9009\u62E9\u4E00\u4E2A\u64CD\u4F5C\uFF1A");
    page.button("\u{1F4E4} \u4E0A\u4F20\u6295\u5F71", () => {
      this.player.sendMessage(
        "\xA7a[HPBE] \u8BF7\u4F7F\u7528 \xA7e!hpbe pos1 \xA7a\u548C \xA7e!hpbe pos2 \xA7a\u8BBE\u7F6E\u9009\u533A\uFF0C\u7136\u540E\u4F7F\u7528 \xA7e!hpbe\xA7a \u6253\u5F00\u83DC\u5355\u9009\u62E9\u4E0A\u4F20"
      );
      this.nav.go("upload");
    });
    page.button("\u{1F4E5} \u52A0\u8F7D\u6295\u5F71", () => HoloCore.loadProjectionList(this.player));
  }
  buildUpload(page) {
    const name = obsStr("");
    const author = obsStr(this.player.name);
    const description = obsStr("");
    const visibilityIndex = obsNum(0);
    page.textField("\xA7a\u6295\u5F71\u540D\u79F0", name, { description: "\u8BF7\u8F93\u5165\u6295\u5F71\u540D\u79F0\u2026" });
    page.textField("\xA7a\u4F5C\u8005", author, { description: "\u4F5C\u8005\u540D" });
    page.textField("\xA77\u63CF\u8FF0\uFF08\u53EF\u9009\uFF09", description, { description: "\u8BF7\u8F93\u5165\u63CF\u8FF0\u2026" });
    page.dropdown("\xA7a\u53EF\u89C1\u6027", visibilityIndex, [
      { label: "\u516C\u5171", value: 0 },
      { label: "\u79C1\u4EBA", value: 1 }
    ]);
    page.button("\u786E\u8BA4\u4E0A\u4F20", () => {
      HoloCore.startUpload(this.player, {
        name: name.getData(),
        author: author.getData(),
        description: description.getData(),
        visibility: visibilityIndex.getData() === 0 ? "public" : "private"
      });
    });
  }
  buildLoad(page) {
    const privateList = this.nav.state.privateList;
    const publicList = this.nav.state.publicList;
    page.label(ListFormInfo([`\u6211\u7684\u6295\u5F71: ${privateList?.length ?? 0} | \u516C\u5171\u6295\u5F71: ${publicList?.length ?? 0}`]));
    for (const p of privateList ?? []) {
      page.button(`${p.name}`, () => {
        this.nav.confirm(
          "\u653E\u7F6E\u6295\u5F71",
          "\u662F\u5426\u5C06\u6295\u5F71\u653E\u7F6E\u5728\u5F53\u524D\u4F4D\u7F6E\uFF1F",
          () => HoloEntity.spawnProjection(this.player, p.id, this.player.location),
          () => this.nav.rebuild("load")
        );
      });
    }
    for (const p of publicList ?? []) {
      page.button(`${p.name}`, () => {
        this.nav.confirm(
          "\u653E\u7F6E\u6295\u5F71",
          "\u662F\u5426\u5C06\u6295\u5F71\u653E\u7F6E\u5728\u5F53\u524D\u4F4D\u7F6E\uFF1F",
          () => HoloEntity.spawnProjection(this.player, p.id, this.player.location),
          () => this.nav.rebuild("load")
        );
      });
    }
  }
  buildOperation(page) {
    const p = this.nav.state.projection;
    if (!p) {
      page.label("\u6295\u5F71\u6570\u636E\u4E22\u5931\u3002");
      return;
    }
    const s = p.settings;
    page.label(`\u64CD\u4F5C - ${p.name}`);
    page.button("\u{1F9F1} \u7269\u54C1\u6E05\u5355", () => HoloCore.executeOperation(this.player, p.id, "materials"));
    page.button(
      `\u{1F441} \u663E\u793A/\u9690\u85CF (\u5F53\u524D: ${s.visible ? "\u663E\u793A" : "\u9690\u85CF"})`,
      () => HoloCore.executeOperation(this.player, p.id, "toggle_visibility")
    );
    page.button(`\u{1F4D0} \u6BD4\u4F8B (\u5F53\u524D: ${s.scale})`, () => {
      this.nav.state.op = "set_scale";
      this.nav.state.defaultValue = s.scale;
      this.nav.state.min = 0.1;
      this.nav.state.max = 10;
      this.nav.go("numInput");
    });
    page.button(`\u{1F3A8} \u7EB9\u7406\u8F6E\u5ED3\u5BBD\u5EA6 (\u5F53\u524D: ${s.textureOutlineWidth})`, () => {
      this.nav.state.op = "set_texture_outline_width";
      this.nav.state.defaultValue = s.textureOutlineWidth;
      this.nav.state.min = 0;
      this.nav.state.max = 10;
      this.nav.go("numInput");
    });
    page.button(`\u{1F3A8} \u7EB9\u7406\u8F6E\u5ED3\u900F\u660E\u5EA6 (\u5F53\u524D: ${s.textureOutlineOpacity})`, () => {
      this.nav.state.op = "set_texture_outline_opacity";
      this.nav.state.defaultValue = s.textureOutlineOpacity;
      this.nav.state.min = 0;
      this.nav.state.max = 1;
      this.nav.go("numInput");
    });
    page.button("\u{1F3A8} \u7EB9\u7406\u8F6E\u5ED3\u989C\u8272", () => {
      this.nav.state.op = "set_texture_outline_color";
      this.nav.go("colorPicker");
    });
    page.button(`\u{1F308} \u53E0\u52A0\u67D3\u8272\u900F\u660E\u5EA6 (\u5F53\u524D: ${s.overlayTintOpacity})`, () => {
      this.nav.state.op = "set_overlay_tint_opacity";
      this.nav.state.defaultValue = s.overlayTintOpacity;
      this.nav.state.min = 0;
      this.nav.state.max = 1;
      this.nav.go("numInput");
    });
    page.button("\u{1F308} \u53E0\u52A0\u67D3\u8272", () => {
      this.nav.state.op = "set_overlay_tint";
      this.nav.go("colorPicker");
    });
    page.button(
      `\u25B6 \u751F\u6210\u52A8\u753B (\u5F53\u524D: ${s.spawnAnimation ? "\u5F00" : "\u5173"})`,
      () => HoloCore.executeOperation(this.player, p.id, "toggle_spawn_animation")
    );
    page.button(`\u{1F506} \u900F\u660E\u5EA6 (\u5F53\u524D: ${s.opacity})`, () => {
      this.nav.state.op = "set_opacity";
      this.nav.state.defaultValue = s.opacity;
      this.nav.state.min = 0;
      this.nav.state.max = 1;
      this.nav.go("numInput");
    });
    page.button(`\u{1F4CA} \u5C42\u7EA7 (\u5F53\u524D: ${s.layer})`, () => {
      this.nav.state.op = "set_layer";
      this.nav.state.defaultValue = s.layer;
      this.nav.state.min = -64;
      this.nav.state.max = 320;
      this.nav.go("numInput");
    });
    page.button(`\u{1F4CF} \u79FB\u52A8`, () => this.nav.go("moveInput"));
    page.button(`\u{1F504} \u65CB\u8F6C (\u5F53\u524D: ${s.rotation}\xB0)`, () => {
      this.nav.state.op = "set_rotation";
      this.nav.state.defaultValue = s.rotation;
      this.nav.state.min = 0;
      this.nav.state.max = 360;
      this.nav.go("numInput");
    });
    page.button(
      `\u{1F50D} \u65B9\u5757\u68C0\u67E5 (\u5F53\u524D: ${s.blockInspect ? "\u5F00" : "\u5173"})`,
      () => HoloCore.executeOperation(this.player, p.id, "toggle_block_inspect")
    );
    page.button(
      `\u{1F3A8} \u53E0\u52A0\u67D3\u8272\u5F00\u5173 (\u5F53\u524D: ${s.overlayTint ? "\u5F00" : "\u5173"})`,
      () => HoloCore.executeOperation(this.player, p.id, "toggle_overlay_tint")
    );
    page.button(
      `\u{1F4CB} \u5C42\u6A21\u5F0F (\u5F53\u524D: ${s.layerMode === "all" ? "\u5168\u90E8" : s.layerMode === "single" ? "\u5355\u5C42" : "\u8303\u56F4"})`,
      () => this.nav.go("layerMode")
    );
    page.button("\u274C \u5220\u9664\u6295\u5F71", () => {
      this.nav.confirm(
        "\u5220\u9664\u6295\u5F71",
        "\u786E\u5B9A\u8981\u5220\u9664\u6B64\u6295\u5F71\u5417\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
        () => HoloCore.executeOperation(this.player, p.id, "delete"),
        () => this.nav.rebuild("main")
      );
    });
    page.button("\u{1F504} \u66F4\u6362\u6295\u5F71", () => HoloCore.loadProjectionList(this.player));
  }
  buildMaterials(page) {
    const materials = this.nav.state.materials;
    if (!materials) {
      page.label("\u65E0\u6570\u636E");
      return;
    }
    const sorted = [...materials].sort((a, b) => b.count - a.count);
    const maxDisplay = 50;
    const displayItems = sorted.slice(0, maxDisplay);
    page.label(`\u5171 \xA7e${sorted.length}\xA7r \u79CD\u6750\u6599`);
    for (const m of displayItems) page.label(`\xA77${m.count}\xA7r x ${m.name}`);
    if (sorted.length > maxDisplay) page.label(`\xA78... \u8FD8\u6709 ${sorted.length - maxDisplay} \u79CD\u6750\u6599`);
  }
  buildNumInput(page) {
    const val = obsNum(this.nav.state.defaultValue ?? 0);
    page.slider("\u6570\u503C", val, this.nav.state.min ?? 0, this.nav.state.max ?? 100, { step: 1 });
    page.button("\u786E\u8BA4", () => {
      HoloCore.executeOperation(
        this.player,
        this.nav.state.projection?.id,
        this.nav.state.op,
        val.getData()
      );
      this.nav.rebuild("operation");
    });
  }
  buildColorPicker(page) {
    page.label("\u9009\u62E9\u4E00\u4E2A\u989C\u8272\u9884\u8BBE\uFF1A");
    for (const preset of COLOR_PRESETS) {
      page.button(`\xA7l${preset.name}\xA7r  ${preset.hex}`, () => {
        HoloCore.executeOperation(
          this.player,
          this.nav.state.projection?.id,
          this.nav.state.op,
          preset.value
        );
        this.nav.rebuild("operation");
      });
    }
  }
  buildMoveInput(page) {
    const p = this.nav.state.projection;
    if (!p) {
      page.label("\u6570\u636E\u4E22\u5931");
      return;
    }
    const s = p.settings;
    const offsetX = obsNum(s.offsetX);
    const offsetY = obsNum(s.offsetY);
    const offsetZ = obsNum(s.offsetZ);
    page.slider("X \u504F\u79FB", offsetX, -64, 64);
    page.slider("Y \u504F\u79FB", offsetY, -64, 64);
    page.slider("Z \u504F\u79FB", offsetZ, -64, 64);
    page.button("\u786E\u8BA4", () => {
      const x = offsetX.getData(), y = offsetY.getData(), z = offsetZ.getData();
      if (x !== s.offsetX || y !== s.offsetY || z !== s.offsetZ)
        HoloCore.executeOperation(this.player, p.id, "move", { x, y, z });
      this.nav.rebuild("operation");
    });
  }
  buildLayerMode(page) {
    const p = this.nav.state.projection;
    const index = obsNum(0);
    page.dropdown("\u9009\u62E9\u5C42\u6A21\u5F0F", index, [
      { label: "\u5168\u90E8", value: 0 },
      { label: "\u5355\u5C42", value: 1 },
      { label: "\u8303\u56F4", value: 2 }
    ]);
    page.button("\u786E\u8BA4", () => {
      const mode = index.getData() === 0 ? "all" : index.getData() === 1 ? "single" : "range";
      HoloCore.executeOperation(this.player, p?.id, "set_layer_mode", mode);
      this.nav.rebuild("operation");
    });
  }
};

// scripts/doge/ChatSoundsHelper.ts
import { system as system22, world as world27 } from "@minecraft/server";
var KEYWORDS = {
  ciallo: "cs.ciallo",
  \u5495\u5495\u560E\u560E: "cs.gugugaga",
  \u6C69\u6C69\u5495: "cs.gugugu",
  baka: "cs.baka",
  yee: "cs.yee",
  \u5E72\u561B: "mob.chicken.hurt",
  huh: "cs.huh"
};
var ChatSoundsHelper = class _ChatSoundsHelper {
  constructor(keywords) {
    this.cooldownTicks = 200;
    this.cooldownMap = {};
    this.keywords = keywords;
  }
  static getInstance() {
    if (!_ChatSoundsHelper.instance) {
      _ChatSoundsHelper.instance = new _ChatSoundsHelper(KEYWORDS);
    }
    return _ChatSoundsHelper.instance;
  }
  registerEvent() {
    world27.beforeEvents.chatSend.subscribe((event) => {
      const msg = event.message;
      for (const keyWord in this.keywords) {
        if (!msg.toLowerCase().includes(keyWord.toLowerCase())) continue;
        const sender = event.sender;
        if (sender.getGameMode() !== "Creative") {
          const id = sender.id;
          if (this.cooldownMap[id]) return;
          this.cooldownMap[id] = true;
          system22.runTimeout(() => {
            delete this.cooldownMap[id];
          }, this.cooldownTicks);
        }
        const soundId = this.keywords[keyWord];
        system22.run(() => {
          for (const p of world27.getAllPlayers()) {
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
};

// scripts/doge/MonitorReporter.ts
import { world as world28, system as system23 } from "@minecraft/server";
var REPORT_INTERVAL = 600;
var DIMENSIONS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
var MonitorReporter = class {
  static init() {
    system23.runInterval(() => {
      this.report();
    }, REPORT_INTERVAL);
  }
  static async report() {
    try {
      const tps = TPS.getTPS();
      const entities = {};
      for (const dim of DIMENSIONS) {
        try {
          entities[dim] = world28.getDimension(dim).getEntities().length;
        } catch (e) {
          entities[dim] = 0;
        }
      }
      await HttpDB.post("/api/sfmc/monitor/metrics", { tps, entities });
      const players = world28.getAllPlayers();
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

// scripts/entry.ts
var AddOnInit = class {
  static init() {
    this.registerEvents();
    this.createTasks();
  }
  static registerEvents() {
    system24.beforeEvents.startup.subscribe(async (e) => {
      system24.run(async () => {
        await ConfigManager.init();
        ConfigManager.startPolling();
        ConfigManager.startFastPoll();
        Permission.register("permlist.see", Permission.Member);
        Permission.register("help.see", Permission.Member);
        Permission.register("menu.use", Permission.Member);
        Permission.register("shop.use", Permission.Member);
        Permission.register("money.admin", Permission.OP);
        Permission.register("holorint.menu", Permission.Member);
        Permission.register("holorint.pos1", Permission.Member);
        Permission.register("holorint.pos2", Permission.Member);
        Permission.register("afk.use", Permission.Member);
        Permission.register("afk.clear.other", Permission.OP);
        CoopSystem.registerPermissions();
        Permission.register("chat.use", Permission.Member);
        Permission.register("chat.admin", Permission.OP);
        Permission.register("tps.see", Permission.Any);
        if (ConfigManager.isEnabled("fly")) init();
        if (ConfigManager.isEnabled("online_time")) OnlineTime.getInstance().registerCommandsAndPermissions();
        if (ConfigManager.isEnabled("creative")) CreativeArea.getInstance().registerCommandsAndPermissions();
        if (ConfigManager.isEnabled("survival")) SurvivalArea.getInstance().registerCommandsAndPermissions();
        if (ConfigManager.isEnabled("land")) LandSystem.registerCommandsAndPermissions();
        Permission.registerPermlistCommand();
        Command.registerHelpCommand();
        MainMenu.registerMenuCommand();
        if (ConfigManager.isEnabled("money")) MoneyGUI.registerCommand();
        if (ConfigManager.isEnabled("shop")) ShopSystem.registerCommand();
        if (ConfigManager.isEnabled("holoprint")) HoloGUI.registerCommand();
        if (ConfigManager.isEnabled("afk")) registerCommand();
        if (ConfigManager.isEnabled("coop")) CoopSystem.registerCommands();
        if (ConfigManager.isEnabled("chat")) ChatSystem.registerCommands();
        if (ConfigManager.isEnabled("tps")) TPS.registerCommands();
        if (ConfigManager.isEnabled("clean")) registerCommand2();
        Command.register("admin", "chat.admin", (player) => {
          if (player) AdminGUI.show(player);
        }, "\u7BA1\u7406\u9762\u677F");
      });
    });
    world29.afterEvents.worldLoad.subscribe(() => {
      if (ConfigManager.isEnabled("afk")) init2();
      if (ConfigManager.isEnabled("coop")) CoopSystem.init();
      if (ConfigManager.isEnabled("chat")) ChatSystem.init();
      if (ConfigManager.isEnabled("clean")) Clean.getInstance().init();
      if (ConfigManager.isEnabled("tps")) TPS.init();
      MonitorReporter.init();
      if (ConfigManager.isEnabled("online_time")) OnlineTime.getInstance().init();
      if (ConfigManager.isEnabled("creative")) CreativeArea.getInstance().init();
      if (ConfigManager.isEnabled("survival")) SurvivalArea.getInstance().init();
      if (ConfigManager.isEnabled("inventory_switcher")) InventorySwitcher.getInstance().init();
      if (ConfigManager.isEnabled("land")) LandSystem.init();
      if (ConfigManager.isEnabled("activity_log")) ActivityLog.init();
      Money.initScoreboard();
      ScoreboardSync.init();
      syncWorldData();
      HoloEntity.init();
      if (ConfigManager.isEnabled("chat_sounds")) ChatSoundsHelper.getInstance().registerEvent();
    });
    if (ConfigManager.isEnabled("online_time")) OnlineTime.getInstance().registerEvents();
    if (ConfigManager.isEnabled("creative")) CreativeArea.getInstance().registerEvents();
    if (ConfigManager.isEnabled("survival")) SurvivalArea.getInstance().registerEvents();
    if (ConfigManager.isEnabled("inventory_switcher")) InventorySwitcher.getInstance().registerEvents();
    if (ConfigManager.isEnabled("land")) LandEvents.registerEvents();
    if (ConfigManager.isEnabled("activity_log")) ActivityLog.registerEvents();
    if (ConfigManager.isEnabled("holoprint")) HoloEntity.registerEvents();
    if (ConfigManager.isEnabled("chat")) ChatSystem.registerEvents();
    world29.afterEvents.playerSpawn.subscribe((event) => {
      if (event.initialSpawn) {
        if (ConfigManager.isEnabled("peace")) Peace.getInstance().init();
        if (ConfigManager.isEnabled("fly")) playerJoinEvent(event.player);
        if (ConfigManager.isEnabled("afk")) reset(event.player);
        getPlayerData(event.player).then((data) => {
          savePlayers([data]).catch(() => {
          });
        });
      }
    });
    world29.afterEvents.playerLeave.subscribe((event) => {
      const player = world29.getEntity(event.playerId);
      if (player) {
        getPlayerData(player).then((data) => {
          savePlayers([data]).catch(() => {
          });
        });
        if (ConfigManager.isEnabled("online_time")) OnlineTime.getInstance().onPlayerLeave(player);
      }
    });
    world29.afterEvents.playerSpawn.subscribe((ev) => {
      if (ConfigManager.isEnabled("spawn_protect")) SpawnProtect.setProtect(ev.player);
    });
    world29.beforeEvents.chatSend.subscribe((event) => {
      let firstChar = event.message.substring(0, 1);
      if (firstChar === "!" || firstChar === "\uFF01") {
        Command.trigger(event.sender, event.message.substring(1));
        event.cancel = true;
      }
    });
    system24.beforeEvents.shutdown.subscribe(() => {
      syncWorldData();
      ScoreboardsBackup();
    });
  }
  static createTasks() {
    if (ConfigManager.isEnabled("qa")) QAManager.getInstance().start();
  }
};

// scripts/main.ts
AddOnInit.init();

//# sourceMappingURL=../debug/main.js.map
