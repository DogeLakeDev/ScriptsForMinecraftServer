import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPlaygroundMeta,
  extractClassBody,
  parseClassMembers,
  listHubSignals,
  resolveEventType,
  listHubSignalEntries,
  resolveClassMembers,
  extractExtends,
} from "./gen-playground-meta.mjs";

const SAMPLE = `
export class ItemStack {
  amount: number;
  readonly typeId: string;
  clone(): ItemStack;
  setLore(loreList: string[]): void;
}
export class PlayerJoinAfterEvent {
  readonly playerId: string;
  readonly playerName: string;
}
export class PlayerJoinAfterEventSignal {
  private constructor();
  subscribe(callback: (arg0: PlayerJoinAfterEvent) => void): (arg0: PlayerJoinAfterEvent) => void;
}
export class ChatSendBeforeEvent {
  cancel: boolean;
  readonly message: string;
  readonly sender: Player;
}
export class ChatSendBeforeEventSignal {
  subscribe(callback: (arg0: ChatSendBeforeEvent) => void): (arg0: ChatSendBeforeEvent) => void;
}
export class WorldAfterEvents {
  readonly playerJoin: PlayerJoinAfterEventSignal;
  readonly worldLoad: WorldLoadAfterEventSignal;
}
export class WorldBeforeEvents {
  readonly chatSend: ChatSendBeforeEventSignal;
}
export class SystemBeforeEvents {
  readonly startup: StartupBeforeEventSignal;
  readonly shutdown: ShutdownBeforeEventSignal;
}
export class WorldLoadAfterEventSignal {
  subscribe(callback: (arg0: WorldLoadAfterEvent) => void): (arg0: WorldLoadAfterEvent) => void;
}
export class WorldLoadAfterEvent {}
export class StartupBeforeEventSignal {
  subscribe(callback: (arg0: StartupBeforeEvent) => void): (arg0: StartupBeforeEvent) => void;
}
export class StartupBeforeEvent {}
export class ShutdownBeforeEventSignal {
  subscribe(callback: (arg0: ShutdownBeforeEvent) => void): (arg0: ShutdownBeforeEvent) => void;
}
export class ShutdownBeforeEvent {}
`;

test("parseClassMembers 区分 readonly / method / parameters", () => {
  const body = extractClassBody(SAMPLE, "ItemStack");
  assert.ok(body);
  const { properties, methods } = parseClassMembers(body);
  assert.equal(properties.find((p) => p.name === "amount")?.readonly, false);
  assert.equal(properties.find((p) => p.name === "typeId")?.readonly, true);
  assert.ok(methods.some((m) => m.name === "clone"));
  const setLore = methods.find((m) => m.name === "setLore");
  assert.ok(setLore);
  assert.equal(setLore.parameters.length, 1);
  assert.equal(setLore.parameters[0].name, "loreList");
  assert.equal(setLore.parameters[0].type, "string[]");
});

test("resolveClassMembers 合并 Player extends Entity", () => {
  const src = `
export class Entity {
  readonly id: string;
  nameTag: string;
  teleport(location: Vector3): void;
  addTag(tag: string): boolean;
}
export class Player extends Entity {
  readonly name: string;
  sendMessage(message: string): void;
}
`;
  assert.equal(extractExtends(src, "Player"), "Entity");
  const members = resolveClassMembers(src, "Player");
  assert.ok(members.properties.some((p) => p.name === "id"));
  assert.ok(members.properties.some((p) => p.name === "nameTag"));
  assert.ok(members.properties.some((p) => p.name === "name"));
  assert.ok(members.methods.some((m) => m.name === "teleport"));
  assert.ok(members.methods.some((m) => m.name === "addTag"));
  assert.ok(members.methods.some((m) => m.name === "sendMessage"));
  const teleport = members.methods.find((m) => m.name === "teleport");
  assert.equal(teleport?.parameters[0]?.name, "location");
});

test("parseClassMembers 泛型方法不误解析形参为属性", () => {
  const src = `
export class Entity {
  nameTag: string;
  getComponent<T extends string>(componentId: T): T | undefined;
  hasComponent(componentId: string): boolean;
}
`;
  const body = extractClassBody(src, "Entity");
  assert.ok(body);
  const { properties, methods } = parseClassMembers(body);
  assert.equal(properties.some((p) => p.name === "componentId"), false);
  assert.ok(methods.some((m) => m.name === "getComponent"));
  const gc = methods.find((m) => m.name === "getComponent");
  assert.equal(gc?.parameters[0]?.name, "componentId");
});

test("resolveEventType 从 Signal.subscribe 解析", () => {
  assert.equal(resolveEventType(SAMPLE, "PlayerJoinAfterEventSignal"), "PlayerJoinAfterEvent");
  assert.equal(resolveEventType(SAMPLE, "ChatSendBeforeEventSignal"), "ChatSendBeforeEvent");
});

test("buildPlaygroundMeta 含 Event 类与 eventTypes", () => {
  const meta = buildPlaygroundMeta(SAMPLE);
  assert.ok(meta.classes.ItemStack);
  assert.equal(meta.classes.PlayerJoinAfterEvent?.kind, "event");
  assert.ok(meta.classes.PlayerJoinAfterEvent.properties.some((p) => p.name === "playerName"));
  assert.deepEqual(meta.events["world.afterEvents"], ["playerJoin", "worldLoad"]);
  assert.equal(
    meta.eventTypes["world.afterEvents.playerJoin"].eventType,
    "PlayerJoinAfterEvent"
  );
  assert.equal(meta.eventTypes["world.beforeEvents.chatSend"].eventType, "ChatSendBeforeEvent");
  assert.ok(meta.events["system.beforeEvents"].includes("startup"));
});

test("listHubSignals / listHubSignalEntries", () => {
  const sigs = listHubSignals(SAMPLE, "WorldAfterEvents");
  assert.deepEqual(sigs, ["playerJoin", "worldLoad"]);
  const entries = listHubSignalEntries(SAMPLE, "WorldAfterEvents");
  assert.equal(entries[0].signalType, "PlayerJoinAfterEventSignal");
});

test("annotateImpl：overrides 自有方法标 l2，其余 l0；Entity 合并到 Player", async () => {
  const { annotateImpl, extractOwnMemberNames, extractTypeAliasBody } = await import(
    "./gen-playground-meta.mjs"
  );
  const playerSrc = `
export type FakePlayer = {
  name: string;
  sendMessage(text: string): void;
  getGameMode(): string;
};
`;
  const entitySrc = `
export type FakeEntity = {
  applyDamage(amount: number): boolean;
  runCommand(commandString: string): { successCount: number };
};
`;
  const playerBody = extractTypeAliasBody(playerSrc, "FakePlayer");
  const entityBody = extractTypeAliasBody(entitySrc, "FakeEntity");
  assert.ok(playerBody);
  assert.ok(entityBody);
  const surface = {
    Player: extractOwnMemberNames(playerBody),
    Entity: extractOwnMemberNames(entityBody),
  };
  for (const n of surface.Entity) surface.Player.add(n);
  const meta = {
    classes: {
      Player: {
        kind: "object",
        properties: [{ name: "name", readonly: true, type: "string" }],
        methods: [
          { name: "sendMessage", parameters: [] },
          { name: "getGameMode", parameters: [] },
          { name: "applyDamage", parameters: [] },
          { name: "applyImpulse", parameters: [] },
        ],
      },
      Entity: {
        kind: "object",
        properties: [],
        methods: [
          { name: "applyDamage", parameters: [] },
          { name: "applyImpulse", parameters: [] },
        ],
      },
    },
    events: {},
    eventTypes: {},
  };
  annotateImpl(meta, surface);
  assert.equal(meta.classes.Player.properties[0].impl, "l2");
  assert.equal(meta.classes.Player.methods.find((m) => m.name === "sendMessage")?.impl, "l2");
  assert.equal(meta.classes.Player.methods.find((m) => m.name === "getGameMode")?.impl, "l2");
  assert.equal(meta.classes.Player.methods.find((m) => m.name === "applyDamage")?.impl, "l2");
  assert.equal(meta.classes.Player.methods.find((m) => m.name === "applyImpulse")?.impl, "l0");
  assert.equal(meta.classes.Entity.methods.find((m) => m.name === "applyDamage")?.impl, "l2");
});
