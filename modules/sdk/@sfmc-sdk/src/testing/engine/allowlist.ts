/**
 * 假引擎 allowlist：清单外属性访问抛错，避免安静 noop 假绿。
 */

export const SERVER_ALLOWLIST = {
  top: new Set([
    "world",
    "system",
    "Player",
    "PlayerPermissionLevel",
    "GameMode",
    "ItemStack",
    "Entity",
    "BlockComponentTypes",
    "BlockPermutation",
    "Dimension",
    "EntityInventoryComponent",
    "EntityInitializationCause",
    "ChatSendBeforeEvent",
    "PlayerSpawnAfterEvent",
    "PlayerJoinAfterEvent",
    "EntitySpawnAfterEvent",
  ]),
  system: new Set([
    "afterEvents",
    "beforeEvents",
    "run",
    "runTimeout",
    "runInterval",
    "clearRun",
    "waitTicks",
    "currentTick",
  ]),
  world: new Set([
    "afterEvents",
    "beforeEvents",
    "getDimension",
    "getPlayers",
    "getAllPlayers",
    "scoreboard",
  ]),
  dimension: new Set([
    "id",
    "localizationKey",
    "heightRange",
    "getBlock",
    "setBlockPermutation",
    "setBlockType",
    "getEntities",
    "getPlayers",
    "spawnEntity",
  ]),
  block: new Set([
    "dimension",
    "x",
    "y",
    "z",
    "location",
    "isValid",
    "isAir",
    "isLiquid",
    "isWaterlogged",
    "typeId",
    "type",
    "permutation",
    "setPermutation",
    "setType",
  ]),
  entity: new Set([
    "id",
    "typeId",
    "location",
    "dimension",
    "nameTag",
    "isValid",
    "isOnGround",
    "isSneaking",
    "scoreboardIdentity",
    "remove",
    "kill",
    "teleport",
    "getComponent",
    "hasComponent",
    "getComponents",
    "getTags",
    "addTag",
    "removeTag",
    "hasTag",
    "getRotation",
    "getHeadLocation",
    "getVelocity",
  ]),
  container: new Set([
    "size",
    "isValid",
    "emptySlotsCount",
    "weight",
    "getItem",
    "setItem",
    "addItem",
    "clearAll",
    "transferItem",
    "swapItems",
    "moveItem",
  ]),
} as const;

export const SERVER_UI_ALLOWLIST = new Set([
  "ActionFormData",
  "MessageFormData",
  "ModalFormData",
  "CustomForm",
  "MessageBox",
  "FormCancelationReason",
  "DataDrivenScreenClosedReason",
  "ObservableBoolean",
  "ObservableNumber",
  "ObservableString",
  "ObservableUIRawMessage",
  "uiManager",
]);

export class UnimplementedMinecraftApiError extends Error {
  constructor(apiPath: string) {
    super(
      `sfmc-testing: 未实现的 Minecraft API「${apiPath}」。` +
        `仅 allowlist 内 API 有语义；请缩小用例或扩展沙箱清单。`
    );
    this.name = "UnimplementedMinecraftApiError";
  }
}

/** 对对象做 allowlist 代理：访问未列出的自有键以外的未知属性时抛错。 */
export function guardAllowlist<T extends object>(target: T, allowed: Set<string>, path: string): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (typeof prop === "symbol") return Reflect.get(obj, prop, receiver);
      if (prop === "then") return undefined; /* 避免被当成 Thenable */
      if (allowed.has(prop) || prop in obj) return Reflect.get(obj, prop, receiver);
      throw new UnimplementedMinecraftApiError(`${path}.${prop}`);
    },
  });
}
